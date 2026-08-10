-- Apply this migration to existing installations before deploying audio-enabled recording clients.
ALTER TABLE whiteboard_recording_session
  ADD COLUMN audio_url VARCHAR(1024) NOT NULL DEFAULT '' AFTER event_manifest_url,
  ADD COLUMN audio_mime_type VARCHAR(128) NOT NULL DEFAULT '' AFTER audio_url,
  ADD COLUMN audio_duration_ms BIGINT NOT NULL DEFAULT 0 AFTER audio_mime_type,
  ADD COLUMN audio_start_offset_ms BIGINT NOT NULL DEFAULT 0 AFTER audio_duration_ms;
