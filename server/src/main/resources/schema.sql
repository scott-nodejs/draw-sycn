CREATE TABLE IF NOT EXISTS whiteboard_recording_session (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  session_id VARCHAR(128) NOT NULL,
  lesson_id VARCHAR(128) NULL,
  teacher_id VARCHAR(128) NULL,
  room_id VARCHAR(128) NULL,
  title VARCHAR(255) NOT NULL DEFAULT '',
  storage_provider VARCHAR(32) NOT NULL DEFAULT 'local',
  baseline_snapshot_url VARCHAR(1024) NOT NULL DEFAULT '',
  event_manifest_url VARCHAR(1024) NOT NULL DEFAULT '',
  audio_url VARCHAR(1024) NOT NULL DEFAULT '',
  audio_mime_type VARCHAR(128) NOT NULL DEFAULT '',
  audio_duration_ms BIGINT NOT NULL DEFAULT 0,
  audio_start_offset_ms BIGINT NOT NULL DEFAULT 0,
  duration_ms BIGINT NOT NULL DEFAULT 0,
  event_count BIGINT NOT NULL DEFAULT 0,
  chunk_count BIGINT NOT NULL DEFAULT 0,
  status TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_whiteboard_recording_session_session_id (session_id),
  KEY idx_whiteboard_recording_session_lesson_id (lesson_id),
  KEY idx_whiteboard_recording_session_room_id (room_id),
  KEY idx_whiteboard_recording_session_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teaching_paper (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL DEFAULT '',
  creator_id VARCHAR(64) NOT NULL DEFAULT '',
  title VARCHAR(255) NOT NULL,
  subject VARCHAR(64) NOT NULL,
  grade VARCHAR(64) NOT NULL,
  source VARCHAR(128) NOT NULL DEFAULT '',
  pdf_object_key VARCHAR(1024) NOT NULL DEFAULT '',
  page_count INT NOT NULL DEFAULT 0,
  question_count INT NOT NULL DEFAULT 0,
  reviewed_count INT NOT NULL DEFAULT 0,
  taught_count INT NOT NULL DEFAULT 0,
  progress INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'processing',
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_teaching_paper_org_created (organization_id, created_at),
  KEY idx_teaching_paper_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teaching_question (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  paper_id VARCHAR(64) NOT NULL,
  question_number INT NOT NULL,
  question_type VARCHAR(32) NOT NULL,
  stem TEXT NOT NULL,
  options_json JSON NULL,
  answer TEXT NOT NULL,
  analysis TEXT NOT NULL,
  points DECIMAL(8,2) NOT NULL DEFAULT 0,
  confidence INT NOT NULL DEFAULT 0,
  review_status VARCHAR(32) NOT NULL DEFAULT 'review',
  teaching_status VARCHAR(32) NOT NULL DEFAULT 'unrecorded',
  crop_regions_json JSON NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_teaching_question_paper_number (paper_id, question_number),
  KEY idx_teaching_question_review (paper_id, review_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teaching_parse_job (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  paper_id VARCHAR(64) NOT NULL,
  provider VARCHAR(64) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  progress INT NOT NULL DEFAULT 0,
  request_id VARCHAR(128) NOT NULL DEFAULT '',
  error_code VARCHAR(64) NOT NULL DEFAULT '',
  error_message VARCHAR(1024) NOT NULL DEFAULT '',
  retry_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_teaching_parse_job_paper (paper_id),
  KEY idx_teaching_parse_job_status (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teaching_task (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  student_id VARCHAR(64) NOT NULL,
  student_name VARCHAR(128) NOT NULL,
  student_grade VARCHAR(64) NOT NULL,
  subject VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  question_count INT NOT NULL DEFAULT 0,
  service_type VARCHAR(32) NOT NULL,
  expected_at VARCHAR(128) NOT NULL,
  budget DECIMAL(10,2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  teacher_id VARCHAR(64) NULL,
  teacher_name VARCHAR(128) NULL,
  tags_json JSON NULL,
  version BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_teaching_task_status_created (status, created_at),
  KEY idx_teaching_task_student (student_id, created_at),
  KEY idx_teaching_task_teacher (teacher_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teaching_task_application (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  task_id VARCHAR(64) NOT NULL,
  teacher_id VARCHAR(64) NOT NULL,
  teacher_name VARCHAR(128) NOT NULL,
  message VARCHAR(1024) NOT NULL DEFAULT '',
  quoted_price DECIMAL(10,2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_task_application_task_teacher (task_id, teacher_id),
  KEY idx_task_application_task_status (task_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_product (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  teacher_id VARCHAR(64) NOT NULL,
  teacher_name VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(512) NOT NULL DEFAULT '',
  subject VARCHAR(64) NOT NULL,
  grade VARCHAR(64) NOT NULL,
  product_type VARCHAR(32) NOT NULL,
  paper_id VARCHAR(64) NULL,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  cover_style VARCHAR(32) NOT NULL DEFAULT 'indigo',
  lesson_count INT NOT NULL DEFAULT 0,
  duration VARCHAR(64) NOT NULL DEFAULT '',
  sales INT NOT NULL DEFAULT 0,
  rating DECIMAL(3,2) NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  highlights_json JSON NULL,
  version BIGINT NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_learning_product_status_published (status, published_at),
  KEY idx_learning_product_teacher (teacher_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_product_question (
  product_id VARCHAR(64) NOT NULL,
  question_id VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, question_id),
  KEY idx_product_question_sort (product_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_product_recording (
  product_id VARCHAR(64) NOT NULL,
  recording_session_id VARCHAR(128) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, recording_session_id),
  KEY idx_product_recording_sort (product_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_purchase (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  product_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  payment_trade_no VARCHAR(128) NOT NULL DEFAULT '',
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_learning_purchase_product_student (product_id, student_id),
  KEY idx_learning_purchase_student_status (student_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
