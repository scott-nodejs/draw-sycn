package com.whiteboard.server.teaching;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
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
public class PaperCloudMigrationService {
  private static final Logger log = LoggerFactory.getLogger(PaperCloudMigrationService.class);
  private final JdbcTemplate jdbc;
  private final QiniuPaperStorageService storage;
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private final Set<String> queued = ConcurrentHashMap.newKeySet();
  private final AtomicBoolean historyRunning = new AtomicBoolean(false);
  private final AtomicInteger total = new AtomicInteger(), completed = new AtomicInteger(), failed = new AtomicInteger();

  public PaperCloudMigrationService(JdbcTemplate jdbc, QiniuPaperStorageService storage) { this.jdbc = jdbc; this.storage = storage; }

  public void queue(String paperId) {
    if (!queued.add(paperId)) return;
    executor.submit(() -> archiveOne(paperId, false));
  }

  public Map<String, Object> migrateHistory() {
    if (!historyRunning.compareAndSet(false, true)) return status();
    List<String> ids = jdbc.queryForList("SELECT id FROM teaching_paper WHERE deleted_at IS NULL AND status IN ('review','ready') AND cloud_status<>'done' ORDER BY created_at", String.class);
    total.set(ids.size()); completed.set(0); failed.set(0);
    executor.submit(() -> {
      try { for (String id : ids) { queued.add(id); archiveOne(id, true); } }
      finally { historyRunning.set(false); }
    });
    return status();
  }

  public Map<String, Object> status() {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("running", historyRunning.get()); result.put("total", total.get()); result.put("completed", completed.get()); result.put("failed", failed.get()); result.put("queued", queued.size());
    return result;
  }

  private void archiveOne(String paperId, boolean historical) {
    try { storage.archive(paperId); if (historical) completed.incrementAndGet(); }
    catch (Exception error) { if (historical) failed.incrementAndGet(); log.error("Paper cloud archive failed: paperId={}", paperId, error); }
    finally { queued.remove(paperId); }
  }

  @PreDestroy public void shutdown() { executor.shutdownNow(); }
}
