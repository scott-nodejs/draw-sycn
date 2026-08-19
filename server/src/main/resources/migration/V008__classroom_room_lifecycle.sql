ALTER TABLE class_sync_room
  ADD COLUMN max_rtc_seats INT NOT NULL DEFAULT 3 AFTER status,
  ADD COLUMN started_at DATETIME NULL AFTER max_rtc_seats,
  ADD COLUMN ended_at DATETIME NULL AFTER started_at;

ALTER TABLE class_sync_room_member
  ADD COLUMN presence_status VARCHAR(32) NOT NULL DEFAULT 'OFFLINE' AFTER student_id,
  ADD COLUMN joined_at DATETIME NULL AFTER presence_status,
  ADD COLUMN left_at DATETIME NULL AFTER joined_at,
  ADD COLUMN last_seen_at DATETIME NULL AFTER left_at,
  ADD COLUMN can_publish_audio TINYINT NOT NULL DEFAULT 0 AFTER last_seen_at,
  ADD COLUMN can_write_canvas TINYINT NOT NULL DEFAULT 0 AFTER can_publish_audio;

UPDATE class_sync_room SET status=CASE WHEN status='open' THEN 'ACTIVE' WHEN status='closed' THEN 'ENDED' ELSE status END;

CREATE TABLE IF NOT EXISTS class_sync_room_event (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  room_id VARCHAR(64) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  actor_id VARCHAR(64) NOT NULL DEFAULT '',
  target_user_id VARCHAR(64) NOT NULL DEFAULT '',
  payload_json JSON NULL,
  occurred_at DATETIME(3) NOT NULL,
  KEY idx_room_event_cursor (room_id, id),
  KEY idx_room_event_time (room_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_sync_hand_raise (
  id VARCHAR(64) NOT NULL PRIMARY KEY, room_id VARCHAR(64) NOT NULL, student_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL, raised_at DATETIME(3) NOT NULL, invited_at DATETIME(3) NULL,
  connected_at DATETIME(3) NULL, ended_at DATETIME(3) NULL, created_at DATETIME(3) NOT NULL,
  KEY idx_hand_raise_queue (room_id,status,raised_at), KEY idx_hand_raise_student (room_id,student_id,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS class_sync_rtc_session (
  id VARCHAR(64) NOT NULL PRIMARY KEY, room_id VARCHAR(64) NOT NULL, user_id VARCHAR(64) NOT NULL,
  role VARCHAR(16) NOT NULL, status VARCHAR(32) NOT NULL, mute_status VARCHAR(16) NOT NULL DEFAULT 'UNMUTED',
  joined_at DATETIME(3) NULL, left_at DATETIME(3) NULL, created_at DATETIME(3) NOT NULL,
  KEY idx_rtc_room_status (room_id,status), KEY idx_rtc_user (room_id,user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
