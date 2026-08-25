package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class KnowledgePointClassifierService {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final DeepseekClient deepseek;

  public KnowledgePointClassifierService(JdbcTemplate jdbc, ObjectMapper json, DeepseekClient deepseek) {
    this.jdbc = jdbc; this.json = json; this.deepseek = deepseek;
  }

  /** Mutates each structured question by adding a validated knowledgePoints array. */
  public int classify(JsonNode questions, String subject, String grade) throws Exception {
    if (!questions.isArray() || questions.size() == 0) return 0;
    List<Point> points = loadPoints(subject, grade);
    if (points.isEmpty()) return 0;
    Set<String> parentIds = new HashSet<>();
    Map<String, Point> byId = new HashMap<>();
    for (Point point : points) { byId.put(point.id, point); if (point.parentId != null && !point.parentId.isEmpty()) parentIds.add(point.parentId); }

    ArrayNode candidates = json.createArrayNode();
    Set<String> candidateIds = new HashSet<>();
    for (Point point : points) {
      if (parentIds.contains(point.id)) continue;
      candidateIds.add(point.id);
      ObjectNode item = candidates.addObject(); item.put("id", point.id); item.put("path", path(point, byId));
    }

    ArrayNode questionInput = json.createArrayNode();
    for (JsonNode question : questions) {
      ObjectNode item = questionInput.addObject(); item.put("number", question.path("number").asInt());
      item.put("type", question.path("type").asText()); item.put("stem", limit(question.path("stem").asText(), 1800));
      item.set("options", question.path("options").deepCopy()); item.put("answer", limit(question.path("answer").asText(), 500));
      item.put("analysis", limit(question.path("analysis").asText(), 1000));
    }

    JsonNode result = deepseek.classifyKnowledgePoints(questionInput, candidates, subject, grade);
    Map<Integer, JsonNode> matches = new HashMap<>();
    for (JsonNode match : result.path("matches")) matches.put(match.path("number").asInt(), match.path("knowledgePoints"));
    int assigned = 0;
    for (JsonNode question : questions) {
      if (!(question instanceof ObjectNode)) continue;
      ArrayNode output = ((ObjectNode) question).putArray("knowledgePoints");
      JsonNode values = matches.get(question.path("number").asInt());
      if (values == null || !values.isArray()) continue;
      Set<String> seen = new HashSet<>();
      for (JsonNode value : values) {
        String id = value.path("id").asText();
        if (!candidateIds.contains(id) || !seen.add(id) || output.size() >= 3) continue;
        ObjectNode accepted = output.addObject(); accepted.put("id", id);
        accepted.put("confidence", Math.max(0, Math.min(100, value.path("confidence").asInt())));
        accepted.put("reason", limit(value.path("reason").asText(), 500)); assigned++;
      }
    }
    return assigned;
  }

  private List<Point> loadPoints(String subject, String grade) {
    String stage = grade != null && grade.startsWith("初") ? "初中" : grade != null && grade.startsWith("高") ? "高中" : grade;
    return jdbc.query("SELECT id,parent_id,name FROM knowledge_point WHERE subject=? AND (grade=? OR grade=? OR grade='') ORDER BY sort_order,name",
      (rs,n) -> new Point(rs.getString("id"), rs.getString("parent_id"), rs.getString("name")), subject, grade, stage);
  }

  private String path(Point point, Map<String, Point> byId) {
    List<String> names = new ArrayList<>(); Point current = point; int guard = 0;
    while (current != null && guard++ < 10) { names.add(0, current.name); current = byId.get(current.parentId); }
    return String.join(" > ", names);
  }

  private String limit(String value, int size) { return value == null ? "" : value.substring(0, Math.min(size, value.length())); }
  private static final class Point { final String id,parentId,name; Point(String id,String parentId,String name){this.id=id;this.parentId=parentId;this.name=name;} }
}
