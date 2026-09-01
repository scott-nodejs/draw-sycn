package com.whiteboard.server.organizer;

import com.fasterxml.jackson.databind.JsonNode;
import com.whiteboard.server.teaching.TeachingPlatformService;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/organizer")
public class OrganizerWorkspaceController {
  private final OrganizerWorkspaceService organizer;
  private final TeachingPlatformService teaching;
  private final com.whiteboard.server.teaching.PaperCloudMigrationService cloudMigration;
  private final com.whiteboard.server.teaching.QuestionAssetCloudMigrationService questionAssetMigration;

  public OrganizerWorkspaceController(OrganizerWorkspaceService organizer, TeachingPlatformService teaching, com.whiteboard.server.teaching.PaperCloudMigrationService cloudMigration, com.whiteboard.server.teaching.QuestionAssetCloudMigrationService questionAssetMigration) {
    this.organizer = organizer;
    this.teaching = teaching;
    this.cloudMigration = cloudMigration;
    this.questionAssetMigration = questionAssetMigration;
  }

  @GetMapping("/dashboard")
  public Map<String, Object> dashboard(@RequestHeader("X-User-Id") String userId) {
    return organizer.dashboard(userId);
  }

  @GetMapping("/papers")
  public List<Map<String, Object>> papers(@RequestHeader("X-User-Id") String userId) {
    return organizer.listPapers(userId);
  }

  @PostMapping(value = "/papers", consumes = "multipart/form-data")
  @ResponseStatus(HttpStatus.CREATED)
  public Object upload(@RequestParam("file") MultipartFile[] files,
      @RequestParam String title, @RequestParam String subject, @RequestParam String grade,
      @RequestHeader("X-User-Id") String userId) throws IOException {
    if (files.length == 1 && isZip(files[0])) {
      List<Map<String, Object>> papers = teaching.createPapersFromZip(files[0], title, subject, grade, "", userId);
      for (Map<String, Object> paper : papers) organizer.attachPaper(String.valueOf(paper.get("id")), userId);
      return papers;
    }
    Map<String, Object> paper = teaching.createPaper(Arrays.asList(files), title, subject, grade, "", userId);
    organizer.attachPaper(String.valueOf(paper.get("id")), userId);
    return paper;
  }

  @PostMapping("/papers/cloud-migration")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public Map<String, Object> migratePaperHistory() { return cloudMigration.migrateHistory(); }

  @GetMapping("/papers/cloud-migration")
  public Map<String, Object> paperMigrationStatus() { return cloudMigration.status(); }

  @PostMapping("/question-assets/cloud-migration")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public Map<String, Object> migrateQuestionAssetHistory() { return questionAssetMigration.migrateHistory(); }

  @GetMapping("/question-assets/cloud-migration")
  public Map<String, Object> questionAssetMigrationStatus() { return questionAssetMigration.status(); }

  @DeleteMapping("/papers/{paperId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deletePaper(@PathVariable String paperId, @RequestHeader("X-User-Id") String userId) {
    organizer.assertOrganizerPaper(paperId, userId);
    teaching.deletePaper(paperId, userId);
  }

  private boolean isZip(MultipartFile file) {
    String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
    String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
    return "application/zip".equals(type) || "application/x-zip-compressed".equals(type) || name.endsWith(".zip");
  }

  @GetMapping("/papers/{paperId}/questions")
  public List<Map<String, Object>> questions(@PathVariable String paperId, @RequestHeader("X-User-Id") String userId) {
    organizer.assertOrganizerPaper(paperId, userId);
    return teaching.listQuestions(paperId, userId);
  }

  @GetMapping("/questions")
  public List<Map<String, Object>> confirmedQuestions(@RequestHeader("X-User-Id") String userId) {
    return organizer.listQuestions(userId);
  }

  @GetMapping("/knowledge-points")
  public List<Map<String, Object>> knowledgePoints(@RequestHeader("X-User-Id") String userId) {
    return organizer.listKnowledgePoints(userId);
  }

  @PostMapping("/knowledge-points")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> createKnowledgePoint(@RequestBody JsonNode input,
      @RequestHeader("X-User-Id") String userId) {
    return organizer.createKnowledgePoint(input, userId);
  }

  @PutMapping("/questions/{questionId}/knowledge-points")
  public Map<String, Object> assignKnowledgePoints(@PathVariable String questionId, @RequestBody JsonNode input,
      @RequestHeader("X-User-Id") String userId) {
    return organizer.assignKnowledgePoints(questionId, input, userId);
  }

  @PatchMapping("/questions/{questionId}")
  public Map<String, Object> review(@PathVariable String questionId, @RequestBody JsonNode input,
      @RequestHeader("X-User-Id") String userId) {
    return organizer.reviewQuestion(questionId, input, userId);
  }

  @GetMapping("/question-sets")
  public List<Map<String, Object>> questionSets(@RequestHeader("X-User-Id") String userId) {
    return organizer.listQuestionSets(userId);
  }

  @PostMapping("/question-sets")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> createQuestionSet(@RequestBody JsonNode input, @RequestHeader("X-User-Id") String userId) {
    return organizer.saveQuestionSet(null, input, userId);
  }

  @PutMapping("/question-sets/{setId}")
  public Map<String, Object> updateQuestionSet(@PathVariable String setId, @RequestBody JsonNode input,
      @RequestHeader("X-User-Id") String userId) {
    return organizer.saveQuestionSet(setId, input, userId);
  }

  @PostMapping("/question-sets/{setId}/publish")
  public Map<String, Object> publish(@PathVariable String setId, @RequestHeader("X-User-Id") String userId) {
    return organizer.publish(setId, userId);
  }

  @PostMapping("/question-sets/{setId}/unpublish")
  public Map<String, Object> unpublish(@PathVariable String setId, @RequestHeader("X-User-Id") String userId) {
    return organizer.unpublish(setId, userId);
  }

  @DeleteMapping("/question-sets/{setId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteQuestionSet(@PathVariable String setId, @RequestHeader("X-User-Id") String userId) {
    organizer.deleteQuestionSet(setId, userId);
  }
}
