ALTER TABLE class_sync_room
  ADD COLUMN paused_at DATETIME(3) NULL AFTER started_at,
  ADD COLUMN pause_count INT NOT NULL DEFAULT 0 AFTER paused_at;
