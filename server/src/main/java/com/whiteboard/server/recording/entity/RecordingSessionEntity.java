package com.whiteboard.server.recording.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;

@TableName("whiteboard_recording_session")
public class RecordingSessionEntity {
  @TableId
  private String id;
  private String sessionId;
  private String lessonId;
  private String teacherId;
  private String roomId;
  private String title;
  private String storageProvider;
  private String baselineSnapshotUrl;
  private String eventManifestUrl;
  private String audioUrl;
  private String audioMimeType;
  private Long audioDurationMs;
  private Long audioStartOffsetMs;
  private Long durationMs;
  private Long eventCount;
  private Long chunkCount;
  private Integer status;
  private LocalDateTime createdAt;
  private LocalDateTime updatedAt;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getSessionId() {
    return sessionId;
  }

  public void setSessionId(String sessionId) {
    this.sessionId = sessionId;
  }

  public String getLessonId() {
    return lessonId;
  }

  public void setLessonId(String lessonId) {
    this.lessonId = lessonId;
  }

  public String getTeacherId() {
    return teacherId;
  }

  public void setTeacherId(String teacherId) {
    this.teacherId = teacherId;
  }

  public String getRoomId() {
    return roomId;
  }

  public void setRoomId(String roomId) {
    this.roomId = roomId;
  }

  public String getTitle() {
    return title;
  }

  public void setTitle(String title) {
    this.title = title;
  }

  public String getStorageProvider() {
    return storageProvider;
  }

  public void setStorageProvider(String storageProvider) {
    this.storageProvider = storageProvider;
  }

  public String getBaselineSnapshotUrl() {
    return baselineSnapshotUrl;
  }

  public void setBaselineSnapshotUrl(String baselineSnapshotUrl) {
    this.baselineSnapshotUrl = baselineSnapshotUrl;
  }

  public String getEventManifestUrl() {
    return eventManifestUrl;
  }

  public void setEventManifestUrl(String eventManifestUrl) {
    this.eventManifestUrl = eventManifestUrl;
  }

  public String getAudioUrl() { return audioUrl; }
  public void setAudioUrl(String audioUrl) { this.audioUrl = audioUrl; }
  public String getAudioMimeType() { return audioMimeType; }
  public void setAudioMimeType(String audioMimeType) { this.audioMimeType = audioMimeType; }
  public Long getAudioDurationMs() { return audioDurationMs; }
  public void setAudioDurationMs(Long audioDurationMs) { this.audioDurationMs = audioDurationMs; }
  public Long getAudioStartOffsetMs() { return audioStartOffsetMs; }
  public void setAudioStartOffsetMs(Long audioStartOffsetMs) { this.audioStartOffsetMs = audioStartOffsetMs; }

  public Long getDurationMs() {
    return durationMs;
  }

  public void setDurationMs(Long durationMs) {
    this.durationMs = durationMs;
  }

  public Long getEventCount() {
    return eventCount;
  }

  public void setEventCount(Long eventCount) {
    this.eventCount = eventCount;
  }

  public Long getChunkCount() {
    return chunkCount;
  }

  public void setChunkCount(Long chunkCount) {
    this.chunkCount = chunkCount;
  }

  public Integer getStatus() {
    return status;
  }

  public void setStatus(Integer status) {
    this.status = status;
  }

  public LocalDateTime getCreatedAt() {
    return createdAt;
  }

  public void setCreatedAt(LocalDateTime createdAt) {
    this.createdAt = createdAt;
  }

  public LocalDateTime getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(LocalDateTime updatedAt) {
    this.updatedAt = updatedAt;
  }
}
