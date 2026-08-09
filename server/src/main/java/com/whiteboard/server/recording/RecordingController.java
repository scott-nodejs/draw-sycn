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
}
