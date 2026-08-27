ALTER TABLE teaching_paper ADD COLUMN deleted_at DATETIME NULL AFTER status;
ALTER TABLE teaching_question ADD COLUMN deleted_at DATETIME NULL AFTER teaching_status;
