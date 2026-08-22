package com.whiteboard.server.organizer;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
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
public class QuestionSetMarketplaceService {
  private final JdbcTemplate jdbc;
  public QuestionSetMarketplaceService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  public List<Map<String,Object>> store() {
    return jdbc.query(baseSelect() + " WHERE s.status='published' ORDER BY s.updated_at DESC", this::row);
  }

  public List<Map<String,Object>> mine(String teacherId) {
    return jdbc.query(baseSelect() + " JOIN question_set_purchase p ON p.question_set_id=s.id WHERE p.teacher_id=? AND p.status='paid' ORDER BY p.paid_at DESC", this::row, teacherId);
  }

  @Transactional
  public Map<String,Object> purchase(String setId,String teacherId) {
    Map<String,Object> item=jdbc.query(baseSelect()+" WHERE s.id=? AND s.status='published'",this::row,setId).stream().findFirst()
      .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"试题集不存在或已经下线"));
    List<Map<String,Object>> existing=jdbc.query("SELECT id,status FROM question_set_purchase WHERE question_set_id=? AND teacher_id=? AND status IN ('pending','paid') ORDER BY created_at DESC LIMIT 1",
      (rs,n)->{Map<String,Object> value=new LinkedHashMap<>();value.put("id",rs.getString(1));value.put("status",rs.getString(2));return value;},setId,teacherId);
    if(!existing.isEmpty())return existing.get(0);
    String id="qset_order_"+UUID.randomUUID().toString().replace("-","");Timestamp now=Timestamp.valueOf(LocalDateTime.now());
    jdbc.update("INSERT INTO question_set_purchase(id,question_set_id,teacher_id,amount,status,created_at,updated_at) VALUES(?,?,?,?,'pending',?,?)",id,setId,teacherId,item.get("price"),now,now);
    Map<String,Object> result=new LinkedHashMap<>();result.put("id",id);result.put("status","pending");return result;
  }

  private String baseSelect(){return "SELECT s.*,u.display_name organizer_name,(SELECT COUNT(*) FROM organizer_question_set_item i WHERE i.set_id=s.id) question_count FROM organizer_question_set s JOIN user_account u ON u.id=s.organizer_id";}
  private Map<String,Object> row(ResultSet rs,int n)throws SQLException{
    Map<String,Object> value=new LinkedHashMap<>();String id=rs.getString("id");int count=rs.getInt("question_count");
    value.put("id",id);value.put("teacherName",rs.getString("organizer_name"));value.put("title",rs.getString("title"));value.put("subtitle",rs.getString("description"));
    value.put("description",rs.getString("description"));value.put("subject",rs.getString("subject"));value.put("grade",rs.getString("grade"));value.put("productType","试题集");
    value.put("collectionType",rs.getString("collection_type"));value.put("topicLabel",rs.getString("topic_label"));value.put("price",rs.getBigDecimal("price"));value.put("status",rs.getString("status"));
    value.put("coverStyle","indigo");value.put("lessonCount",count);value.put("duration","");value.put("sales",0);value.put("rating",BigDecimal.ZERO);value.put("highlights",new ArrayList<>());
    value.put("recordingAssetIds",new ArrayList<>());value.put("questionIds",jdbc.query("SELECT question_id FROM organizer_question_set_item WHERE set_id=? ORDER BY sort_order",(items,index)->items.getString(1),id));
    value.put("previewMode","first");value.put("freeQuestionCount",0);value.put("previewQuestionIds",new ArrayList<>());return value;
  }
}
