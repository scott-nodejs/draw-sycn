CREATE TABLE IF NOT EXISTS paper_recognition_report (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  paper_id VARCHAR(64) NOT NULL,
  job_id VARCHAR(64) NOT NULL,
  pipeline_version VARCHAR(32) NOT NULL,
  overall_score INT NOT NULL,
  native_page_count INT NOT NULL DEFAULT 0,
  ocr_page_count INT NOT NULL DEFAULT 0,
  repaired_page_count INT NOT NULL DEFAULT 0,
  question_count INT NOT NULL DEFAULT 0,
  manual_review_count INT NOT NULL DEFAULT 0,
  cross_page_count INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL,
  report_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_recognition_report_job (job_id),
  KEY idx_recognition_report_paper (paper_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
