package com.whiteboard.server.live;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Collections;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/whiteboard/rooms")
public class LiveRoomController {
  private final LiveRoomService liveRoomService;

  public LiveRoomController(LiveRoomService liveRoomService) {
    this.liveRoomService = liveRoomService;
  }

  @PostMapping("/{roomId}/start")
  public Map<String, String> start(@PathVariable String roomId, @RequestBody JsonNode body) {
    liveRoomService.startRoom(roomId, body.get("baselineSnapshot"));
    return Collections.singletonMap("status", "started");
  }

  @PostMapping("/{roomId}/events")
  public Map<String, String> publish(@PathVariable String roomId, @RequestBody JsonNode body) {
    liveRoomService.publishEvent(roomId, body.get("event"));
    return Collections.singletonMap("status", "published");
  }

  @GetMapping(path = "/{roomId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
  public SseEmitter stream(@PathVariable String roomId) {
    return liveRoomService.subscribe(roomId);
  }
}
