package com.whiteboard.server.teaching;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.whiteboard.server.config.WhiteboardProperties;
import java.io.IOException;
import java.math.BigDecimal;
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
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
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

  public TeachingPlatformService(JdbcTemplate jdbc, ObjectMapper objectMapper, WhiteboardProperties properties) {
    this.jdbc = jdbc;
    this.objectMapper = objectMapper;
    this.properties = properties;
  }

  public List<Map<String, Object>> listPapers(String organizationId) {
    String sql = "SELECT id, title, subject, grade, source, page_count, question_count, reviewed_count, " +
      "taught_count, progress, status, created_at FROM teaching_paper " +
      "WHERE (? = '' OR organization_id = ?) ORDER BY created_at DESC";
    return jdbc.query(sql, (rs, rowNum) -> paperRow(rs), safe(organizationId), safe(organizationId));
  }

  @Transactional
  public Map<String, Object> createPaper(MultipartFile file, String title, String subject, String grade,
      String organizationId, String creatorId) throws IOException {
    if (file == null || file.isEmpty()) throw badRequest("PDF 文件不能为空");
    String contentType = file.getContentType();
    if (contentType != null && !"application/pdf".equalsIgnoreCase(contentType)) throw badRequest("仅支持 PDF 文件");
    if (file.getSize() > 100L * 1024L * 1024L) throw badRequest("PDF 文件不能超过 100 MB");

    String id = newId("paper");
    Path directory = Paths.get(properties.getStorageRoot(), "papers", id).normalize();
    Files.createDirectories(directory);
    Path pdfPath = directory.resolve("original.pdf").normalize();
    if (!pdfPath.startsWith(directory)) throw badRequest("非法文件路径");
    Files.copy(file.getInputStream(), pdfPath, StandardCopyOption.REPLACE_EXISTING);

    LocalDateTime now = LocalDateTime.now();
    jdbc.update("INSERT INTO teaching_paper (id, organization_id, creator_id, title, subject, grade, source, " +
        "pdf_object_key, status, progress, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing', 0, ?, ?)",
      id, safe(organizationId), safe(creatorId), required(title, "试卷名称"), required(subject, "学科"),
      required(grade, "年级"), "教师上传", pdfPath.toString(), Timestamp.valueOf(now), Timestamp.valueOf(now));
    jdbc.update("INSERT INTO teaching_parse_job (id, paper_id, status, progress, created_at, updated_at) " +
      "VALUES (?, ?, 'queued', 0, ?, ?)", newId("parse"), id, Timestamp.valueOf(now), Timestamp.valueOf(now));
    return getPaper(id);
  }

  public Map<String, Object> getPaper(String id) {
    try {
      return jdbc.queryForObject("SELECT id, title, subject, grade, source, page_count, question_count, " +
        "reviewed_count, taught_count, progress, status, created_at FROM teaching_paper WHERE id = ?", (rs, n) -> paperRow(rs), id);
    } catch (EmptyResultDataAccessException error) {
      throw notFound("试卷不存在");
    }
  }

  public List<Map<String, Object>> listQuestions(String paperId) {
    return jdbc.query("SELECT id, paper_id, question_number, question_type, stem, options_json, answer, analysis, " +
      "points, confidence, review_status, teaching_status, version FROM teaching_question WHERE paper_id = ? " +
      "ORDER BY question_number", (rs, rowNum) -> questionRow(rs), paperId);
  }

  @Transactional
  public Map<String, Object> updateQuestion(String id, JsonNode patch) {
    Map<String, Object> current = getQuestion(id);
    long version = longValue(current.get("version"));
    if (patch.has("version") && patch.path("version").asLong() != version) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "题目已被其他用户修改，请刷新后重试");
    }
    String type = text(patch, "type", stringValue(current.get("type")));
    String stem = text(patch, "stem", stringValue(current.get("stem")));
    String answer = text(patch, "answer", stringValue(current.get("answer")));
    String analysis = text(patch, "analysis", stringValue(current.get("analysis")));
    int number = integer(patch, "number", integerValue(current.get("number")));
    BigDecimal points = decimal(patch, "points", decimalValue(current.get("points")));
    String optionsJson = patch.has("options") ? json(patch.get("options")) : json(current.get("options"));
    int changed = jdbc.update("UPDATE teaching_question SET question_number=?, question_type=?, stem=?, options_json=?, " +
      "answer=?, analysis=?, points=?, review_status='confirmed', version=version+1, updated_at=? WHERE id=? AND version=?",
      number, type, required(stem, "题目正文"), optionsJson, answer, analysis, points,
      Timestamp.valueOf(LocalDateTime.now()), id, version);
    if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "题目已被其他用户修改");
    refreshPaperCounts(stringValue(current.get("paperId")));
    return getQuestion(id);
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
    return jdbc.query("SELECT session_id, title, duration_ms, status, created_at FROM whiteboard_recording_session " +
      "ORDER BY created_at DESC LIMIT 200", (rs, rowNum) -> {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", rs.getString("session_id"));
        row.put("questionIds", Collections.emptyList());
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
    String sql = "SELECT * FROM learning_product WHERE (?='' OR status=?) AND (?='' OR teacher_id=?) " +
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
    if ("published".equals(status) && recordingIds.isEmpty()) throw badRequest("发布商品至少需要一个录制资产");
    if ("published".equals(status)) validateRecordingAssets(recordingIds);
    LocalDateTime now = LocalDateTime.now();
    int changed = jdbc.update("UPDATE learning_product SET teacher_name=?, title=?, subtitle=?, subject=?, grade=?, " +
      "product_type=?, paper_id=?, price=?, original_price=?, status=?, cover_style=?, lesson_count=?, duration=?, " +
      "description=?, highlights_json=?, published_at=CASE WHEN ?='published' THEN COALESCE(published_at, ?) ELSE published_at END, " +
      "version=version+1, updated_at=? WHERE id=? AND teacher_id=?", input.path("teacherName").asText(""),
      required(input.path("title").asText(), "商品名称"), input.path("subtitle").asText(""),
      required(input.path("subject").asText(), "学科"), required(input.path("grade").asText(), "年级"), productType,
      nullable(input.path("paperId").asText(null)), price, input.hasNonNull("originalPrice") ? input.path("originalPrice").decimalValue() : null,
      status, input.path("coverStyle").asText("indigo"), input.path("lessonCount").asInt(0), input.path("duration").asText(""),
      input.path("description").asText(""), json(input.path("highlights")), status, Timestamp.valueOf(now), Timestamp.valueOf(now),
      productId, teacherId);
    if (changed == 0) {
      jdbc.update("INSERT INTO learning_product (id, teacher_id, teacher_name, title, subtitle, subject, grade, product_type, " +
        "paper_id, price, original_price, status, cover_style, lesson_count, duration, description, highlights_json, " +
        "published_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        productId, required(teacherId, "老师 ID"), input.path("teacherName").asText(""), required(input.path("title").asText(), "商品名称"),
        input.path("subtitle").asText(""), required(input.path("subject").asText(), "学科"), required(input.path("grade").asText(), "年级"),
        productType, nullable(input.path("paperId").asText(null)), price,
        input.hasNonNull("originalPrice") ? input.path("originalPrice").decimalValue() : null, status,
        input.path("coverStyle").asText("indigo"), input.path("lessonCount").asInt(0), input.path("duration").asText(""),
        input.path("description").asText(""), json(input.path("highlights")), "published".equals(status) ? Timestamp.valueOf(now) : null,
        Timestamp.valueOf(now), Timestamp.valueOf(now));
    }
    replaceProductRelations(productId, stringList(input.path("questionIds")), recordingIds);
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
        "points, confidence, review_status, teaching_status, version FROM teaching_question WHERE id=?", (rs, n) -> questionRow(rs), id);
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
    row.put("confidence", rs.getInt("confidence")); row.put("status", rs.getString("review_status"));
    row.put("teachingStatus", rs.getString("teaching_status")); row.put("version", rs.getLong("version")); return row;
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
    row.put("highlights", readJson(rs.getString("highlights_json"), Collections.emptyList())); row.put("publishedAt", timestamp(rs, "published_at")); return row;
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
}
