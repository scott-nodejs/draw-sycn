package com.whiteboard.server.recording.upload;

import java.util.List;

public class UploadInitResponse {
  public String sessionId;
  public String uploadId;
  public List<UploadPartResponse> parts;
}
