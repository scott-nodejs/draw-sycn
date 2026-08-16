package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.net.URI;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

@Component
public class MineruClient implements OcrProvider {
  private final RestTemplate http;
  private final ObjectMapper json;
  private final String apiKey;
  private final String baseUrl;

  public MineruClient(RestTemplateBuilder builder, ObjectMapper json,
      @Value("${MINERU_API_KEY:}") String apiKey,
      @Value("${MINERU_API_BASE_URL:https://mineru.net/api/v4}") String baseUrl) {
    this.http = builder.setConnectTimeout(java.time.Duration.ofSeconds(20)).setReadTimeout(java.time.Duration.ofSeconds(60)).build();
    this.json = json; this.apiKey = apiKey; this.baseUrl = baseUrl.replaceAll("/$", "");
  }

  public String submit(List<Path> sourceFiles, String paperId) throws Exception {
    requireConfigured();
    List<Map<String, Object>> files = new ArrayList<>();
    for (int i = 0; i < sourceFiles.size(); i++) {
      Map<String, Object> item = new LinkedHashMap<>(); item.put("name", sourceFiles.get(i).getFileName().toString()); item.put("data_id", paperId + "_" + (i + 1)); files.add(item);
    }
    Map<String, Object> body = new LinkedHashMap<>(); body.put("files", files); body.put("model_version", "vlm"); body.put("language", "ch"); body.put("enable_formula", true); body.put("enable_table", true);
    JsonNode response = exchange(baseUrl + "/file-urls/batch", HttpMethod.POST, body);
    assertSuccess(response, "MINERU_SUBMIT_FAILED");
    String batchId = response.path("data").path("batch_id").asText();
    JsonNode urls = response.path("data").path("file_urls");
    if (batchId.isEmpty() || !urls.isArray() || urls.size() != sourceFiles.size()) throw new ProviderException("MINERU_INVALID_RESPONSE", "MinerU 未返回完整上传地址");
    for (int i = 0; i < sourceFiles.size(); i++) {
      Path source = sourceFiles.get(i);
      HttpStatus uploadStatus;
      try {
        // MinerU signs these OSS URLs without Content-Type. Writing directly to
        // the request body avoids HttpMessageConverter adding that header.
        uploadStatus = http.execute(URI.create(urls.get(i).asText()), HttpMethod.PUT,
          request -> Files.copy(source, request.getBody()), clientResponse -> clientResponse.getStatusCode());
      } catch (RestClientResponseException error) {
        // Avoid leaking the signed URL, signature, and access-key details into logs.
        throw new ProviderException("MINERU_UPLOAD_FAILED", "MinerU upload rejected (HTTP " + error.getRawStatusCode() + ")");
      }
      ResponseEntity<Void> uploaded = new ResponseEntity<Void>(uploadStatus);
      if (!uploaded.getStatusCode().is2xxSuccessful()) throw new ProviderException("MINERU_UPLOAD_FAILED", "上传解析源文件失败");
    }
    return batchId;
  }

  @Override public String name() { return "mineru"; }

  public OcrProvider.PollResult poll(String batchId) throws Exception {
    JsonNode response = exchange(baseUrl + "/extract-results/batch/" + batchId, HttpMethod.GET, null);
    assertSuccess(response, "MINERU_POLL_FAILED");
    JsonNode results = response.path("data").path("extract_result");
    if (!results.isArray()) results = response.path("data").path("extract_results");
    if (!results.isArray()) throw new ProviderException("MINERU_INVALID_RESPONSE", "MinerU 未返回任务列表");
    List<String> zipUrls = new ArrayList<>(); boolean running = false;
    for (JsonNode item : results) {
      String state = item.path("state").asText();
      if ("failed".equals(state)) throw new ProviderException("MINERU_EXTRACT_FAILED", item.path("err_msg").asText("MinerU 解析失败"));
      if ("done".equals(state)) zipUrls.add(item.path("full_zip_url").asText()); else running = true;
    }
    return new OcrProvider.PollResult(!running && !zipUrls.isEmpty(), response, zipUrls);
  }

  public byte[] download(String url) { return http.getForObject(URI.create(url), byte[].class); }

