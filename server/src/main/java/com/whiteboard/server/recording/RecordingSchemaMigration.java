package com.whiteboard.server.recording;

import javax.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Keeps legacy recording tables compatible with audio-enabled Qiniu sessions. */
@Component
public class RecordingSchemaMigration {
  private final JdbcTemplate jdbc;

  public RecordingSchemaMigration(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @PostConstruct
  public void migrate() {
    addColumnIfMissing("audio_url", "VARCHAR(1024) NOT NULL DEFAULT '' AFTER event_manifest_url");
    addColumnIfMissing("audio_mime_type", "VARCHAR(128) NOT NULL DEFAULT '' AFTER audio_url");
    addColumnIfMissing("audio_duration_ms", "BIGINT NOT NULL DEFAULT 0 AFTER audio_mime_type");
    addColumnIfMissing("audio_start_offset_ms", "BIGINT NOT NULL DEFAULT 0 AFTER audio_duration_ms");
    addColumnIfMissing("question_ids_json", "JSON NULL AFTER audio_start_offset_ms");
    addColumnIfMissing("question_segments_json", "JSON NULL AFTER question_ids_json");
  }

  private void addColumnIfMissing(String columnName, String definition) {
    Integer count = jdbc.queryForObject(
      "SELECT COUNT(*) FROM information_schema.COLUMNS "
        + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'whiteboard_recording_session' AND COLUMN_NAME = ?",
      Integer.class,
      columnName
    );
    if (count != null && count == 0) {
      jdbc.execute("ALTER TABLE whiteboard_recording_session ADD COLUMN " + columnName + " " + definition);
    }
  }
}
