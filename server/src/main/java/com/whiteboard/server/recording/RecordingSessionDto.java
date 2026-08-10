package com.whiteboard.server.recording;

import com.whiteboard.server.recording.entity.RecordingSessionEntity;
import java.time.LocalDateTime;

public class RecordingSessionDto {
  public String sessionId;
  public String lessonId;
  public String teacherId;
  public String roomId;
  public String title;
  public String storageProvider;
  public String baselineSnapshotUrl;
  public String eventManifestUrl;
  public String audioUrl;
  public String audioMimeType;
  public Long audioDurationMs;
  public Long audioStartOffsetMs;
  public Long durationMs;
  public Long eventCount;
  public Long chunkCount;
  public Integer status;
  public LocalDateTime createdAt;
  public LocalDateTime updatedAt;

  public static RecordingSessionDto fromEntity(RecordingSessionEntity entity) {
    RecordingSessionDto dto = new RecordingSessionDto();
    dto.sessionId = entity.getSessionId();
    dto.lessonId = entity.getLessonId();
    dto.teacherId = entity.getTeacherId();
    dto.roomId = entity.getRoomId();
    dto.title = entity.getTitle();
    dto.storageProvider = entity.getStorageProvider();
    dto.baselineSnapshotUrl = entity.getBaselineSnapshotUrl();
    dto.eventManifestUrl = entity.getEventManifestUrl();
    dto.audioUrl = entity.getAudioUrl();
    dto.audioMimeType = entity.getAudioMimeType();
    dto.audioDurationMs = entity.getAudioDurationMs();
    dto.audioStartOffsetMs = entity.getAudioStartOffsetMs();
    dto.durationMs = entity.getDurationMs();
    dto.eventCount = entity.getEventCount();
    dto.chunkCount = entity.getChunkCount();
    dto.status = entity.getStatus();
    dto.createdAt = entity.getCreatedAt();
    dto.updatedAt = entity.getUpdatedAt();
    return dto;
  }
}
