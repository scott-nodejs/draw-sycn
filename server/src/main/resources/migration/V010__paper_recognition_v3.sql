ALTER TABLE paper_page
  ADD COLUMN page_source_type VARCHAR(32) NOT NULL DEFAULT 'image' AFTER status,
  ADD COLUMN parse_strategy VARCHAR(48) NOT NULL DEFAULT 'full_ocr' AFTER page_source_type,
  ADD COLUMN has_text_layer TINYINT NOT NULL DEFAULT 0 AFTER parse_strategy,
  ADD COLUMN native_text_score INT NOT NULL DEFAULT 0 AFTER has_text_layer,
  ADD COLUMN image_coverage DECIMAL(6,4) NOT NULL DEFAULT 0 AFTER native_text_score,
  ADD COLUMN inspection_json JSON NULL AFTER image_coverage;

CREATE TABLE IF NOT EXISTS paper_stage_execution (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  job_id VARCHAR(64) NOT NULL,
  paper_id VARCHAR(64) NOT NULL,
  stage VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL,
  attempt INT NOT NULL DEFAULT 1,
  provider VARCHAR(64) NOT NULL DEFAULT '',
  input_json JSON NULL,
  output_json JSON NULL,
  error_code VARCHAR(64) NOT NULL DEFAULT '',
  error_message VARCHAR(1024) NOT NULL DEFAULT '',
  started_at DATETIME(3) NOT NULL,
  finished_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_stage_execution_job (job_id, started_at),
  KEY idx_stage_execution_paper (paper_id, started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
