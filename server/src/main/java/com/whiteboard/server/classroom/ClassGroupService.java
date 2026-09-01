package com.whiteboard.server.classroom;

import com.fasterxml.jackson.databind.JsonNode;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Collections;
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
public class ClassGroupService {
  private final JdbcTemplate jdbc;

  public ClassGroupService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  public List<Map<String, Object>> teacherGroups(String teacherId) {
    return jdbc.query("SELECT g.*, (SELECT COUNT(*) FROM class_group_member m WHERE m.group_id=g.id AND m.status='active') member_count " +
      "FROM class_group g WHERE g.teacher_id=? AND g.status='active' ORDER BY g.created_at DESC", this::groupRow, required(teacherId, "老师 ID"));
  }

  @Transactional
  public Map<String, Object> createGroup(JsonNode input, String teacherId) {
    String id = id("class"); LocalDateTime now = LocalDateTime.now();
    jdbc.update("INSERT INTO class_group (id,teacher_id,name,grade,description,status,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?)",
      id, required(teacherId, "老师 ID"), required(input.path("name").asText(), "班级名称"), input.path("grade").asText(""),
      input.path("description").asText(""), Timestamp.valueOf(now), Timestamp.valueOf(now));
    return getGroup(id, teacherId);
  }

  public List<Map<String, Object>> members(String groupId, String teacherId) {
    assertOwner(groupId, teacherId);
    return jdbc.query("SELECT m.student_id,u.display_name,u.mobile,m.joined_at FROM class_group_member m " +
      "JOIN user_account u ON u.id=m.student_id WHERE m.group_id=? AND m.status='active' ORDER BY m.joined_at DESC", (rs, n) -> {
        Map<String,Object> row=new LinkedHashMap<>(); row.put("studentId",rs.getString("student_id")); row.put("studentName",rs.getString("display_name"));
        row.put("mobile",rs.getString("mobile")); row.put("joinedAt",rs.getTimestamp("joined_at").toLocalDateTime().toString()); return row;
      }, groupId);
  }

  @Transactional
  public Map<String, Object> createInvite(String groupId, String teacherId) {
    assertOwner(groupId, teacherId); LocalDateTime now=LocalDateTime.now();
    jdbc.update("UPDATE class_group_invite SET status='revoked' WHERE group_id=? AND status='active'", groupId);
    String code; do { code=UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(); }
    while (jdbc.queryForObject("SELECT COUNT(*) FROM class_group_invite WHERE invite_code=?", Integer.class, code) > 0);
    LocalDateTime expires=now.plusDays(7);
    jdbc.update("INSERT INTO class_group_invite (id,group_id,invite_code,expires_at,status,created_at) VALUES (?,?,?,?,'active',?)",
      id("invite"),groupId,code,Timestamp.valueOf(expires),Timestamp.valueOf(now));
    Map<String,Object> result=new LinkedHashMap<>(); result.put("groupId",groupId); result.put("inviteCode",code); result.put("expiresAt",expires.toString()); return result;
  }

