ALTER TABLE teaching_paper
  ADD COLUMN source_cloud_key VARCHAR(1024) NOT NULL DEFAULT '' AFTER pdf_object_key,
  ADD COLUMN cloud_status VARCHAR(32) NOT NULL DEFAULT 'pending' AFTER source_cloud_key,
  ADD COLUMN cloud_error VARCHAR(1024) NOT NULL DEFAULT '' AFTER cloud_status;

ALTER TABLE paper_page
  ADD COLUMN preview_cloud_key VARCHAR(1024) NOT NULL DEFAULT '' AFTER normalized_object_key;
