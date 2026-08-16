package com.whiteboard.server.recording;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.whiteboard.server.config.WhiteboardProperties;
import com.whiteboard.server.recording.entity.RecordingSessionEntity;
import com.whiteboard.server.recording.mapper.RecordingSessionMapper;
import com.whiteboard.server.recording.upload.UploadCompleteRequest;
import java.util.List;
import java.util.stream.Collectors;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import com.qiniu.http.Client;
import com.qiniu.util.Auth;
import com.qiniu.storage.BucketManager;
import com.qiniu.storage.Configuration;
import com.qiniu.storage.Region;

@Service
public class RecordingService {
  private final ObjectMapper objectMapper;
  private final WhiteboardProperties properties;
  private final RecordingSessionMapper recordingSessionMapper;
  private final JdbcTemplate jdbc;
  private volatile String resolvedQiniuDomain;

  public RecordingService(
    ObjectMapper objectMapper,
    WhiteboardProperties properties,
    RecordingSessionMapper recordingSessionMapper,
    JdbcTemplate jdbc
  ) {
    this.objectMapper = objectMapper;
    this.properties = properties;
    this.recordingSessionMapper = recordingSessionMapper;
    this.jdbc = jdbc;
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
    RecordingSessionEntity session = findSession(sessionId);
    if (session != null && "qiniu".equals(session.getStorageProvider())) {
      return loadQiniuJson("whiteboard/" + sessionId + "/package.json");
    }
    Path packagePath = Paths.get(properties.getStorageRoot(), sessionId, "package.json");
    if (!Files.exists(packagePath)) {
      return null;
    }

    try (java.io.InputStream input = Files.newInputStream(packagePath)) {
      return objectMapper.readTree(input);
    }
  }

  public String getQiniuAudioUrl(String sessionId) {
    RecordingSessionEntity session = findSession(sessionId);
    if (session == null || !"qiniu".equals(session.getStorageProvider()) || session.getAudioUrl() == null || session.getAudioUrl().isEmpty()) {
      return null;
    }
    String key = objectKey(session.getAudioUrl());
    return signedQiniuUrl(key);
  }

  private JsonNode loadQiniuJson(String key) throws IOException {
    try {
      com.qiniu.http.Response response = new Client().get(signedQiniuUrl(key));
      try {
        return objectMapper.readTree(response.bodyString());
      } finally {
        response.close();
      }
    } catch (com.qiniu.common.QiniuException error) {
      throw new IOException("Failed to download Qiniu recording package: " + error.getMessage(), error);
    }
  }

  private String signedQiniuUrl(String key) {
    WhiteboardProperties.Qiniu qiniu = properties.getQiniu();
    String domain = resolveQiniuDomain(qiniu).replaceAll("/$", "");
    if (!domain.startsWith("http://") && !domain.startsWith("https://")) domain = "https://" + domain;
    Auth auth = Auth.create(qiniu.getAccessKey().trim(), qiniu.getSecretKey().trim());
    return auth.privateDownloadUrl(domain + "/" + key, Math.max(300, qiniu.getTokenExpireSeconds()));
  }

  private String resolveQiniuDomain(WhiteboardProperties.Qiniu qiniu) {
    if (qiniu.getPublicDomain() != null && !qiniu.getPublicDomain().trim().isEmpty()) {
      return qiniu.getPublicDomain().trim();
    }
    if (resolvedQiniuDomain != null) return resolvedQiniuDomain;
    try {
      Auth auth = Auth.create(qiniu.getAccessKey().trim(), qiniu.getSecretKey().trim());
      Configuration configuration = Configuration.create(Region.autoRegion());
      configuration.useHttpsDomains = true;
      String[] domains = new BucketManager(auth, configuration).domainList(qiniu.getBucket().trim());
      if (domains != null) {
        for (String domain : domains) {
          if (domain != null && !domain.trim().isEmpty()) {
            resolvedQiniuDomain = domain.trim();
            return resolvedQiniuDomain;
          }
        }
      }
      throw new IllegalStateException("No download domain is bound to Qiniu bucket " + qiniu.getBucket());
    } catch (com.qiniu.common.QiniuException error) {
      throw new IllegalStateException("Failed to discover Qiniu download domain", error);
    }
  }

  private String objectKey(String storedUrl) {
    if (storedUrl.startsWith("qiniu://")) {
      int slash = storedUrl.indexOf('/', "qiniu://".length());
      return slash >= 0 ? storedUrl.substring(slash + 1) : storedUrl;
    }
    int marker = storedUrl.indexOf("/whiteboard/");
    return marker >= 0 ? storedUrl.substring(marker + 1) : storedUrl;
  }

  private RecordingSessionEntity findSession(String sessionId) {
    return recordingSessionMapper.selectList(
      new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<RecordingSessionEntity>()
        .eq(RecordingSessionEntity::getSessionId, sessionId)
        .last("LIMIT 1")
    ).stream().findFirst().orElse(null);
  }

