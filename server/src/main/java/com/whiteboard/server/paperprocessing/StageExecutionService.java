package com.whiteboard.server.paperprocessing;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class StageExecutionService {
  private final JdbcTemplate jdbc;
  public StageExecutionService(JdbcTemplate jdbc) { this.jdbc = jdbc; }
  public String start(String jobId, String paperId, String stage, String provider) {
    String id="stage_"+UUID.randomUUID().toString().replace("-",""); Timestamp now=Timestamp.valueOf(LocalDateTime.now());
    Integer attempt=jdbc.queryForObject("SELECT COUNT(*)+1 FROM paper_stage_execution WHERE job_id=? AND stage=?", Integer.class, jobId, stage);
    jdbc.update("INSERT INTO paper_stage_execution (id,job_id,paper_id,stage,status,attempt,provider,started_at,created_at,updated_at) VALUES (?,?,?,?,'running',?,?,?,?,?)", id,jobId,paperId,stage,attempt==null?1:attempt,provider==null?"":provider,now,now,now);
    return id;
  }
  public void complete(String id, String outputJson) { jdbc.update("UPDATE paper_stage_execution SET status='completed',output_json=?,finished_at=?,updated_at=? WHERE id=?",outputJson,now(),now(),id); }
  public void completeRunning(String jobId, String stage, String outputJson) { jdbc.update("UPDATE paper_stage_execution SET status='completed',output_json=?,finished_at=?,updated_at=? WHERE job_id=? AND stage=? AND status='running'",outputJson,now(),now(),jobId,stage); }
  public void fail(String id, String code, String message) { jdbc.update("UPDATE paper_stage_execution SET status='failed',error_code=?,error_message=?,finished_at=?,updated_at=? WHERE id=?",code,clip(message),now(),now(),id); }
  public void failRunning(String jobId, String code, String message) { jdbc.update("UPDATE paper_stage_execution SET status='failed',error_code=?,error_message=?,finished_at=?,updated_at=? WHERE job_id=? AND status='running'",code,clip(message),now(),now(),jobId); }
  private Timestamp now(){return Timestamp.valueOf(LocalDateTime.now());}
  private String clip(String value){if(value==null)return "";return value.substring(0,Math.min(1000,value.length()));}
}
