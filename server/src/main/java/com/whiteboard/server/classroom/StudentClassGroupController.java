package com.whiteboard.server.classroom;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/student")
public class StudentClassGroupController {
  private final ClassGroupService service;
  public StudentClassGroupController(ClassGroupService service) { this.service = service; }

  @PostMapping("/class-groups/join") public Map<String,Object> join(@RequestBody JsonNode input, @RequestHeader("X-User-Id") String studentId) { return service.join(input.path("inviteCode").asText(), studentId); }
  @GetMapping("/class-groups") public List<Map<String,Object>> groups(@RequestHeader("X-User-Id") String studentId) { return service.studentGroups(studentId); }
  @GetMapping("/class-assignments") public List<Map<String,Object>> assignments(@RequestHeader("X-User-Id") String studentId) { return service.studentAssignments(studentId); }
  @PostMapping("/class-assignments/{id}/submissions") public Map<String,Object> submit(@PathVariable String id, @RequestBody JsonNode input, @RequestHeader("X-User-Id") String studentId) { return service.submitAssignment(id, input, studentId); }
  @GetMapping("/sync-rooms") public List<Map<String,Object>> syncRooms(@RequestHeader("X-User-Id") String studentId) { return service.studentSyncRooms(studentId); }
}
