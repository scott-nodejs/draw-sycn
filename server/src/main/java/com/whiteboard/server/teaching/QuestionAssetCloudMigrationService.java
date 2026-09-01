package com.whiteboard.server.teaching;

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
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private final AtomicBoolean running = new AtomicBoolean(false);
  private final AtomicInteger total = new AtomicInteger(), completed = new AtomicInteger(), failed = new AtomicInteger(), migratedAssets = new AtomicInteger();

  public QuestionAssetCloudMigrationService(JdbcTemplate jdbc, QiniuPaperStorageService storage) {
    this.jdbc = jdbc; this.storage = storage;
  }

  public Map<String, Object> migrateHistory() {
    if (!running.compareAndSet(false, true)) return status();
    List<String> paperIds = jdbc.queryForList(
      "SELECT DISTINCT p.id FROM teaching_paper p JOIN teaching_question q ON q.paper_id=p.id WHERE p.deleted_at IS NULL AND q.deleted_at IS NULL AND q.crop_regions_json IS NOT NULL ORDER BY p.created_at",
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

  public Map<String, Object> status() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("running", running.get()); result.put("totalPapers", total.get()); result.put("completedPapers", completed.get());
    result.put("failedPapers", failed.get()); result.put("migratedAssets", migratedAssets.get());
    return result;
  }

  @PreDestroy public void shutdown() { executor.shutdownNow(); }
}
