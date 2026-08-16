ALTER TABLE learning_product
  ADD COLUMN preview_mode VARCHAR(32) NOT NULL DEFAULT 'first' AFTER highlights_json,
  ADD COLUMN free_question_count INT NOT NULL DEFAULT 0 AFTER preview_mode,
  ADD COLUMN preview_question_ids_json JSON NULL AFTER free_question_count;
