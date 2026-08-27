package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.graphics.image.LosslessFactory;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;

@Component
public class PaddleOcrProvider implements OcrProvider {
  private final RestTemplate http;
  private final ObjectMapper json;
  private final String token;
  private final String jobUrl;
  private final String model;

  public PaddleOcrProvider(RestTemplateBuilder builder, ObjectMapper json,
      @Value("${PADDLEOCR_API_TOKEN:}") String token,
      @Value("${PADDLEOCR_JOB_URL:https://paddleocr.aistudio-app.com/api/v2/ocr/jobs}") String jobUrl,
      @Value("${PADDLEOCR_MODEL:PaddleOCR-VL-1.6}") String model) {
    this.http = builder.setConnectTimeout(java.time.Duration.ofSeconds(20)).setReadTimeout(java.time.Duration.ofSeconds(90)).build();
    this.json = json; this.token = token; this.jobUrl = jobUrl.replaceAll("/$", ""); this.model = model;
  }

  @Override public String name() { return "paddleocr"; }

  @Override
  public String submit(List<Path> sourceFiles, String dataId) throws Exception {
    requireConfigured(); if (sourceFiles.isEmpty()) throw new ProviderException("PADDLEOCR_SOURCE_MISSING", "没有可识别的文件");
    Path merged = null;
    List<Path> submittedFiles = sourceFiles;
    if (sourceFiles.size() > 1) { merged = mergeImages(sourceFiles); submittedFiles = Collections.singletonList(merged); }
    List<String> jobIds = new ArrayList<>();
    try { for (Path source : submittedFiles) {
      Map<String, Object> options = new LinkedHashMap<>(); options.put("useDocOrientationClassify", false); options.put("useDocUnwarping", false); options.put("useChartRecognition", false);
      JsonNode response;
      try { response = submitMultipart(source, json.writeValueAsString(options)); }
      catch (ProviderException error) { throw error; }
      catch (Exception error) { throw new ProviderException("PADDLEOCR_SUBMIT_FAILED", "PaddleOCR submit failed: " + error.getClass().getSimpleName()); }
      int businessCode=response.path("code").asInt(0);String businessMessage=response.path("msg").asText(response.path("message").asText());
      if(businessCode==10010)throw new ProviderException("PADDLEOCR_QUEUE_FULL","PaddleOCR 提交队列已满，系统稍后自动重试");
      if(businessCode!=0&&!response.path("data").hasNonNull("jobId"))throw new ProviderException("PADDLEOCR_SUBMIT_REJECTED",businessMessage.isEmpty()?"PaddleOCR 拒绝了任务提交":businessMessage);
      String jobId = response.path("data").path("jobId").asText(); if (jobId.isEmpty()) throw new ProviderException("PADDLEOCR_INVALID_RESPONSE", "PaddleOCR 未返回 jobId"); jobIds.add(jobId);
    } } finally { if (merged != null) Files.deleteIfExists(merged); }
    return String.join(",", jobIds);
  }

  private Path mergeImages(List<Path> images) throws Exception {
    Path output = Files.createTempFile("paddleocr-paper-", ".pdf");
    try (PDDocument document = new PDDocument()) {
      for (Path path : images) {
        BufferedImage image = ImageIO.read(path.toFile()); if (image == null) throw new ProviderException("PADDLEOCR_SOURCE_INVALID", "无法读取试卷图片: " + path.getFileName());
        PDPage page = new PDPage(new PDRectangle(image.getWidth(), image.getHeight())); document.addPage(page);
        PDImageXObject object = LosslessFactory.createFromImage(document, image);
        try (PDPageContentStream content = new PDPageContentStream(document, page)) { content.drawImage(object, 0, 0, image.getWidth(), image.getHeight()); }
      }
      document.save(output.toFile()); return output;
    } catch (Exception error) { Files.deleteIfExists(output); throw error; }
  }

  @Override
  public PollResult poll(String requestId) throws Exception {
    ArrayNode raw = json.createArrayNode(); List<String> resultUrls = new ArrayList<>(); boolean done = true;
    for (String jobId : requestId.split(",")) {
      JsonNode response;
      try { response = authorizedGet(jobUrl + "/" + jobId); }
      catch (ProviderException error) { throw error; }
      catch (Exception error) { throw new ProviderException("PADDLEOCR_POLL_FAILED", "PaddleOCR poll failed: " + error.getClass().getSimpleName()); }
      raw.add(response); JsonNode data = response.path("data"); String state = data.path("state").asText();
      if ("failed".equalsIgnoreCase(state)) throw new ProviderException("PADDLEOCR_EXTRACT_FAILED", data.path("errorMsg").asText("PaddleOCR 解析失败"));
      if ("done".equalsIgnoreCase(state)) { String url = data.path("resultUrl").path("jsonUrl").asText(); if (url.isEmpty()) throw new ProviderException("PADDLEOCR_INVALID_RESPONSE", "PaddleOCR 未返回 JSONL 地址"); resultUrls.add(url); }
      else done = false;
    }
    return new PollResult(done, raw, resultUrls);
  }

