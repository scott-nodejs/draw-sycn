package com.whiteboard.server.recording;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.whiteboard.server.config.WhiteboardProperties;
import com.whiteboard.server.recording.entity.RecordingSessionEntity;
import com.whiteboard.server.recording.mapper.RecordingSessionMapper;
import java.util.List;
import java.util.stream.Collectors;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;

@Service
public class RecordingService {
  private final ObjectMapper objectMapper;
  private final WhiteboardProperties properties;
  private final RecordingSessionMapper recordingSessionMapper;

  public RecordingService(
    ObjectMapper objectMapper,
    WhiteboardProperties properties,
    RecordingSessionMapper recordingSessionMapper
  ) {
    this.objectMapper = objectMapper;
    this.properties = properties;
    this.recordingSessionMapper = recordingSessionMapper;
  }

  public RecordingManifest save(JsonNode recording) throws IOException {
    validateRecording(recording);

    String sessionId = recording.get("sessionId").asText();
    Path sessionDir = Paths.get(properties.getStorageRoot(), sessionId);
    Files.createDirectories(sessionDir);

    writeJson(sessionDir.resolve("baseline-snapshot.json"), recording.get("baselineSnapshot"));
    writeJson(sessionDir.resolve("event-manifest.json"), recording.get("eventManifest"));
    writeJson(sessionDir.resolve("package.json"), recording);

    JsonNode chunks = recording.get("chunks");
    if (chunks != null && chunks.isArray()) {
      for (JsonNode chunk : chunks) {
        int index = chunk.get("index").asInt();
        String fileName = String.format("events-%06d.json", index);
        writeJson(sessionDir.resolve(fileName), chunk);
      }
    }

    RecordingManifest manifest = toManifest(recording);
    upsertRecordingSession(manifest, "local");
    return manifest;
  }

  public JsonNode load(String sessionId) throws IOException {
    Path packagePath = Paths.get(properties.getStorageRoot(), sessionId, "package.json");
    if (!Files.exists(packagePath)) {
      return null;
    }

    return objectMapper.readTree(Files.newInputStream(packagePath));
  }

  public List<RecordingSessionDto> listRecent(int limit) {
    return recordingSessionMapper
      .selectList(
        new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RecordingSessionEntity>()
          .orderByDesc(RecordingSessionEntity::getCreatedAt)
          .last("LIMIT " + Math.max(1, Math.min(limit, 100)))
      )
      .stream()
      .map(RecordingSessionDto::fromEntity)
      .collect(Collectors.toList());
  }

  private RecordingManifest toManifest(JsonNode recording) {
    RecordingManifest manifest = new RecordingManifest();
    manifest.sessionId = recording.get("sessionId").asText();
    manifest.title = recording.path("title").asText("");
    manifest.createdAt = recording.path("createdAt").asText("");
    manifest.duration = recording.path("duration").asLong(0);
    manifest.eventCount = recording.path("eventCount").asLong(0);
    manifest.chunkCount = recording.path("eventManifest").path("chunkCount").asLong(0);
    manifest.baselineSnapshotUrl = "local://whiteboard/" + manifest.sessionId + "/baseline-snapshot.json";
    manifest.eventManifestUrl = "local://whiteboard/" + manifest.sessionId + "/event-manifest.json";
    return manifest;
  }

  public void upsertRecordingSession(RecordingManifest manifest, String storageProvider) {
    LocalDateTime now = LocalDateTime.now();
    RecordingSessionEntity existing = recordingSessionMapper
      .selectList(
        new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RecordingSessionEntity>()
          .eq(RecordingSessionEntity::getSessionId, manifest.sessionId)
          .last("LIMIT 1")
      )
      .stream()
      .findFirst()
      .orElse(null);

    RecordingSessionEntity entity = existing == null ? new RecordingSessionEntity() : existing;
    if (existing == null) {
      entity.setId(manifest.sessionId);
      entity.setSessionId(manifest.sessionId);
      entity.setCreatedAt(now);
    }

    entity.setTitle(manifest.title);
    entity.setStorageProvider(storageProvider);
    entity.setBaselineSnapshotUrl(manifest.baselineSnapshotUrl);
    entity.setEventManifestUrl(manifest.eventManifestUrl);
    entity.setDurationMs(manifest.duration);
    entity.setEventCount(manifest.eventCount);
    entity.setChunkCount(manifest.chunkCount);
    entity.setStatus(1);
    entity.setUpdatedAt(now);

    if (existing == null) {
      recordingSessionMapper.insert(entity);
    } else {
      recordingSessionMapper.updateById(entity);
    }
  }

  private void validateRecording(JsonNode recording) {
    if (recording == null || recording.path("version").asInt() != 1) {
      throw new IllegalArgumentException("Unsupported recording version");
    }

    if (!"tldraw-store-diff".equals(recording.path("protocol").asText())) {
      throw new IllegalArgumentException("Unsupported recording protocol");
    }

    if (recording.path("sessionId").asText("").isEmpty() || !recording.has("baselineSnapshot")) {
      throw new IllegalArgumentException("Invalid recording package");
    }
  }

  private void writeJson(Path path, JsonNode value) throws IOException {
    Files.createDirectories(path.getParent());
    Files.write(path, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(value).getBytes(StandardCharsets.UTF_8));
  }
}
