package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Owns physical question boundaries. The language model only owns semantic fields. */
@Component
public class QuestionBoundaryResolver {
  private static final Logger log = LoggerFactory.getLogger(QuestionBoundaryResolver.class);
  private final ObjectMapper json;

  public QuestionBoundaryResolver(ObjectMapper json) { this.json = json; }

  public void resolve(JsonNode structured, ArrayNode blocks) {
    JsonNode questions = structured.path("questions");
    if (!questions.isArray()) return;
    List<Boundary> starts = new ArrayList<>();
    for (JsonNode question : questions) {
      int number = question.path("number").asInt();
      starts.add(new Boundary(question, number, findStart(blocks, number)));
    }
    for (Boundary current : starts) resolveOne(current, nextStart(starts, current.start), blocks);
  }

  private void resolveOne(Boundary boundary, int next, ArrayNode blocks) {
    if (!(boundary.question instanceof ObjectNode)) return;
    ObjectNode question = (ObjectNode) boundary.question;
    ArrayNode warnings = question.withArray("warnings");
    if (boundary.start < 0) {
      warnings.add("question_start_not_found");
      ensureFallbackRegion(question, blocks);
      question.put("confidence", Math.min(question.path("confidence").asInt(50), 45));
      quality(question, 35, 0, false);
      log.warn("Question boundary fallback: number={}, reason=start_not_found, totalBlocks={}", boundary.number, blocks.size());
      return;
    }

    int end = next < 0 ? findAnswerSection(blocks, boundary.start + 1) : next;
    if (end < 0) end = blocks.size();
    Map<Integer, Bounds> pages = new LinkedHashMap<>();
    List<JsonNode> figures = new ArrayList<>();
    int textBlocks = 0;
    for (int index = boundary.start; index < end; index++) {
      JsonNode block = blocks.get(index);
      JsonNode box = block.path("bbox");
      if (!valid(box)) continue;
      int page = block.path("pageNumber").asInt();
      if (page <= 0) continue;
      pages.computeIfAbsent(page, key -> new Bounds()).include(box);
      if ("figure".equals(block.path("type").asText())) figures.add(block); else textBlocks++;
    }

    // Layout providers may append image blocks after all text. Recover ownership by geometry.
    attachSpatialFigures(blocks, pages, figures);

    ArrayNode regions = question.putArray("sourceRegions");
    for (Map.Entry<Integer, Bounds> entry : pages.entrySet()) {
      Bounds b = entry.getValue();
      ObjectNode region = regions.addObject();
      region.put("pageNumber", entry.getKey());
      region.put("x0", clamp(b.x0 - 8));
      region.put("y0", clamp(b.y0 - 8));
      region.put("x1", clamp(b.x1 + 8));
      region.put("y1", clamp(b.y1 + 8));
    }
    ArrayNode figureRegions = question.putArray("figureRegions");
    for (JsonNode figure : figures) {
      JsonNode box = figure.path("bbox");
      ObjectNode region = figureRegions.addObject();
      region.put("pageNumber", figure.path("pageNumber").asInt());
      region.put("x0", box.get(0).asInt());
      region.put("y0", box.get(1).asInt());
      region.put("x1", box.get(2).asInt());
      region.put("y1", box.get(3).asInt());
      if (figure.hasNonNull("objectKey")) region.put("objectKey", figure.path("objectKey").asText());
    }
    boolean crossPage = pages.size() > 1;
    int score = 55 + Math.min(20, textBlocks * 2) + (next >= 0 ? 10 : 0) + (figures.isEmpty() ? 0 : 5);
    score = Math.min(100, score);
    if (next < 0) warnings.add("last_question_boundary_uses_document_end");
    if (crossPage) warnings.add("cross_page_question_merged");
    warnings.add("source_region_verified_from_layout_v3");
    question.put("confidence", Math.min(question.path("confidence").asInt(80), score));
    quality(question, score, textBlocks, crossPage);
    log.info("Question boundary resolved: number={}, startBlock={}, endBlock={}, pages={}, textBlocks={}, figures={}, score={}", boundary.number, boundary.start, end, pages.keySet(), textBlocks, figures.size(), score);
  }

