package com.whiteboard.server.teaching;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.Resource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
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

  @GetMapping("/batch-upload-options")
  public Map<String, Object> batchUploadOptions() {
    return service.batchUploadOptions();
  }

  @GetMapping("/papers")
  public List<Map<String, Object>> listPapers(
      @RequestHeader(value = "X-Organization-Id", defaultValue = "") String organizationId,
      @RequestHeader("X-User-Id") String userId) {
    return service.listPapers(organizationId, userId);
  }

  @PostMapping(value = "/papers", consumes = "multipart/form-data")
  @ResponseStatus(HttpStatus.CREATED)
  public Object createPaper(
      @RequestParam("file") MultipartFile[] files,
      @RequestParam String title,
      @RequestParam String subject,
      @RequestParam String grade,
      @RequestHeader(value = "X-Organization-Id", defaultValue = "") String organizationId,
      @RequestHeader("X-User-Id") String creatorId) throws IOException {
    if (files.length == 1 && isZip(files[0]))
      return service.createPapersFromZip(files[0], title, subject, grade, organizationId, creatorId);
    return service.createPaper(Arrays.asList(files), title, subject, grade, organizationId, creatorId);
  }

  private boolean isZip(MultipartFile file) {
    String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
    String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
    return "application/zip".equals(type) || "application/x-zip-compressed".equals(type) || name.endsWith(".zip");
  }

  @DeleteMapping("/papers/{paperId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deletePaper(@PathVariable String paperId, @RequestHeader("X-User-Id") String userId) throws IOException {
    service.deletePaper(paperId, userId);
  }

  @GetMapping("/questions")
  public List<Map<String, Object>> listAllQuestions(
      @RequestHeader(value = "X-Organization-Id", defaultValue = "") String organizationId,
      @RequestHeader("X-User-Id") String userId) {
    return service.listAllQuestions(organizationId, userId);
  }

  @GetMapping("/papers/{paperId}/questions")
  public List<Map<String, Object>> listQuestions(@PathVariable String paperId, @RequestHeader("X-User-Id") String userId) {
    return service.listQuestions(paperId, userId);
  }

  @PatchMapping("/questions/{questionId}")
  public Map<String, Object> updateQuestion(
      @PathVariable String questionId,
      @RequestBody JsonNode patch,
      @RequestHeader("X-User-Id") String reviewerId) {
    // reviewerId is required so the authentication layer cannot be bypassed.
    return service.updateQuestion(questionId, patch, reviewerId);
  }

  @PutMapping("/questions/{questionId}/presentation")
  public Map<String, Object> updateQuestionPresentation(
      @PathVariable String questionId,
      @RequestBody JsonNode input,
      @RequestHeader("X-User-Id") String reviewerId) {
    return service.updateQuestionPresentation(questionId, input.path("presentationLayout"), reviewerId);
  }

  @PostMapping("/questions/{questionId}/reprocess")
  @ResponseStatus(HttpStatus.ACCEPTED)
  public Map<String, Object> reprocessQuestion(
      @PathVariable String questionId,
      @RequestBody JsonNode input,
      @RequestHeader("X-User-Id") String reviewerId) {
    return service.reprocessQuestion(questionId, input.path("sourceRegions"), reviewerId);
  }

  @GetMapping("/questions/{questionId}/reprocess/{jobId}")
  public Map<String, Object> getQuestionReprocessStatus(
      @PathVariable String questionId,
      @PathVariable String jobId,
      @RequestHeader("X-User-Id") String userId) {
    return service.getQuestionReprocessStatus(questionId, jobId, userId);
  }

  @GetMapping(value = "/questions/{questionId}/crops/{assetIndex}", produces = MediaType.IMAGE_PNG_VALUE)
  public ResponseEntity<?> getQuestionCrop(
      @PathVariable String questionId,
      @PathVariable int assetIndex,
      @RequestHeader("X-User-Id") String userId) {
    String cloudUrl = service.getQuestionCropCloudUrl(questionId, assetIndex, userId);
    if (cloudUrl != null) return ResponseEntity.status(HttpStatus.FOUND).location(java.net.URI.create(cloudUrl)).build();
    return ResponseEntity.ok().cacheControl(CacheControl.noCache()).contentType(MediaType.IMAGE_PNG)
      .body(service.getQuestionCrop(questionId, assetIndex, userId));
  }

  @GetMapping(value = "/questions/{questionId}/figures/{assetIndex}", produces = MediaType.IMAGE_PNG_VALUE)
  public ResponseEntity<?> getQuestionFigure(
      @PathVariable String questionId,
      @PathVariable int assetIndex,
      @RequestHeader("X-User-Id") String userId) {
    String cloudUrl = service.getQuestionFigureCloudUrl(questionId, assetIndex, userId);
    if (cloudUrl != null) return ResponseEntity.status(HttpStatus.FOUND).location(java.net.URI.create(cloudUrl)).build();
    return ResponseEntity.ok().cacheControl(CacheControl.noCache()).contentType(MediaType.IMAGE_PNG)
      .body(service.getQuestionFigure(questionId, assetIndex, userId));
  }

  @PostMapping("/questions/{questionId}/figures/{assetIndex}/enhance")
  public Map<String, Object> enhanceQuestionFigure(@PathVariable String questionId, @PathVariable int assetIndex,
      @RequestHeader("X-User-Id") String userId) throws IOException {
    return service.enhanceQuestionFigure(questionId, assetIndex, userId);
  }

  @PutMapping(value = "/questions/{questionId}/figures/{assetIndex}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public Map<String, Object> replaceQuestionFigure(@PathVariable String questionId, @PathVariable int assetIndex,
      @RequestParam("file") MultipartFile file, @RequestHeader("X-User-Id") String userId) throws IOException {
    return service.replaceQuestionFigure(questionId, assetIndex, file, userId);
  }

  @GetMapping(value = "/papers/{paperId}/pages/{pageNumber}", produces = MediaType.IMAGE_JPEG_VALUE)
  public ResponseEntity<?> getPaperPage(
      @PathVariable String paperId,
      @PathVariable int pageNumber,
      @RequestHeader("X-User-Id") String userId) {
    String cloudUrl = service.getPaperPageCloudUrl(paperId, pageNumber, userId);
    if (cloudUrl != null) return ResponseEntity.status(HttpStatus.FOUND).location(java.net.URI.create(cloudUrl)).build();
    return ResponseEntity.ok().cacheControl(CacheControl.maxAge(java.time.Duration.ofDays(7)).cachePrivate()).contentType(MediaType.IMAGE_JPEG).body(service.getPaperPage(paperId, pageNumber, userId));
  }

  @GetMapping("/papers/{paperId}/pages/{pageNumber}/location")
  public java.util.Map<String, Object> getPaperPageLocation(@PathVariable String paperId, @PathVariable int pageNumber,
      @RequestHeader("X-User-Id") String userId) {
    String url = service.getPaperPageCloudUrl(paperId, pageNumber, userId);
    return java.util.Collections.<String, Object>singletonMap("url", url == null ? "" : url);
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
