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
}