  private void attachSpatialFigures(ArrayNode blocks, Map<Integer, Bounds> pages, List<JsonNode> figures) {
    for (JsonNode block : blocks) {
      if (!"figure".equals(block.path("type").asText()) || !valid(block.path("bbox"))) continue;
      int page = block.path("pageNumber").asInt();
      Bounds question = pages.get(page);
      if (question == null) continue;
      JsonNode box = block.path("bbox");
      int centerY = (box.get(1).asInt() + box.get(3).asInt()) / 2;
      int tolerance = Math.max(24, (question.y1 - question.y0) / 3);
      if (centerY >= question.y0 - tolerance && centerY <= question.y1 + tolerance && !figures.contains(block)) {
        figures.add(block);
        question.include(box);
      }
    }
  }

  private void quality(ObjectNode question, int score, int blockCount, boolean crossPage) {
    ObjectNode quality = question.putObject("boundaryQuality");
    quality.put("score", score);
    quality.put("blockCount", blockCount);
    quality.put("crossPage", crossPage);
    quality.put("requiresManualReview", score < 70);
  }

  private void ensureFallbackRegion(ObjectNode question, ArrayNode blocks) {
    JsonNode existing = question.path("sourceRegions");
    if (existing.isArray() && existing.size() > 0 && validRegion(existing.get(0))) return;
    int page = blocks.size() > 0 ? Math.max(1, blocks.get(0).path("pageNumber").asInt(1)) : 1;
    ArrayNode regions = question.putArray("sourceRegions");
    ObjectNode region = regions.addObject();
    region.put("pageNumber", page);
    region.put("x0", 0); region.put("y0", 0); region.put("x1", 1000); region.put("y1", 1000);
    question.putArray("figureRegions");
  }

  private boolean validRegion(JsonNode region) {
    int x0 = region.path("x0").asInt(-1), y0 = region.path("y0").asInt(-1);
    int x1 = region.path("x1").asInt(-1), y1 = region.path("y1").asInt(-1);
    return region.path("pageNumber").asInt() > 0 && x0 >= 0 && y0 >= 0 && x1 <= 1000 && y1 <= 1000 && x1 > x0 && y1 > y0;
  }

  private int nextStart(List<Boundary> boundaries, int current) {
    int next = Integer.MAX_VALUE;
    for (Boundary value : boundaries) if (value.start > current && value.start < next) next = value.start;
    return next == Integer.MAX_VALUE ? -1 : next;
  }

  private int findStart(ArrayNode blocks, int number) {
    Pattern pattern = Pattern.compile("^\\s*" + number + "\\s*[.\\uFF0E\\u3001\\u3002)\\uFF09:]", Pattern.DOTALL);
    for (int i = 0; i < blocks.size(); i++) {
      String text = blocks.get(i).path("text").asText().trim();
      if (pattern.matcher(text).find()) return i;
    }
    return -1;
  }

  private int findAnswerSection(ArrayNode blocks, int from) {
    for (int i = Math.max(0, from); i < blocks.size(); i++) {
      String text = blocks.get(i).path("text").asText().replace(" ", "");
      if (text.startsWith("\u53C2\u8003\u7B54\u6848") || text.startsWith("\u7B54\u6848\u4E0E\u89E3\u6790") || text.startsWith("\u8BD5\u9898\u7B54\u6848")) return i;
    }
    return -1;
  }

  private boolean valid(JsonNode box) { return box.isArray() && box.size() == 4 && box.get(2).asInt() > box.get(0).asInt() && box.get(3).asInt() > box.get(1).asInt(); }
  private int clamp(int value) { return Math.max(0, Math.min(1000, value)); }

  private static final class Boundary {
    final JsonNode question; final int number; final int start;
    Boundary(JsonNode question, int number, int start) { this.question = question; this.number = number; this.start = start; }
  }
  private static final class Bounds {
    int x0 = 1000, y0 = 1000, x1 = 0, y1 = 0;
    void include(JsonNode box) { x0 = Math.min(x0, box.get(0).asInt()); y0 = Math.min(y0, box.get(1).asInt()); x1 = Math.max(x1, box.get(2).asInt()); y1 = Math.max(y1, box.get(3).asInt()); }
  }
}
