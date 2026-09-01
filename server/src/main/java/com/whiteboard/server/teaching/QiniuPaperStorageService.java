package com.whiteboard.server.teaching;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.qiniu.common.QiniuException;
import com.qiniu.storage.BucketManager;
import com.qiniu.storage.Configuration;
import com.qiniu.storage.Region;
import com.qiniu.storage.UploadManager;
import com.qiniu.util.Auth;
import com.whiteboard.server.config.WhiteboardProperties;
import java.io.InputStream;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class QiniuPaperStorageService {
  private final JdbcTemplate jdbc;
  private final WhiteboardProperties properties;
  private final PaperPagePreviewService previews;
  private final ObjectMapper json;
  private volatile String resolvedDomain;

  public QiniuPaperStorageService(JdbcTemplate jdbc, WhiteboardProperties properties, PaperPagePreviewService previews, ObjectMapper json) {
    this.jdbc = jdbc; this.properties = properties; this.previews = previews; this.json = json;
  }

  public void archive(String paperId) throws Exception {
    requireConfigured();
    Map<String, Object> paper = jdbc.queryForMap("SELECT pdf_object_key,source_cloud_key FROM teaching_paper WHERE id=? AND deleted_at IS NULL", paperId);
    Path manifest = java.nio.file.Paths.get(String.valueOf(paper.get("pdf_object_key"))).toAbsolutePath().normalize();
    List<Map<String, Object>> pages = jdbc.queryForList("SELECT page_number,normalized_object_key,preview_cloud_key FROM paper_page WHERE paper_id=? ORDER BY page_number", paperId);
    jdbc.update("UPDATE teaching_paper SET cloud_status='uploading',cloud_error='',updated_at=NOW() WHERE id=?", paperId);
    try {
      for (Map<String, Object> page : pages) {
        int number = ((Number) page.get("page_number")).intValue();
        String existing = String.valueOf(page.get("preview_cloud_key"));
        if (existing != null && !existing.trim().isEmpty() && !"null".equals(existing)) continue;
        Path source = java.nio.file.Paths.get(String.valueOf(page.get("normalized_object_key"))).toAbsolutePath().normalize();
        Path preview = previews.preview(source);
        String key = String.format("papers/%s/pages/page-%04d.jpg", paperId, number);
        upload(preview, key);
        jdbc.update("UPDATE paper_page SET preview_cloud_key=?,updated_at=NOW() WHERE paper_id=? AND page_number=?", key, paperId, number);
      }
      String manifestJson = Files.isRegularFile(manifest) ? new String(Files.readAllBytes(manifest), java.nio.charset.StandardCharsets.UTF_8) : "";
      String processingName = manifestJson.contains("\"converted.pdf\"") ? "converted.pdf" : "original.pdf";
      Path original = manifest.getParent().resolve(processingName).normalize();
      String sourceKey = String.valueOf(paper.get("source_cloud_key"));
      boolean pdfSource = manifestJson.contains("\"original.pdf\"") || manifestJson.contains("\"converted.pdf\"");
      if ((sourceKey == null || sourceKey.trim().isEmpty() || "null".equals(sourceKey)) && Files.isRegularFile(original)) {
        sourceKey = "papers/" + paperId + "/source/" + processingName;
        upload(original, sourceKey);
        jdbc.update("UPDATE teaching_paper SET source_cloud_key=?,updated_at=NOW() WHERE id=?", sourceKey, paperId);
      }
      if (pdfSource && (sourceKey == null || sourceKey.trim().isEmpty() || "null".equals(sourceKey))) throw new IllegalStateException("本地源 PDF 不存在，无法归档到七牛");
      Path originalDocx = manifest.getParent().resolve("original.docx"), originalDoc = manifest.getParent().resolve("original.doc");
      if (Files.isRegularFile(originalDocx)) upload(originalDocx, "papers/" + paperId + "/source/original.docx");
      if (Files.isRegularFile(originalDoc)) upload(originalDoc, "papers/" + paperId + "/source/original.doc");
      archiveQuestionAssets(paperId);
      jdbc.update("UPDATE teaching_paper SET cloud_status='done',cloud_error='',updated_at=NOW() WHERE id=?", paperId);
      if (sourceKey != null && !sourceKey.trim().isEmpty() && !"null".equals(sourceKey)) { Files.deleteIfExists(original); Files.deleteIfExists(originalDocx); Files.deleteIfExists(originalDoc); }
    } catch (Exception error) {
      jdbc.update("UPDATE teaching_paper SET cloud_status='failed',cloud_error=?,updated_at=NOW() WHERE id=?", limit(error.getMessage()), paperId);
      throw error;
    }
  }

  public String pageUrl(String paperId, int pageNumber) {
    String key;
    try { key = jdbc.queryForObject("SELECT preview_cloud_key FROM paper_page WHERE paper_id=? AND page_number=?", String.class, paperId, pageNumber); }
    catch (Exception error) { return null; }
    return key == null || key.trim().isEmpty() ? null : signedUrl(key);
  }

  public int archiveQuestionAssets(String paperId) throws Exception {
    requireConfigured();
    int migrated = 0;
    List<Map<String, Object>> questions = jdbc.queryForList("SELECT id,crop_regions_json FROM teaching_question WHERE paper_id=? AND deleted_at IS NULL", paperId);
    for (Map<String, Object> question : questions) {
      String questionId = String.valueOf(question.get("id"));
      JsonNode parsed = json.readTree(String.valueOf(question.get("crop_regions_json")));
      ObjectNode data = parsed instanceof ObjectNode ? (ObjectNode) parsed : json.createObjectNode();
      List<Path> uploadedLocals = new ArrayList<>();
      int changed = migrateAssetArray(paperId, questionId, "assets", "crop", data.withArray("assets"), uploadedLocals)
        + migrateAssetArray(paperId, questionId, "figureAssets", "figure", data.withArray("figureAssets"), uploadedLocals);
      if (changed == 0) continue;
      jdbc.update("UPDATE teaching_question SET crop_regions_json=?,version=version+1,updated_at=NOW() WHERE id=?", json.writeValueAsString(data), questionId);
      for (Path local : uploadedLocals) Files.deleteIfExists(local);
      migrated += changed;
    }
    return migrated;
  }

  private int migrateAssetArray(String paperId, String questionId, String field, String prefix, ArrayNode assets, List<Path> uploadedLocals) throws Exception {
    int migrated = 0;
    for (int index = 0; index < assets.size(); index++) {
      JsonNode node = assets.get(index);
      if (!(node instanceof ObjectNode)) continue;
      ObjectNode descriptor = (ObjectNode) node;
      String cloudKey = descriptor.path("cloudKey").asText("").trim();
      if (!cloudKey.isEmpty()) continue;
      Path local = java.nio.file.Paths.get(descriptor.path("objectKey").asText("")).toAbsolutePath().normalize();
      if (!Files.isRegularFile(local)) continue;
      cloudKey = String.format("papers/%s/questions/%s/%s-%02d.png", paperId, questionId, prefix, index + 1);
      upload(local, cloudKey);
      descriptor.put("cloudKey", cloudKey);
      uploadedLocals.add(local);
      migrated++;
    }
    return migrated;
  }

  public String questionAssetUrl(String questionId, int assetIndex, String field) {
    try {
      String cropJson = jdbc.queryForObject("SELECT crop_regions_json FROM teaching_question WHERE id=? AND deleted_at IS NULL", String.class, questionId);
      JsonNode assets = json.readTree(cropJson).path(field);
      if (!assets.isArray() || assetIndex < 0 || assetIndex >= assets.size()) return null;
      String key = assets.get(assetIndex).path("cloudKey").asText("").trim();
      return key.isEmpty() ? null : signedUrl(key);
    } catch (Exception error) { return null; }
  }

  public void restoreAsset(String cloudKey, Path target) throws Exception {
    if (cloudKey == null || cloudKey.trim().isEmpty()) throw new IllegalStateException("云端题图不存在");
    Files.createDirectories(target.getParent());
    Path temporary = Files.createTempFile(target.getParent(), "question-asset-", ".tmp");
    try (InputStream input = new URL(signedUrl(cloudKey)).openStream()) {
      Files.copy(input, temporary, StandardCopyOption.REPLACE_EXISTING);
      Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
    } finally { Files.deleteIfExists(temporary); }
  }

  public void uploadAsset(Path file, String cloudKey) throws Exception { requireConfigured(); upload(file, cloudKey); }

  public void restoreOriginal(String paperId, Path target) throws Exception {
    String key = jdbc.queryForObject("SELECT source_cloud_key FROM teaching_paper WHERE id=?", String.class, paperId);
    if (key == null || key.trim().isEmpty()) throw new IllegalStateException("试卷源 PDF 本地已删除且云端对象不存在");
    Files.createDirectories(target.getParent());
    Path temporary = Files.createTempFile(target.getParent(), "original-", ".pdf.tmp");
    try (InputStream input = new URL(signedUrl(key)).openStream()) {
      Files.copy(input, temporary, StandardCopyOption.REPLACE_EXISTING);
      Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
    } finally { Files.deleteIfExists(temporary); }
  }

  private void upload(Path file, String key) throws Exception {
    WhiteboardProperties.Qiniu qiniu = properties.getQiniu();
    Configuration configuration = Configuration.create(Region.autoRegion());
    configuration.useHttpsDomains = true;
    Auth auth = Auth.create(qiniu.getAccessKey().trim(), qiniu.getSecretKey().trim());
    String token = auth.uploadToken(qiniu.getBucket().trim(), key, Math.max(300, qiniu.getTokenExpireSeconds()), null);
    com.qiniu.http.Response response = null;
    try {
      response = new UploadManager(configuration).put(file.toFile(), key, token);
      if (!response.isOK()) throw new IllegalStateException("七牛上传失败：" + response.statusCode);
    } finally { if (response != null) response.close(); }
  }

  private String signedUrl(String key) {
    WhiteboardProperties.Qiniu qiniu = properties.getQiniu();
    String domain = resolveDomain().replaceAll("/$", "");
    if (!domain.startsWith("http://") && !domain.startsWith("https://")) domain = "https://" + domain;
    return Auth.create(qiniu.getAccessKey().trim(), qiniu.getSecretKey().trim()).privateDownloadUrl(domain + "/" + key, Math.max(300, qiniu.getTokenExpireSeconds()));
  }

  private String resolveDomain() {
    WhiteboardProperties.Qiniu qiniu = properties.getQiniu();
    if (qiniu.getPublicDomain() != null && !qiniu.getPublicDomain().trim().isEmpty()) return qiniu.getPublicDomain().trim();
    if (resolvedDomain != null) return resolvedDomain;
    try {
      String[] domains = new BucketManager(Auth.create(qiniu.getAccessKey().trim(), qiniu.getSecretKey().trim()), Configuration.create(Region.autoRegion())).domainList(qiniu.getBucket().trim());
      if (domains != null) for (String domain : domains) if (domain != null && !domain.trim().isEmpty()) return resolvedDomain = domain.trim();
    } catch (QiniuException error) { throw new IllegalStateException("无法获取七牛下载域名", error); }
    throw new IllegalStateException("七牛 Bucket 未绑定下载域名");
  }

  private void requireConfigured() {
    WhiteboardProperties.Qiniu qiniu = properties.getQiniu();
    if (blank(qiniu.getAccessKey()) || blank(qiniu.getSecretKey()) || blank(qiniu.getBucket())) throw new IllegalStateException("未配置七牛云存储");
  }
  private boolean blank(String value) { return value == null || value.trim().isEmpty(); }
  private String limit(String value) { if (value == null) return "云归档失败"; return value.length() > 1000 ? value.substring(0, 1000) : value; }
}