  public Map<String, String> saveAudio(String sessionId, MultipartFile file, String mimeType) throws IOException {
    if (file == null || file.isEmpty()) throw new IllegalArgumentException("Audio file is required");
    if (file.getSize() > 250L * 1024L * 1024L) throw new IllegalArgumentException("Audio file is too large");
    String actualMimeType = mimeType == null || mimeType.trim().isEmpty() ? file.getContentType() : mimeType;
    if (actualMimeType == null || !actualMimeType.toLowerCase().startsWith("audio/")) {
      throw new IllegalArgumentException("Unsupported audio content type");
    }
    String extension = actualMimeType.contains("ogg") ? "ogg" : actualMimeType.contains("mp4") ? "m4a" : "webm";
    Path sessionDir = safeSessionDir(sessionId);
    Files.createDirectories(sessionDir);
    Path audioPath = sessionDir.resolve("teacher-audio." + extension).normalize();
    if (!audioPath.startsWith(sessionDir)) throw new IllegalArgumentException("Invalid audio path");
    try (java.io.InputStream input = file.getInputStream()) {
      Files.copy(input, audioPath, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
    }
    Map<String, String> result = new LinkedHashMap<>();
    result.put("objectKey", sessionId + "/teacher-audio." + extension);
    result.put("audioUrl", "/api/whiteboard/recordings/" + sessionId + "/audio");
    return result;
  }

  public Path getAudioPath(String sessionId) throws IOException {
    Path sessionDir = safeSessionDir(sessionId);
    if (!Files.exists(sessionDir)) return null;
    try (java.util.stream.Stream<Path> paths = Files.list(sessionDir)) {
      return paths.filter(path -> path.getFileName().toString().startsWith("teacher-audio.")).findFirst().orElse(null);
    }
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
    JsonNode audio = recording.path("audio");
    manifest.audioUrl = audio.path("url").asText("");
    manifest.audioMimeType = audio.path("mimeType").asText("");
    manifest.audioDurationMs = audio.path("durationMs").asLong(0);
    manifest.audioStartOffsetMs = audio.path("startOffsetMs").asLong(0);
    return manifest;
  }

  public void upsertRecordingSession(RecordingManifest manifest, String storageProvider) {
    upsertRecordingSession(manifest, storageProvider, null);
  }

  @Transactional
  public void completeQiniuRecording(RecordingManifest manifest, UploadCompleteRequest request) {
    upsertRecordingSession(manifest, "qiniu", request);
    if (request.questionIds == null || request.questionIds.isEmpty()) return;

    String placeholders = String.join(",", java.util.Collections.nCopies(request.questionIds.size(), "?"));
    jdbc.update(
      "UPDATE teaching_question SET teaching_status='recorded', updated_at=? WHERE id IN (" + placeholders + ")",
      prepend(java.sql.Timestamp.valueOf(LocalDateTime.now()), request.questionIds)
    );
    if (request.paperId != null && !request.paperId.trim().isEmpty()) {
      jdbc.update(
        "UPDATE teaching_paper SET taught_count=(SELECT COUNT(*) FROM teaching_question WHERE paper_id=? AND teaching_status='recorded'), updated_at=? WHERE id=?",
        request.paperId,
        java.sql.Timestamp.valueOf(LocalDateTime.now()),
        request.paperId
      );
    }
  }

  private void upsertRecordingSession(RecordingManifest manifest, String storageProvider, UploadCompleteRequest request) {
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
    if (request != null) {
      entity.setLessonId(request.paperId);
      try {
        entity.setQuestionIdsJson(objectMapper.writeValueAsString(request.questionIds == null ? java.util.Collections.emptyList() : request.questionIds));
        entity.setQuestionSegmentsJson(objectMapper.writeValueAsString(request.questionSegments == null ? java.util.Collections.emptyList() : request.questionSegments));
      } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
        throw new IllegalArgumentException("Invalid recording question metadata", error);
      }
    }
    entity.setBaselineSnapshotUrl(manifest.baselineSnapshotUrl);
    entity.setEventManifestUrl(manifest.eventManifestUrl);
    entity.setAudioUrl(manifest.audioUrl == null ? "" : manifest.audioUrl);
    entity.setAudioMimeType(manifest.audioMimeType == null ? "" : manifest.audioMimeType);
    entity.setAudioDurationMs(manifest.audioDurationMs);
    entity.setAudioStartOffsetMs(manifest.audioStartOffsetMs);
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

  private Object[] prepend(Object first, List<String> values) {
    Object[] parameters = new Object[values.size() + 1];
    parameters[0] = first;
    for (int i = 0; i < values.size(); i++) parameters[i + 1] = values.get(i);
    return parameters;
  }

  private Path safeSessionDir(String sessionId) {
    if (sessionId == null || !sessionId.matches("[A-Za-z0-9_-]{1,128}")) {
      throw new IllegalArgumentException("Invalid recording session id");
    }
    Path storageRoot = Paths.get(properties.getStorageRoot()).toAbsolutePath().normalize();
    Path sessionDir = storageRoot.resolve(sessionId).normalize();
    if (!sessionDir.startsWith(storageRoot)) throw new IllegalArgumentException("Invalid recording session path");
    return sessionDir;
  }

  private void writeJson(Path path, JsonNode value) throws IOException {
    Files.createDirectories(path.getParent());
    Files.write(path, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(value).getBytes(StandardCharsets.UTF_8));
  }
}
