package com.whiteboard.server.teaching;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.whiteboard.server.config.WhiteboardProperties;
import com.whiteboard.server.paperprocessing.QuestionReprocessingService;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.Comparator;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TeachingPlatformService {
  private static final List<String> TASK_SERVICE_TYPES = Arrays.asList("直播讲解", "录制讲解", "均可");
  private static final List<String> PRODUCT_TYPES = Arrays.asList("整卷讲解", "单题精讲", "专题合集");

  private final JdbcTemplate jdbc;
  private final ObjectMapper objectMapper;
  private final WhiteboardProperties properties;
  private final QuestionReprocessingService questionReprocessing;
  private final PaperPagePreviewService pagePreviews;
  private final QiniuPaperStorageService cloudStorage;
  private final LibreOfficeDocumentConverter documentConverter;

  public TeachingPlatformService(JdbcTemplate jdbc, ObjectMapper objectMapper, WhiteboardProperties properties, QuestionReprocessingService questionReprocessing, PaperPagePreviewService pagePreviews, QiniuPaperStorageService cloudStorage, LibreOfficeDocumentConverter documentConverter) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
    this.properties = properties;
    this.questionReprocessing = questionReprocessing;
    this.pagePreviews = pagePreviews;
    this.cloudStorage = cloudStorage;
    this.documentConverter = documentConverter;
  }

  public List<Map<String, Object>> listPapers(String organizationId, String userId) {
    String sql = "SELECT id, title, subject, grade, source, page_count, question_count, reviewed_count, " +
      "taught_count, progress, CASE WHEN question_count>0 AND reviewed_count>=question_count THEN 'ready' ELSE status END status, created_at FROM teaching_paper " +
      "WHERE deleted_at IS NULL AND source <> '试题导入' AND ((? <> '' AND organization_id = ?) OR (? = '' AND creator_id = ?)) ORDER BY created_at DESC";
    return jdbc.query(sql, (rs, rowNum) -> paperRow(rs), safe(organizationId), safe(organizationId), safe(organizationId), safe(userId));
  }

  public Map<String, Object> batchUploadOptions() {
    Map<String, Object> options = new LinkedHashMap<>();
    options.put("grades", Arrays.asList("小学一年级", "小学二年级", "小学三年级", "小学四年级", "小学五年级", "小学六年级", "初一", "初二", "初三", "高一", "高二", "高三"));
    options.put("subjects", Arrays.asList("语文", "数学", "英语", "物理", "化学", "生物", "政治", "历史", "地理", "科学"));
    options.put("defaultGrade", "高三");
    options.put("defaultSubject", "数学");
    return options;
  }

  @Transactional
  public void deletePaper(String paperId, String userId) {
    assertPaperOwner(paperId, userId);
    Timestamp deletedAt = Timestamp.valueOf(LocalDateTime.now());
    jdbc.update("UPDATE teaching_question SET deleted_at=?,updated_at=? WHERE paper_id=? AND deleted_at IS NULL", deletedAt, deletedAt, paperId);
    jdbc.update("UPDATE teaching_parse_job SET status='cancelled',stage='cancelled',locked_at=NULL,finished_at=?,updated_at=? WHERE paper_id=? AND status IN ('queued','processing')", deletedAt, deletedAt, paperId);
    jdbc.update("UPDATE teaching_paper SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL", deletedAt, deletedAt, paperId);
  }

  private void deletePaperDirectory(String manifest, String paperId) throws IOException {
    if (manifest == null || manifest.trim().isEmpty()) return;
    Path storageRoot = Paths.get(properties.getStorageRoot()).toAbsolutePath().normalize();
    Path papersRoot = storageRoot.resolve("papers").normalize();
    Path directory = Paths.get(manifest).toAbsolutePath().normalize().getParent();
    if (directory == null || !directory.startsWith(papersRoot) || !paperId.equals(directory.getFileName().toString()))
      throw new IOException("批次存储目录校验失败");
    if (!Files.exists(directory)) return;
    try (java.util.stream.Stream<Path> paths = Files.walk(directory)) {
      for (Path path : (Iterable<Path>) paths.sorted(Comparator.reverseOrder())::iterator) Files.deleteIfExists(path);
    }
  }

  @Transactional
  public Map<String, Object> createPaper(List<MultipartFile> files, String title, String subject, String grade,
      String organizationId, String creatorId) throws IOException {
    return createDocumentBatch(files, title, subject, grade, organizationId, creatorId, "教师上传");
  }

  @Transactional
  public List<Map<String, Object>> createPapersFromZip(MultipartFile zipFile, String title, String subject, String grade,
      String organizationId, String creatorId) throws IOException {
    if (zipFile == null || zipFile.isEmpty()) throw badRequest("请选择 ZIP 文件");
    if (!isZip(zipFile)) throw badRequest("仅支持 ZIP 压缩包");
    Map<String, List<ZipDocumentFile>> groups = unzipDocumentGroups(zipFile);
    if (groups.isEmpty()) throw badRequest("ZIP 中没有可识别的 PDF 或图片文件");
    List<Map<String, Object>> papers = new ArrayList<>();
    boolean single = groups.size() == 1;
    for (Map.Entry<String, List<ZipDocumentFile>> entry : groups.entrySet()) {
      String batchTitle = single ? title : required(title, "导入批次名称") + " - " + readableZipGroupName(entry.getKey());
      papers.add(createDocumentBatchSources(entry.getValue(), batchTitle, subject, grade, organizationId, creatorId, "教师上传"));
    }
    return papers;
  }

  private Map<String, Object> createDocumentBatch(List<MultipartFile> files, String title, String subject, String grade,
      String organizationId, String creatorId, String sourceType) throws IOException {
    List<MultipartSourceFile> sourceFiles = files == null ? Collections.emptyList()
      : files.stream().map(MultipartSourceFile::new).collect(java.util.stream.Collectors.toList());
    return createDocumentBatchSources(sourceFiles,
      title, subject, grade, organizationId, creatorId, sourceType);
  }

  private Map<String, Object> createDocumentBatchSources(List<? extends DocumentSourceFile> files, String title, String subject, String grade,
      String organizationId, String creatorId, String sourceType) throws IOException {
    if (files == null || files.isEmpty() || files.stream().allMatch(DocumentSourceFile::isEmpty)) throw badRequest("请选择 PDF、Word 或图片文件");
    List<DocumentSourceFile> sourceFiles = new ArrayList<>(files);
    sourceFiles.removeIf(DocumentSourceFile::isEmpty);
    if (sourceFiles.size() > 30) throw badRequest("图片试卷最多支持 30 张");
    boolean hasPdf = sourceFiles.stream().anyMatch(file -> isPdf(file) || isWord(file));
    boolean hasImage = sourceFiles.stream().anyMatch(this::isImage);
    if (sourceFiles.stream().anyMatch(file -> !isPdf(file) && !isWord(file) && !isImage(file))) throw badRequest("仅支持 PDF、DOC、DOCX、JPG、PNG、WEBP 文件");
    if (hasPdf && (hasImage || sourceFiles.size() > 1)) throw badRequest("PDF、Word 与图片不能混合上传，且每次只能上传一个文档");
    long totalSize = sourceFiles.stream().mapToLong(DocumentSourceFile::getSize).sum();
    if (totalSize > 100L * 1024L * 1024L) throw badRequest("上传文件总大小不能超过 100 MB");

    String id = newId("试题导入".equals(sourceType) ? "questionbatch" : "paper");
    Path directory = Paths.get(properties.getStorageRoot(), "papers", id).normalize();
    Files.createDirectories(directory);
    List<Map<String, Object>> sources = new ArrayList<>();
    for (int index = 0; index < sourceFiles.size(); index++) {
      DocumentSourceFile file = sourceFiles.get(index);
      boolean word = isWord(file); String extension = isPdf(file) ? "pdf" : word ? wordExtension(file) : imageExtension(file);
      String archiveName = isPdf(file) ? "original.pdf" : word ? "original." + extension : String.format("page-%03d.%s", index + 1, extension);
      Path sourcePath = directory.resolve(archiveName).normalize();
      if (!sourcePath.startsWith(directory)) throw badRequest("非法文件路径");
      try (InputStream input = file.getInputStream()) {
        Files.copy(input, sourcePath, StandardCopyOption.REPLACE_EXISTING);
      }
      String storedName = archiveName;
      if (word) { storedName = "converted.pdf"; try { documentConverter.convertToPdf(sourcePath, directory.resolve(storedName)); } catch (Exception error) { throw badRequest("Word 转 PDF 失败：" + error.getMessage()); } }
      Map<String, Object> source = new LinkedHashMap<>(); source.put("name", storedName); if (word) source.put("originalSourceName", archiveName); source.put("originalName", file.getOriginalFilename()); source.put("contentType", word ? "application/pdf" : file.getContentType()); source.put("size", file.getSize()); sources.add(source);
    }
    Path manifestPath = directory.resolve("source-manifest.json");
    objectMapper.writeValue(manifestPath.toFile(), sources);

    LocalDateTime now = LocalDateTime.now();
    jdbc.update("INSERT INTO teaching_paper (id, organization_id, creator_id, title, subject, grade, source, " +
        "pdf_object_key, status, progress, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing', 0, ?, ?)",
      id, safe(organizationId), safe(creatorId), required(title, "导入批次名称"), required(subject, "学科"),
      required(grade, "年级"), sourceType, manifestPath.toString(), Timestamp.valueOf(now), Timestamp.valueOf(now));
    jdbc.update("INSERT INTO teaching_parse_job (id, paper_id, status, progress, created_at, updated_at) " +
      "VALUES (?, ?, 'queued', 0, ?, ?)", newId("parse"), id, Timestamp.valueOf(now), Timestamp.valueOf(now));
    for (int index = 0; index < sources.size(); index++) {
      jdbc.update("INSERT INTO paper_page (id,paper_id,page_number,source_object_key,status,created_at,updated_at) VALUES (?,?,?,?, 'uploaded',?,?)",
        newId("page"), id, index + 1, directory.resolve(String.valueOf(sources.get(index).get("name"))).toString(), Timestamp.valueOf(now), Timestamp.valueOf(now));
    }
    return getPaper(id);
  }

  private Map<String, List<ZipDocumentFile>> unzipDocumentGroups(MultipartFile zipFile) throws IOException {
    try {
      return unzipDocumentGroups(zipFile, StandardCharsets.UTF_8);
    } catch (IllegalArgumentException utf8Error) {
      try {
        return unzipDocumentGroups(zipFile, Charset.forName("GBK"));
      } catch (IllegalArgumentException gbkError) {
        throw badRequest("ZIP 文件名编码不受支持，请使用 UTF-8 编码重新压缩");
      }
    }
  }

  private Map<String, List<ZipDocumentFile>> unzipDocumentGroups(MultipartFile zipFile, Charset charset) throws IOException {
    Map<String, List<ZipDocumentFile>> groups = new LinkedHashMap<>();
    byte[] buffer = new byte[8192];
    long totalSize = 0;
    int fileCount = 0;
    try (ZipInputStream input = new ZipInputStream(zipFile.getInputStream(), charset)) {
      ZipEntry entry;
      while ((entry = input.getNextEntry()) != null) {
        if (entry.isDirectory()) continue;
        String entryName = normalizeZipEntryName(entry.getName());
        if (entryName.isEmpty()) continue;
        String lower = entryName.toLowerCase();
        if (!isSupportedZipDocument(lower)) continue;
        java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
        int read;
        while ((read = input.read(buffer)) > 0) {
          totalSize += read;
          if (totalSize > 300L * 1024L * 1024L) throw badRequest("ZIP 解压后总大小不能超过 300 MB");
          bytes.write(buffer, 0, read);
        }
        fileCount++;
        if (fileCount > 200) throw badRequest("ZIP 内文件数量不能超过 200 个");
        String group = zipGroupName(entryName, lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx"));
        groups.computeIfAbsent(group, key -> new ArrayList<>())
          .add(new ZipDocumentFile(entryName, contentTypeForName(lower), bytes.toByteArray()));
      }
    }
    for (List<ZipDocumentFile> groupFiles : groups.values()) {
      groupFiles.sort(Comparator.comparing(ZipDocumentFile::getOriginalFilename));
    }
    return groups;
  }

  private String normalizeZipEntryName(String name) {
    String normalized = safe(name).replace('\\', '/');
    while (normalized.startsWith("/")) normalized = normalized.substring(1);
    if (normalized.isEmpty() || normalized.contains("..") || normalized.startsWith("__MACOSX/")) return "";
    String last = normalized.substring(normalized.lastIndexOf('/') + 1);
    if (last.startsWith(".") || last.trim().isEmpty()) return "";
    return normalized;
  }

  private boolean isSupportedZipDocument(String lowerName) {
    return lowerName.endsWith(".pdf") || lowerName.endsWith(".doc") || lowerName.endsWith(".docx") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")
      || lowerName.endsWith(".png") || lowerName.endsWith(".webp");
  }

  private String zipGroupName(String entryName, boolean document) {
    if (document) {
      int dot = entryName.lastIndexOf('.');
      String withoutExtension = dot > 0 ? entryName.substring(0, dot) : entryName;
      return withoutExtension.replace('/', ' ');
    }
    int slash = entryName.indexOf('/');
    if (slash > 0) return entryName.substring(0, slash);
    return "根目录图片";
  }

  private String readableZipGroupName(String value) {
    String name = safe(value).replace('_', ' ').replace('-', ' ');
    return name.isEmpty() ? "未命名试卷" : name;
  }

  private String contentTypeForName(String lowerName) {
    if (lowerName.endsWith(".pdf")) return "application/pdf";
    if (lowerName.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (lowerName.endsWith(".doc")) return "application/msword";
    if (lowerName.endsWith(".png")) return "image/png";
    if (lowerName.endsWith(".webp")) return "image/webp";
    return "image/jpeg";
  }

  private boolean isZip(MultipartFile file) {
    String type = safe(file.getContentType()).toLowerCase();
    String name = safe(file.getOriginalFilename()).toLowerCase();
    return "application/zip".equals(type) || "application/x-zip-compressed".equals(type) || name.endsWith(".zip");
  }

  private boolean isPdf(DocumentSourceFile file) {
    String name = safe(file.getOriginalFilename()).toLowerCase();
    return "application/pdf".equalsIgnoreCase(file.getContentType()) || name.endsWith(".pdf");
  }

  private boolean isImage(DocumentSourceFile file) {
    String type = safe(file.getContentType()).toLowerCase();
    String name = safe(file.getOriginalFilename()).toLowerCase();
    return type.startsWith("image/") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".webp");
  }

  private boolean isWord(DocumentSourceFile file) {
    String type = safe(file.getContentType()).toLowerCase();
    String name = safe(file.getOriginalFilename()).toLowerCase();
    return "application/msword".equals(type) || "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(type) || name.endsWith(".doc") || name.endsWith(".docx");
  }

  private String wordExtension(DocumentSourceFile file) { return safe(file.getOriginalFilename()).toLowerCase().endsWith(".doc") ? "doc" : "docx"; }

  private String imageExtension(DocumentSourceFile file) {
    String name = safe(file.getOriginalFilename()).toLowerCase();
    if (name.endsWith(".png")) return "png";
    if (name.endsWith(".webp")) return "webp";
    return "jpg";
  }

  public Map<String, Object> getPaper(String id) {
    try {
      return jdbc.queryForObject("SELECT id, title, subject, grade, source, page_count, question_count, " +
        "reviewed_count, taught_count, progress, CASE WHEN question_count>0 AND reviewed_count>=question_count THEN 'ready' ELSE status END status, created_at FROM teaching_paper WHERE id = ? AND deleted_at IS NULL", (rs, n) -> paperRow(rs), id);
    } catch (EmptyResultDataAccessException error) {
      throw notFound("试卷不存在");
    }
  }

  public List<Map<String, Object>> listQuestions(String paperId, String userId) {
    assertPaperOwner(paperId, userId);
    return jdbc.query("SELECT id, paper_id, question_number, question_type, stem, options_json, answer, analysis, " +
      "points, confidence, difficulty, review_status, teaching_status, crop_regions_json, version FROM teaching_question WHERE paper_id = ? AND deleted_at IS NULL " +
      "ORDER BY question_number", (rs, rowNum) -> questionRow(rs), paperId);
  }

  public List<Map<String, Object>> listAllQuestions(String organizationId, String userId) {
    String sql = "SELECT q.id,q.paper_id,q.question_number,q.question_type,q.stem,q.options_json,q.answer,q.analysis," +
      "q.points,q.confidence,q.difficulty,q.review_status,q.teaching_status,q.crop_regions_json,q.version," +
      "p.title source_title,p.subject source_subject,p.grade source_grade,p.source source_type FROM teaching_question q " +
      "JOIN teaching_paper p ON p.id=q.paper_id WHERE q.deleted_at IS NULL AND p.deleted_at IS NULL AND q.review_status='confirmed' AND ((? <> '' AND p.organization_id=?) OR (? = '' AND p.creator_id=?)) " +
      "ORDER BY q.created_at DESC,q.question_number";
    return jdbc.query(sql, (rs, rowNum) -> { Map<String, Object> row = questionRow(rs); row.put("sourceTitle", rs.getString("source_title")); row.put("sourceSubject", rs.getString("source_subject")); row.put("sourceGrade", rs.getString("source_grade")); row.put("sourceType", rs.getString("source_type")); return row; },
      safe(organizationId), safe(organizationId), safe(organizationId), safe(userId));
  }

  @Transactional
  public Map<String, Object> updateQuestion(String id, JsonNode patch, String reviewerId) {
    Map<String, Object> current = getQuestion(id);
    assertPaperOwner(stringValue(current.get("paperId")), reviewerId);
    long version = longValue(current.get("version"));
    if (patch.has("version") && patch.path("version").asLong() != version) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "题目已被其他用户修改，请刷新后重试");
    }
    String type = text(patch, "type", stringValue(current.get("type")));
    if (!Arrays.asList("选择题", "填空题", "解答题").contains(type)) throw badRequest("不支持的题目类型");
    String stem = text(patch, "stem", stringValue(current.get("stem")));
    String answer = text(patch, "answer", stringValue(current.get("answer")));
    String analysis = text(patch, "analysis", stringValue(current.get("analysis")));
    String difficulty = text(patch, "difficulty", stringValue(current.get("difficulty")));
    if (!Arrays.asList("高", "中", "低").contains(difficulty)) throw badRequest("难度只能是高、中、低");
    int number = integer(patch, "number", integerValue(current.get("number")));
    BigDecimal points = decimal(patch, "points", decimalValue(current.get("points")));
    String optionsJson = patch.has("options") ? json(patch.get("options")) : json(current.get("options"));
    String cropRegionsJson = jdbc.queryForObject("SELECT crop_regions_json FROM teaching_question WHERE id=?", String.class, id);
    if (patch.has("sourceRegions") || patch.has("presentationLayout")) {
      JsonNode regions = patch.path("sourceRegions");
      if (patch.has("sourceRegions")) validateSourceRegions(regions);
      try {
        JsonNode parsed = objectMapper.readTree(cropRegionsJson);
        ObjectNode cropData = parsed instanceof ObjectNode ? (ObjectNode) parsed : objectMapper.createObjectNode();
        if (patch.has("sourceRegions")) cropData.set("regions", regions.deepCopy());
        if (patch.has("presentationLayout")) cropData.set("presentationLayout", patch.path("presentationLayout").deepCopy());
        cropRegionsJson = objectMapper.writeValueAsString(cropData);
      } catch (JsonProcessingException error) {
        throw badRequest("题目区域数据无效");
      }
    }
    int changed = jdbc.update("UPDATE teaching_question SET question_number=?, question_type=?, stem=?, options_json=?, " +
      "answer=?, analysis=?, points=?, difficulty=?, review_status='confirmed', version=version+1, updated_at=? WHERE id=? AND version=?",
      number, type, required(stem, "题目正文"), optionsJson, answer, analysis, points, difficulty,
      Timestamp.valueOf(LocalDateTime.now()), id, version);
    if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "题目已被其他用户修改");
    if (patch.has("sourceRegions") || patch.has("presentationLayout")) {
      jdbc.update("UPDATE teaching_question SET crop_regions_json=? WHERE id=?", cropRegionsJson, id);
    }
    refreshPaperCounts(stringValue(current.get("paperId")));
    Map<String, Object> updated = getQuestion(id);
    jdbc.update("INSERT INTO question_revision (id,question_id,version,snapshot_json,change_source,changed_by,change_reason,created_at) VALUES (?,?,?,?, 'TEACHER_EDIT',?,?,?)",
      newId("revision"), id, longValue(updated.get("version")), json(updated), safe(reviewerId), patch.path("changeReason").asText("老师校对确认"), Timestamp.valueOf(LocalDateTime.now()));
    return updated;
  }

  private void validateSourceRegions(JsonNode regions) {
    if (!regions.isArray() || regions.size() == 0) throw badRequest("题目区域不能为空");
    for (JsonNode region : regions) {
      int page = region.path("pageNumber").asInt(); int x0 = region.path("x0").asInt(-1); int y0 = region.path("y0").asInt(-1);
      int x1 = region.path("x1").asInt(-1); int y1 = region.path("y1").asInt(-1);
      if (page <= 0 || x0 < 0 || y0 < 0 || x1 > 1000 || y1 > 1000 || x1 <= x0 || y1 <= y0) throw badRequest("题目区域坐标无效");
    }
  }

  @Transactional
  public Map<String, Object> updateQuestionPresentation(String id, JsonNode layout, String reviewerId) {
    Map<String, Object> current = getQuestion(id); assertPaperOwner(stringValue(current.get("paperId")), reviewerId);
    if (!layout.isObject() || !layout.path("blocks").isArray()) throw badRequest("试题版式数据无效");
    String cropJson = jdbc.queryForObject("SELECT crop_regions_json FROM teaching_question WHERE id=?", String.class, id);
    try {
      JsonNode parsed = objectMapper.readTree(cropJson); ObjectNode cropData = parsed instanceof ObjectNode ? (ObjectNode) parsed : objectMapper.createObjectNode();
      cropData.set("presentationLayout", layout.deepCopy());
      jdbc.update("UPDATE teaching_question SET crop_regions_json=?,version=version+1,updated_at=? WHERE id=?", objectMapper.writeValueAsString(cropData), Timestamp.valueOf(LocalDateTime.now()), id);
      Map<String, Object> updated = getQuestion(id);
      jdbc.update("INSERT INTO question_revision (id,question_id,version,snapshot_json,change_source,changed_by,change_reason,created_at) VALUES (?,?,?,?, 'TEACHER_EDIT',?,?,?)",
        newId("revision"), id, longValue(updated.get("version")), json(updated), safe(reviewerId), "调整试题展示版式", Timestamp.valueOf(LocalDateTime.now()));
      return updated;
    } catch (JsonProcessingException error) { throw badRequest("试题版式数据无效"); }
  }

  @Transactional
  public Map<String, Object> reprocessQuestion(String id, JsonNode regions, String reviewerId) {
    Map<String, Object> current = getQuestion(id);
    String paperId = stringValue(current.get("paperId"));
    assertPaperOwner(paperId, reviewerId);
    validateSourceRegions(regions);
    try {
      String cropRegionsJson = jdbc.queryForObject("SELECT crop_regions_json FROM teaching_question WHERE id=?", String.class, id);
      JsonNode parsed = objectMapper.readTree(cropRegionsJson);
      ObjectNode cropData = parsed instanceof ObjectNode ? (ObjectNode) parsed : objectMapper.createObjectNode();
      cropData.set("regions", regions.deepCopy());
      jdbc.update("UPDATE teaching_question SET crop_regions_json=?,version=version+1,updated_at=? WHERE id=?",
        objectMapper.writeValueAsString(cropData), Timestamp.valueOf(LocalDateTime.now()), id);
      Map<String, Object> updated = getQuestion(id);
      jdbc.update("INSERT INTO question_revision (id,question_id,version,snapshot_json,change_source,changed_by,change_reason,created_at) VALUES (?,?,?,?, 'TEACHER_REGION_EDIT',?,?,?)",
        newId("revision"), id, longValue(updated.get("version")), json(updated), safe(reviewerId), "人工调整题目识别区域", Timestamp.valueOf(LocalDateTime.now()));
      String jobId = questionReprocessing.enqueue(id, paperId, regions);
      updated.put("reprocessJobId", jobId);
      return updated;
    } catch (JsonProcessingException error) {
      throw badRequest("题目区域数据无效");
    }
  }

  public Map<String, Object> getQuestionReprocessStatus(String questionId, String jobId, String userId) {
    Map<String, Object> question = getQuestion(questionId);
    assertPaperOwner(stringValue(question.get("paperId")), userId);
    Map<String, Object> status = jdbc.queryForObject(
      "SELECT id,status,stage,error_code,error_message,updated_at FROM question_reprocess_job WHERE id=? AND question_id=?",
      (rs, n) -> { Map<String, Object> row = new LinkedHashMap<>(); row.put("jobId", rs.getString("id")); row.put("status", rs.getString("status")); row.put("stage", rs.getString("stage")); row.put("errorCode", rs.getString("error_code")); row.put("errorMessage", rs.getString("error_message")); row.put("updatedAt", rs.getTimestamp("updated_at")); return row; },
      jobId, questionId);
    if ("done".equals(status.get("status"))) status.put("question", getQuestion(questionId));
    return status;
  }

  public Resource getQuestionCrop(String questionId, int assetIndex, String userId) {
    return getQuestionImageAsset(questionId, assetIndex, userId, "assets");
  }

  public Resource getQuestionFigure(String questionId, int assetIndex, String userId) {
    return getQuestionImageAsset(questionId, assetIndex, userId, "figureAssets");
  }

  private Resource getQuestionImageAsset(String questionId, int assetIndex, String userId, String assetField) {
    Map<String, Object> question = getQuestion(questionId); assertQuestionImageViewer(questionId, stringValue(question.get("paperId")), userId);
    String cropJson = jdbc.queryForObject("SELECT crop_regions_json FROM teaching_question WHERE id=?", String.class, questionId);
    try {
      JsonNode assets = objectMapper.readTree(cropJson).path(assetField);
      if (!assets.isArray() || assetIndex < 0 || assetIndex >= assets.size()) throw notFound("题目裁图不存在");
      Path root = Paths.get(properties.getStorageRoot()).toAbsolutePath().normalize();
      Path path = Paths.get(assets.get(assetIndex).path("objectKey").asText()).toAbsolutePath().normalize();
      if (!path.startsWith(root) || !Files.isRegularFile(path)) throw notFound("题目裁图不存在");
      return new PathResource(path);
    } catch (JsonProcessingException error) { throw notFound("题目裁图数据损坏"); }
  }

  private void assertQuestionImageViewer(String questionId, String paperId, String userId) {
    Integer allowed = jdbc.queryForObject(
      "SELECT COUNT(*) FROM teaching_paper p WHERE p.id=? AND (p.creator_id=? OR EXISTS (SELECT 1 FROM class_sync_room r JOIN class_sync_room_member m ON m.room_id=r.id WHERE r.current_question_id=? AND r.status='ACTIVE' AND m.student_id=?))",
      Integer.class, paperId, userId, questionId, userId);
    if (allowed == null || allowed == 0) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权查看题目图片");
  }

  public Resource getPaperPage(String paperId, int pageNumber, String userId) {
    assertPaperOwner(paperId, userId);
    try {
      jdbc.queryForObject(
        "SELECT normalized_object_key FROM paper_page WHERE paper_id=? AND page_number=?",
        String.class, paperId, pageNumber);
    } catch (EmptyResultDataAccessException error) {
      throw notFound("试卷页面不存在");
    }
    Path configuredRoot = Paths.get(properties.getStorageRoot());
    List<Path> roots = new ArrayList<>();
    roots.add(configuredRoot.toAbsolutePath().normalize());
    if (!configuredRoot.isAbsolute()) {
      roots.add(Paths.get("server").resolve(configuredRoot).toAbsolutePath().normalize());
    }
    for (Path root : roots) {
      Path page = root.resolve("papers").resolve(paperId).resolve("pages")
        .resolve(String.format("page-%04d.png", pageNumber)).normalize();
      if (page.startsWith(root) && Files.isRegularFile(page)) {
        try { return new PathResource(pagePreviews.preview(page)); }
        catch (Exception error) { throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "试卷页面预览生成失败", error); }
      }
    }
    throw notFound("试卷页面文件不存在");
  }

  private void assertPaperOwner(String paperId, String userId) {
    Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM teaching_paper WHERE id=? AND creator_id=? AND deleted_at IS NULL", Integer.class, paperId, safe(userId));
    if (count == null || count == 0) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问该试卷");
  }

  public List<Map<String, Object>> listTasks(String status, String studentId, String teacherId) {
    String sql = "SELECT t.*, (SELECT COUNT(*) FROM teaching_task_application a WHERE a.task_id=t.id) applicants " +
      "FROM teaching_task t WHERE (?='' OR t.status=?) AND (?='' OR t.student_id=?) AND (?='' OR t.teacher_id=?) " +
      "ORDER BY t.created_at DESC";
    return jdbc.query(sql, (rs, rowNum) -> taskRow(rs), safe(status), safe(status), safe(studentId), safe(studentId),
      safe(teacherId), safe(teacherId));
  }

  @Transactional
  public Map<String, Object> createTask(JsonNode input, String authenticatedStudentId) {
    String id = newId("task");
    String serviceType = required(input.path("serviceType").asText(), "服务方式");
    if (!TASK_SERVICE_TYPES.contains(serviceType)) throw badRequest("不支持的服务方式");
    BigDecimal budget = input.path("budget").decimalValue();
    if (budget.compareTo(BigDecimal.ZERO) <= 0) throw badRequest("任务预算必须大于 0");
    LocalDateTime now = LocalDateTime.now();
    jdbc.update("INSERT INTO teaching_task (id, student_id, student_name, student_grade, subject, title, description, " +
      "question_count, service_type, expected_at, budget, status, tags_json, created_at, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)", id, required(authenticatedStudentId, "学生 ID"),
      required(input.path("studentName").asText(), "学生名称"), required(input.path("studentGrade").asText(), "年级"),
      required(input.path("subject").asText(), "学科"), required(input.path("title").asText(), "任务标题"),
      input.path("description").asText(""), input.path("questionCount").asInt(0), serviceType,
      required(input.path("expectedAt").asText(), "期望完成时间"), budget, json(input.path("tags")),
      Timestamp.valueOf(now), Timestamp.valueOf(now));
    return getTask(id);
  }

  @Transactional
  public Map<String, Object> applyTask(String taskId, JsonNode input, String teacherId) {
    Map<String, Object> task = getTask(taskId);
    if (!"open".equals(task.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "任务当前不可申请");
    String id = newId("application");
    try {
      jdbc.update("INSERT INTO teaching_task_application (id, task_id, teacher_id, teacher_name, message, quoted_price, " +
        "status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)", id, taskId,
        required(teacherId, "老师 ID"), required(input.path("teacherName").asText(), "老师名称"),
        input.path("message").asText(""), input.has("quotedPrice") ? input.path("quotedPrice").decimalValue() : task.get("budget"),
        Timestamp.valueOf(LocalDateTime.now()), Timestamp.valueOf(LocalDateTime.now()));
    } catch (org.springframework.dao.DuplicateKeyException error) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "你已经申请过该任务");
    }
    return getApplication(id);
  }

  @Transactional
  public Map<String, Object> assignTask(String taskId, String applicationId, String studentId) {
    Map<String, Object> task = getTask(taskId);
    if (!studentId.equals(task.get("studentId"))) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权选择该任务的老师");
    Map<String, Object> application = getApplication(applicationId);
    if (!taskId.equals(application.get("taskId"))) throw badRequest("申请记录不属于当前任务");
    int changed = jdbc.update("UPDATE teaching_task SET teacher_id=?, teacher_name=?, status='scheduled', version=version+1, " +
      "updated_at=? WHERE id=? AND status='open'", application.get("teacherId"), application.get("teacherName"),
      Timestamp.valueOf(LocalDateTime.now()), taskId);
    if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "任务已被处理");
    jdbc.update("UPDATE teaching_task_application SET status=CASE WHEN id=? THEN 'accepted' ELSE 'rejected' END, updated_at=? " +
      "WHERE task_id=?", applicationId, Timestamp.valueOf(LocalDateTime.now()), taskId);
    return getTask(taskId);
  }

  public List<Map<String, Object>> listRecordingAssets() {
    return jdbc.query("SELECT session_id, title, duration_ms, status, created_at, question_ids_json FROM whiteboard_recording_session " +
      "ORDER BY created_at DESC LIMIT 200", (rs, rowNum) -> {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", rs.getString("session_id"));
        row.put("questionIds", readJson(rs.getString("question_ids_json"), Collections.emptyList()));
        row.put("title", rs.getString("title"));
        row.put("source", "时序录制");
        row.put("duration", formatDuration(rs.getLong("duration_ms")));
        row.put("status", rs.getInt("status") == 1 ? "ready" : "processing");
        row.put("published", false);
        row.put("createdAt", timestamp(rs, "created_at"));
        return row;
      });
  }

  public List<Map<String, Object>> listProducts(String status, String teacherId) {
    String sql = "SELECT * FROM learning_product WHERE product_type<>'试题集' AND (?='' OR status=?) AND (?='' OR teacher_id=?) " +
      "ORDER BY COALESCE(published_at, created_at) DESC";
    List<Map<String, Object>> products = jdbc.query(sql, (rs, rowNum) -> productRow(rs), safe(status), safe(status),
      safe(teacherId), safe(teacherId));
    for (Map<String, Object> product : products) attachProductRelations(product);
    return products;
  }

  @Transactional
  public Map<String, Object> saveProduct(String id, JsonNode input, String teacherId) {
    String productId = (id == null || id.trim().isEmpty()) ? newId("product") : id;
    String productType = required(input.path("productType").asText(), "商品类型");
    if (!PRODUCT_TYPES.contains(productType)) throw badRequest("不支持的商品类型");
    BigDecimal price = input.path("price").decimalValue();
    if (price.compareTo(BigDecimal.ZERO) < 0) throw badRequest("商品价格不能小于 0");
    String status = input.path("status").asText("draft");
    if (!Arrays.asList("draft", "reviewing", "published", "offline").contains(status)) throw badRequest("非法商品状态");
    List<String> recordingIds = stringList(input.path("recordingAssetIds"));
    List<String> questionIds = stringList(input.path("questionIds"));
    if ("published".equals(status) && recordingIds.isEmpty()) throw badRequest("发布内容商品至少需要一个录制课件");
    if ("published".equals(status) && !recordingIds.isEmpty()) validateRecordingAssets(recordingIds);
    String previewMode = input.path("previewMode").asText("first");
    if (!Arrays.asList("first", "selected").contains(previewMode)) throw badRequest("非法试看策略");
    int freeQuestionCount = Math.max(0, input.path("freeQuestionCount").asInt(0));
    LocalDateTime now = LocalDateTime.now();
    int changed = jdbc.update("UPDATE learning_product SET teacher_name=?, title=?, subtitle=?, subject=?, grade=?, " +
      "product_type=?, paper_id=?, price=?, original_price=?, status=?, cover_style=?, lesson_count=?, duration=?, " +
      "description=?, highlights_json=?, preview_mode=?, free_question_count=?, preview_question_ids_json=?, published_at=CASE WHEN ?='published' THEN COALESCE(published_at, ?) ELSE published_at END, " +
      "version=version+1, updated_at=? WHERE id=? AND teacher_id=?", input.path("teacherName").asText(""),
      required(input.path("title").asText(), "商品名称"), input.path("subtitle").asText(""),
      required(input.path("subject").asText(), "学科"), required(input.path("grade").asText(), "年级"), productType,
      nullable(input.path("paperId").asText(null)), price, input.hasNonNull("originalPrice") ? input.path("originalPrice").decimalValue() : null,
      status, input.path("coverStyle").asText("indigo"), input.path("lessonCount").asInt(0), input.path("duration").asText(""),
      input.path("description").asText(""), json(input.path("highlights")), previewMode, freeQuestionCount,
      json(input.path("previewQuestionIds")), status, Timestamp.valueOf(now), Timestamp.valueOf(now),
      productId, teacherId);
    if (changed == 0) {
      jdbc.update("INSERT INTO learning_product (id, teacher_id, teacher_name, title, subtitle, subject, grade, product_type, " +
        "paper_id, price, original_price, status, cover_style, lesson_count, duration, description, highlights_json, " +
        "preview_mode, free_question_count, preview_question_ids_json, published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        productId, required(teacherId, "老师 ID"), input.path("teacherName").asText(""), required(input.path("title").asText(), "商品名称"),
        input.path("subtitle").asText(""), required(input.path("subject").asText(), "学科"), required(input.path("grade").asText(), "年级"),
        productType, nullable(input.path("paperId").asText(null)), price,
        input.hasNonNull("originalPrice") ? input.path("originalPrice").decimalValue() : null, status,
        input.path("coverStyle").asText("indigo"), input.path("lessonCount").asInt(0), input.path("duration").asText(""),
        input.path("description").asText(""), json(input.path("highlights")), previewMode, freeQuestionCount,
        json(input.path("previewQuestionIds")), "published".equals(status) ? Timestamp.valueOf(now) : null,
        Timestamp.valueOf(now), Timestamp.valueOf(now));
    }
    replaceProductRelations(productId, questionIds, recordingIds);
    return getProduct(productId);
  }

  @Transactional
  public Map<String, Object> createPurchase(String productId, String studentId) {
    Map<String, Object> product = getProduct(productId);
    if (!"published".equals(product.get("status"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "商品当前不可购买");
    String id = newId("purchase");
    try {
      jdbc.update("INSERT INTO learning_purchase (id, product_id, student_id, amount, status, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, 'pending', ?, ?)", id, productId, required(studentId, "学生 ID"), product.get("price"),
        Timestamp.valueOf(LocalDateTime.now()), Timestamp.valueOf(LocalDateTime.now()));
    } catch (org.springframework.dao.DuplicateKeyException error) {
      return getPurchaseByProduct(productId, studentId);
    }
    return getPurchase(id);
  }

  public List<Map<String, Object>> listPurchases(String studentId) {
    return jdbc.query("SELECT id, product_id, student_id, amount, status, payment_trade_no, paid_at, created_at " +
      "FROM learning_purchase WHERE student_id=? ORDER BY created_at DESC", (rs, n) -> purchaseRow(rs), studentId);
  }

  private Map<String, Object> getQuestion(String id) {
    try {
      return jdbc.queryForObject("SELECT id, paper_id, question_number, question_type, stem, options_json, answer, analysis, " +
        "points, confidence, difficulty, review_status, teaching_status, crop_regions_json, version FROM teaching_question WHERE id=? AND deleted_at IS NULL", (rs, n) -> questionRow(rs), id);
    } catch (EmptyResultDataAccessException error) { throw notFound("题目不存在"); }
  }

  private Map<String, Object> getTask(String id) {
    try {
      return jdbc.queryForObject("SELECT t.*, (SELECT COUNT(*) FROM teaching_task_application a WHERE a.task_id=t.id) applicants " +
        "FROM teaching_task t WHERE t.id=?", (rs, n) -> taskRow(rs), id);
    } catch (EmptyResultDataAccessException error) { throw notFound("任务不存在"); }
  }

  private Map<String, Object> getApplication(String id) {
    try {
      return jdbc.queryForObject("SELECT * FROM teaching_task_application WHERE id=?", (rs, n) -> applicationRow(rs), id);
    } catch (EmptyResultDataAccessException error) { throw notFound("接单申请不存在"); }
  }

  private Map<String, Object> getProduct(String id) {
    try {
      Map<String, Object> product = jdbc.queryForObject("SELECT * FROM learning_product WHERE id=?", (rs, n) -> productRow(rs), id);
      attachProductRelations(product);
      return product;
    } catch (EmptyResultDataAccessException error) { throw notFound("商品不存在"); }
  }

  private Map<String, Object> getPurchase(String id) {
    try {
      return jdbc.queryForObject("SELECT id, product_id, student_id, amount, status, payment_trade_no, paid_at, created_at " +
        "FROM learning_purchase WHERE id=?", (rs, n) -> purchaseRow(rs), id);
    } catch (EmptyResultDataAccessException error) { throw notFound("购买订单不存在"); }
  }

  private Map<String, Object> getPurchaseByProduct(String productId, String studentId) {
    return jdbc.queryForObject("SELECT id, product_id, student_id, amount, status, payment_trade_no, paid_at, created_at " +
      "FROM learning_purchase WHERE product_id=? AND student_id=?", (rs, n) -> purchaseRow(rs), productId, studentId);
  }

  private void refreshPaperCounts(String paperId) {
    jdbc.update("UPDATE teaching_paper p SET question_count=(SELECT COUNT(*) FROM teaching_question q WHERE q.paper_id=p.id), " +
      "reviewed_count=(SELECT COUNT(*) FROM teaching_question q WHERE q.paper_id=p.id AND q.review_status='confirmed'), " +
      "status=CASE WHEN (SELECT COUNT(*) FROM teaching_question q WHERE q.paper_id=p.id)>0 " +
      "AND (SELECT COUNT(*) FROM teaching_question q WHERE q.paper_id=p.id AND q.review_status='confirmed')=(SELECT COUNT(*) FROM teaching_question q WHERE q.paper_id=p.id) " +
      "THEN 'ready' WHEN p.status='ready' THEN 'review' ELSE p.status END, " +
      "updated_at=? WHERE p.id=?", Timestamp.valueOf(LocalDateTime.now()), paperId);
  }

  private void validateRecordingAssets(List<String> recordingIds) {
    for (String recordingId : recordingIds) {
      Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM whiteboard_recording_session WHERE session_id=? AND status=1", Integer.class, recordingId);
      if (count == null || count == 0) throw badRequest("录制资产不存在或尚未就绪: " + recordingId);
    }
  }

  private void replaceProductRelations(String productId, List<String> questionIds, List<String> recordingIds) {
    jdbc.update("DELETE FROM learning_product_question WHERE product_id=?", productId);
    jdbc.update("DELETE FROM learning_product_recording WHERE product_id=?", productId);
    for (int i = 0; i < questionIds.size(); i++) jdbc.update("INSERT INTO learning_product_question (product_id, question_id, sort_order) VALUES (?, ?, ?)", productId, questionIds.get(i), i);
    for (int i = 0; i < recordingIds.size(); i++) jdbc.update("INSERT INTO learning_product_recording (product_id, recording_session_id, sort_order) VALUES (?, ?, ?)", productId, recordingIds.get(i), i);
  }

  private void attachProductRelations(Map<String, Object> product) {
    String id = stringValue(product.get("id"));
    product.put("questionIds", jdbc.query("SELECT question_id FROM learning_product_question WHERE product_id=? ORDER BY sort_order", (rs, n) -> rs.getString(1), id));
    product.put("recordingAssetIds", jdbc.query("SELECT recording_session_id FROM learning_product_recording WHERE product_id=? ORDER BY sort_order", (rs, n) -> rs.getString(1), id));
  }

  private Map<String, Object> paperRow(ResultSet rs) throws SQLException {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", rs.getString("id")); row.put("title", rs.getString("title")); row.put("subject", rs.getString("subject"));
    row.put("grade", rs.getString("grade")); row.put("source", rs.getString("source")); row.put("uploadedAt", timestamp(rs, "created_at"));
    row.put("pageCount", rs.getInt("page_count")); row.put("questionCount", rs.getInt("question_count"));
    row.put("reviewedCount", rs.getInt("reviewed_count")); row.put("taughtCount", rs.getInt("taught_count"));
    row.put("progress", rs.getInt("progress")); row.put("status", rs.getString("status")); return row;
  }

  private Map<String, Object> questionRow(ResultSet rs) throws SQLException {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", rs.getString("id")); row.put("paperId", rs.getString("paper_id")); row.put("number", rs.getInt("question_number"));
    row.put("type", rs.getString("question_type")); row.put("stem", rs.getString("stem")); row.put("options", readJson(rs.getString("options_json"), Collections.emptyList()));
    row.put("answer", rs.getString("answer")); row.put("analysis", rs.getString("analysis")); row.put("points", rs.getBigDecimal("points"));
    row.put("confidence", rs.getInt("confidence")); row.put("difficulty", rs.getString("difficulty")); row.put("status", rs.getString("review_status"));
    row.put("teachingStatus", rs.getString("teaching_status")); row.put("version", rs.getLong("version"));
    JsonNode cropData;
    try { cropData = objectMapper.readTree(rs.getString("crop_regions_json")); } catch (Exception error) { cropData = objectMapper.createObjectNode(); }
    row.put("sourceRegions", cropData.path("regions"));
    row.put("boundaryQuality", cropData.path("boundaryQuality"));
    row.put("warnings", cropData.path("warnings"));
    if (cropData.has("presentationLayout")) row.put("presentationLayout", cropData.path("presentationLayout"));
    List<String> cropUrls = new ArrayList<>(); for (int i = 0; i < cropData.path("assets").size(); i++) cropUrls.add("/api/questions/" + rs.getString("id") + "/crops/" + i);
    row.put("cropUrls", cropUrls);
    List<String> figureUrls = new ArrayList<>(); for (int i = 0; i < cropData.path("figureAssets").size(); i++) figureUrls.add("/api/questions/" + rs.getString("id") + "/figures/" + i);
    row.put("figureUrls", figureUrls); return row;
  }

  private Map<String, Object> taskRow(ResultSet rs) throws SQLException {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", rs.getString("id")); row.put("studentId", rs.getString("student_id")); row.put("studentName", rs.getString("student_name"));
    row.put("studentGrade", rs.getString("student_grade")); row.put("subject", rs.getString("subject")); row.put("title", rs.getString("title"));
    row.put("description", rs.getString("description")); row.put("questionCount", rs.getInt("question_count")); row.put("serviceType", rs.getString("service_type"));
    row.put("expectedAt", rs.getString("expected_at")); row.put("budget", rs.getBigDecimal("budget")); row.put("status", rs.getString("status"));
    row.put("teacherName", rs.getString("teacher_name")); row.put("tags", readJson(rs.getString("tags_json"), Collections.emptyList()));
    row.put("publishedAt", timestamp(rs, "created_at")); row.put("applicants", rs.getInt("applicants")); return row;
  }

  private Map<String, Object> applicationRow(ResultSet rs) throws SQLException {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", rs.getString("id")); row.put("taskId", rs.getString("task_id")); row.put("teacherId", rs.getString("teacher_id"));
    row.put("teacherName", rs.getString("teacher_name")); row.put("message", rs.getString("message"));
    row.put("quotedPrice", rs.getBigDecimal("quoted_price")); row.put("status", rs.getString("status")); row.put("createdAt", timestamp(rs, "created_at")); return row;
  }

  private Map<String, Object> productRow(ResultSet rs) throws SQLException {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", rs.getString("id")); row.put("teacherName", rs.getString("teacher_name")); row.put("title", rs.getString("title"));
    row.put("subtitle", rs.getString("subtitle")); row.put("subject", rs.getString("subject")); row.put("grade", rs.getString("grade"));
    row.put("productType", rs.getString("product_type")); row.put("paperId", rs.getString("paper_id")); row.put("price", rs.getBigDecimal("price"));
    row.put("originalPrice", rs.getBigDecimal("original_price")); row.put("status", rs.getString("status")); row.put("coverStyle", rs.getString("cover_style"));
    row.put("lessonCount", rs.getInt("lesson_count")); row.put("duration", rs.getString("duration")); row.put("sales", rs.getInt("sales"));
    row.put("rating", rs.getBigDecimal("rating")); row.put("description", rs.getString("description"));
    row.put("highlights", readJson(rs.getString("highlights_json"), Collections.emptyList()));
    row.put("previewMode", rs.getString("preview_mode")); row.put("freeQuestionCount", rs.getInt("free_question_count"));
    row.put("previewQuestionIds", readJson(rs.getString("preview_question_ids_json"), Collections.emptyList()));
    row.put("publishedAt", timestamp(rs, "published_at")); return row;
  }

  private Map<String, Object> purchaseRow(ResultSet rs) throws SQLException {
    Map<String, Object> row = new LinkedHashMap<>();
    row.put("id", rs.getString("id")); row.put("productId", rs.getString("product_id")); row.put("studentId", rs.getString("student_id"));
    row.put("amount", rs.getBigDecimal("amount")); row.put("status", rs.getString("status")); row.put("paymentTradeNo", rs.getString("payment_trade_no"));
    row.put("paidAt", timestamp(rs, "paid_at")); row.put("createdAt", timestamp(rs, "created_at")); return row;
  }

  private Object readJson(String value, Object fallback) {
    if (value == null || value.trim().isEmpty()) return fallback;
    try { return objectMapper.readValue(value, Object.class); } catch (JsonProcessingException error) { return fallback; }
  }

  private String json(Object value) {
    if (value == null) return "[]";
    try { return objectMapper.writeValueAsString(value); } catch (JsonProcessingException error) { throw new IllegalStateException(error); }
  }

  private List<String> stringList(JsonNode node) {
    if (node == null || !node.isArray()) return Collections.emptyList();
    List<String> values = new ArrayList<>();
    for (JsonNode item : node) if (!item.asText().trim().isEmpty()) values.add(item.asText());
    return values;
  }

  private String formatDuration(long durationMs) {
    long seconds = durationMs / 1000L;
    return String.format("%02d:%02d", seconds / 60L, seconds % 60L);
  }

  private String timestamp(ResultSet rs, String column) throws SQLException {
    Timestamp value = rs.getTimestamp(column);
    return value == null ? null : value.toLocalDateTime().toString();
  }

  private String required(String value, String label) {
    if (value == null || value.trim().isEmpty()) throw badRequest(label + "不能为空");
    return value.trim();
  }

  private String safe(String value) { return value == null ? "" : value.trim(); }
  private String nullable(String value) { return value == null || value.trim().isEmpty() ? null : value.trim(); }
  private String newId(String prefix) { return prefix + "_" + UUID.randomUUID().toString().replace("-", ""); }
  private String text(JsonNode node, String field, String fallback) { return node.has(field) ? node.path(field).asText() : fallback; }
  private int integer(JsonNode node, String field, int fallback) { return node.has(field) ? node.path(field).asInt() : fallback; }
  private BigDecimal decimal(JsonNode node, String field, BigDecimal fallback) { return node.has(field) ? node.path(field).decimalValue() : fallback; }
  private String stringValue(Object value) { return value == null ? "" : String.valueOf(value); }
  private int integerValue(Object value) { return value instanceof Number ? ((Number) value).intValue() : Integer.parseInt(stringValue(value)); }
  private long longValue(Object value) { return value instanceof Number ? ((Number) value).longValue() : Long.parseLong(stringValue(value)); }
  private BigDecimal decimalValue(Object value) { return value instanceof BigDecimal ? (BigDecimal) value : new BigDecimal(stringValue(value)); }
  private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
  private ResponseStatusException notFound(String message) { return new ResponseStatusException(HttpStatus.NOT_FOUND, message); }

  private interface DocumentSourceFile {
    boolean isEmpty();
    String getOriginalFilename();
    String getContentType();
    long getSize();
    InputStream getInputStream() throws IOException;
  }

  public String getPaperPageCloudUrl(String paperId, int pageNumber, String userId) {
    assertPaperOwner(paperId, userId);
    return cloudStorage.pageUrl(paperId, pageNumber);
  }

  private static class MultipartSourceFile implements DocumentSourceFile {
    private final MultipartFile file;
    MultipartSourceFile(MultipartFile file) { this.file = file; }
    public boolean isEmpty() { return file.isEmpty(); }
    public String getOriginalFilename() { return file.getOriginalFilename(); }
    public String getContentType() { return file.getContentType(); }
    public long getSize() { return file.getSize(); }
    public InputStream getInputStream() throws IOException { return file.getInputStream(); }
  }

  private static class ZipDocumentFile implements DocumentSourceFile {
    private final String originalFilename;
    private final String contentType;
    private final byte[] content;
    ZipDocumentFile(String originalFilename, String contentType, byte[] content) {
      this.originalFilename = originalFilename; this.contentType = contentType; this.content = content;
    }
    public boolean isEmpty() { return content.length == 0; }
    public String getOriginalFilename() { return originalFilename; }
    public String getContentType() { return contentType; }
    public long getSize() { return content.length; }
    public InputStream getInputStream() { return new java.io.ByteArrayInputStream(content); }
  }
}
