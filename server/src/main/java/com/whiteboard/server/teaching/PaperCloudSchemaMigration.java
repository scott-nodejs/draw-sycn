package com.whiteboard.server.teaching;

import javax.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class PaperCloudSchemaMigration {
  private final JdbcTemplate jdbc;
  public PaperCloudSchemaMigration(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  @PostConstruct public void migrate() {
    addColumn("paper_page", "preview_cloud_key", "VARCHAR(1024) NOT NULL DEFAULT '' AFTER normalized_object_key");
    addColumn("teaching_paper", "source_cloud_key", "VARCHAR(1024) NOT NULL DEFAULT '' AFTER pdf_object_key");
    addColumn("teaching_paper", "cloud_status", "VARCHAR(32) NOT NULL DEFAULT 'pending' AFTER source_cloud_key");
    addColumn("teaching_paper", "cloud_error", "VARCHAR(1024) NOT NULL DEFAULT '' AFTER cloud_status");
  }

  private void addColumn(String table, String column, String definition) {
    Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?", Integer.class, table, column);
    if (count != null && count == 0) jdbc.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
  }
}