  public String downloadMarkdown(OcrProvider.PollResult result) throws Exception {
    StringBuilder markdown = new StringBuilder();
    for (String url : result.resultUrls) {
      byte[] archive = download(url);
      try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(archive))) {
        ZipEntry entry; byte[] buffer = new byte[8192];
        while ((entry = input.getNextEntry()) != null) {
          if (entry.isDirectory() || !entry.getName().endsWith(".md")) continue;
          ByteArrayOutputStream output = new ByteArrayOutputStream(); int read;
          while ((read = input.read(buffer)) > 0) output.write(buffer, 0, read);
          markdown.append(new String(output.toByteArray(), StandardCharsets.UTF_8)).append('\n');
        }
      }
    }
    if (markdown.toString().trim().isEmpty()) throw new ProviderException("MINERU_EMPTY_RESULT", "MinerU result contains no Markdown");
    return markdown.toString();
  }

  public OcrProvider.QuestionArtifacts downloadQuestionArtifacts(OcrProvider.PollResult result, Path outputDirectory) throws Exception {
    Files.createDirectories(outputDirectory);
    StringBuilder markdown = new StringBuilder(); List<Path> figures = new ArrayList<>(); int imageIndex = 0;
    for (String url : result.resultUrls) {
      byte[] archive = download(url);
      try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(archive))) {
        ZipEntry entry; byte[] buffer = new byte[8192];
        while ((entry = input.getNextEntry()) != null) {
          if (entry.isDirectory()) continue;
          ByteArrayOutputStream output = new ByteArrayOutputStream(); int read;
          while ((read = input.read(buffer)) > 0) output.write(buffer, 0, read);
          String lower = entry.getName().toLowerCase();
          if (lower.endsWith(".md")) markdown.append(new String(output.toByteArray(), StandardCharsets.UTF_8)).append('\n');
          if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(output.toByteArray()));
            if (image != null) { Path figure = outputDirectory.resolve(String.format("figure-%02d.png", ++imageIndex)); ImageIO.write(image, "png", figure.toFile()); figures.add(figure); }
          }
        }
      }
    }
    if (markdown.toString().trim().isEmpty()) throw new ProviderException("MINERU_EMPTY_RESULT", "MinerU result contains no Markdown");
    return new OcrProvider.QuestionArtifacts(markdown.toString(), figures);
  }

  @Override
  public OcrProvider.DocumentArtifacts downloadDocumentArtifacts(OcrProvider.PollResult result, Path outputDirectory) throws Exception {
    Files.createDirectories(outputDirectory); StringBuilder markdown = new StringBuilder(); ArrayNode layout = json.createArrayNode(); int archiveIndex = 0;
    for (String url : result.resultUrls) {
      Path archiveDirectory = outputDirectory.resolve(String.valueOf(++archiveIndex)); Files.createDirectories(archiveDirectory);
      try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(download(url)))) {
        ZipEntry entry; byte[] buffer = new byte[8192];
        while ((entry = input.getNextEntry()) != null) {
          if (entry.isDirectory()) continue;
          ByteArrayOutputStream output = new ByteArrayOutputStream(); int read; while ((read = input.read(buffer)) > 0) output.write(buffer, 0, read);
          String lower = entry.getName().toLowerCase();
          if (lower.endsWith("full.md") || lower.endsWith(".md")) markdown.append(new String(output.toByteArray(), StandardCharsets.UTF_8)).append('\n');
          if (lower.endsWith("content_list.json")) { JsonNode parsed = json.readTree(output.toByteArray()); if (parsed.isArray()) layout.addAll((ArrayNode) parsed); }
          if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) Files.write(archiveDirectory.resolve(java.util.UUID.randomUUID().toString().replace("-", "") + lower.substring(lower.lastIndexOf('.'))), output.toByteArray());
        }
      }
    }
    if (markdown.toString().trim().isEmpty()) throw new ProviderException("MINERU_EMPTY_RESULT", "MinerU result contains no Markdown");
    return new OcrProvider.DocumentArtifacts(markdown.toString(), layout);
  }

  private JsonNode exchange(String url, HttpMethod method, Object body) throws Exception {
    HttpHeaders headers = new HttpHeaders(); headers.setBearerAuth(apiKey); headers.setAccept(java.util.Collections.singletonList(MediaType.APPLICATION_JSON));
    if (body != null) headers.setContentType(MediaType.APPLICATION_JSON);
    ResponseEntity<String> response = http.exchange(url, method, new HttpEntity<Object>(body, headers), String.class);
    return json.readTree(response.getBody());
  }
  private void assertSuccess(JsonNode response, String code) { if (response.path("code").asInt(-1) != 0) throw new ProviderException(code, response.path("msg").asText("MinerU 请求失败")); }
  private void requireConfigured() { if (apiKey.trim().isEmpty()) throw new ProviderException("MINERU_NOT_CONFIGURED", "未配置 MINERU_API_KEY"); }

}
