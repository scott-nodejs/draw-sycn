package com.whiteboard.server.live;

import com.fasterxml.jackson.databind.JsonNode;

public class LiveMessage {
  public String type;
  public String roomId;
  public JsonNode baselineSnapshot;
  public JsonNode event;
  public long timestamp;
}
