package com.whiteboard.server.organizer;

import javax.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Keeps organizer tables compatible when the service runs against an existing database. */
@Component
public class OrganizerSchemaMigration {
  private final JdbcTemplate jdbc;

  public OrganizerSchemaMigration(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @PostConstruct
  public void migrate() {
    addColumn("collection_type", "VARCHAR(32) NOT NULL DEFAULT 'topic' AFTER grade");
    addColumn("topic_label", "VARCHAR(128) NOT NULL DEFAULT '' AFTER collection_type");
    jdbc.execute("CREATE TABLE IF NOT EXISTS knowledge_point (id VARCHAR(64) NOT NULL PRIMARY KEY,parent_id VARCHAR(64) NULL,subject VARCHAR(64) NOT NULL,grade VARCHAR(64) NOT NULL DEFAULT '',name VARCHAR(128) NOT NULL,sort_order INT NOT NULL DEFAULT 0,created_at DATETIME(3) NOT NULL,updated_at DATETIME(3) NOT NULL,UNIQUE KEY uk_knowledge_point_scope_name (subject,grade,parent_id,name),KEY idx_knowledge_point_parent (parent_id,sort_order)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    jdbc.execute("CREATE TABLE IF NOT EXISTS question_knowledge_point (question_id VARCHAR(64) NOT NULL,knowledge_point_id VARCHAR(64) NOT NULL,created_at DATETIME(3) NOT NULL,PRIMARY KEY (question_id,knowledge_point_id),KEY idx_question_knowledge_point_point (knowledge_point_id,question_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    addJoinColumn("confidence", "INT NOT NULL DEFAULT 0 AFTER knowledge_point_id");
    addJoinColumn("reason", "VARCHAR(500) NOT NULL DEFAULT '' AFTER confidence");
    addJoinColumn("source", "VARCHAR(32) NOT NULL DEFAULT 'manual' AFTER reason");
    addTableColumn("teaching_paper", "deleted_at", "DATETIME NULL AFTER status");
    addTableColumn("teaching_question", "deleted_at", "DATETIME NULL AFTER teaching_status");
    addTableColumn("organizer_question_set", "deleted_at", "DATETIME NULL AFTER status");
  }

  private void addColumn(String column, String definition) {
    Integer count = jdbc.queryForObject(
        "SELECT COUNT(*) FROM information_schema.COLUMNS "
            + "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='organizer_question_set' AND COLUMN_NAME=?",
        Integer.class,
        column);
    if (count != null && count == 0) {
      jdbc.execute("ALTER TABLE organizer_question_set ADD COLUMN " + column + " " + definition);
    }
  }

  private void addJoinColumn(String column, String definition) {
    Integer count = jdbc.queryForObject(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() "
            + "AND TABLE_NAME='question_knowledge_point' AND COLUMN_NAME=?",
        Integer.class, column);
    if (count != null && count == 0) {
      jdbc.execute("ALTER TABLE question_knowledge_point ADD COLUMN " + column + " " + definition);
    }
  }

  private void addTableColumn(String table, String column, String definition) {
    Integer count = jdbc.queryForObject(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
        Integer.class, table, column);
    if (count != null && count == 0) jdbc.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
  }
}
