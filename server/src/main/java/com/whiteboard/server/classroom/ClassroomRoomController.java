package com.whiteboard.server.classroom;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/classroom/rooms/{roomId}")
public class ClassroomRoomController {
  private final ClassroomRoomService rooms;
  public ClassroomRoomController(ClassroomRoomService rooms) { this.rooms = rooms; }

  @GetMapping public Map<String,Object> room(@PathVariable String roomId,@RequestHeader("X-User-Id") String userId,@RequestHeader("X-User-Role") String role){return rooms.room(roomId,userId,role);}
  @PostMapping("/start") public Map<String,Object> start(@PathVariable String roomId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);return rooms.start(roomId,teacherId);}
  @PostMapping("/pause") public Map<String,Object> pause(@PathVariable String roomId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);return rooms.pause(roomId,teacherId);}
  @PostMapping("/resume") public Map<String,Object> resume(@PathVariable String roomId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);return rooms.resume(roomId,teacherId);}
  @PostMapping("/end") public Map<String,Object> end(@PathVariable String roomId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);return rooms.end(roomId,teacherId);}
  @PostMapping("/join") public Map<String,Object> join(@PathVariable String roomId,@RequestHeader("X-User-Id") String userId,@RequestHeader("X-User-Role") String role){return rooms.join(roomId,userId,role);}
  @PostMapping("/heartbeat") @ResponseStatus(HttpStatus.NO_CONTENT) public void heartbeat(@PathVariable String roomId,@RequestHeader("X-User-Id") String studentId,@RequestHeader("X-User-Role") String role){requireStudent(role);rooms.heartbeat(roomId,studentId);}
  @PostMapping("/teacher-heartbeat") @ResponseStatus(HttpStatus.NO_CONTENT) public void teacherHeartbeat(@PathVariable String roomId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);rooms.teacherHeartbeat(roomId,teacherId);}
  @PostMapping("/leave") @ResponseStatus(HttpStatus.NO_CONTENT) public void leave(@PathVariable String roomId,@RequestHeader("X-User-Id") String userId,@RequestHeader("X-User-Role") String role){rooms.leave(roomId,userId,role);}
  @GetMapping("/members") public List<Map<String,Object>> members(@PathVariable String roomId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);return rooms.members(roomId,teacherId);}
  @GetMapping("/events") public List<Map<String,Object>> events(@PathVariable String roomId,@RequestParam(defaultValue="0") long afterId,@RequestHeader("X-User-Id") String userId,@RequestHeader("X-User-Role") String role){return rooms.events(roomId,userId,role,afterId);}
  @PostMapping("/rtc/token") public Map<String,Object> rtcToken(@PathVariable String roomId,@RequestHeader("X-User-Id") String userId,@RequestHeader("X-User-Role") String role){return rooms.rtcToken(roomId,userId,role);}
  @GetMapping("/canvas/access") public Map<String,Object> canvasAccess(@PathVariable String roomId,@RequestHeader("X-User-Id") String userId,@RequestHeader("X-User-Role") String role){return rooms.canvasAccess(roomId,userId,role);}
  @PostMapping("/hand-raise") public Map<String,Object> raiseHand(@PathVariable String roomId,@RequestHeader("X-User-Id") String studentId,@RequestHeader("X-User-Role") String role){requireStudent(role);return rooms.raiseHand(roomId,studentId);}
  @DeleteMapping("/hand-raise") @ResponseStatus(HttpStatus.NO_CONTENT) public void cancelHandRaise(@PathVariable String roomId,@RequestHeader("X-User-Id") String studentId,@RequestHeader("X-User-Role") String role){requireStudent(role);rooms.cancelHandRaise(roomId,studentId);}
  @GetMapping("/hand-raises") public List<Map<String,Object>> handRaises(@PathVariable String roomId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);return rooms.handRaises(roomId,teacherId);}
  @PostMapping("/students/{studentId}/rtc/invite") public Map<String,Object> inviteRtc(@PathVariable String roomId,@PathVariable String studentId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);return rooms.inviteRtc(roomId,studentId,teacherId);}
  @PostMapping("/students/{studentId}/hand-raise/reject") @ResponseStatus(HttpStatus.NO_CONTENT) public void rejectHandRaise(@PathVariable String roomId,@PathVariable String studentId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);rooms.rejectHandRaise(roomId,studentId,teacherId);}
  @PostMapping("/rtc/invite/accept") public Map<String,Object> acceptRtc(@PathVariable String roomId,@RequestHeader("X-User-Id") String studentId,@RequestHeader("X-User-Role") String role){requireStudent(role);return rooms.acceptRtc(roomId,studentId);}
  @PostMapping("/rtc/invite/reject") @ResponseStatus(HttpStatus.NO_CONTENT) public void declineRtc(@PathVariable String roomId,@RequestHeader("X-User-Id") String studentId,@RequestHeader("X-User-Role") String role){requireStudent(role);rooms.declineRtc(roomId,studentId);}
  @PostMapping("/rtc/connected") @ResponseStatus(HttpStatus.NO_CONTENT) public void rtcConnected(@PathVariable String roomId,@RequestHeader("X-User-Id") String userId,@RequestHeader("X-User-Role") String role){rooms.rtcConnected(roomId,userId,role);}
  @PostMapping("/rtc/mute") @ResponseStatus(HttpStatus.NO_CONTENT) public void muteSelf(@PathVariable String roomId,@RequestHeader("X-User-Id") String userId,@RequestHeader("X-User-Role") String role){rooms.rtcMute(roomId,userId,userId,role,true);}
  @PostMapping("/rtc/unmute") @ResponseStatus(HttpStatus.NO_CONTENT) public void unmuteSelf(@PathVariable String roomId,@RequestHeader("X-User-Id") String userId,@RequestHeader("X-User-Role") String role){rooms.rtcMute(roomId,userId,userId,role,false);}
  @PostMapping("/students/{studentId}/rtc/mute") @ResponseStatus(HttpStatus.NO_CONTENT) public void muteStudent(@PathVariable String roomId,@PathVariable String studentId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);rooms.rtcMute(roomId,studentId,teacherId,role,true);}
  @PostMapping("/students/{studentId}/rtc/kick") @ResponseStatus(HttpStatus.NO_CONTENT) public void kickRtc(@PathVariable String roomId,@PathVariable String studentId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);rooms.kickRtc(roomId,studentId,teacherId);}
  @PostMapping("/rtc/leave") @ResponseStatus(HttpStatus.NO_CONTENT) public void leaveRtc(@PathVariable String roomId,@RequestHeader("X-User-Id") String userId,@RequestHeader("X-User-Role") String role){rooms.leaveRtc(roomId,userId,role);}
  @PostMapping("/students/{studentId}/canvas/grant") @ResponseStatus(HttpStatus.NO_CONTENT) public void grantCanvas(@PathVariable String roomId,@PathVariable String studentId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);rooms.canvasPermission(roomId,studentId,teacherId,true);}
  @PostMapping("/students/{studentId}/canvas/revoke") @ResponseStatus(HttpStatus.NO_CONTENT) public void revokeCanvas(@PathVariable String roomId,@PathVariable String studentId,@RequestHeader("X-User-Id") String teacherId,@RequestHeader("X-User-Role") String role){requireTeacher(role);rooms.canvasPermission(roomId,studentId,teacherId,false);}

  private void requireTeacher(String role){if(!"teacher".equals(role))throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN,"仅老师可以执行该操作");}
  private void requireStudent(String role){if(!"student".equals(role))throw new org.springframework.web.server.ResponseStatusException(HttpStatus.FORBIDDEN,"仅学生可以执行该操作");}
}
