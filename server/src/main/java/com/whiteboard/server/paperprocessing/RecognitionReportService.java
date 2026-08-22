package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class RecognitionReportService {
  private final JdbcTemplate jdbc;private final ObjectMapper json;
  public RecognitionReportService(JdbcTemplate jdbc,ObjectMapper json){this.jdbc=jdbc;this.json=json;}
  public ObjectNode create(String jobId,String paperId,JsonNode structured)throws Exception{
    Map<String,Object> pages=jdbc.queryForMap("SELECT COUNT(*) total,SUM(parse_strategy='native') native_count,SUM(parse_strategy<>'native') ocr_count,SUM(status='preprocessed' OR parse_strategy='image_repair_then_ocr') repaired_count,AVG(quality_score) quality FROM paper_page WHERE paper_id=?",paperId);
    int questions=structured.path("questions").size(),manual=0,cross=0,boundaryTotal=0;for(JsonNode q:structured.path("questions")){JsonNode quality=q.path("boundaryQuality");boundaryTotal+=quality.path("score").asInt();if(quality.path("requiresManualReview").asBoolean())manual++;if(quality.path("crossPage").asBoolean())cross++;}
    int pageQuality=number(pages.get("quality")),boundaryQuality=questions==0?0:boundaryTotal/questions,overall=Math.max(0,Math.min(100,(pageQuality*35+boundaryQuality*65)/100));String status=manual>0||overall<75?"needs_review":"passed";
    ObjectNode report=json.createObjectNode();report.put("pipelineVersion","hybrid-v3");report.put("overallScore",overall);report.put("pageQualityScore",pageQuality);report.put("boundaryQualityScore",boundaryQuality);report.put("nativePageCount",number(pages.get("native_count")));report.put("ocrPageCount",number(pages.get("ocr_count")));report.put("repairedPageCount",number(pages.get("repaired_count")));report.put("questionCount",questions);report.put("manualReviewCount",manual);report.put("crossPageCount",cross);report.put("status",status);
    Timestamp now=Timestamp.valueOf(LocalDateTime.now());jdbc.update("INSERT INTO paper_recognition_report (id,paper_id,job_id,pipeline_version,overall_score,native_page_count,ocr_page_count,repaired_page_count,question_count,manual_review_count,cross_page_count,status,report_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE overall_score=VALUES(overall_score),manual_review_count=VALUES(manual_review_count),cross_page_count=VALUES(cross_page_count),status=VALUES(status),report_json=VALUES(report_json)","report_"+UUID.randomUUID().toString().replace("-",""),paperId,jobId,"hybrid-v3",overall,number(pages.get("native_count")),number(pages.get("ocr_count")),number(pages.get("repaired_count")),questions,manual,cross,status,json.writeValueAsString(report),now);return report;
  }
  public JsonNode latest(String jobId){try{String value=jdbc.queryForObject("SELECT report_json FROM paper_recognition_report WHERE job_id=?",String.class,jobId);return json.readTree(value);}catch(Exception error){return json.createObjectNode();}}
  private int number(Object value){return value instanceof Number?((Number)value).intValue():0;}
}
