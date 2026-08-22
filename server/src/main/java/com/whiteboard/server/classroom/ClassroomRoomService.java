package com.whiteboard.server.classroom;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.LocalDateTime;
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
public class ClassroomRoomService {
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final TrtcUserSigService trtc;
  private final ClassroomEventBroker broker;

  public ClassroomRoomService(JdbcTemplate jdbc, ObjectMapper json, TrtcUserSigService trtc,ClassroomEventBroker broker) { this.jdbc = jdbc; this.json = json; this.trtc=trtc;this.broker=broker; }

  public Map<String,Object> room(String roomId, String userId, String role) {
    assertAccess(roomId, userId, role);
    return roomRow(roomId);
  }

  @Transactional
  public Map<String,Object> start(String roomId, String teacherId) {
    assertTeacher(roomId, teacherId);
    int changed = jdbc.update("UPDATE class_sync_room SET status='ACTIVE',started_at=COALESCE(started_at,?),teacher_heartbeat_at=? WHERE id=? AND status='NOT_STARTED'", now(), now(), roomId);
    if (changed == 0) {
      String status = jdbc.queryForObject("SELECT status FROM class_sync_room WHERE id=?", String.class, roomId);
      if (!"ACTIVE".equals(status)) throw conflict("课堂当前不能开始");
      jdbc.update("UPDATE class_sync_room SET teacher_heartbeat_at=? WHERE id=?", now(), roomId);
    } else event(roomId, "ROOM_STARTED", teacherId, "", null);
    return roomRow(roomId);
  }

  @Transactional
  public void teacherHeartbeat(String roomId, String teacherId) {
    assertTeacher(roomId, teacherId);
    int changed = jdbc.update("UPDATE class_sync_room SET teacher_heartbeat_at=? WHERE id=? AND status='ACTIVE'", now(), roomId);
    if (changed == 0) throw conflict("课堂当前不是进行中状态");
  }

  @Transactional
  public Map<String,Object> end(String roomId, String teacherId) {
    assertTeacher(roomId, teacherId);
    int changed = jdbc.update("UPDATE class_sync_room SET status='ENDED',ended_at=COALESCE(ended_at,?),closed_at=COALESCE(closed_at,?) WHERE id=? AND status<>'ENDED'", now(), now(), roomId);
    if (changed > 0) {
      jdbc.update("UPDATE class_sync_room_member SET presence_status='OFFLINE',left_at=?,last_seen_at=? WHERE room_id=? AND presence_status='ONLINE'", now(), now(), roomId);
      jdbc.update("UPDATE class_sync_room_member SET can_publish_audio=0,can_write_canvas=0 WHERE room_id=?",roomId);
      jdbc.update("UPDATE class_sync_hand_raise SET status='CANCELLED',ended_at=? WHERE room_id=? AND status IN ('WAITING','INVITED','CONNECTING','CONNECTED')",now(),roomId);
      jdbc.update("UPDATE class_sync_rtc_session SET status='DISCONNECTED',left_at=? WHERE room_id=? AND status<>'DISCONNECTED'",now(),roomId);
      event(roomId, "ROOM_ENDED", teacherId, "", null);
    }
    return roomRow(roomId);
  }

  @Transactional
  public Map<String,Object> join(String roomId, String userId, String role) {
    assertAccess(roomId, userId, role);
    String status = jdbc.queryForObject("SELECT status FROM class_sync_room WHERE id=?", String.class, roomId);
    if (!"ACTIVE".equals(status)) throw conflict("课堂尚未开始或已经结束");
    if ("student".equals(role)) jdbc.update("UPDATE class_sync_room_member SET presence_status='ONLINE',joined_at=COALESCE(joined_at,?),left_at=NULL,last_seen_at=? WHERE room_id=? AND student_id=?", now(), now(), roomId, userId);
    event(roomId, "USER_JOINED", userId, "", singleton("role", role));
    return roomRow(roomId);
  }

  @Transactional
  public void heartbeat(String roomId, String studentId) {
    assertAccess(roomId, studentId, "student");
    int changed = jdbc.update("UPDATE class_sync_room_member SET presence_status='ONLINE',joined_at=COALESCE(joined_at,?),last_seen_at=?,left_at=NULL WHERE room_id=? AND student_id=?", now(), now(), roomId, studentId);
    if (changed == 0) throw forbidden("你不是该课堂成员");
  }

