package com.whiteboard.server.classroom;

import javax.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Keeps existing classroom tables compatible with live question synchronization. */
@Component
public class ClassroomSchemaMigration {
  private final JdbcTemplate jdbc;

  public ClassroomSchemaMigration(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  @PostConstruct
  public void migrate() {
    Integer count = jdbc.queryForObject(
      "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'class_sync_room' AND COLUMN_NAME = 'current_question_id'",
      Integer.class
    );
    if (count != null && count == 0) jdbc.execute("ALTER TABLE class_sync_room ADD COLUMN current_question_id VARCHAR(64) NULL AFTER title");
  }
}
