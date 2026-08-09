package com.whiteboard.server.recording.upload;

import com.whiteboard.server.config.WhiteboardProperties;
import com.whiteboard.server.recording.RecordingManifest;
import com.whiteboard.server.recording.RecordingService;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Base64;

@RestController
@RequestMapping("/api/whiteboard/recordings")
public class QiniuUploadController {
  private final WhiteboardProperties properties;
  private final RecordingService recordingService;

  public QiniuUploadController(WhiteboardProperties properties, RecordingService recordingService) {
    this.properties = properties;
    this.recordingService = recordingService;
  }

  @PostMapping("/qiniu/init")
  public UploadInitResponse init(@RequestBody UploadInitRequest request) {
    WhiteboardProperties.Qiniu qiniu = properties.getQiniu();
    requireQiniuConfig(qiniu);

    UploadInitResponse response = new UploadInitResponse();
    response.sessionId = request.sessionId;
    response.uploadId = "qiniu_" + request.sessionId;
    response.parts = new ArrayList<>();

    if (request.parts != null) {
      for (UploadPartRequest part : request.parts) {
        String key = "whiteboard/" + request.sessionId + "/" + toObjectFileName(part);

        UploadPartResponse item = new UploadPartResponse();
        item.id = part.id;
        item.objectKey = key;
        item.uploadUrl = qiniu.getUploadUrl();
        item.uploadToken = createUploadToken(qiniu, key);
        response.parts.add(item);
      }
    }

    return response;
  }

  @PostMapping("/{sessionId}/qiniu/complete")
  public RecordingManifest complete(@PathVariable String sessionId, @RequestBody UploadCompleteRequest request) {
    WhiteboardProperties.Qiniu qiniu = properties.getQiniu();

    RecordingManifest manifest = new RecordingManifest();
    manifest.sessionId = sessionId;
    manifest.title = request.title == null ? "" : request.title;
    manifest.createdAt = "";
    manifest.duration = request.duration;
    manifest.eventCount = request.eventCount;
    manifest.chunkCount = request.chunkCount;
    manifest.baselineSnapshotUrl = publicUrl(qiniu, "whiteboard/" + sessionId + "/baseline-snapshot.json");
    manifest.eventManifestUrl = publicUrl(qiniu, "whiteboard/" + sessionId + "/event-manifest.json");
    recordingService.upsertRecordingSession(manifest, "qiniu");
    return manifest;
  }

  private String createUploadToken(WhiteboardProperties.Qiniu qiniu, String key) {
    try {
      long deadline = System.currentTimeMillis() / 1000 + qiniu.getTokenExpireSeconds();
      String scope = qiniu.getBucket() + ":" + key;
      String policy =
        "{\"scope\":\"" + escapeJson(scope) + "\",\"deadline\":" + deadline
          + ",\"insertOnly\":0,\"returnBody\":\"{\\\"key\\\":\\\"$(key)\\\",\\\"hash\\\":\\\"$(etag)\\\",\\\"bucket\\\":\\\"$(bucket)\\\",\\\"fsize\\\":$(fsize)}\"}";
      String encodedPolicy = urlSafeBase64(policy.getBytes(StandardCharsets.UTF_8));
      Mac mac = Mac.getInstance("HmacSHA1");
      mac.init(new SecretKeySpec(qiniu.getSecretKey().getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
      String encodedSign = urlSafeBase64(mac.doFinal(encodedPolicy.getBytes(StandardCharsets.UTF_8)));
      return qiniu.getAccessKey() + ":" + encodedSign + ":" + encodedPolicy;
    } catch (Exception error) {
      throw new IllegalStateException("Failed to create Qiniu upload token", error);
    }
  }

  private void requireQiniuConfig(WhiteboardProperties.Qiniu qiniu) {
    if (isBlank(qiniu.getAccessKey()) || isBlank(qiniu.getSecretKey()) || isBlank(qiniu.getBucket())) {
      throw new IllegalStateException("Qiniu storage is not configured. Set QINIU_ACCESS_KEY, QINIU_SECRET_KEY and QINIU_BUCKET.");
    }
  }

  private String toObjectFileName(UploadPartRequest part) {
    if ("baseline".equals(part.type)) {
      return "baseline-snapshot.json";
    }

    if ("event-manifest".equals(part.type)) {
      return "event-manifest.json";
    }

    if ("event-chunk".equals(part.type)) {
      int index = part.chunkIndex == null ? 0 : part.chunkIndex;
      return String.format("events-%06d.json", index);
    }

    return "package.json";
  }

  private String publicUrl(WhiteboardProperties.Qiniu qiniu, String key) {
    if (isBlank(qiniu.getPublicDomain())) {
      return "qiniu://" + qiniu.getBucket() + "/" + key;
    }

    return qiniu.getPublicDomain().replaceAll("/$", "") + "/" + key;
  }

  private String escapeJson(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  private String urlSafeBase64(byte[] bytes) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  private boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
