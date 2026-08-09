package com.whiteboard.server.live;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public class LiveRoom {
  private JsonNode baselineSnapshot;
  private final Set<SseEmitter> clients = new CopyOnWriteArraySet<>();

  public JsonNode getBaselineSnapshot() {
    return baselineSnapshot;
  }

  public void setBaselineSnapshot(JsonNode baselineSnapshot) {
    this.baselineSnapshot = baselineSnapshot;
  }

  public Set<SseEmitter> getClients() {
    return clients;
  }
}