  @Transactional
  public Map<String, Object> join(String inviteCode, String studentId) {
    Map<String,Object> invite;
    try { invite=jdbc.queryForObject("SELECT i.group_id,i.expires_at,g.name FROM class_group_invite i JOIN class_group g ON g.id=i.group_id " +
      "WHERE i.invite_code=? AND i.status='active'", (rs,n)->{Map<String,Object> r=new LinkedHashMap<>();r.put("groupId",rs.getString(1));r.put("expiresAt",rs.getTimestamp(2).toLocalDateTime());r.put("name",rs.getString(3));return r;}, required(inviteCode,"邀请码").toUpperCase()); }
    catch (org.springframework.dao.EmptyResultDataAccessException e) { throw badRequest("邀请码无效"); }
    if (((LocalDateTime)invite.get("expiresAt")).isBefore(LocalDateTime.now())) throw badRequest("邀请码已过期");
    Integer role=jdbc.queryForObject("SELECT COUNT(*) FROM user_account WHERE id=? AND role='student' AND status='active'",Integer.class,studentId);
    if(role==null||role==0) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"只有学生账号可以加入班级");
    String groupId=String.valueOf(invite.get("groupId"));
    jdbc.update("INSERT INTO class_group_member (id,group_id,student_id,joined_at,status) VALUES (?,?,?,?,'active') " +
      "ON DUPLICATE KEY UPDATE status='active',joined_at=VALUES(joined_at)", id("member"),groupId,studentId,Timestamp.valueOf(LocalDateTime.now()));
    return studentGroup(groupId,studentId);
  }

  public List<Map<String, Object>> studentGroups(String studentId) {
    return jdbc.query("SELECT g.*,m.joined_at,(SELECT COUNT(*) FROM class_group_member x WHERE x.group_id=g.id AND x.status='active') member_count " +
      "FROM class_group_member m JOIN class_group g ON g.id=m.group_id WHERE m.student_id=? AND m.status='active' AND g.status='active' ORDER BY m.joined_at DESC",
      this::groupRow, required(studentId,"学生 ID"));
  }

  @Transactional
  public List<Map<String, Object>> assign(String groupId, JsonNode input, String teacherId) {
    assertOwner(groupId,teacherId); String type=required(input.path("contentType").asText(),"内容类型");
    if(!"paper".equals(type)&&!"question".equals(type)) throw badRequest("只支持下发试题或批次");
    List<String> contentIds = new java.util.ArrayList<>();
    if (input.path("contentIds").isArray()) input.path("contentIds").forEach(node -> { if (!node.asText("").trim().isEmpty()) contentIds.add(node.asText().trim()); });
    if (contentIds.isEmpty()) contentIds.add(required(input.path("contentId").asText(),"内容 ID"));
    if ("paper".equals(type) && contentIds.size() > 1) throw badRequest("一次只能选择一个批次");
    List<String> studentIds=new java.util.ArrayList<>();
    if(input.path("studentIds").isArray()) input.path("studentIds").forEach(node->{if(!node.asText("").trim().isEmpty())studentIds.add(node.asText().trim());});
    if(studentIds.isEmpty()&&!input.path("studentId").asText("").trim().isEmpty()) studentIds.add(input.path("studentId").asText().trim());
    if(studentIds.isEmpty()) throw badRequest("请至少选择一名学生");
    for(String studentId:studentIds){Integer memberCount=jdbc.queryForObject("SELECT COUNT(*) FROM class_group_member WHERE group_id=? AND student_id=? AND status='active'",Integer.class,groupId,studentId);if(memberCount==null||memberCount==0)throw badRequest("接收学生不在当前班级");}
    LocalDateTime now=LocalDateTime.now();
    Timestamp scheduledAt=input.path("scheduledAt").asText("").isEmpty()?null:Timestamp.valueOf(LocalDateTime.parse(input.path("scheduledAt").asText()));
    String status=scheduledAt!=null&&scheduledAt.toLocalDateTime().isAfter(now)?"scheduled":"published";
    List<Map<String,Object>> created=new java.util.ArrayList<>();
    for(String contentId:contentIds){
      String title=resolveContentTitle(type,contentId,teacherId); String assignmentId=id("assignment");
      jdbc.update("INSERT INTO class_assignment (id,group_id,teacher_id,content_type,content_id,title,due_at,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        assignmentId,groupId,teacherId,type,contentId,title,scheduledAt,status,Timestamp.valueOf(now));
      for(String studentId:studentIds) jdbc.update("INSERT INTO class_assignment_recipient (id,assignment_id,student_id,created_at) VALUES (?,?,?,?)",id("recipient"),assignmentId,studentId,Timestamp.valueOf(now));
      created.add(assignment(assignmentId));
    }
    return created;
  }

  public List<Map<String, Object>> teacherAssignments(String groupId,String teacherId) { assertOwner(groupId,teacherId); return jdbc.query("SELECT a.*,g.name group_name,(SELECT display_name FROM user_account WHERE id=a.teacher_id) teacher_name,(SELECT ar.student_id FROM class_assignment_recipient ar WHERE ar.assignment_id=a.id LIMIT 1) recipient_student_id,(SELECT COUNT(*) FROM class_assignment_recipient ar WHERE ar.assignment_id=a.id) recipient_count FROM class_assignment a JOIN class_group g ON g.id=a.group_id WHERE a.group_id=? AND a.status IN ('published','scheduled') ORDER BY a.created_at DESC",this::assignmentRow,groupId); }
  public List<Map<String, Object>> studentAssignments(String studentId) {
    return assignmentList("EXISTS (SELECT 1 FROM class_group_member m WHERE m.group_id=a.group_id AND m.student_id=? AND m.status='active') AND (NOT EXISTS (SELECT 1 FROM class_assignment_recipient ar WHERE ar.assignment_id=a.id) OR EXISTS (SELECT 1 FROM class_assignment_recipient ar WHERE ar.assignment_id=a.id AND ar.student_id=?))",required(studentId,"学生 ID"),studentId);
  }

  @Transactional
  public Map<String,Object> submitAssignment(String assignmentId,JsonNode input,String studentId){
    Integer allowed=jdbc.queryForObject("SELECT COUNT(*) FROM class_assignment a JOIN class_group_member m ON m.group_id=a.group_id AND m.student_id=? AND m.status='active' WHERE a.id=? AND (NOT EXISTS (SELECT 1 FROM class_assignment_recipient ar WHERE ar.assignment_id=a.id) OR EXISTS (SELECT 1 FROM class_assignment_recipient ar WHERE ar.assignment_id=a.id AND ar.student_id=?))",Integer.class,studentId,assignmentId,studentId);
    if(allowed==null||allowed==0)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"无权提交该任务");
    LocalDateTime now=LocalDateTime.now();String submissionId=id("submission");
    jdbc.update("INSERT INTO student_assignment_submission (id,assignment_id,student_id,answer_text,board_snapshot_json,status,submitted_at,updated_at) VALUES (?,?,?,?,?,'submitted',?,?) ON DUPLICATE KEY UPDATE answer_text=VALUES(answer_text),board_snapshot_json=VALUES(board_snapshot_json),status='submitted',submitted_at=VALUES(submitted_at),updated_at=VALUES(updated_at)",submissionId,assignmentId,studentId,input.path("answerText").asText(""),input.path("boardSnapshot").isMissingNode()?null:input.path("boardSnapshot").toString(),Timestamp.valueOf(now),Timestamp.valueOf(now));
    Map<String,Object> result=new LinkedHashMap<>();result.put("assignmentId",assignmentId);result.put("studentId",studentId);result.put("status","submitted");result.put("submittedAt",now.toString());return result;
  }

  public List<Map<String,Object>> submissions(String assignmentId,String teacherId){
    Integer owned=jdbc.queryForObject("SELECT COUNT(*) FROM class_assignment WHERE id=? AND teacher_id=?",Integer.class,assignmentId,teacherId);if(owned==null||owned==0)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"无权查看提交");
    return jdbc.query("SELECT s.student_id,u.display_name,s.answer_text,s.board_snapshot_json,s.status,s.submitted_at FROM student_assignment_submission s JOIN user_account u ON u.id=s.student_id WHERE s.assignment_id=? ORDER BY s.submitted_at DESC",(rs,n)->{Map<String,Object>r=new LinkedHashMap<>();r.put("studentId",rs.getString(1));r.put("studentName",rs.getString(2));r.put("answerText",rs.getString(3));r.put("boardSnapshot",rs.getString(4));r.put("status",rs.getString(5));r.put("submittedAt",rs.getTimestamp(6).toLocalDateTime().toString());return r;},assignmentId);
  }

  @Transactional public Map<String,Object> createSyncRoom(String groupId,JsonNode input,String teacherId){assertOwner(groupId,teacherId);List<String> studentIds=new java.util.ArrayList<>();if(input.path("studentIds").isArray())input.path("studentIds").forEach(node->{if(!node.asText("").trim().isEmpty())studentIds.add(node.asText().trim());});if(studentIds.isEmpty())throw badRequest("请至少选择一名学生");for(String studentId:studentIds){Integer count=jdbc.queryForObject("SELECT COUNT(*) FROM class_group_member WHERE group_id=? AND student_id=? AND status='active'",Integer.class,groupId,studentId);if(count==null||count==0)throw badRequest("房间成员不属于当前班级");}String roomId=id("board");LocalDateTime now=LocalDateTime.now();String title=input.path("title").asText("课堂同步看板").trim();if(title.isEmpty())title="课堂同步看板";int maxSeats=Math.max(1,Math.min(8,input.path("maxRtcSeats").asInt(3)));jdbc.update("INSERT INTO class_sync_room (id,group_id,teacher_id,title,status,max_rtc_seats,created_at) VALUES (?,?,?,?,'NOT_STARTED',?,?)",roomId,groupId,teacherId,title,maxSeats,Timestamp.valueOf(now));for(String studentId:studentIds)jdbc.update("INSERT INTO class_sync_room_member (id,room_id,student_id,presence_status,created_at) VALUES (?,?,?,'OFFLINE',?)",id("room_member"),roomId,studentId,Timestamp.valueOf(now));return syncRoom(roomId);}
  public List<Map<String,Object>> teacherSyncRooms(String teacherId){return jdbc.query(syncRoomSelect()+" WHERE r.teacher_id=? AND r.created_at>DATE_SUB(NOW(),INTERVAL 90 DAY) ORDER BY r.created_at DESC",this::syncRoomRow,required(teacherId,"老师 ID"));}
  @Transactional public List<Map<String,Object>> studentSyncRooms(String studentId){jdbc.update("UPDATE class_sync_room SET status='ENDED',ended_at=COALESCE(ended_at,NOW(3)),closed_at=COALESCE(closed_at,NOW(3)) WHERE status IN ('ACTIVE','PAUSED') AND (teacher_heartbeat_at IS NULL OR teacher_heartbeat_at<DATE_SUB(NOW(3),INTERVAL 45 SECOND))");return jdbc.query(syncRoomSelect()+" JOIN class_sync_room_member m ON m.room_id=r.id WHERE m.student_id=? AND r.status IN ('ACTIVE','PAUSED') AND r.created_at>DATE_SUB(NOW(),INTERVAL 90 DAY) ORDER BY r.created_at DESC",this::syncRoomRow,required(studentId,"学生 ID"));}
  @Transactional public Map<String,Object> updateCurrentQuestion(String roomId,String questionId,String teacherId){String requiredQuestionId=required(questionId,"题目 ID");Integer owned=jdbc.queryForObject("SELECT COUNT(*) FROM class_sync_room r JOIN teaching_question q ON q.id=? JOIN teaching_paper p ON p.id=q.paper_id WHERE r.id=? AND r.teacher_id=? AND p.creator_id=? AND r.status='ACTIVE'",Integer.class,requiredQuestionId,roomId,teacherId,teacherId);if(owned==null||owned==0)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"无权同步该题目");jdbc.update("UPDATE class_sync_room SET current_question_id=? WHERE id=? AND teacher_id=?",requiredQuestionId,roomId,teacherId);jdbc.update("INSERT INTO class_sync_room_event(room_id,event_type,actor_id,target_user_id,payload_json,occurred_at) VALUES(?,'QUESTION_CHANGED',?,'',JSON_OBJECT('questionId',?),?)",roomId,teacherId,requiredQuestionId,Timestamp.valueOf(LocalDateTime.now()));return syncRoom(roomId);}
  @Transactional public void closeSyncRoom(String roomId,String teacherId){Integer owned=jdbc.queryForObject("SELECT COUNT(*) FROM class_sync_room WHERE id=? AND teacher_id=?",Integer.class,roomId,teacherId);if(owned==null||owned==0)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"无权关闭该房间");Timestamp now=Timestamp.valueOf(LocalDateTime.now());jdbc.update("UPDATE class_sync_room SET status='ENDED',ended_at=COALESCE(ended_at,?),closed_at=COALESCE(closed_at,?) WHERE id=? AND teacher_id=?",now,now,roomId,teacherId);}
  private String syncRoomSelect(){return "SELECT r.*,g.name group_name,u.display_name teacher_name,q.question_number current_question_number,q.question_type current_question_type,q.stem current_question_stem,q.options_json current_question_options,JSON_EXTRACT(q.crop_regions_json,'$.presentationLayout') current_question_presentation_layout,COALESCE(JSON_LENGTH(JSON_EXTRACT(q.crop_regions_json,'$.figureAssets')),0) current_question_figure_count FROM class_sync_room r JOIN class_group g ON g.id=r.group_id JOIN user_account u ON u.id=r.teacher_id LEFT JOIN teaching_question q ON q.id=r.current_question_id";}
  private Map<String,Object> syncRoom(String roomId){return jdbc.queryForObject(syncRoomSelect()+" WHERE r.id=?",this::syncRoomRow,roomId);}
  private Map<String,Object> syncRoomRow(ResultSet rs,int n)throws SQLException{Map<String,Object>r=new LinkedHashMap<>();r.put("id",rs.getString("id"));r.put("groupId",rs.getString("group_id"));r.put("groupName",rs.getString("group_name"));r.put("teacherId",rs.getString("teacher_id"));r.put("teacherName",rs.getString("teacher_name"));r.put("title",rs.getString("title"));r.put("status",rs.getString("status"));r.put("createdAt",rs.getTimestamp("created_at").toLocalDateTime().toString());String questionId=rs.getString("current_question_id");if(questionId!=null){Map<String,Object>q=new LinkedHashMap<>();q.put("id",questionId);q.put("number",rs.getInt("current_question_number"));q.put("type",rs.getString("current_question_type"));q.put("stem",rs.getString("current_question_stem"));q.put("optionsJson",rs.getString("current_question_options"));q.put("presentationLayoutJson",rs.getString("current_question_presentation_layout"));List<String>figureUrls=new java.util.ArrayList<>();for(int i=0;i<rs.getInt("current_question_figure_count");i++)figureUrls.add("/api/questions/"+questionId+"/figures/"+i);q.put("figureUrls",figureUrls);r.put("currentQuestion",q);}else r.put("currentQuestion",null);return r;}

  private List<Map<String,Object>> assignmentList(String where,Object... values){return jdbc.query("SELECT a.*,g.name group_name,(SELECT display_name FROM user_account WHERE id=a.teacher_id) teacher_name,(SELECT ar.student_id FROM class_assignment_recipient ar WHERE ar.assignment_id=a.id LIMIT 1) recipient_student_id,(SELECT COUNT(*) FROM class_assignment_recipient ar WHERE ar.assignment_id=a.id) recipient_count FROM class_assignment a JOIN class_group g ON g.id=a.group_id WHERE "+where+" AND (a.status='published' OR (a.status='scheduled' AND a.due_at<=NOW())) ORDER BY a.created_at DESC",this::assignmentRow,values);}
  private Map<String,Object> assignment(String id){return jdbc.queryForObject("SELECT a.*,g.name group_name,(SELECT display_name FROM user_account WHERE id=a.teacher_id) teacher_name,(SELECT ar.student_id FROM class_assignment_recipient ar WHERE ar.assignment_id=a.id LIMIT 1) recipient_student_id,(SELECT COUNT(*) FROM class_assignment_recipient ar WHERE ar.assignment_id=a.id) recipient_count FROM class_assignment a JOIN class_group g ON g.id=a.group_id WHERE a.id=?",this::assignmentRow,id);}
  private String resolveContentTitle(String type,String id,String teacherId){try{return jdbc.queryForObject("paper".equals(type)?"SELECT title FROM teaching_paper WHERE id=? AND creator_id=?":"SELECT CONCAT('第 ',question_number,' 题：',LEFT(stem,80)) FROM teaching_question q JOIN teaching_paper p ON p.id=q.paper_id WHERE q.id=? AND p.creator_id=?",String.class,id,teacherId);}catch(Exception e){throw badRequest("下发内容不存在或不属于当前老师");}}
  private void assertOwner(String groupId,String teacherId){Integer n=jdbc.queryForObject("SELECT COUNT(*) FROM class_group WHERE id=? AND teacher_id=? AND status='active'",Integer.class,groupId,teacherId);if(n==null||n==0)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"无权管理该班级");}
  private Map<String,Object> getGroup(String id,String teacherId){return jdbc.queryForObject("SELECT g.*,0 member_count FROM class_group g WHERE id=? AND teacher_id=?",this::groupRow,id,teacherId);}
  private Map<String,Object> studentGroup(String id,String studentId){return jdbc.queryForObject("SELECT g.*,m.joined_at,1 member_count FROM class_group g JOIN class_group_member m ON m.group_id=g.id WHERE g.id=? AND m.student_id=?",this::groupRow,id,studentId);}
  private Map<String,Object> groupRow(ResultSet rs,int n)throws SQLException{Map<String,Object>r=new LinkedHashMap<>();r.put("id",rs.getString("id"));r.put("teacherId",rs.getString("teacher_id"));r.put("name",rs.getString("name"));r.put("grade",rs.getString("grade"));r.put("description",rs.getString("description"));r.put("memberCount",rs.getInt("member_count"));r.put("createdAt",rs.getTimestamp("created_at").toLocalDateTime().toString());return r;}
  private Map<String,Object> assignmentRow(ResultSet rs,int n)throws SQLException{Map<String,Object>r=new LinkedHashMap<>();r.put("id",rs.getString("id"));r.put("groupId",rs.getString("group_id"));r.put("groupName",rs.getString("group_name"));r.put("teacherName",rs.getString("teacher_name"));r.put("contentType",rs.getString("content_type"));r.put("contentId",rs.getString("content_id"));r.put("title",rs.getString("title"));r.put("studentId",rs.getString("recipient_student_id"));r.put("recipientType","student");r.put("recipientCount",rs.getInt("recipient_count"));r.put("status",rs.getString("status"));r.put("scheduledAt",rs.getTimestamp("due_at")==null?null:rs.getTimestamp("due_at").toLocalDateTime().toString());r.put("createdAt",rs.getTimestamp("created_at").toLocalDateTime().toString());return r;}
  private String id(String prefix){return prefix+"_"+UUID.randomUUID().toString().replace("-","");}
  private String required(String v,String name){if(v==null||v.trim().isEmpty())throw badRequest(name+"不能为空");return v.trim();}
  private ResponseStatusException badRequest(String m){return new ResponseStatusException(HttpStatus.BAD_REQUEST,m);}
}
