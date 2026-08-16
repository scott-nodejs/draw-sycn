CREATE TABLE IF NOT EXISTS user_account (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  mobile VARCHAR(32) NOT NULL UNIQUE,
  email VARCHAR(255) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  role VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_session (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL
);
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
);
