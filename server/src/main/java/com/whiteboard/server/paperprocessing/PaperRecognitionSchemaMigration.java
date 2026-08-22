package com.whiteboard.server.paperprocessing;

import javax.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Makes recognition V3 safe to deploy over existing paper data. */
@Component
public class PaperRecognitionSchemaMigration {
  private final JdbcTemplate jdbc;
  public PaperRecognitionSchemaMigration(JdbcTemplate jdbc) { this.jdbc=jdbc; }

  @PostConstruct
  public void migrate() {
    addColumn("page_source_type","VARCHAR(32) NOT NULL DEFAULT 'image' AFTER status");
    addColumn("parse_strategy","VARCHAR(48) NOT NULL DEFAULT 'full_ocr' AFTER page_source_type");
    addColumn("has_text_layer","TINYINT NOT NULL DEFAULT 0 AFTER parse_strategy");
    addColumn("native_text_score","INT NOT NULL DEFAULT 0 AFTER has_text_layer");
    addColumn("image_coverage","DECIMAL(6,4) NOT NULL DEFAULT 0 AFTER native_text_score");
    addColumn("inspection_json","JSON NULL AFTER image_coverage");
    jdbc.execute("CREATE TABLE IF NOT EXISTS paper_stage_execution (id VARCHAR(64) NOT NULL PRIMARY KEY,job_id VARCHAR(64) NOT NULL,paper_id VARCHAR(64) NOT NULL,stage VARCHAR(64) NOT NULL,status VARCHAR(32) NOT NULL,attempt INT NOT NULL DEFAULT 1,provider VARCHAR(64) NOT NULL DEFAULT '',input_json JSON NULL,output_json JSON NULL,error_code VARCHAR(64) NOT NULL DEFAULT '',error_message VARCHAR(1024) NOT NULL DEFAULT '',started_at DATETIME(3) NOT NULL,finished_at DATETIME(3) NULL,created_at DATETIME(3) NOT NULL,updated_at DATETIME(3) NOT NULL,KEY idx_stage_execution_job (job_id,started_at),KEY idx_stage_execution_paper (paper_id,started_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    jdbc.execute("CREATE TABLE IF NOT EXISTS paper_recognition_report (id VARCHAR(64) NOT NULL PRIMARY KEY,paper_id VARCHAR(64) NOT NULL,job_id VARCHAR(64) NOT NULL,pipeline_version VARCHAR(32) NOT NULL,overall_score INT NOT NULL,native_page_count INT NOT NULL DEFAULT 0,ocr_page_count INT NOT NULL DEFAULT 0,repaired_page_count INT NOT NULL DEFAULT 0,question_count INT NOT NULL DEFAULT 0,manual_review_count INT NOT NULL DEFAULT 0,cross_page_count INT NOT NULL DEFAULT 0,status VARCHAR(32) NOT NULL,report_json JSON NOT NULL,created_at DATETIME(3) NOT NULL,UNIQUE KEY uk_recognition_report_job (job_id),KEY idx_recognition_report_paper (paper_id,created_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  }

  private void addColumn(String column,String definition){Integer count=jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='paper_page' AND COLUMN_NAME=?",Integer.class,column);if(count!=null&&count==0)jdbc.execute("ALTER TABLE paper_page ADD COLUMN "+column+" "+definition);}
}
