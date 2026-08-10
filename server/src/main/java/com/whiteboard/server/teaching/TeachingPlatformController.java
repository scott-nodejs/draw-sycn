package com.whiteboard.server.teaching;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class TeachingPlatformController {
  private final TeachingPlatformService service;

  public TeachingPlatformController(TeachingPlatformService service) {
    this.service = service;
  }

  @GetMapping("/papers")
  public List<Map<String, Object>> listPapers(
      @RequestHeader(value = "X-Organization-Id", defaultValue = "") String organizationId) {
    return service.listPapers(organizationId);
  }

  @PostMapping(value = "/papers", consumes = "multipart/form-data")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> createPaper(
      @RequestParam MultipartFile file,
      @RequestParam String title,
      @RequestParam String subject,
      @RequestParam String grade,
      @RequestHeader(value = "X-Organization-Id", defaultValue = "") String organizationId,
      @RequestHeader("X-User-Id") String creatorId) throws IOException {
    return service.createPaper(file, title, subject, grade, organizationId, creatorId);
  }

  @GetMapping("/papers/{paperId}/questions")
  public List<Map<String, Object>> listQuestions(@PathVariable String paperId) {
    return service.listQuestions(paperId);
  }

  @PatchMapping("/questions/{questionId}")
  public Map<String, Object> updateQuestion(
      @PathVariable String questionId,
      @RequestBody JsonNode patch,
      @RequestHeader("X-User-Id") String reviewerId) {
    // reviewerId is required so the authentication layer cannot be bypassed.
    return service.updateQuestion(questionId, patch);
  }

  @GetMapping("/teaching-assets")
  public List<Map<String, Object>> listTeachingAssets() {
    return service.listRecordingAssets();
  }

  @GetMapping("/teaching-tasks")
  public List<Map<String, Object>> listTasks(
      @RequestParam(defaultValue = "") String status,
      @RequestParam(defaultValue = "") String studentId,
      @RequestParam(defaultValue = "") String teacherId) {
    return service.listTasks(status, studentId, teacherId);
  }

  @PostMapping("/teaching-tasks")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> createTask(
      @RequestBody JsonNode input,
      @RequestHeader("X-User-Id") String studentId) {
    return service.createTask(input, studentId);
  }

  @PostMapping("/teaching-tasks/{taskId}/applications")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> applyTask(
      @PathVariable String taskId,
      @RequestBody JsonNode input,
      @RequestHeader("X-User-Id") String teacherId) {
    return service.applyTask(taskId, input, teacherId);
  }

  @PostMapping("/teaching-tasks/{taskId}/assignments/{applicationId}")
  public Map<String, Object> assignTask(
      @PathVariable String taskId,
      @PathVariable String applicationId,
      @RequestHeader("X-User-Id") String studentId) {
    return service.assignTask(taskId, applicationId, studentId);
  }

  @GetMapping("/learning-products")
  public List<Map<String, Object>> listProducts(
      @RequestParam(defaultValue = "") String status,
      @RequestParam(defaultValue = "") String teacherId) {
    return service.listProducts(status, teacherId);
  }

  @PutMapping("/learning-products/{productId}")
  public Map<String, Object> saveProduct(
      @PathVariable String productId,
      @RequestBody JsonNode input,
      @RequestHeader("X-User-Id") String teacherId) {
    return service.saveProduct(productId, input, teacherId);
  }

  @PostMapping("/learning-products/{productId}/purchases")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Object> createPurchase(
      @PathVariable String productId,
      @RequestHeader("X-User-Id") String studentId) {
    return service.createPurchase(productId, studentId);
  }

  @GetMapping("/learning-purchases")
  public List<Map<String, Object>> listPurchases(@RequestHeader("X-User-Id") String studentId) {
    return service.listPurchases(studentId);
  }
}
