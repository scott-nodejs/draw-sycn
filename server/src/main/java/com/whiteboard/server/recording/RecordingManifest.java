package com.whiteboard.server.recording;

public class RecordingManifest {
  public String sessionId;
  public String title;
  public String createdAt;
  public long duration;
  public long eventCount;
  public long chunkCount;
  public String baselineSnapshotUrl;
  public String eventManifestUrl;
  public String audioUrl;
  public String audioMimeType;
  public long audioDurationMs;
  public long audioStartOffsetMs;
}
