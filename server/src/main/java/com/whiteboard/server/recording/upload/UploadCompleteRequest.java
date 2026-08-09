package com.whiteboard.server.recording.upload;

import java.util.List;

public class UploadCompleteRequest {
  public String sessionId;
  public String uploadId;
  public String title;
  public long duration;
  public long eventCount;
  public long chunkCount;
  public List<UploadedPart> parts;
}
