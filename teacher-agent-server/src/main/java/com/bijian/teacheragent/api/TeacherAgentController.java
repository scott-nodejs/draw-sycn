package com.bijian.teacheragent.api;

import com.bijian.teacheragent.domain.Plans.PlanBundle;
import com.bijian.teacheragent.domain.TeachingSession;
import com.bijian.teacheragent.orchestrator.TeachingOrchestrator;
import com.bijian.teacheragent.planner.DeepSeekPlanner;
import com.bijian.teacheragent.store.InMemoryStore;
import org.springframework.http.*; import org.springframework.web.bind.annotation.*;
import javax.validation.Valid; import javax.validation.constraints.*;

@RestController @RequestMapping("/api/teacher-agent")
public class TeacherAgentController {
  private final DeepSeekPlanner planner; private final InMemoryStore store; private final TeachingOrchestrator orchestrator;
  public TeacherAgentController(DeepSeekPlanner p,InMemoryStore s,TeachingOrchestrator o){planner=p;store=s;orchestrator=o;}
  @PostMapping("/plans") public ResponseEntity<PlanBundle> plan(@Valid @RequestBody PlanRequest request){return ResponseEntity.status(HttpStatus.CREATED).body(store.save(planner.plan(request.problem,request.studentLevel)));}
  @GetMapping("/plans/{id}") public PlanBundle plan(@PathVariable String id){return store.plan(id);}
  @PostMapping("/sessions") public ResponseEntity<TeachingSession> session(@Valid @RequestBody SessionRequest request){TeachingSession s=orchestrator.create(request.planId,request.roomId);if(request.autoStart)orchestrator.start(s.id);return ResponseEntity.status(HttpStatus.CREATED).body(s);}
  @GetMapping("/sessions/{id}") public TeachingSession session(@PathVariable String id){return store.session(id);}
  @PostMapping("/sessions/{id}/{command}") public TeachingSession command(@PathVariable String id,@PathVariable String command){switch(command){case "start":return orchestrator.start(id);case "pause":return orchestrator.pause(id);case "resume":return orchestrator.resume(id);case "next":return orchestrator.next(id);case "stop":return orchestrator.stop(id);default:throw new IllegalArgumentException("未知会话命令: "+command);}}
  public static class PlanRequest { @NotBlank public String problem; public String studentLevel="NORMAL"; }
  public static class SessionRequest { @NotBlank public String planId; @NotBlank public String roomId; public boolean autoStart=false; }
}
