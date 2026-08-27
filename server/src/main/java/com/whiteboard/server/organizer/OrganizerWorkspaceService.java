package com.whiteboard.server.organizer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.whiteboard.server.teaching.TeachingPlatformService;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class OrganizerWorkspaceService {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final TeachingPlatformService teaching;

  public OrganizerWorkspaceService(JdbcTemplate jdbc, ObjectMapper json, TeachingPlatformService teaching) {
    this.jdbc = jdbc; this.json = json; this.teaching = teaching;
  }

  public void attachPaper(String paperId, String userId) {
    Timestamp now = now();
    jdbc.update("INSERT INTO organizer_paper_workspace (id,paper_id,organizer_id,status,created_at,updated_at) VALUES (?,?,?,'processing',?,?) ON DUPLICATE KEY UPDATE organizer_id=VALUES(organizer_id),updated_at=VALUES(updated_at)",
      id("workspace"), paperId, userId, now, now);
  }

  public Map<String, Object> dashboard(String userId) {
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("paperCount", count("SELECT COUNT(*) FROM organizer_paper_workspace w JOIN teaching_paper p ON p.id=w.paper_id WHERE w.organizer_id=? AND p.deleted_at IS NULL", userId));
    result.put("reviewingCount", count("SELECT COUNT(*) FROM organizer_paper_workspace w JOIN teaching_paper p ON p.id=w.paper_id WHERE w.organizer_id=? AND p.deleted_at IS NULL AND p.status IN ('processing','review')", userId));
    result.put("confirmedQuestionCount", count("SELECT COUNT(*) FROM teaching_question q JOIN organizer_paper_workspace w ON w.paper_id=q.paper_id JOIN teaching_paper p ON p.id=q.paper_id WHERE w.organizer_id=? AND p.deleted_at IS NULL AND q.deleted_at IS NULL AND q.review_status='confirmed'", userId));
    result.put("publishedSetCount", count("SELECT COUNT(*) FROM organizer_question_set WHERE organizer_id=? AND status='published'", userId));
    result.put("recentPapers", listPapers(userId));
    return result;
  }

  public List<Map<String, Object>> listPapers(String userId) {
    return jdbc.query("SELECT p.id,p.title,p.subject,p.grade,p.page_count,p.question_count,p.reviewed_count,p.progress,COALESCE(j.status,p.status) status,COALESCE(j.error_code,'') error_code,COALESCE(j.error_message,'') error_message,p.created_at FROM organizer_paper_workspace w JOIN teaching_paper p ON p.id=w.paper_id LEFT JOIN teaching_parse_job j ON j.id=(SELECT latest.id FROM teaching_parse_job latest WHERE latest.paper_id=p.id ORDER BY latest.created_at DESC,latest.id DESC LIMIT 1) WHERE w.organizer_id=? AND p.deleted_at IS NULL ORDER BY p.created_at DESC",
      (rs,n) -> { Map<String,Object> row=new LinkedHashMap<>(); row.put("id",rs.getString("id")); row.put("title",rs.getString("title")); row.put("subject",rs.getString("subject")); row.put("grade",rs.getString("grade")); row.put("pageCount",rs.getInt("page_count")); row.put("questionCount",rs.getInt("question_count")); row.put("reviewedCount",rs.getInt("reviewed_count")); row.put("progress",rs.getInt("progress")); row.put("status",rs.getString("status")); row.put("errorCode",rs.getString("error_code")); row.put("errorMessage",rs.getString("error_message")); row.put("createdAt",rs.getTimestamp("created_at").toLocalDateTime().toString()); return row; }, userId);
  }

  public List<Map<String, Object>> listQuestions(String userId) {
    List<Map<String, Object>> questions = teaching.listAllQuestions("", userId);
    for (Map<String, Object> question : questions) {
      String questionId = String.valueOf(question.get("id"));
      question.put("knowledgePointIds", jdbc.query(
        "SELECT knowledge_point_id FROM question_knowledge_point WHERE question_id=? ORDER BY created_at",
        (rs,n) -> rs.getString(1), questionId));
    }
    return questions;
  }

  public List<Map<String, Object>> listKnowledgePoints(String userId) {
    return jdbc.query("SELECT k.id,k.parent_id,k.subject,k.grade,k.name,k.sort_order,COUNT(DISTINCT CASE WHEN w.organizer_id=? AND q.deleted_at IS NULL THEN qkp.question_id END) question_count FROM knowledge_point k LEFT JOIN question_knowledge_point qkp ON qkp.knowledge_point_id=k.id LEFT JOIN teaching_question q ON q.id=qkp.question_id LEFT JOIN organizer_paper_workspace w ON w.paper_id=q.paper_id GROUP BY k.id,k.parent_id,k.subject,k.grade,k.name,k.sort_order ORDER BY k.subject,k.grade,k.sort_order,k.name",
      (rs,n) -> { Map<String,Object> row=new LinkedHashMap<>(); row.put("id",rs.getString("id")); row.put("parentId",rs.getString("parent_id")); row.put("subject",rs.getString("subject")); row.put("grade",rs.getString("grade")); row.put("name",rs.getString("name")); row.put("sortOrder",rs.getInt("sort_order")); row.put("questionCount",rs.getInt("question_count")); return row; }, userId);
  }

  @Transactional
  public Map<String, Object> createKnowledgePoint(JsonNode input, String userId) {
    String id=id("kp"), name=required(input.path("name").asText(),"知识点名称");
    String subject=required(input.path("subject").asText(),"学科"), grade=input.path("grade").asText("");
    String parentId=input.path("parentId").asText("");
    if (!parentId.isEmpty() && count("SELECT COUNT(*) FROM knowledge_point WHERE id=?",parentId)==0)
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"父级知识点不存在");
    Timestamp now=now();
    jdbc.update("INSERT INTO knowledge_point (id,parent_id,subject,grade,name,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,(SELECT next_order FROM (SELECT COALESCE(MAX(sort_order),-1)+1 next_order FROM knowledge_point WHERE subject=? AND grade=?) x),?,?)",id,parentId.isEmpty()?null:parentId,subject,grade,name,subject,grade,now,now);
    Map<String,Object> result=new LinkedHashMap<>(); result.put("id",id); result.put("parentId",parentId.isEmpty()?null:parentId); result.put("subject",subject); result.put("grade",grade); result.put("name",name); result.put("sortOrder",0); result.put("questionCount",0); return result;
  }

  @Transactional
  public Map<String, Object> assignKnowledgePoints(String questionId, JsonNode input, String userId) {
    assertOrganizerQuestion(questionId,userId);
    jdbc.update("DELETE FROM question_knowledge_point WHERE question_id=?",questionId);
    if (input.path("knowledgePointIds").isArray()) for (JsonNode value:input.path("knowledgePointIds")) {
      String pointId=value.asText();
      if (count("SELECT COUNT(*) FROM knowledge_point WHERE id=?",pointId)==0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"知识点不存在");
      jdbc.update("INSERT INTO question_knowledge_point (question_id,knowledge_point_id,created_at) VALUES (?,?,?)",questionId,pointId,now());
    }
    Map<String,Object> result=new LinkedHashMap<>(); result.put("questionId",questionId); result.put("knowledgePointIds",jdbc.query("SELECT knowledge_point_id FROM question_knowledge_point WHERE question_id=? ORDER BY created_at",(rs,n)->rs.getString(1),questionId)); return result;
  }

  public void assertOrganizerPaper(String paperId, String userId) {
    if (count("SELECT COUNT(*) FROM organizer_paper_workspace w JOIN teaching_paper p ON p.id=w.paper_id WHERE w.paper_id=? AND w.organizer_id=? AND p.deleted_at IS NULL", paperId, userId) == 0)
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问该整理任务");
  }

  @Transactional
  public Map<String, Object> reviewQuestion(String questionId, JsonNode input, String userId) {
    String paperId;
    try { paperId = jdbc.queryForObject("SELECT paper_id FROM teaching_question WHERE id=?", String.class, questionId); }
    catch (Exception error) { throw new ResponseStatusException(HttpStatus.NOT_FOUND, "题目不存在"); }
    assertOrganizerPaper(paperId, userId);
    Map<String,Object> updated = teaching.updateQuestion(questionId, input, userId);
    jdbc.update("UPDATE organizer_paper_workspace SET status=CASE WHEN (SELECT COUNT(*) FROM teaching_question WHERE paper_id=? AND review_status<>'confirmed')=0 THEN 'completed' ELSE 'reviewing' END,updated_at=? WHERE paper_id=?", paperId, now(), paperId);
    return updated;
  }

  public List<Map<String, Object>> listQuestionSets(String userId) {
    return jdbc.query("SELECT s.*,COUNT(q.id) question_count FROM organizer_question_set s LEFT JOIN organizer_question_set_item i ON i.set_id=s.id LEFT JOIN teaching_question q ON q.id=i.question_id AND q.deleted_at IS NULL WHERE s.organizer_id=? GROUP BY s.id ORDER BY s.updated_at DESC",
      (rs,n) -> { Map<String,Object> row=new LinkedHashMap<>(); String id=rs.getString("id"); row.put("id",id); row.put("title",rs.getString("title")); row.put("description",rs.getString("description")); row.put("subject",rs.getString("subject")); row.put("grade",rs.getString("grade")); row.put("collectionType",rs.getString("collection_type")); row.put("topicLabel",rs.getString("topic_label")); row.put("price",rs.getBigDecimal("price")); row.put("status",rs.getString("status")); row.put("questionCount",rs.getInt("question_count")); row.put("questionIds",jdbc.query("SELECT i.question_id FROM organizer_question_set_item i JOIN teaching_question q ON q.id=i.question_id WHERE i.set_id=? AND q.deleted_at IS NULL ORDER BY i.sort_order",(items,index)->items.getString(1),id)); row.put("updatedAt",rs.getTimestamp("updated_at").toLocalDateTime().toString()); return row; }, userId);
  }

  @Transactional
  public Map<String, Object> saveQuestionSet(String setId, JsonNode input, String userId) {
    boolean creating = setId == null || setId.trim().isEmpty();
    if (creating) setId = id("qset"); else {
      assertSetOwner(setId, userId);
      String currentStatus = jdbc.queryForObject("SELECT status FROM organizer_question_set WHERE id=?", String.class, setId);
      if ("published".equals(currentStatus)) {
        throw new ResponseStatusException(HttpStatus.CONFLICT, "销售中的试题集需要先下线才能编辑");
      }
    }
    String title = required(input.path("title").asText(), "试题集名称");
    String description = input.path("description").asText("");
    String subject = required(input.path("subject").asText(), "学科");
    String grade = required(input.path("grade").asText(), "年级");
    String collectionType = input.path("collectionType").asText("topic");
    String topicLabel = input.path("topicLabel").asText("");
    BigDecimal price = input.path("price").decimalValue();
    if (price.signum() < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "价格不能为负数");
    Timestamp now=now();
    if (creating) jdbc.update("INSERT INTO organizer_question_set (id,organizer_id,title,description,subject,grade,collection_type,topic_label,price,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'draft',?,?)",setId,userId,title,description,subject,grade,collectionType,topicLabel,price,now,now);
    else jdbc.update("UPDATE organizer_question_set SET title=?,description=?,subject=?,grade=?,collection_type=?,topic_label=?,price=?,updated_at=? WHERE id=?",title,description,subject,grade,collectionType,topicLabel,price,now,setId);
    if (input.path("questionIds").isArray()) {
      jdbc.update("DELETE FROM organizer_question_set_item WHERE set_id=?",setId); int order=0;
      for (JsonNode value: input.path("questionIds")) { String qid=value.asText(); assertOrganizerQuestion(qid,userId); jdbc.update("INSERT INTO organizer_question_set_item (set_id,question_id,sort_order) VALUES (?,?,?)",setId,qid,order++); }
    }
    return getSet(setId,userId);
  }

  @Transactional
  public Map<String, Object> publish(String setId, String userId) {
    assertSetOwner(setId,userId); Map<String,Object> set=getSet(setId,userId);
    @SuppressWarnings("unchecked") List<String> questionIds=(List<String>)set.get("questionIds");
    if (questionIds.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"试题集至少需要一道已校对题目");
    Timestamp now=now();
    jdbc.update("UPDATE organizer_question_set SET status='published',product_id=NULL,updated_at=? WHERE id=?",now,setId);
    return getSet(setId,userId);
  }

  @Transactional
  public Map<String, Object> unpublish(String setId, String userId) {
    assertSetOwner(setId, userId);
    Timestamp now = now();
    jdbc.update("UPDATE organizer_question_set SET status='draft',updated_at=? WHERE id=?", now, setId);
    return getSet(setId, userId);
  }

  private Map<String,Object> getSet(String setId,String userId){ assertSetOwner(setId,userId); Map<String,Object> row=jdbc.queryForMap("SELECT id,title,description,subject,grade,collection_type collectionType,topic_label topicLabel,price,status,product_id FROM organizer_question_set WHERE id=?",setId); row.put("questionIds",jdbc.query("SELECT i.question_id FROM organizer_question_set_item i JOIN teaching_question q ON q.id=i.question_id WHERE i.set_id=? AND q.deleted_at IS NULL ORDER BY i.sort_order",(rs,n)->rs.getString(1),setId)); return row; }
  private void assertSetOwner(String setId,String userId){ if(count("SELECT COUNT(*) FROM organizer_question_set WHERE id=? AND organizer_id=?",setId,userId)==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"试题集不存在"); }
  private void assertOrganizerQuestion(String qid,String userId){ if(count("SELECT COUNT(*) FROM teaching_question q JOIN organizer_paper_workspace w ON w.paper_id=q.paper_id JOIN teaching_paper p ON p.id=q.paper_id WHERE q.id=? AND w.organizer_id=? AND p.deleted_at IS NULL AND q.deleted_at IS NULL AND q.review_status='confirmed'",qid,userId)==0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"只能加入本人已校对的题目"); }
  private int count(String sql,Object...args){ Integer value=jdbc.queryForObject(sql,Integer.class,args); return value==null?0:value; }
  private String required(String value,String name){ if(value==null||value.trim().isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,name+"不能为空"); return value.trim(); }
  private String id(String prefix){ return prefix+"_"+UUID.randomUUID().toString().replace("-",""); }
  private Timestamp now(){ return Timestamp.valueOf(LocalDateTime.now()); }
}
