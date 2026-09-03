package com.whiteboard.server.organizer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.InputStream;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import javax.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.context.annotation.DependsOn;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@DependsOn("organizerSchemaMigration")
public class PhysicsKnowledgePointInitializer {
  private static final Logger log = LoggerFactory.getLogger(PhysicsKnowledgePointInitializer.class);
  private static final String SUBJECT = "物理";
  private static final String GRADE = "初中";
  private static final String ID_PREFIX = "kp_phy_";

  private final JdbcTemplate jdbc;
  private final ObjectMapper json;

  public PhysicsKnowledgePointInitializer(JdbcTemplate jdbc, ObjectMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  @PostConstruct
  public void initialize() {
    try (InputStream input = new ClassPathResource("physics-knowledge-points.json").getInputStream()) {
      JsonNode roots = json.readTree(input).path("data");
      if (!roots.isArray()) throw new IllegalStateException("物理知识点资源缺少 data 数组");
      int count = importChildren(roots, null);
      log.info("Physics knowledge points initialized: count={}", count);
    } catch (Exception error) {
      throw new IllegalStateException("物理知识点初始化失败", error);
    }
  }

  private int importChildren(JsonNode nodes, String parentId) {
    int count = 0;
    for (int index = 0; index < nodes.size(); index++) {
      JsonNode node = nodes.get(index);
      String id = ID_PREFIX + node.path("id").asText();
      String name = node.path("name").asText("").trim();
      if (name.isEmpty()) continue;
      Timestamp now = Timestamp.valueOf(LocalDateTime.now());
      jdbc.update("INSERT INTO knowledge_point (id,parent_id,subject,grade,name,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) " +
          "ON DUPLICATE KEY UPDATE parent_id=VALUES(parent_id),subject=VALUES(subject),grade=VALUES(grade),name=VALUES(name),sort_order=VALUES(sort_order),updated_at=VALUES(updated_at)",
        id, parentId, SUBJECT, GRADE, name, index, now, now);
      String resolvedId = jdbc.queryForObject(
        "SELECT id FROM knowledge_point WHERE subject=? AND grade=? AND parent_id <=> ? AND name=? LIMIT 1",
        String.class, SUBJECT, GRADE, parentId, name);
      count++;
      JsonNode children = node.path("children");
      if (children.isArray()) count += importChildren(children, resolvedId);
    }
    return count;
  }
}
