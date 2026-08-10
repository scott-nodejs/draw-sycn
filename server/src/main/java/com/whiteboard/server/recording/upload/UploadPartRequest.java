package com.whiteboard.server.recording.upload;

public class UploadPartRequest {
  public String id;
  public String type;
  public long sizeBytes;
  public Integer chunkIndex;
  public String mimeType;
}
