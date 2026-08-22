ALTER TABLE organizer_question_set ADD COLUMN collection_type VARCHAR(32) NOT NULL DEFAULT 'topic' AFTER grade;
ALTER TABLE organizer_question_set ADD COLUMN topic_label VARCHAR(128) NOT NULL DEFAULT '' AFTER collection_type;