  @Transactional
  public void leave(String roomId, String userId, String role) {
    assertAccess(roomId, userId, role);
    if ("student".equals(role)) jdbc.update("UPDATE class_sync_room_member SET presence_status='OFFLINE',left_at=?,last_seen_at=? WHERE room_id=? AND student_id=?", now(), now(), roomId, userId);
    event(roomId, "USER_LEFT", userId, "", singleton("role", role));
  }

  public List<Map<String,Object>> members(String roomId, String teacherId) {
    assertTeacher(roomId, teacherId);
    markStaleOffline(roomId);
    return jdbc.query("SELECT m.student_id,u.display_name,m.presence_status,m.joined_at,m.last_seen_at,m.can_publish_audio,m.can_write_canvas FROM class_sync_room_member m JOIN user_account u ON u.id=m.student_id WHERE m.room_id=? ORDER BY m.presence_status DESC,u.display_name",
      (rs,n)->{Map<String,Object> row=new LinkedHashMap<>();row.put("studentId",rs.getString(1));row.put("studentName",rs.getString(2));row.put("presenceStatus",rs.getString(3));row.put("joinedAt",rs.getTimestamp(4)==null?null:rs.getTimestamp(4).toLocalDateTime().toString());row.put("lastSeenAt",rs.getTimestamp(5)==null?null:rs.getTimestamp(5).toLocalDateTime().toString());row.put("canPublishAudio",rs.getBoolean(6));row.put("canWriteCanvas",rs.getBoolean(7));return row;},roomId);
  }

  public List<Map<String,Object>> events(String roomId, String userId, String role, long afterId) {
    assertAccess(roomId, userId, role);
    return jdbc.query("SELECT id,event_type,actor_id,target_user_id,payload_json,occurred_at FROM class_sync_room_event WHERE room_id=? AND id>? ORDER BY id LIMIT 200",
      (rs,n)->{Map<String,Object> row=new LinkedHashMap<>();row.put("id",rs.getLong(1));row.put("event",rs.getString(2));row.put("roomId",roomId);row.put("userId",rs.getString(3));row.put("targetUserId",rs.getString(4));row.put("payload",parse(rs.getString(5)));row.put("timestamp",rs.getTimestamp(6).getTime());return row;},roomId,afterId);
  }

  public Map<String,Object> rtcToken(String roomId,String userId,String role){
    assertAccess(roomId,userId,role);assertActive(roomId);
    boolean publish="teacher".equals(role)||Boolean.TRUE.equals(jdbc.queryForObject("SELECT can_publish_audio FROM class_sync_room_member WHERE room_id=? AND student_id=?",Boolean.class,roomId,userId));
    return trtc.issue(roomId,userId,publish);
  }
  public Map<String,Object> canvasAccess(String roomId,String userId,String role){assertAccess(roomId,userId,role);boolean write="teacher".equals(role)||Boolean.TRUE.equals(jdbc.queryForObject("SELECT can_write_canvas FROM class_sync_room_member WHERE room_id=? AND student_id=?",Boolean.class,roomId,userId));Map<String,Object> result=new LinkedHashMap<>();result.put("userId",userId);result.put("role",role);result.put("canWrite",write);return result;}

  @Transactional public Map<String,Object> raiseHand(String roomId,String studentId){
    assertAccess(roomId,studentId,"student");assertActive(roomId);
    List<String> active=jdbc.query("SELECT id FROM class_sync_hand_raise WHERE room_id=? AND student_id=? AND status IN ('WAITING','INVITED','CONNECTING','CONNECTED') ORDER BY created_at DESC LIMIT 1",(rs,n)->rs.getString(1),roomId,studentId);
    if(!active.isEmpty())return handRaise(active.get(0));
    String id=id("raise");Timestamp at=now();jdbc.update("INSERT INTO class_sync_hand_raise(id,room_id,student_id,status,raised_at,created_at) VALUES(?,?,?,'WAITING',?,?)",id,roomId,studentId,at,at);
    event(roomId,"HAND_RAISE",studentId,"",null);return handRaise(id);
  }

  @Transactional public void cancelHandRaise(String roomId,String studentId){
    assertAccess(roomId,studentId,"student");
    int changed=jdbc.update("UPDATE class_sync_hand_raise SET status='CANCELLED',ended_at=? WHERE room_id=? AND student_id=? AND status='WAITING'",now(),roomId,studentId);
    if(changed>0)event(roomId,"HAND_RAISE_CANCEL",studentId,"",null);
  }

