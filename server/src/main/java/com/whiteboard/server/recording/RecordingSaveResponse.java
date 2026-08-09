package com.whiteboard.server.recording;

import com.fasterxml.jackson.databind.JsonNode;

public class RecordingSaveResponse {
  public RecordingManifest manifest;
  public JsonNode packagePayload;

  public RecordingSaveResponse(RecordingManifest manifest, JsonNode packagePayload) {
    this.manifest = manifest;
    this.packagePayload = packagePayload;
  }
}
