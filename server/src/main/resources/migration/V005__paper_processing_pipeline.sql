ALTER TABLE teaching_parse_job
  ADD COLUMN stage VARCHAR(32) NOT NULL DEFAULT 'queued' AFTER retry_count,
  ADD COLUMN result_object_key VARCHAR(1024) NOT NULL DEFAULT '' AFTER stage,
  ADD COLUMN next_retry_at DATETIME NULL AFTER result_object_key,
  ADD COLUMN locked_at DATETIME NULL AFTER next_retry_at,
  ADD COLUMN finished_at DATETIME NULL AFTER locked_at;

CREATE TABLE IF NOT EXISTS paper_page (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  paper_id VARCHAR(64) NOT NULL,
  page_number INT NOT NULL,
  source_object_key VARCHAR(1024) NOT NULL,
  normalized_object_key VARCHAR(1024) NOT NULL DEFAULT '',
  width INT NOT NULL DEFAULT 0,
  height INT NOT NULL DEFAULT 0,
  quality_score INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'uploaded',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_paper_page_number (paper_id, page_number)
);

CREATE TABLE IF NOT EXISTS paper_ocr_result (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  paper_id VARCHAR(64) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  provider_task_id VARCHAR(128) NOT NULL DEFAULT '',
  model_version VARCHAR(64) NOT NULL DEFAULT '',
  markdown_object_key VARCHAR(1024) NOT NULL DEFAULT '',
  raw_result_object_key VARCHAR(1024) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS question_revision (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  question_id VARCHAR(64) NOT NULL,
  version BIGINT NOT NULL,
  snapshot_json JSON NOT NULL,
  change_source VARCHAR(32) NOT NULL,
  changed_by VARCHAR(64) NOT NULL DEFAULT '',
  change_reason VARCHAR(512) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  UNIQUE KEY uk_question_revision_version (question_id, version)
);