  public List<Map<String,Object>> handRaises(String roomId,String teacherId){
    assertTeacher(roomId,teacherId);
    return jdbc.query("SELECT h.id,h.student_id,u.display_name,h.status,h.raised_at,h.invited_at,h.connected_at FROM class_sync_hand_raise h JOIN user_account u ON u.id=h.student_id WHERE h.room_id=? AND h.status IN ('WAITING','INVITED','CONNECTING','CONNECTED') ORDER BY h.raised_at ASC",this::handRaiseRow,roomId);
  }

  @Transactional public Map<String,Object> inviteRtc(String roomId,String studentId,String teacherId){
    assertTeacher(roomId,teacherId);assertMember(roomId,studentId);assertActive(roomId);
    jdbc.queryForObject("SELECT id FROM class_sync_room WHERE id=? FOR UPDATE",String.class,roomId);
    Integer max=jdbc.queryForObject("SELECT max_rtc_seats FROM class_sync_room WHERE id=?",Integer.class,roomId);
    Integer used=jdbc.queryForObject("SELECT COUNT(*) FROM class_sync_room_member WHERE room_id=? AND can_publish_audio=1",Integer.class,roomId);
    if(used!=null&&max!=null&&used>=max)throw conflict("当前连麦席位已满，请先结束其他学生连麦");
    int changed=jdbc.update("UPDATE class_sync_hand_raise SET status='INVITED',invited_at=? WHERE room_id=? AND student_id=? AND status='WAITING'",now(),roomId,studentId);
    if(changed==0)throw conflict("该学生当前不在举手队列中");
    jdbc.update("UPDATE class_sync_room_member SET can_publish_audio=1 WHERE room_id=? AND student_id=?",roomId,studentId);
    event(roomId,"RTC_INVITE",teacherId,studentId,null);return activeHandRaise(roomId,studentId);
  }

  @Transactional public void rejectHandRaise(String roomId,String studentId,String teacherId){
    assertTeacher(roomId,teacherId);assertMember(roomId,studentId);
    int changed=jdbc.update("UPDATE class_sync_hand_raise SET status='REJECTED',ended_at=? WHERE room_id=? AND student_id=? AND status IN ('WAITING','INVITED')",now(),roomId,studentId);
    if(changed>0)event(roomId,"RTC_INVITE_REJECT",teacherId,studentId,null);
  }

  @Transactional public Map<String,Object> acceptRtc(String roomId,String studentId){
    assertAccess(roomId,studentId,"student");assertActive(roomId);
    int changed=jdbc.update("UPDATE class_sync_hand_raise SET status='CONNECTING' WHERE room_id=? AND student_id=? AND status='INVITED'",roomId,studentId);
    if(changed==0)throw conflict("连麦邀请已失效");event(roomId,"RTC_INVITE_ACCEPT",studentId,"",null);event(roomId,"RTC_CONNECTING",studentId,"",null);
    return rtcToken(roomId,studentId,"student");
  }
  @Transactional public void declineRtc(String roomId,String studentId){assertAccess(roomId,studentId,"student");int changed=jdbc.update("UPDATE class_sync_hand_raise SET status='REJECTED',ended_at=? WHERE room_id=? AND student_id=? AND status='INVITED'",now(),roomId,studentId);jdbc.update("UPDATE class_sync_room_member SET can_publish_audio=0 WHERE room_id=? AND student_id=?",roomId,studentId);if(changed>0)event(roomId,"RTC_INVITE_REJECT",studentId,"",null);}

  @Transactional public void rtcConnected(String roomId,String userId,String role){
    assertAccess(roomId,userId,role);if("student".equals(role)){Integer granted=jdbc.queryForObject("SELECT COUNT(*) FROM class_sync_room_member WHERE room_id=? AND student_id=? AND can_publish_audio=1",Integer.class,roomId,userId);if(granted==null||granted==0)throw forbidden("尚未获得连麦权限");jdbc.update("UPDATE class_sync_hand_raise SET status='CONNECTED',connected_at=? WHERE room_id=? AND student_id=? AND status IN ('INVITED','CONNECTING')",now(),roomId,userId);}
    jdbc.update("UPDATE class_sync_rtc_session SET status='DISCONNECTED',left_at=? WHERE room_id=? AND user_id=? AND status<>'DISCONNECTED'",now(),roomId,userId);
    jdbc.update("INSERT INTO class_sync_rtc_session(id,room_id,user_id,role,status,mute_status,joined_at,created_at) VALUES(?,?,?,?, 'CONNECTED','UNMUTED',?,?)",id("rtc"),roomId,userId,role,now(),now());event(roomId,"RTC_CONNECTED",userId,"",singleton("role",role));
  }

