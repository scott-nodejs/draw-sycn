CREATE TABLE IF NOT EXISTS question_reprocess_job (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  question_id VARCHAR(64) NOT NULL,
  paper_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  stage VARCHAR(32) NOT NULL DEFAULT 'queued',
  request_id VARCHAR(128) NOT NULL DEFAULT '',
  input_manifest_path VARCHAR(1024) NOT NULL,
  error_code VARCHAR(64) NOT NULL DEFAULT '',
  error_message VARCHAR(1024) NOT NULL DEFAULT '',
  locked_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_question_reprocess_question (question_id, created_at),
  KEY idx_question_reprocess_status (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