  @Override
  public DocumentArtifacts downloadDocumentArtifacts(PollResult result, Path outputDirectory) throws Exception {
    ParsedArtifacts parsed = downloadAndParse(result, outputDirectory, true); return new DocumentArtifacts(parsed.markdown, parsed.layout);
  }

  @Override
  public QuestionArtifacts downloadQuestionArtifacts(PollResult result, Path outputDirectory) throws Exception {
    ParsedArtifacts parsed = downloadAndParse(result, outputDirectory, false); return new QuestionArtifacts(parsed.markdown, parsed.figures);
  }

  private ParsedArtifacts downloadAndParse(PollResult result, Path outputDirectory, boolean includeLayout) throws Exception {
    Files.createDirectories(outputDirectory); StringBuilder markdown = new StringBuilder(); ArrayNode layout = json.createArrayNode(); List<Path> figures = new ArrayList<>(); int page = 0; int imageIndex = 0;
    for (String resultUrl : result.resultUrls) {
      String jsonl;
      try { jsonl = new String(downloadResult(resultUrl, "PADDLEOCR_RESULT_DOWNLOAD_FAILED"), StandardCharsets.UTF_8); }
      catch (ProviderException error) { throw error; }
      if (jsonl == null) continue;
      for (String line : jsonl.split("\\R")) {
        if (line.trim().isEmpty()) continue; JsonNode root = json.readTree(line).path("result");
        for (JsonNode parsedPage : root.path("layoutParsingResults")) {
          JsonNode md = parsedPage.path("markdown"); String pageMarkdown = md.path("text").asText();
          if (pageMarkdown.trim().isEmpty()) pageMarkdown = fallbackPageText(parsedPage);
          markdown.append(pageMarkdown).append("\n\n");
          Map<String, Path> pageImages = new LinkedHashMap<>();
          JsonNode images = md.path("images"); if (images.isObject()) {
            java.util.Iterator<Map.Entry<String, JsonNode>> fields = images.fields();
            while (fields.hasNext()) { Map.Entry<String, JsonNode> image = fields.next(); byte[] bytes = downloadResult(image.getValue().asText(), "PADDLEOCR_IMAGE_DOWNLOAD_FAILED"); if (bytes.length == 0) continue; BufferedImage decoded = ImageIO.read(new ByteArrayInputStream(bytes)); if (decoded == null) continue; Path stored = outputDirectory.resolve(String.format("figure-%02d.png", ++imageIndex)); ImageIO.write(decoded, "png", stored.toFile()); Path absolute = stored.toAbsolutePath().normalize(); figures.add(absolute); pageImages.put(image.getKey().replace('\\', '/'), absolute); }
          }
          if (includeLayout) appendLayout(layout, parsedPage, page, pageImages); page++;
        }
      }
    }
    if (markdown.toString().trim().isEmpty()) throw new ProviderException("PADDLEOCR_EMPTY_RESULT", "PaddleOCR 结果中没有 Markdown");
    return new ParsedArtifacts(markdown.toString(), layout, figures);
  }

  private void appendLayout(ArrayNode target, JsonNode page, int pageIndex, Map<String, Path> pageImages) {
    JsonNode pruned = page.path("prunedResult");
    JsonNode blocks = pruned.path("parsing_res_list"); if (!blocks.isArray()) blocks = page.path("parsing_res_list");
    if (!blocks.isArray()) return;
    int coordinateWidth = pruned.path("width").asInt(page.path("width").asInt());
    int coordinateHeight = pruned.path("height").asInt(page.path("height").asInt());
    java.util.Iterator<Path> imageFallback = pageImages.values().iterator();
    for (JsonNode source : blocks) {
      JsonNode bbox = source.path("block_bbox"); if (!bbox.isArray()) bbox = source.path("bbox"); if (!bbox.isArray() || bbox.size() != 4) continue;
      String label = source.path("block_label").asText(source.path("label").asText()); String text = source.path("block_content").asText(source.path("text").asText());
      String lowerLabel = label.toLowerCase(); boolean figure = lowerLabel.contains("image") || lowerLabel.contains("figure") || lowerLabel.contains("chart");
      ObjectNode block = target.addObject(); block.put("page_idx", pageIndex); block.set("bbox", bbox.deepCopy()); block.put("type", figure ? "image" : "text"); block.put("text", text);
      if (coordinateWidth > 0 && coordinateHeight > 0) { block.put("coordinateWidth", coordinateWidth); block.put("coordinateHeight", coordinateHeight); }
      if (figure) {
        Path stored = null;
        String normalizedText = text.replace('\\', '/');
        for (Map.Entry<String, Path> image : pageImages.entrySet()) if (normalizedText.contains(image.getKey())) { stored = image.getValue(); break; }
        if (stored == null && imageFallback.hasNext()) stored = imageFallback.next();
        if (stored != null) block.put("localImagePath", stored.toString());
      }
    }
  }