  @Transactional public void rtcMute(String roomId,String targetId,String actorId,String actorRole,boolean muted){
    assertAccess(roomId,actorId,actorRole);if(!actorId.equals(targetId)&&!"teacher".equals(actorRole))throw forbidden("无权控制其他成员麦克风");if(!actorId.equals(targetId))assertTeacher(roomId,actorId);
    jdbc.update("UPDATE class_sync_rtc_session SET mute_status=? WHERE room_id=? AND user_id=? AND status='CONNECTED'",muted?"MUTED":"UNMUTED",roomId,targetId);event(roomId,muted?"RTC_MUTED":"RTC_UNMUTED",actorId,targetId,null);
  }

  @Transactional public void kickRtc(String roomId,String studentId,String teacherId){assertTeacher(roomId,teacherId);disconnectRtc(roomId,studentId,teacherId,"RTC_KICK");}
  @Transactional public void leaveRtc(String roomId,String userId,String role){assertAccess(roomId,userId,role);disconnectRtc(roomId,userId,userId,"RTC_DISCONNECTED");}

  @Transactional public void canvasPermission(String roomId,String studentId,String teacherId,boolean granted){
    assertTeacher(roomId,teacherId);assertMember(roomId,studentId);jdbc.update("UPDATE class_sync_room_member SET can_write_canvas=? WHERE room_id=? AND student_id=?",granted,roomId,studentId);event(roomId,granted?"CANVAS_PERMISSION_GRANTED":"CANVAS_PERMISSION_REVOKED",teacherId,studentId,null);
  }

  private void disconnectRtc(String roomId,String userId,String actor,String eventType){jdbc.update("UPDATE class_sync_rtc_session SET status='DISCONNECTED',left_at=? WHERE room_id=? AND user_id=? AND status<>'DISCONNECTED'",now(),roomId,userId);jdbc.update("UPDATE class_sync_room_member SET can_publish_audio=0 WHERE room_id=? AND student_id=?",roomId,userId);jdbc.update("UPDATE class_sync_hand_raise SET status='CANCELLED',ended_at=? WHERE room_id=? AND student_id=? AND status IN ('INVITED','CONNECTING','CONNECTED')",now(),roomId,userId);event(roomId,eventType,actor,userId,null);}
  private Map<String,Object> activeHandRaise(String roomId,String studentId){return jdbc.queryForObject("SELECT h.id,h.student_id,u.display_name,h.status,h.raised_at,h.invited_at,h.connected_at FROM class_sync_hand_raise h JOIN user_account u ON u.id=h.student_id WHERE h.room_id=? AND h.student_id=? AND h.status IN ('WAITING','INVITED','CONNECTING','CONNECTED') ORDER BY h.created_at DESC LIMIT 1",this::handRaiseRow,roomId,studentId);}
  private Map<String,Object> handRaise(String raiseId){return jdbc.queryForObject("SELECT h.id,h.student_id,u.display_name,h.status,h.raised_at,h.invited_at,h.connected_at FROM class_sync_hand_raise h JOIN user_account u ON u.id=h.student_id WHERE h.id=?",this::handRaiseRow,raiseId);}
  private Map<String,Object> handRaiseRow(java.sql.ResultSet rs,int n)throws java.sql.SQLException{Map<String,Object> row=new LinkedHashMap<>();Timestamp raised=rs.getTimestamp(5);row.put("id",rs.getString(1));row.put("studentId",rs.getString(2));row.put("studentName",rs.getString(3));row.put("status",rs.getString(4));row.put("raisedAt",raised.toLocalDateTime().toString());row.put("waitSeconds",Math.max(0,(System.currentTimeMillis()-raised.getTime())/1000));row.put("invitedAt",rs.getTimestamp(6)==null?null:rs.getTimestamp(6).toLocalDateTime().toString());row.put("connectedAt",rs.getTimestamp(7)==null?null:rs.getTimestamp(7).toLocalDateTime().toString());return row;}

