CREATE TABLE IF NOT EXISTS organizer_paper_workspace (
  id VARCHAR(64) NOT NULL PRIMARY KEY, paper_id VARCHAR(64) NOT NULL, organizer_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'processing', created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
  UNIQUE KEY uk_organizer_workspace_paper (paper_id), KEY idx_organizer_workspace_user (organizer_id, updated_at)
);
CREATE TABLE IF NOT EXISTS organizer_question_set (
  id VARCHAR(64) NOT NULL PRIMARY KEY, organizer_id VARCHAR(64) NOT NULL, product_id VARCHAR(64) NULL,
  title VARCHAR(255) NOT NULL, description TEXT NOT NULL, subject VARCHAR(64) NOT NULL, grade VARCHAR(64) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0, status VARCHAR(32) NOT NULL DEFAULT 'draft', created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL, KEY idx_organizer_question_set_user (organizer_id, updated_at)
);
CREATE TABLE IF NOT EXISTS organizer_question_set_item (
  set_id VARCHAR(64) NOT NULL, question_id VARCHAR(64) NOT NULL, sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (set_id, question_id), KEY idx_organizer_set_item_sort (set_id, sort_order)
);