  private String fallbackPageText(JsonNode page) {
    JsonNode blocks = page.path("prunedResult").path("parsing_res_list");
    if (!blocks.isArray()) blocks = page.path("parsing_res_list");
    if (!blocks.isArray()) blocks = page.path("layoutParsingResults");
    StringBuilder text = new StringBuilder();
    if (blocks.isArray()) for (JsonNode block : blocks) {
      String value = block.path("block_content").asText(block.path("text").asText());
      if (!value.trim().isEmpty()) text.append(value.trim()).append('\n');
    }
    return text.toString();
  }

  private HttpHeaders headers() { HttpHeaders headers = new HttpHeaders(); headers.set(HttpHeaders.AUTHORIZATION, "bearer " + token.trim()); headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON)); return headers; }
  private JsonNode submitMultipart(Path source, String optionalPayload) throws Exception {
    String boundary = "----WhiteboardPaddleOcr" + System.nanoTime(); HttpURLConnection connection = open(jobUrl, "POST");
    connection.setDoOutput(true); connection.setChunkedStreamingMode(8192); connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
    try (DataOutputStream output = new DataOutputStream(connection.getOutputStream())) {
      writeField(output, boundary, "model", model); writeField(output, boundary, "optionalPayload", optionalPayload);
      output.writeBytes("--" + boundary + "\r\n"); output.writeBytes("Content-Disposition: form-data; name=\"file\"; filename=\"" + source.getFileName().toString().replace("\"", "") + "\"\r\n");
      output.writeBytes("Content-Type: application/octet-stream\r\n\r\n"); Files.copy(source, output); output.writeBytes("\r\n--" + boundary + "--\r\n");
    }
    return readJsonResponse(connection, "PADDLEOCR_SUBMIT_FAILED");
  }
  private JsonNode authorizedGet(String url) throws Exception { return readJsonResponse(open(url, "GET"), "PADDLEOCR_POLL_FAILED"); }
  private byte[] downloadResult(String url, String code) {
    HttpURLConnection connection = null;
    try {
      connection = (HttpURLConnection) new URL(url).openConnection(); connection.setRequestMethod("GET"); connection.setConnectTimeout(20000); connection.setReadTimeout(90000);
      int status = connection.getResponseCode(); if (status < 200 || status >= 300) throw new ProviderException(code, "PaddleOCR signed resource download failed (HTTP " + status + ")");
      try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) { byte[] buffer = new byte[8192]; int read; while ((read = input.read(buffer)) >= 0) output.write(buffer, 0, read); return output.toByteArray(); }
    } catch (ProviderException error) { throw error; }
    catch (Exception error) { throw new ProviderException(code, "PaddleOCR signed resource download failed: " + error.getClass().getSimpleName()); }
    finally { if (connection != null) connection.disconnect(); }
  }
  private HttpURLConnection open(String target, String method) throws Exception { HttpURLConnection connection = (HttpURLConnection) new URL(target).openConnection(); connection.setRequestMethod(method); connection.setConnectTimeout(20000); connection.setReadTimeout(90000); connection.setRequestProperty("Authorization", "bearer " + token.trim()); connection.setRequestProperty("Accept", "application/json"); return connection; }
  private void writeField(DataOutputStream output, String boundary, String name, String value) throws Exception { output.writeBytes("--" + boundary + "\r\n"); output.writeBytes("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n"); output.write(value.getBytes(StandardCharsets.UTF_8)); output.writeBytes("\r\n"); }
  private JsonNode readJsonResponse(HttpURLConnection connection, String code) throws Exception { int status = connection.getResponseCode(); InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream(); if (stream != null) { byte[] buffer = new byte[4096]; int read; while ((read = stream.read(buffer)) >= 0) bytes.write(buffer, 0, read); stream.close(); } String body = new String(bytes.toByteArray(), StandardCharsets.UTF_8); if (status < 200 || status >= 300) throw new ProviderException(code, "PaddleOCR HTTP " + status + ": " + sanitizeError(body)); return json.readTree(body); }
  private String sanitizeError(String body) { try { JsonNode parsed = json.readTree(body); String message = parsed.path("message").asText(parsed.path("msg").asText()); return message.isEmpty() ? "request rejected" : message; } catch (Exception ignored) { return "request rejected"; } }
  private JsonNode parse(ResponseEntity<String> response) throws Exception { if (!response.getStatusCode().is2xxSuccessful()) throw new ProviderException("PADDLEOCR_REQUEST_FAILED", "PaddleOCR HTTP " + response.getStatusCodeValue()); return json.readTree(response.getBody()); }
  private void requireConfigured() { if (token.trim().isEmpty()) throw new ProviderException("PADDLEOCR_NOT_CONFIGURED", "未配置 PADDLEOCR_API_TOKEN"); }
  private static final class ParsedArtifacts { final String markdown; final ArrayNode layout; final List<Path> figures; ParsedArtifacts(String markdown, ArrayNode layout, List<Path> figures) { this.markdown = markdown; this.layout = layout; this.figures = figures; } }
}
