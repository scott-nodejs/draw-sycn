package com.whiteboard.server.recording.upload;

import java.util.List;

public class UploadInitRequest {
  public String sessionId;
  public String title;
  public long duration;
  public long eventCount;
  public long chunkCount;
  public List<UploadPartRequest> parts;
}
