package com.whiteboard.server.live;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class LiveRoomService {
  private final Map<String, LiveRoom> rooms = new ConcurrentHashMap<>();

  public void startRoom(String roomId, JsonNode baselineSnapshot) {
    LiveRoom room = room(roomId);
    room.setBaselineSnapshot(baselineSnapshot);

    LiveMessage message = new LiveMessage();
    message.type = "baseline";
    message.roomId = roomId;
    message.baselineSnapshot = baselineSnapshot;
    message.timestamp = System.currentTimeMillis();
    broadcast(room, message);
  }

  public void publishEvent(String roomId, JsonNode event) {
    LiveMessage message = new LiveMessage();
    message.type = "event";
    message.roomId = roomId;
    message.event = event;
    message.timestamp = System.currentTimeMillis();
    broadcast(room(roomId), message);
  }

  public SseEmitter subscribe(String roomId) {
    LiveRoom room = room(roomId);
    SseEmitter emitter = new SseEmitter(0L);
    room.getClients().add(emitter);
    emitter.onCompletion(() -> room.getClients().remove(emitter));
    emitter.onTimeout(() -> room.getClients().remove(emitter));
    emitter.onError((error) -> room.getClients().remove(emitter));

    if (room.getBaselineSnapshot() != null) {
      LiveMessage message = new LiveMessage();
      message.type = "baseline";
      message.roomId = roomId;
      message.baselineSnapshot = room.getBaselineSnapshot();
      message.timestamp = System.currentTimeMillis();
      send(emitter, message);
    }

    return emitter;
  }

  private LiveRoom room(String roomId) {
    return rooms.computeIfAbsent(roomId, ignored -> new LiveRoom());
  }

  private void broadcast(LiveRoom room, LiveMessage message) {
    for (SseEmitter emitter : room.getClients()) {
      if (!send(emitter, message)) {
        room.getClients().remove(emitter);
      }
    }
  }

  private boolean send(SseEmitter emitter, LiveMessage message) {
    try {
      emitter.send(message);
      return true;
    } catch (IOException | IllegalStateException error) {
      emitter.completeWithError(error);
      return false;
    }
  }
}
