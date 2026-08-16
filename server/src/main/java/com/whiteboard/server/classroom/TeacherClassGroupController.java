package com.whiteboard.server.classroom;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/teacher")
public class TeacherClassGroupController {
  private final ClassGroupService service;
  public TeacherClassGroupController(ClassGroupService service) { this.service = service; }

  @GetMapping("/class-groups") public List<Map<String,Object>> groups(@RequestHeader("X-User-Id") String teacherId) { return service.teacherGroups(teacherId); }
  @PostMapping("/class-groups") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> create(@RequestBody JsonNode input, @RequestHeader("X-User-Id") String teacherId) { return service.createGroup(input, teacherId); }
  @GetMapping("/class-groups/{id}/members") public List<Map<String,Object>> members(@PathVariable String id, @RequestHeader("X-User-Id") String teacherId) { return service.members(id, teacherId); }
  @PostMapping("/class-groups/{id}/invites") public Map<String,Object> invite(@PathVariable String id, @RequestHeader("X-User-Id") String teacherId) { return service.createInvite(id, teacherId); }
  @PostMapping("/class-groups/{id}/assignments") @ResponseStatus(HttpStatus.CREATED) public List<Map<String,Object>> assign(@PathVariable String id, @RequestBody JsonNode input, @RequestHeader("X-User-Id") String teacherId) { return service.assign(id, input, teacherId); }
  @GetMapping("/class-groups/{id}/assignments") public List<Map<String,Object>> assignments(@PathVariable String id, @RequestHeader("X-User-Id") String teacherId) { return service.teacherAssignments(id, teacherId); }
  @GetMapping("/class-assignments/{id}/submissions") public List<Map<String,Object>> submissions(@PathVariable String id, @RequestHeader("X-User-Id") String teacherId) { return service.submissions(id, teacherId); }
  @PostMapping("/class-groups/{id}/sync-rooms") @ResponseStatus(HttpStatus.CREATED) public Map<String,Object> createSyncRoom(@PathVariable String id, @RequestBody JsonNode input, @RequestHeader("X-User-Id") String teacherId) { return service.createSyncRoom(id, input, teacherId); }
  @PutMapping("/sync-rooms/{id}/current-question") public Map<String,Object> updateCurrentQuestion(@PathVariable String id, @RequestBody JsonNode input, @RequestHeader("X-User-Id") String teacherId) { return service.updateCurrentQuestion(id, input.path("questionId").asText(), teacherId); }
  @PostMapping("/sync-rooms/{id}/close") @ResponseStatus(HttpStatus.NO_CONTENT) public void closeSyncRoom(@PathVariable String id, @RequestHeader("X-User-Id") String teacherId) { service.closeSyncRoom(id, teacherId); }
}