  private Map<String,Object> roomRow(String roomId) {
    markStaleOffline(roomId);
    return jdbc.queryForObject("SELECT r.id,r.title,r.group_id,g.name,r.teacher_id,u.display_name,r.status,r.started_at,r.ended_at,r.max_rtc_seats,(SELECT COUNT(*) FROM class_sync_room_member m WHERE m.room_id=r.id AND m.presence_status='ONLINE') online_count,(SELECT COUNT(*) FROM class_sync_room_member m WHERE m.room_id=r.id AND m.can_publish_audio=1) rtc_seat_count FROM class_sync_room r JOIN class_group g ON g.id=r.group_id JOIN user_account u ON u.id=r.teacher_id WHERE r.id=?",
      (rs,n)->{Map<String,Object> row=new LinkedHashMap<>();row.put("roomId",rs.getString(1));row.put("roomName",rs.getString(2));row.put("classId",rs.getString(3));row.put("className",rs.getString(4));row.put("teacherId",rs.getString(5));row.put("teacherName",rs.getString(6));row.put("status",rs.getString(7));row.put("startedAt",rs.getTimestamp(8)==null?null:rs.getTimestamp(8).toLocalDateTime().toString());row.put("endedAt",rs.getTimestamp(9)==null?null:rs.getTimestamp(9).toLocalDateTime().toString());row.put("maxRtcSeats",rs.getInt(10));row.put("onlineCount",rs.getInt(11));row.put("currentRtcSeatCount",rs.getInt(12));return row;},roomId);
  }

  private void markStaleOffline(String roomId) { jdbc.update("UPDATE class_sync_room_member SET presence_status='OFFLINE',left_at=COALESCE(left_at,?) WHERE room_id=? AND presence_status='ONLINE' AND (last_seen_at IS NULL OR last_seen_at<?)", now(), roomId, Timestamp.valueOf(LocalDateTime.now().minusSeconds(45))); }
  private void assertActive(String roomId){String status=jdbc.queryForObject("SELECT status FROM class_sync_room WHERE id=?",String.class,roomId);if(!"ACTIVE".equals(status))throw conflict("课堂当前不是进行中状态");}
  private void assertMember(String roomId,String studentId){Integer n=jdbc.queryForObject("SELECT COUNT(*) FROM class_sync_room_member WHERE room_id=? AND student_id=?",Integer.class,roomId,studentId);if(n==null||n==0)throw forbidden("该学生不属于当前课堂");}
  private void assertTeacher(String roomId,String teacherId){Integer n=jdbc.queryForObject("SELECT COUNT(*) FROM class_sync_room WHERE id=? AND teacher_id=?",Integer.class,roomId,teacherId);if(n==null||n==0)throw forbidden("无权管理该课堂");}
  private void assertAccess(String roomId,String userId,String role){Integer n="teacher".equals(role)?jdbc.queryForObject("SELECT COUNT(*) FROM class_sync_room WHERE id=? AND teacher_id=?",Integer.class,roomId,userId):jdbc.queryForObject("SELECT COUNT(*) FROM class_sync_room_member WHERE room_id=? AND student_id=?",Integer.class,roomId,userId);if(n==null||n==0)throw forbidden("无权访问该课堂");}
  private void event(String roomId,String type,String actor,String target,Object payload){try{Timestamp at=now();jdbc.update("INSERT INTO class_sync_room_event(room_id,event_type,actor_id,target_user_id,payload_json,occurred_at) VALUES(?,?,?,?,?,?)",roomId,type,actor,target,payload==null?null:json.writeValueAsString(payload),at);Map<String,Object> message=new LinkedHashMap<>();message.put("event",type);message.put("roomId",roomId);message.put("userId",actor);message.put("targetUserId",target);message.put("timestamp",at.getTime());message.put("payload",payload==null?new LinkedHashMap<>():payload);broker.publish(roomId,message);}catch(Exception error){throw new IllegalStateException(error);}}
  private Map<String,Object> singleton(String key,Object value){Map<String,Object> result=new LinkedHashMap<>();result.put(key,value);return result;}
  private Object parse(String value){if(value==null)return new LinkedHashMap<>();try{return json.readValue(value,Object.class);}catch(Exception error){return new LinkedHashMap<>();}}
  private Timestamp now(){return Timestamp.valueOf(LocalDateTime.now());}
  private String id(String prefix){return prefix+"_"+UUID.randomUUID().toString().replace("-","");}
  private ResponseStatusException forbidden(String message){return new ResponseStatusException(HttpStatus.FORBIDDEN,message);}
  private ResponseStatusException conflict(String message){return new ResponseStatusException(HttpStatus.CONFLICT,message);}
}
