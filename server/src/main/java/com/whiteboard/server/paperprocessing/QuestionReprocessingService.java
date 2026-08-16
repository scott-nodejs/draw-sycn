package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuestionReprocessingService {
  private static final Logger log = LoggerFactory.getLogger(QuestionReprocessingService.class);
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final OcrProviderRouter ocrProviders;
  private final DeepseekClient deepseek;

  public QuestionReprocessingService(JdbcTemplate jdbc, ObjectMapper json, OcrProviderRouter ocrProviders, DeepseekClient deepseek) {
    this.jdbc = jdbc; this.json = json; this.ocrProviders = ocrProviders; this.deepseek = deepseek;
  }

  @Transactional
  public String enqueue(String questionId, String paperId, JsonNode regions) {
    try {
      Path directory = questionDirectory(paperId, questionId).resolve("manual-reprocess");
      Files.createDirectories(directory);
      List<String> inputs = createCrops(paperId, regions, directory);
      Path manifest = directory.resolve("input-manifest.json");
      json.writeValue(manifest.toFile(), inputs);
      Timestamp now = now();
      jdbc.update("UPDATE question_reprocess_job SET status='superseded',updated_at=? WHERE question_id=? AND status IN ('queued','processing')", now, questionId);
      String jobId = id("qreprocess");
      jdbc.update("INSERT INTO question_reprocess_job (id,question_id,paper_id,status,stage,input_manifest_path,created_at,updated_at) VALUES (?,?,?,'queued','queued',?,?,?)",
        jobId, questionId, paperId, manifest.toString(), now, now);
      log.info("Question re-recognition queued: questionId={}, paperId={}, cropCount={}", questionId, paperId, inputs.size());
      return jobId;
    } catch (Exception error) {
      throw new ProviderException("QUESTION_CROP_REBUILD_FAILED", error.getMessage() == null ? "Failed to rebuild question crop" : error.getMessage());
    }
  }

  @Scheduled(fixedDelayString = "${QUESTION_REPROCESS_INTERVAL_MS:5000}")
  public void tick() {
    List<Map<String, Object>> jobs = jdbc.query("SELECT id,question_id,paper_id,stage,request_id,input_manifest_path FROM question_reprocess_job WHERE status IN ('queued','processing') AND (locked_at IS NULL OR locked_at<?) ORDER BY created_at LIMIT 1",
      (rs, n) -> { Map<String, Object> row = new java.util.LinkedHashMap<>(); row.put("id", rs.getString("id")); row.put("questionId", rs.getString("question_id")); row.put("paperId", rs.getString("paper_id")); row.put("stage", rs.getString("stage")); row.put("requestId", rs.getString("request_id")); row.put("manifest", rs.getString("input_manifest_path")); return row; },
      Timestamp.valueOf(LocalDateTime.now().minusMinutes(10)));
    if (jobs.isEmpty()) return;
    Map<String, Object> job = jobs.get(0); String jobId = string(job.get("id"));
    if (jdbc.update("UPDATE question_reprocess_job SET locked_at=?,updated_at=? WHERE id=? AND (locked_at IS NULL OR locked_at<?)", now(), now(), jobId, Timestamp.valueOf(LocalDateTime.now().minusMinutes(10))) == 0) return;
    try { process(job); } catch (Exception error) { fail(jobId, error); }
  }

  private void process(Map<String, Object> job) throws Exception {
    String jobId = string(job.get("id")); String questionId = string(job.get("questionId")); String stage = string(job.get("stage"));
    if ("queued".equals(stage)) {
      OcrProvider provider = ocrProviders.selected();
      JsonNode manifest = json.readTree(Paths.get(string(job.get("manifest"))).toFile()); List<Path> inputs = new ArrayList<>();
      for (JsonNode path : manifest) inputs.add(Paths.get(path.asText()));
      String requestId = provider.submit(inputs, questionId);
      jdbc.update("UPDATE question_reprocess_job SET status='processing',stage=?,request_id=?,locked_at=NULL,updated_at=? WHERE id=?", provider.name() + "_running", requestId, now(), jobId);
      log.info("Question crop submitted to OCR provider: provider={}, jobId={}, questionId={}, requestId={}", provider.name(), jobId, questionId, requestId); return;
    }
    if (stage.endsWith("_running")) {
      OcrProvider provider = ocrProviders.byName(stage.substring(0, stage.length() - "_running".length()));
      OcrProvider.PollResult result = provider.poll(string(job.get("requestId")));
      if (!result.done) { jdbc.update("UPDATE question_reprocess_job SET locked_at=NULL,updated_at=? WHERE id=?", now(), jobId); return; }
      Path figureDirectory = questionDirectory(string(job.get("paperId")), questionId).resolve("figures");
      OcrProvider.QuestionArtifacts artifacts = provider.downloadQuestionArtifacts(result, figureDirectory);
      String markdown = artifacts.markdown;
      Map<String, Object> current = jdbc.queryForMap("SELECT question_number,question_type,version FROM teaching_question WHERE id=?", questionId);
      JsonNode recognized = deepseek.recognizeQuestionCrop(markdown, ((Number) current.get("question_number")).intValue(), string(current.get("question_type")));
      long version = ((Number) current.get("version")).longValue() + 1;
      String cropJson = jdbc.queryForObject("SELECT crop_regions_json FROM teaching_question WHERE id=?", String.class, questionId);
      JsonNode parsedCrop = json.readTree(cropJson); ObjectNode cropData = parsedCrop instanceof ObjectNode ? (ObjectNode) parsedCrop : json.createObjectNode();
      ArrayNode figureAssets = cropData.putArray("figureAssets");
      for (Path figure : artifacts.figures) {
        BufferedImage image = ImageIO.read(figure.toFile()); if (image == null) continue;
        ObjectNode descriptor = figureAssets.addObject(); descriptor.put("objectKey", figure.toAbsolutePath().normalize().toString()); descriptor.put("width", image.getWidth()); descriptor.put("height", image.getHeight());
      }
      jdbc.update("UPDATE teaching_question SET stem=?,options_json=?,answer=?,analysis=?,confidence=?,difficulty=?,crop_regions_json=?,review_status='review',version=?,updated_at=? WHERE id=?",
        recognized.path("stem").asText(), json.writeValueAsString(recognized.path("options")), recognized.path("answer").asText(), recognized.path("analysis").asText(),
        Math.max(0, Math.min(100, recognized.path("confidence").asInt())), normalizeDifficulty(recognized.path("difficulty").asText()), json.writeValueAsString(cropData), version, now(), questionId);
      jdbc.update("INSERT INTO question_revision (id,question_id,version,snapshot_json,change_source,change_reason,created_at) VALUES (?,?,?,?,'AI_REGION_RECOGNITION','人工纠框后局部重识别',?)",
        id("revision"), questionId, version, json.writeValueAsString(recognized), now());
      jdbc.update("UPDATE question_reprocess_job SET status='done',stage='done',locked_at=NULL,finished_at=?,updated_at=? WHERE id=?", now(), now(), jobId);
      log.info("Question re-recognition completed: jobId={}, questionId={}, figureCount={}", jobId, questionId, artifacts.figures.size());
    }
  }

  private List<String> createCrops(String paperId, JsonNode regions, Path output) throws Exception {
    List<String> paths = new ArrayList<>(); int index = 0;
    for (JsonNode region : regions) {
      int page = region.path("pageNumber").asInt();
      String stored = jdbc.queryForObject("SELECT normalized_object_key FROM paper_page WHERE paper_id=? AND page_number=?", String.class, paperId, page);
      Path pagePath = resolveStoredPath(stored); BufferedImage image = ImageIO.read(pagePath.toFile());
      int x0 = pixel(region.path("x0").asInt(), image.getWidth()); int y0 = pixel(region.path("y0").asInt(), image.getHeight());
      int x1 = pixel(region.path("x1").asInt(), image.getWidth()); int y1 = pixel(region.path("y1").asInt(), image.getHeight());
      if (x1 <= x0 || y1 <= y0) throw new ProviderException("INVALID_CROP_REGION", "Invalid question region");
      Path crop = output.resolve(String.format("crop-%02d.png", ++index));
      ImageIO.write(image.getSubimage(x0, y0, x1 - x0, y1 - y0), "png", crop.toFile()); paths.add(crop.toString());
    }
    return paths;
  }

  private Path questionDirectory(String paperId, String questionId) {
    String manifest = jdbc.queryForObject("SELECT pdf_object_key FROM teaching_paper WHERE id=?", String.class, paperId);
    return resolveStoredPath(manifest).getParent().resolve("questions").resolve(questionId);
  }
  private Path resolveStoredPath(String value) {
    Path path = Paths.get(value); if (path.isAbsolute() && Files.exists(path)) return path.normalize();
    Path direct = path.toAbsolutePath().normalize(); if (Files.exists(direct)) return direct;
    Path underServer = Paths.get("server").resolve(path).toAbsolutePath().normalize(); if (Files.exists(underServer)) return underServer;
    return direct;
  }
  private int pixel(int normalized, int size) { return Math.round(Math.max(0, Math.min(1000, normalized)) * size / 1000f); }
  private void fail(String jobId, Exception error) {
    String code = error instanceof ProviderException ? ((ProviderException) error).getCode() : "QUESTION_REPROCESS_FAILED";
    String message = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
    jdbc.update("UPDATE question_reprocess_job SET status='failed',error_code=?,error_message=?,locked_at=NULL,finished_at=?,updated_at=? WHERE id=?", code, message.substring(0, Math.min(1000, message.length())), now(), now(), jobId);
    log.error("Question re-recognition failed: jobId={}, code={}", jobId, code, error);
  }
  private Timestamp now() { return Timestamp.valueOf(LocalDateTime.now()); }
  private String id(String prefix) { return prefix + "_" + UUID.randomUUID().toString().replace("-", ""); }
  private String string(Object value) { return value == null ? "" : String.valueOf(value); }
  private String normalizeDifficulty(String value) { return "高".equals(value) || "低".equals(value) ? value : "中"; }
}
