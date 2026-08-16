package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class PaddleDocLayoutClient {
  private static final Logger log = LoggerFactory.getLogger(PaddleDocLayoutClient.class);
  private final ObjectMapper json; private final String token; private final String jobUrl; private final String model; private final boolean enabled;
  public PaddleDocLayoutClient(ObjectMapper json,
      @Value("${PADDLEOCR_API_TOKEN:}") String token,
      @Value("${PADDLE_LAYOUT_JOB_URL:${PADDLEOCR_JOB_URL:https://paddleocr.aistudio-app.com/api/v2/ocr/jobs}}") String jobUrl,
      @Value("${PADDLE_LAYOUT_MODEL:PP-StructureV3}") String model,
      @Value("${PADDLE_LAYOUT_ENABLED:true}") boolean enabled) {
    this.json = json; this.token = token; this.jobUrl = jobUrl.replaceAll("/$", ""); this.model = model; this.enabled = enabled;
  }

  public ArrayNode analyze(List<Path> pages) {
    if (!enabled || token.trim().isEmpty()) return null;
    try {
      ArrayNode result = json.createArrayNode();
      for (int pageIndex = 0; pageIndex < pages.size(); pageIndex++) {
        String jobId = submit(pages.get(pageIndex)); JsonNode completed = waitFor(jobId);
        String resultUrl = completed.path("data").path("resultUrl").path("jsonUrl").asText();
        if (resultUrl.isEmpty()) throw new ProviderException("PADDLE_LAYOUT_INVALID_RESPONSE", "PP-DocLayout 未返回 JSON 地址");
        parseJsonl(download(resultUrl), pageIndex, result);
      }
      if (result.isEmpty()) throw new ProviderException("PADDLE_LAYOUT_EMPTY_RESULT", "PP-DocLayout 未返回布局框");
      log.info("PP-StructureV3 layout extraction completed: model={}, pages={}, blocks={}", model, pages.size(), result.size()); return result;
    } catch (Exception error) {
      log.warn("PP-StructureV3 layout extraction unavailable, falling back to PaddleOCR-VL layout: {}", error.getMessage()); return null;
    }
  }

  private String submit(Path source) throws Exception {
    String boundary = "----WhiteboardPaddleLayout" + System.nanoTime(); HttpURLConnection connection = open(jobUrl, "POST");
    connection.setDoOutput(true); connection.setChunkedStreamingMode(8192); connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
    try (DataOutputStream output = new DataOutputStream(connection.getOutputStream())) {
      writeField(output, boundary, "model", model); writeField(output, boundary, "optionalPayload", "{}");
      output.writeBytes("--" + boundary + "\r\n"); output.writeBytes("Content-Disposition: form-data; name=\"file\"; filename=\"" + source.getFileName().toString().replace("\"", "") + "\"\r\n");
      output.writeBytes("Content-Type: application/octet-stream\r\n\r\n"); Files.copy(source, output); output.writeBytes("\r\n--" + boundary + "--\r\n");
    }
    JsonNode response = readJson(connection); String id = response.path("data").path("jobId").asText();
    if (id.isEmpty()) throw new ProviderException("PADDLE_LAYOUT_INVALID_RESPONSE", "PP-DocLayout 未返回 jobId"); return id;
  }

  private JsonNode waitFor(String jobId) throws Exception {
    for (int attempt = 0; attempt < 90; attempt++) {
      JsonNode response = readJson(open(jobUrl + "/" + jobId, "GET")); String state = response.path("data").path("state").asText();
      if ("done".equalsIgnoreCase(state)) return response;
      if ("failed".equalsIgnoreCase(state)) throw new ProviderException("PADDLE_LAYOUT_FAILED", response.path("data").path("errorMsg").asText("PP-DocLayout 处理失败"));
      Thread.sleep(2000);
    }
    throw new ProviderException("PADDLE_LAYOUT_TIMEOUT", "PP-DocLayout 等待超时");
  }

  private void parseJsonl(byte[] bytes, int pageIndex, ArrayNode target) throws Exception {
    for (String line : new String(bytes, StandardCharsets.UTF_8).split("\\R")) {
      if (line.trim().isEmpty()) continue; JsonNode root = json.readTree(line).path("result");
      JsonNode boxes = root.path("layout_det_res").path("boxes");
      if (!boxes.isArray()) boxes = root.path("layoutParsingResults").path(0).path("prunedResult").path("layout_det_res").path("boxes");
      JsonNode parsed = root.path("parsing_res_list");
      if (!parsed.isArray()) parsed = root.path("layoutParsingResults").path(0).path("prunedResult").path("parsing_res_list");
      if (parsed.isArray() && parsed.size() > 0) for (JsonNode block : parsed) append(target, pageIndex, block.path("block_bbox"), block.path("block_label").asText(), "", 0, block.path("block_order").asInt(-1));
      else if (boxes.isArray()) for (JsonNode box : boxes) append(target, pageIndex, box.path("coordinate"), box.path("label").asText(), "", box.path("score").asDouble(), box.path("order").asInt(-1));
    }
  }

  private void append(ArrayNode target, int page, JsonNode bbox, String label, String content, double score, int order) {
    if (!bbox.isArray() || bbox.size() != 4) return; ObjectNode block = target.addObject(); block.put("page_idx", page); block.set("bbox", bbox.deepCopy());
    block.put("type", isFigure(label) ? "figure" : label); block.put("label", label); block.put("text", content); block.put("score", score); block.put("block_order", order);
  }
  private boolean isFigure(String label) { String value = label.toLowerCase(); return value.contains("figure") || value.contains("image") || value.contains("chart"); }
  private HttpURLConnection open(String target, String method) throws Exception { HttpURLConnection connection = (HttpURLConnection) new URL(target).openConnection(); connection.setRequestMethod(method); connection.setConnectTimeout(20000); connection.setReadTimeout(180000); connection.setRequestProperty("Authorization", "bearer " + token.trim()); connection.setRequestProperty("Accept", "application/json"); return connection; }
  private void writeField(DataOutputStream output, String boundary, String name, String value) throws Exception { output.writeBytes("--" + boundary + "\r\n"); output.writeBytes("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n"); output.write(value.getBytes(StandardCharsets.UTF_8)); output.writeBytes("\r\n"); }
  private JsonNode readJson(HttpURLConnection connection) throws Exception { int status = connection.getResponseCode(); byte[] bytes = read(status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream()); String body = new String(bytes, StandardCharsets.UTF_8); if (status < 200 || status >= 300) throw new ProviderException("PADDLE_LAYOUT_HTTP_ERROR", "PP-DocLayout HTTP " + status + ": " + body.substring(0, Math.min(300, body.length()))); return json.readTree(body); }
  private byte[] download(String target) throws Exception { HttpURLConnection connection = (HttpURLConnection) new URL(target).openConnection(); connection.setConnectTimeout(20000); connection.setReadTimeout(180000); int status = connection.getResponseCode(); if (status < 200 || status >= 300) throw new ProviderException("PADDLE_LAYOUT_DOWNLOAD_FAILED", "PP-DocLayout 结果下载失败 HTTP " + status); return read(connection.getInputStream()); }
  private byte[] read(InputStream input) throws Exception { if (input == null) return new byte[0]; try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) { byte[] buffer = new byte[8192]; int count; while ((count = stream.read(buffer)) >= 0) output.write(buffer, 0, count); return output.toByteArray(); } }
}
