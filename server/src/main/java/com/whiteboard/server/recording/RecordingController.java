package com.whiteboard.server.recording;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api/whiteboard/recordings")
public class RecordingController {
  private final RecordingService recordingService;

  public RecordingController(RecordingService recordingService) {
    this.recordingService = recordingService;
  }

  @PostMapping
  public RecordingSaveResponse save(@RequestBody JsonNode recording) throws Exception {
    RecordingManifest manifest = recordingService.save(recording);
    return new RecordingSaveResponse(manifest, recording);
  }

  @GetMapping("/{sessionId}")
  public ResponseEntity<JsonNode> load(@PathVariable String sessionId) throws Exception {
    JsonNode recording = recordingService.load(sessionId);
    if (recording == null) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
    }

    return ResponseEntity.ok(recording);
  }

  @GetMapping
  public java.util.List<RecordingSessionDto> list(@RequestParam(defaultValue = "20") int limit) {
    return recordingService.listRecent(limit);
  }

  @PostMapping(value = "/{sessionId}/audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public Map<String, String> uploadAudio(
      @PathVariable String sessionId,
      @RequestParam MultipartFile file,
      @RequestParam String mimeType,
      @RequestParam(defaultValue = "0") long durationMs,
      @RequestParam(defaultValue = "0") long startOffsetMs) throws Exception {
    return recordingService.saveAudio(sessionId, file, mimeType);
  }

  @GetMapping("/{sessionId}/audio")
  public ResponseEntity<Resource> loadAudio(@PathVariable String sessionId) throws Exception {
    Path path = recordingService.getAudioPath(sessionId);
    if (path == null) return ResponseEntity.notFound().build();
    String filename = path.getFileName().toString();
    MediaType type = filename.endsWith(".ogg") ? MediaType.parseMediaType("audio/ogg")
      : filename.endsWith(".m4a") ? MediaType.parseMediaType("audio/mp4")
      : MediaType.parseMediaType("audio/webm");
    return ResponseEntity.ok().header("Accept-Ranges", "bytes").contentType(type).body(new FileSystemResource(path));
  }
}
