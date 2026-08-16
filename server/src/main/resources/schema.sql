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
  question_ids_json JSON NULL,
  question_segments_json JSON NULL,
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
  difficulty VARCHAR(8) NOT NULL DEFAULT '中',
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
  stage VARCHAR(32) NOT NULL DEFAULT 'queued',
  result_object_key VARCHAR(1024) NOT NULL DEFAULT '',
  next_retry_at DATETIME NULL,
  locked_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_teaching_parse_job_paper (paper_id),
  KEY idx_teaching_parse_job_status (status, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  updated_at DATETIME NOT NULL,
  KEY idx_paper_ocr_paper (paper_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  preview_mode VARCHAR(32) NOT NULL DEFAULT 'first',
  free_question_count INT NOT NULL DEFAULT 0,
  preview_question_ids_json JSON NULL,
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
CREATE TABLE IF NOT EXISTS user_account (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  mobile VARCHAR(32) NOT NULL,
  email VARCHAR(255) NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  role VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_user_account_mobile (mobile),
  UNIQUE KEY uk_user_account_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_session (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uk_auth_session_token_hash (token_hash),
  KEY idx_auth_session_user (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS teacher_profile (
  user_id VARCHAR(64) NOT NULL PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL DEFAULT '',
  subject VARCHAR(64) NOT NULL DEFAULT '',
  grade_range VARCHAR(128) NOT NULL DEFAULT '',
  bio VARCHAR(1000) NOT NULL DEFAULT '',
  certification_status VARCHAR(32) NOT NULL DEFAULT 'unsubmitted',
  service_status VARCHAR(32) NOT NULL DEFAULT 'available',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_group (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  teacher_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  grade VARCHAR(64) NOT NULL DEFAULT '',
  description VARCHAR(500) NOT NULL DEFAULT '',
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  KEY idx_class_group_teacher (teacher_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_group_member (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  joined_at DATETIME NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  UNIQUE KEY uk_class_group_member (group_id, student_id),
  KEY idx_class_group_member_student (student_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_group_invite (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL,
  invite_code VARCHAR(16) NOT NULL,
  expires_at DATETIME NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL,
  UNIQUE KEY uk_class_group_invite_code (invite_code),
  KEY idx_class_group_invite_group (group_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_assignment (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL,
  teacher_id VARCHAR(64) NOT NULL,
  content_type VARCHAR(32) NOT NULL,
  content_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  due_at DATETIME NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL,
  KEY idx_class_assignment_group (group_id, created_at),
  KEY idx_class_assignment_teacher (teacher_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_assignment_recipient (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  assignment_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uk_assignment_recipient (assignment_id, student_id),
  KEY idx_assignment_recipient_student (student_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS student_assignment_submission (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  assignment_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  answer_text TEXT NULL,
  board_snapshot_json LONGTEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  submitted_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_assignment_submission (assignment_id, student_id),
  KEY idx_submission_assignment (assignment_id, submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_sync_room (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  group_id VARCHAR(64) NOT NULL,
  teacher_id VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  current_question_id VARCHAR(64) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL,
  closed_at DATETIME NULL,
  KEY idx_sync_room_teacher (teacher_id, created_at),
  KEY idx_sync_room_group (group_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_sync_room_member (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL,
  student_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY uk_sync_room_member (room_id, student_id),
  KEY idx_sync_room_member_student (student_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
