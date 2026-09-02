package com.whiteboard.server.teaching;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.whiteboard.server.paperprocessing.QuestionReprocessingService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import javax.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class QuestionAssetCloudMigrationService {
  private static final Logger log = LoggerFactory.getLogger(QuestionAssetCloudMigrationService.class);
  private final JdbcTemplate jdbc;
  private final QiniuPaperStorageService storage;
  private final QuestionReprocessingService reprocessing;
  private final ObjectMapper json;
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private final AtomicBoolean running = new AtomicBoolean(false);
  private final AtomicInteger total = new AtomicInteger(), completed = new AtomicInteger(), failed = new AtomicInteger(), migratedAssets = new AtomicInteger();
  private volatile String operation = "idle";

  public QuestionAssetCloudMigrationService(JdbcTemplate jdbc, QiniuPaperStorageService storage, QuestionReprocessingService reprocessing, ObjectMapper json) {
    this.jdbc = jdbc; this.storage = storage; this.reprocessing = reprocessing; this.json = json;
  }

  public Map<String, Object> migrateHistory() {
    if (!running.compareAndSet(false, true)) return status();
    operation = "cloud-migration";
    List<String> paperIds = jdbc.queryForList(
      "SELECT p.id FROM teaching_paper p WHERE p.deleted_at IS NULL AND EXISTS (SELECT 1 FROM teaching_question q WHERE q.paper_id=p.id AND q.deleted_at IS NULL AND q.crop_regions_json IS NOT NULL) ORDER BY p.created_at",
      String.class);
    total.set(paperIds.size()); completed.set(0); failed.set(0); migratedAssets.set(0);
    executor.submit(() -> {
      try {
        for (String paperId : paperIds) {
          try { migratedAssets.addAndGet(storage.archiveQuestionAssets(paperId)); completed.incrementAndGet(); }
          catch (Exception error) { failed.incrementAndGet(); log.error("Question asset cloud migration failed: paperId={}", paperId, error); }
        }
      } finally { running.set(false); }
    });
    return status();
  }

  public Map<String, Object> rebuildHistory() {
    if (!running.compareAndSet(false, true)) return status();
    operation = "crop-rebuild";
    List<Map<String, Object>> questions = jdbc.queryForList(
      "SELECT q.id,q.paper_id,q.crop_regions_json FROM teaching_question q JOIN teaching_paper p ON p.id=q.paper_id " +
      "WHERE q.deleted_at IS NULL AND p.deleted_at IS NULL AND q.crop_regions_json IS NOT NULL ORDER BY p.created_at,q.question_number");
    total.set(questions.size()); completed.set(0); failed.set(0); migratedAssets.set(0);
    executor.submit(() -> {
      String activePaper = null;
      try {
        for (Map<String, Object> question : questions) {
          String questionId = String.valueOf(question.get("id"));
          String paperId = String.valueOf(question.get("paper_id"));
          try {
            JsonNode parsed = json.readTree(String.valueOf(question.get("crop_regions_json")));
            ObjectNode data = parsed instanceof ObjectNode ? (ObjectNode) parsed : json.createObjectNode();
            JsonNode regions = data.path("regions");
            if (!validRegions(regions)) { failed.incrementAndGet(); continue; }
            ArrayNode assets = reprocessing.rebuildCropAssets(questionId, paperId, regions);
            data.set("assets", assets);
            jdbc.update("UPDATE teaching_question SET crop_regions_json=?,version=version+1,updated_at=NOW() WHERE id=?", json.writeValueAsString(data), questionId);
            if (activePaper != null && !activePaper.equals(paperId)) migratedAssets.addAndGet(storage.archiveQuestionAssets(activePaper));
            activePaper = paperId;
            completed.incrementAndGet();
          } catch (Exception error) {
            failed.incrementAndGet();
            log.error("Historical question crop rebuild failed: questionId={}", questionId, error);
          }
        }
        if (activePaper != null) migratedAssets.addAndGet(storage.archiveQuestionAssets(activePaper));
      } catch (Exception error) {
        log.error("Historical question crop archive failed: paperId={}", activePaper, error);
      } finally { running.set(false); }
    });
    return status();
  }

  private boolean validRegions(JsonNode regions) {
    if (!regions.isArray() || regions.size() == 0) return false;
    for (JsonNode region : regions) {
      int x0 = region.path("x0").asInt(-1), y0 = region.path("y0").asInt(-1);
      int x1 = region.path("x1").asInt(-1), y1 = region.path("y1").asInt(-1);
      if (region.path("pageNumber").asInt() <= 0 || x0 < 0 || y0 < 0 || x1 > 1000 || y1 > 1000 || x1 <= x0 || y1 <= y0) return false;
    }
    return true;
  }

  public Map<String, Object> status() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("operation", operation);
    result.put("running", running.get()); result.put("totalPapers", total.get()); result.put("completedPapers", completed.get());
    result.put("failedPapers", failed.get()); result.put("migratedAssets", migratedAssets.get());
    return result;
  }

  @PreDestroy public void shutdown() { executor.shutdownNow(); }
}
