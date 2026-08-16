package com.whiteboard.server.recording.upload;

import java.util.List;

public class UploadCompleteRequest {
  public String sessionId;
  public String uploadId;
  public String title;
  public long duration;
  public long eventCount;
  public long chunkCount;
  public String audioMimeType;
  public long audioDurationMs;
  public long audioStartOffsetMs;
  public String paperId;
  public List<String> questionIds;
  public List<QuestionSegment> questionSegments;
  public List<UploadedPart> parts;

  public static class QuestionSegment {
    public String questionId;
    public int questionNumber;
    public long startMs;
    public long endMs;
  }
}
