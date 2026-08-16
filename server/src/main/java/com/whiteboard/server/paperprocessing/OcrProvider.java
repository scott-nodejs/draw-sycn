package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.nio.file.Path;
import java.util.List;

public interface OcrProvider {
  String name();
  String submit(List<Path> sourceFiles, String dataId) throws Exception;
  PollResult poll(String requestId) throws Exception;
  DocumentArtifacts downloadDocumentArtifacts(PollResult result, Path outputDirectory) throws Exception;
  QuestionArtifacts downloadQuestionArtifacts(PollResult result, Path outputDirectory) throws Exception;

  final class PollResult {
    public final boolean done;
    public final JsonNode raw;
    public final List<String> resultUrls;
    public PollResult(boolean done, JsonNode raw, List<String> resultUrls) { this.done = done; this.raw = raw; this.resultUrls = resultUrls; }
  }

  final class DocumentArtifacts {
    public final String markdown;
    public final ArrayNode layout;
    public DocumentArtifacts(String markdown, ArrayNode layout) { this.markdown = markdown; this.layout = layout; }
  }

  final class QuestionArtifacts {
    public final String markdown;
    public final List<Path> figures;
    public QuestionArtifacts(String markdown, List<Path> figures) { this.markdown = markdown; this.figures = figures; }
  }
}
