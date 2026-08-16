ALTER TABLE teaching_question
  ADD COLUMN difficulty VARCHAR(8) NOT NULL DEFAULT '中' AFTER confidence;
