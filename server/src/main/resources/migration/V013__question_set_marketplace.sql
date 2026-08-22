CREATE TABLE IF NOT EXISTS question_set_purchase (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  question_set_id VARCHAR(64) NOT NULL,
  teacher_id VARCHAR(64) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(32) NOT NULL,
  payment_trade_no VARCHAR(128) NULL,
  paid_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  KEY idx_qset_purchase_teacher (teacher_id,status,created_at),
  KEY idx_qset_purchase_set (question_set_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
