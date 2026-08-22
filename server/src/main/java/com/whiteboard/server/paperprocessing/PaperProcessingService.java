package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.HashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.imageio.ImageIO;
import javax.annotation.PostConstruct;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PaperProcessingService {
  private static final Logger log = LoggerFactory.getLogger(PaperProcessingService.class);
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;
  private final OcrProviderRouter ocrProviders;
  private final DeepseekClient deepseek;
  private final DocumentNormalizer normalizer;
  private final PaddleDocLayoutClient layoutClient;
  private final PageInspector pageInspector;
  private final StageExecutionService stageExecutions;
  private final QuestionQualityValidator qualityValidator;
  private final HybridRecognitionService hybridRecognition;
  private final QuestionBoundaryResolver boundaryResolver;
  private final PageImagePreprocessor imagePreprocessor;
  private final RecognitionReportService recognitionReports;
  private final TransactionTemplate transactions;

  public PaperProcessingService(JdbcTemplate jdbc, ObjectMapper json, OcrProviderRouter ocrProviders, DeepseekClient deepseek,
      DocumentNormalizer normalizer, PaddleDocLayoutClient layoutClient, PageInspector pageInspector,
      StageExecutionService stageExecutions, QuestionQualityValidator qualityValidator,
      HybridRecognitionService hybridRecognition,
      QuestionBoundaryResolver boundaryResolver,
      PageImagePreprocessor imagePreprocessor,
      RecognitionReportService recognitionReports,
      org.springframework.transaction.PlatformTransactionManager transactionManager) {
    this.jdbc = jdbc; this.json = json; this.ocrProviders = ocrProviders; this.deepseek = deepseek; this.normalizer = normalizer;
    this.layoutClient = layoutClient;
    this.pageInspector = pageInspector; this.stageExecutions = stageExecutions; this.qualityValidator = qualityValidator;
    this.hybridRecognition = hybridRecognition;
    this.boundaryResolver = boundaryResolver;
    this.imagePreprocessor = imagePreprocessor;
    this.recognitionReports = recognitionReports;
    this.transactions = new TransactionTemplate(transactionManager);
  }

  @PostConstruct
  public void recoverConfigurationFailures() {
    int recovered = jdbc.update("UPDATE teaching_parse_job SET status='queued',stage='queued',progress=0,error_code='',error_message='',retry_count=0,next_retry_at=NULL,locked_at=NULL,updated_at=? WHERE status='failed' AND error_code='PADDLEOCR_NOT_CONFIGURED'", now());
    if (recovered > 0) log.info("Recovered {} paper jobs after PaddleOCR configuration became available", recovered);
    List<Map<String, Object>> legacy = jdbc.query("SELECT j.id,j.paper_id,j.request_id,j.result_object_key FROM teaching_parse_job j WHERE j.provider='paddleocr' AND j.status='review' AND NOT EXISTS (SELECT 1 FROM teaching_question q WHERE q.paper_id=j.paper_id AND q.review_status='confirmed')",
      (rs, n) -> { Map<String,Object> row=new LinkedHashMap<>(); row.put("id",rs.getString("id")); row.put("paperId",rs.getString("paper_id")); row.put("requestId",rs.getString("request_id")); row.put("resultKey",rs.getString("result_object_key")); return row; });
    for (Map<String,Object> item : legacy) {
      try {
        Path markdown = Paths.get(string(item.get("resultKey")));
        Path layoutPath = markdown.getParent().resolve("content-list.json");
        JsonNode layout = json.readTree(layoutPath.toFile());
        if (!layout.isArray() || layout.size() == 0 || layout.get(0).has("coordinateWidth")) continue;
        jdbc.update("UPDATE teaching_parse_job SET status='processing',stage='ocr_running',progress=45,error_code='',error_message='',locked_at=NULL,updated_at=? WHERE id=?", now(), item.get("id"));
        jdbc.update("UPDATE teaching_paper SET status='processing',progress=45,updated_at=? WHERE id=?", now(), item.get("paperId"));
        log.info("Queued legacy PaddleOCR coordinate repair: jobId={}, paperId={}", item.get("id"), item.get("paperId"));
      } catch (Exception error) { log.warn("Could not inspect legacy PaddleOCR coordinates for job {}", item.get("id"), error); }
    }
  }

  @Scheduled(fixedDelayString = "${PAPER_PROCESSING_INTERVAL_MS:5000}")
  public void tick() {
    List<Map<String, Object>> jobs = jdbc.query("SELECT id,paper_id,status,stage,provider,request_id,retry_count FROM teaching_parse_job WHERE status IN ('queued','processing') AND (next_retry_at IS NULL OR next_retry_at<=?) AND (locked_at IS NULL OR locked_at<?) ORDER BY created_at LIMIT 1",
      (rs, n) -> { Map<String, Object> row = new LinkedHashMap<>(); row.put("id", rs.getString("id")); row.put("paperId", rs.getString("paper_id")); row.put("stage", rs.getString("stage")); row.put("provider", rs.getString("provider")); row.put("requestId", rs.getString("request_id")); row.put("retryCount", rs.getInt("retry_count")); return row; },
      Timestamp.valueOf(LocalDateTime.now()), Timestamp.valueOf(LocalDateTime.now().minusMinutes(10)));
    if (jobs.isEmpty()) return;
    Map<String, Object> job = jobs.get(0); String id = string(job.get("id"));
    if (jdbc.update("UPDATE teaching_parse_job SET locked_at=?,updated_at=? WHERE id=? AND (locked_at IS NULL OR locked_at<?)", now(), now(), id, Timestamp.valueOf(LocalDateTime.now().minusMinutes(10))) == 0) return;
    log.info("Paper job claimed: jobId={}, paperId={}, stage={}, retryCount={}", id, job.get("paperId"), job.get("stage"), job.get("retryCount"));
    try { process(job); } catch (Exception error) {
      log.error("Paper job execution failed: jobId={}, paperId={}, stage={}", id, job.get("paperId"), job.get("stage"), error);
      failOrRetry(job, error);
    }
  }

  private void process(Map<String, Object> job) throws Exception {
    String stage = string(job.get("stage")); String jobId = string(job.get("id")); String paperId = string(job.get("paperId"));
    if (stage.isEmpty() || "queued".equals(stage)) {
      OcrProvider provider = ocrProviders.selected();
      List<Path> sources = sourceFiles(paperId);
      if (sources.isEmpty()) throw new ProviderException("SOURCE_FILES_MISSING", "找不到试卷源文件");
      log.info("Paper normalization starting: jobId={}, paperId={}, sourceCount={}", jobId, paperId, sources.size());
      jdbc.update("UPDATE teaching_parse_job SET status='processing',stage='normalizing',progress=5,updated_at=? WHERE id=?", now(), jobId);
      String normalizationExecution = stageExecutions.start(jobId, paperId, "normalizing", "pdfbox");
      int pages = normalizer.normalize(paperId, sources, paperDirectory(paperId));
      stageExecutions.complete(normalizationExecution, "{\"pageCount\":" + pages + "}");
      log.info("Paper normalization completed: jobId={}, paperId={}, pageCount={}", jobId, paperId, pages);
      String preprocessingExecution = stageExecutions.start(jobId, paperId, "image_preprocessing", "local");
      PageImagePreprocessor.Summary preprocessing = imagePreprocessor.process(paperId, paperDirectory(paperId));
      stageExecutions.complete(preprocessingExecution, "{\"pageCount\":" + preprocessing.pages + ",\"repairedPages\":" + preprocessing.repaired + ",\"averageScore\":" + preprocessing.averageScore + "}");
      jdbc.update("UPDATE teaching_parse_job SET stage='page_inspection',progress=15,updated_at=? WHERE id=?", now(), jobId);
      String inspectionExecution = stageExecutions.start(jobId, paperId, "page_inspection", "pdfbox");
      pageInspector.inspect(paperId, sources);
      stageExecutions.complete(inspectionExecution, "{\"pageCount\":" + pages + "}");
      log.info("Submitting paper to OCR provider: provider={}, jobId={}, paperId={}", provider.name(), jobId, paperId);
      String nativeExecution = stageExecutions.start(jobId, paperId, "native_extraction", "pdfbox");
      HybridRecognitionService.Submission submission = hybridRecognition.submit(paperId, sources, paperDirectory(paperId), provider);
      String batchId = submission.requestId;
      stageExecutions.complete(nativeExecution, "{\"nativePages\":" + submission.nativePages + ",\"ocrPages\":" + submission.ocrPages + "}");
      if (submission.ocrPages > 0) stageExecutions.start(jobId, paperId, "ocr", provider.name());
      log.info("Paper submitted to OCR provider: provider={}, jobId={}, paperId={}, externalTaskId={}", provider.name(), jobId, paperId, batchId);
      jdbc.update("UPDATE teaching_parse_job SET provider=?,stage='ocr_running',progress=25,request_id=?,locked_at=NULL,error_code='',error_message='',updated_at=? WHERE id=?", provider.name(), batchId, now(), jobId);
      jdbc.update("UPDATE teaching_paper SET page_count=?,progress=25,status='processing',updated_at=? WHERE id=?", pages, now(), paperId); return;
    }
    if ("normalizing".equals(stage) || "page_inspection".equals(stage)) {
      log.warn("Recovering interrupted normalization: jobId={}, paperId={}", jobId, paperId);
      jdbc.update("UPDATE teaching_parse_job SET stage='queued',locked_at=NULL,updated_at=? WHERE id=?", now(), jobId); return;
    }
    if ("ocr_running".equals(stage) || "mineru_running".equals(stage)) {
      OcrProvider provider = ocrProviders.byName("mineru_running".equals(stage) ? "mineru" : string(job.get("provider")));
      log.info("Polling OCR provider: provider={}, jobId={}, paperId={}, externalTaskId={}", provider.name(), jobId, paperId, job.get("requestId"));
      HybridRecognitionService.PollOutcome poll = hybridRecognition.poll(paperId, paperDirectory(paperId), provider, string(job.get("requestId")));
      OcrProvider.PollResult result = poll.result;
      if (poll.resubmitted) jdbc.update("UPDATE teaching_parse_job SET request_id=?,updated_at=? WHERE id=?", poll.requestId, now(), jobId);
      if (!result.done) { log.info("OCR provider still processing: provider={}, jobId={}, paperId={}", provider.name(), jobId, paperId); unlock(jobId, 45); updatePaperProgress(paperId, 45); return; }
      Path directory = paperDirectory(paperId); Files.createDirectories(directory);
      Path rawPath = directory.resolve(provider.name() + "-result.json"); json.writeValue(rawPath.toFile(), result.raw);
      OcrProvider.DocumentArtifacts artifacts = hybridRecognition.complete(paperId, directory, provider, result, directory.resolve(provider.name() + "-assets"));
      Path markdownPath = directory.resolve("ocr.md"); Path layoutPath = directory.resolve("content-list.json");
      Files.write(markdownPath, artifacts.markdown.getBytes(StandardCharsets.UTF_8)); json.writeValue(layoutPath.toFile(), artifacts.layout);
      Timestamp current = now();
      jdbc.update("INSERT INTO paper_ocr_result (id,paper_id,provider,provider_task_id,model_version,markdown_object_key,raw_result_object_key,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'done',?,?)",
        id("ocr"), paperId, provider.name(), string(job.get("requestId")), "hybrid-v3", markdownPath.toString(), rawPath.toString(), current, current);
      stageExecutions.completeRunning(jobId, "ocr", "{\"provider\":\"" + provider.name() + "\"}");
      jdbc.update("UPDATE teaching_parse_job SET stage='deepseek_pending',progress=65,result_object_key=?,locked_at=NULL,updated_at=? WHERE id=?", markdownPath.toString(), now(), jobId);
      updatePaperProgress(paperId, 65); return;
    }
    if ("deepseek_pending".equals(stage)) {
      log.info("DeepSeek structuring starting: jobId={}, paperId={}", jobId, paperId);
      String semanticExecution = stageExecutions.start(jobId, paperId, "question_segmentation", "deepseek");
      Map<String, Object> paper = jdbc.queryForMap("SELECT subject,grade FROM teaching_paper WHERE id=?", paperId);
      Path markdownPath = Paths.get(jdbc.queryForObject("SELECT result_object_key FROM teaching_parse_job WHERE id=?", String.class, jobId));
      String markdown = new String(Files.readAllBytes(markdownPath), StandardCharsets.UTF_8);
      if (markdown.length() > 180000) throw new ProviderException("OCR_RESULT_TOO_LARGE", "OCR 文本过长，需要按页拆分处理");
      JsonNode layout = json.readTree(markdownPath.getParent().resolve("content-list.json").toFile());
      String layoutExecution = stageExecutions.start(jobId, paperId, "layout_detection", "pp-structure-v3");
      ArrayNode structureLayout = layoutClient.analyze(normalizedPageFiles(paperId));
      if (structureLayout != null && structureLayout.size() > 0) {
        json.writeValue(markdownPath.getParent().resolve("pp-doclayout.json").toFile(), structureLayout);
        layout = mergeVlTextWithStructureLayout(layout, structureLayout);
      }
      stageExecutions.complete(layoutExecution, "{\"blockCount\":" + (structureLayout == null ? 0 : structureLayout.size()) + "}");
      ArrayNode normalizedLayout = compactLayout(paperId, layout);
      JsonNode structured = deepseek.structureQuestions(markdown, normalizedLayout, string(paper.get("subject")), string(paper.get("grade")));
      boundaryResolver.resolve(structured, normalizedLayout);
      qualityValidator.validate(structured);
      String qualityExecution = stageExecutions.start(jobId, paperId, "quality_assurance", "local");
      ObjectNode qualityReport = recognitionReports.create(jobId, paperId, structured);
      stageExecutions.complete(qualityExecution, json.writeValueAsString(qualityReport));
      stageExecutions.complete(semanticExecution, "{\"questionCount\":" + structured.path("questions").size() + "}");
      transactions.executeWithoutResult(status -> { try { persistQuestions(paperId, structured.path("questions")); } catch (Exception error) { throw new IllegalStateException(error); } });
      Path structuredPath = paperDirectory(paperId).resolve("structured-questions.json"); json.writeValue(structuredPath.toFile(), structured);
      int count = structured.path("questions").size();
      jdbc.update("UPDATE teaching_parse_job SET status='review',stage='review_required',progress=100,result_object_key=?,locked_at=NULL,finished_at=?,updated_at=? WHERE id=?", structuredPath.toString(), now(), now(), jobId);
      jdbc.update("UPDATE teaching_paper SET status='review',progress=100,question_count=?,updated_at=? WHERE id=?", count, now(), paperId);
      log.info("Paper processing completed: jobId={}, paperId={}, questionCount={}", jobId, paperId, count);
    }
  }

  protected void persistQuestions(String paperId, JsonNode questions) throws Exception {
    Integer confirmed = jdbc.queryForObject("SELECT COUNT(*) FROM teaching_question WHERE paper_id=? AND review_status='confirmed'", Integer.class, paperId);
    if (confirmed != null && confirmed > 0) throw new ProviderException("PAPER_ALREADY_REVIEWED", "试卷已有确认题目，不能自动覆盖");
    jdbc.update("DELETE FROM teaching_question WHERE paper_id=?", paperId); Timestamp current = now();
    for (JsonNode item : questions) {
      int number = item.path("number").asInt(); String questionId = id("question");
      ObjectNode cropData = createQuestionCrops(paperId, questionId, item.path("sourceRegions"), item.path("figureRegions"));
      cropData.set("boundaryQuality", item.path("boundaryQuality").deepCopy());
      cropData.set("warnings", item.path("warnings").deepCopy());
      String reviewStatus = item.path("boundaryQuality").path("requiresManualReview").asBoolean() ? "needs_attention" : "review";
      Map<String, Object> snapshot = new LinkedHashMap<>(); snapshot.put("number", number); snapshot.put("type", item.path("type").asText()); snapshot.put("stem", item.path("stem").asText()); snapshot.put("options", item.path("options")); snapshot.put("answer", item.path("answer").asText()); snapshot.put("analysis", item.path("analysis").asText()); snapshot.put("points", item.path("points").asDouble(0)); snapshot.put("confidence", clamp(item.path("confidence").asInt(0))); snapshot.put("difficulty", normalizeDifficulty(item.path("difficulty").asText())); snapshot.put("cropData", cropData);
      jdbc.update("INSERT INTO teaching_question (id,paper_id,question_number,question_type,stem,options_json,answer,analysis,points,confidence,difficulty,review_status,teaching_status,crop_regions_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'unrecorded',?,?,?)",
        questionId, paperId, number, normalizeType(item.path("type").asText()), item.path("stem").asText(), json.writeValueAsString(item.path("options")), item.path("answer").asText(), item.path("analysis").asText(), item.path("points").asDouble(0), clamp(item.path("confidence").asInt(0)), normalizeDifficulty(item.path("difficulty").asText()), reviewStatus, json.writeValueAsString(cropData), current, current);
      jdbc.update("INSERT INTO question_revision (id,question_id,version,snapshot_json,change_source,created_at) VALUES (?,?,0,?,'AI_STRUCTURING',?)", id("revision"), questionId, json.writeValueAsString(snapshot), current);
    }
  }

  private ObjectNode createQuestionCrops(String paperId, String questionId, JsonNode regions, JsonNode figureRegions) throws Exception {
    ObjectNode result = json.createObjectNode(); result.set("regions", regions.deepCopy()); ArrayNode assets = result.putArray("assets");
    Path output = paperDirectory(paperId).resolve("questions").resolve(questionId); Files.createDirectories(output);
    int index = 0;
    for (JsonNode region : regions) {
      int page = region.path("pageNumber").asInt();
      String pagePath = jdbc.queryForObject("SELECT normalized_object_key FROM paper_page WHERE paper_id=? AND page_number=?", String.class, paperId, page);
      BufferedImage source = ImageIO.read(Paths.get(pagePath).toFile());
      int x0 = pixel(region.path("x0").asInt(), source.getWidth()); int y0 = pixel(region.path("y0").asInt(), source.getHeight());
      int x1 = pixel(region.path("x1").asInt(), source.getWidth()); int y1 = pixel(region.path("y1").asInt(), source.getHeight());
      int padding = Math.max(12, source.getWidth() / 100); x0 = Math.max(0, x0 - padding); y0 = Math.max(0, y0 - padding); x1 = Math.min(source.getWidth(), x1 + padding); y1 = Math.min(source.getHeight(), y1 + padding);
      if (x1 <= x0 || y1 <= y0) throw new ProviderException("INVALID_CROP_REGION", "第 " + page + " 页题目坐标无效");
      Path asset = output.resolve(String.format("crop-%02d.png", ++index)); ImageIO.write(source.getSubimage(x0, y0, x1 - x0, y1 - y0), "png", asset.toFile());
      ObjectNode descriptor = assets.addObject(); descriptor.put("pageNumber", page); descriptor.put("objectKey", asset.toString()); descriptor.put("width", x1 - x0); descriptor.put("height", y1 - y0);
    }
    ArrayNode figureAssets = result.putArray("figureAssets"); index = 0;
    for (JsonNode region : figureRegions) {
      int page = region.path("pageNumber").asInt();
      String pagePath = jdbc.queryForObject("SELECT normalized_object_key FROM paper_page WHERE paper_id=? AND page_number=?", String.class, paperId, page);
      BufferedImage source = ImageIO.read(Paths.get(pagePath).toFile());
      int x0 = pixel(region.path("x0").asInt(), source.getWidth()); int y0 = pixel(region.path("y0").asInt(), source.getHeight());
      int x1 = pixel(region.path("x1").asInt(), source.getWidth()); int y1 = pixel(region.path("y1").asInt(), source.getHeight());
      int padding = Math.max(6, source.getWidth() / 250); x0 = Math.max(0, x0 - padding); y0 = Math.max(0, y0 - padding); x1 = Math.min(source.getWidth(), x1 + padding); y1 = Math.min(source.getHeight(), y1 + padding);
      if (x1 <= x0 || y1 <= y0) continue;
      BufferedImage figure = source.getSubimage(x0, y0, x1 - x0, y1 - y0);
      String mineruImage = region.path("objectKey").asText();
      if (!mineruImage.isEmpty() && Files.isRegularFile(Paths.get(mineruImage))) { BufferedImage original = ImageIO.read(Paths.get(mineruImage).toFile()); if (original != null) figure = original; }
      Path asset = output.resolve(String.format("figure-%02d.png", ++index)); ImageIO.write(figure, "png", asset.toFile());
      ObjectNode descriptor = figureAssets.addObject(); descriptor.put("pageNumber", page); descriptor.put("objectKey", asset.toString()); descriptor.put("width", x1 - x0); descriptor.put("height", y1 - y0);
    }
    return result;
  }

  private ArrayNode compactLayout(String paperId, JsonNode raw) {
    ArrayNode blocks = json.createArrayNode();
    if (!raw.isArray()) return blocks;
    Map<Integer, int[]> pageSizes = new LinkedHashMap<>();
    jdbc.query("SELECT page_number,width,height FROM paper_page WHERE paper_id=?", rs -> {
      pageSizes.put(rs.getInt("page_number"), new int[] { rs.getInt("width"), rs.getInt("height") });
    }, paperId);
    String provider = jdbc.queryForObject("SELECT provider FROM teaching_parse_job WHERE paper_id=? ORDER BY created_at DESC LIMIT 1", String.class, paperId);
    boolean paddleCoordinates = "paddleocr".equalsIgnoreCase(provider);
    for (JsonNode item : raw) {
      String text = item.path("text").asText(); String type = item.path("type").asText(); JsonNode bbox = item.path("bbox");
      boolean figure = "image".equalsIgnoreCase(type) || "figure".equalsIgnoreCase(type);
      if ((!figure && text.trim().isEmpty()) || !bbox.isArray() || bbox.size() != 4) continue;
      int pageNumber = item.path("page_idx").asInt() + 1;
      int[] pageSize = pageSizes.get(pageNumber);
      if (pageSize == null || pageSize[0] <= 0 || pageSize[1] <= 0) continue;
      int coordinateWidth = item.path("coordinateWidth").asInt(paddleCoordinates ? pageSize[0] : 1000);
      int coordinateHeight = item.path("coordinateHeight").asInt(paddleCoordinates ? pageSize[1] : Math.max(1, Math.round(1000f * pageSize[1] / pageSize[0])));
      ArrayNode normalizedBox = json.createArrayNode();
      normalizedBox.add(normalizeCoordinate(bbox.get(0).asInt(), coordinateWidth));
      normalizedBox.add(normalizeCoordinate(bbox.get(1).asInt(), coordinateHeight));
      normalizedBox.add(normalizeCoordinate(bbox.get(2).asInt(), coordinateWidth));
      normalizedBox.add(normalizeCoordinate(bbox.get(3).asInt(), coordinateHeight));
      ObjectNode block = blocks.addObject(); block.put("pageNumber", pageNumber); block.set("bbox", normalizedBox); block.put("type", figure ? "figure" : "text"); block.put("text", text.length() > 2000 ? text.substring(0, 2000) : text);
      if (figure && item.hasNonNull("localImagePath")) block.put("objectKey", item.path("localImagePath").asText());
    }
    return splitCompoundQuestionBlocks(blocks);
  }

  private ArrayNode splitCompoundQuestionBlocks(ArrayNode blocks) {
    ArrayNode result=json.createArrayNode();Pattern starts=Pattern.compile("(?m)^\\s*(\\d{1,3})\\s*[.．、。)）:]");
    for(JsonNode block:blocks){String text=block.path("text").asText();Matcher matcher=starts.matcher(text);List<Integer> offsets=new ArrayList<>();while(matcher.find())offsets.add(matcher.start());
      if(offsets.size()<2||!validBox(block.path("bbox"))){result.add(block);continue;}JsonNode box=block.path("bbox");int top=box.get(1).asInt(),bottom=box.get(3).asInt();
      for(int index=0;index<offsets.size();index++){int from=offsets.get(index),to=index+1<offsets.size()?offsets.get(index+1):text.length();String fragment=text.substring(from,to).trim();if(fragment.isEmpty())continue;ObjectNode copy=block.deepCopy();copy.put("text",fragment);int y0=top+Math.round((bottom-top)*(from/(float)Math.max(1,text.length())));int y1=top+Math.round((bottom-top)*(to/(float)Math.max(1,text.length())));ArrayNode fragmentBox=copy.putArray("bbox");fragmentBox.add(box.get(0).asInt()).add(y0).add(box.get(2).asInt()).add(Math.max(y0+4,y1));result.add(copy);}
      log.info("Compound OCR block split: page={}, questionFragments={}, originalBounds={}",block.path("pageNumber").asInt(),offsets.size(),box);
    }return result;
  }

  private ArrayNode mergeVlTextWithStructureLayout(JsonNode vlLayout, ArrayNode structureLayout) {
    ArrayNode merged = json.createArrayNode();
    List<JsonNode> structureFigures = new ArrayList<>();
    List<JsonNode> usedStructureFigures = new ArrayList<>();
    for (JsonNode block : structureLayout) if (isVisualLayoutBlock(block)) structureFigures.add(block);
    int vlFigures = 0, matchedFigures = 0;
    // PaddleOCR-VL remains authoritative for text and image assets. Structure only corrects figure coordinates.
    if (vlLayout != null && vlLayout.isArray()) {
      for (JsonNode block : vlLayout) {
        ObjectNode copy = block.deepCopy();
        if (isVisualLayoutBlock(block)) {
          vlFigures++;
          JsonNode match = bestOverlappingFigure(block, structureFigures);
          if (match != null) { copy.set("bbox", match.path("bbox").deepCopy()); usedStructureFigures.add(match); matchedFigures++; }
        }
        merged.add(copy);
      }
    }
    // Native-PDF pages have text blocks but no raster figure assets. Preserve unmatched
    // layout figures so deterministic question regions still include diagrams and charts.
    for (JsonNode figure : structureFigures) if (!usedStructureFigures.contains(figure)) {
      ObjectNode copy = figure.deepCopy(); copy.put("type", "figure"); copy.put("text", ""); merged.add(copy);
    }
    log.info("Hybrid layout assembled: vlBlocks={}, vlFigures={}, structureFigures={}, matchedFigures={}, total={}",
      vlLayout != null && vlLayout.isArray() ? vlLayout.size() : 0, vlFigures, structureFigures.size(), matchedFigures, merged.size());
    return merged;
  }

  private boolean isVisualLayoutBlock(JsonNode block) {
    String label = block.path("label").asText(block.path("type").asText()).toLowerCase();
    return label.contains("image") || label.contains("figure") || label.contains("chart");
  }

  private JsonNode bestOverlappingFigure(JsonNode vl, List<JsonNode> candidates) {
    JsonNode vlBox = vl.path("bbox"); if (!validBox(vlBox)) return null;
    int page = vl.path("page_idx").asInt(); JsonNode best = null; double bestScore = 0;
    for (JsonNode candidate : candidates) {
      if (candidate.path("page_idx").asInt() != page || !validBox(candidate.path("bbox"))) continue;
      double score = overlapScore(vlBox, candidate.path("bbox"));
      if (score > bestScore) { bestScore = score; best = candidate; }
    }
    return bestScore >= 0.2 ? best : null;
  }

  private boolean validBox(JsonNode box) { return box.isArray() && box.size() == 4; }

  private double overlapScore(JsonNode left, JsonNode right) {
    double x0 = Math.max(left.get(0).asDouble(), right.get(0).asDouble());
    double y0 = Math.max(left.get(1).asDouble(), right.get(1).asDouble());
    double x1 = Math.min(left.get(2).asDouble(), right.get(2).asDouble());
    double y1 = Math.min(left.get(3).asDouble(), right.get(3).asDouble());
    double intersection = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
    double leftArea = Math.max(1, (left.get(2).asDouble() - left.get(0).asDouble()) * (left.get(3).asDouble() - left.get(1).asDouble()));
    double rightArea = Math.max(1, (right.get(2).asDouble() - right.get(0).asDouble()) * (right.get(3).asDouble() - right.get(1).asDouble()));
    return Math.max(intersection / leftArea, intersection / rightArea);
  }

  private void correctSourceRegions(JsonNode structured, ArrayNode blocks) {
    JsonNode questions = structured.path("questions");
    if (!questions.isArray()) return;
    Map<Integer, Integer> figureOwners = findCaptionedFigureOwners(blocks);
    for (JsonNode question : questions) {
      if (!(question instanceof ObjectNode)) continue;
      int number = question.path("number").asInt();
      int start = findQuestionStart(blocks, number, 0);
      if (start < 0) continue;
      int pageNumber = blocks.get(start).path("pageNumber").asInt();
      int next = findQuestionStart(blocks, number + 1, start + 1);
      int end = next >= 0 && blocks.get(next).path("pageNumber").asInt() == pageNumber ? next : blocks.size();
      JsonNode startBox = blocks.get(start).path("bbox");
      int questionTop = validBox(startBox) ? startBox.get(1).asInt() : 0;
      JsonNode nextBox = next >= 0 ? blocks.get(next).path("bbox") : null;
      int questionBottom = nextBox != null && validBox(nextBox) && blocks.get(next).path("pageNumber").asInt() == pageNumber
        ? nextBox.get(1).asInt() : 1000;
      int x0 = 1000, y0 = 1000, x1 = 0, y1 = 0;
      List<Integer> figureIndexes = new ArrayList<>();
      for (int index = start; index < end; index++) {
        JsonNode block = blocks.get(index);
        if (block.path("pageNumber").asInt() != pageNumber) break;
        int captionOwner = figureCaptionNumber(block.path("text").asText());
        if (captionOwner > 0 && captionOwner != number) continue;
        Integer figureOwner = figureOwners.get(index);
        if (figureOwner != null && figureOwner != number) continue;
        JsonNode box = block.path("bbox");
        if (!box.isArray() || box.size() != 4) continue;
        x0 = Math.min(x0, box.get(0).asInt()); y0 = Math.min(y0, box.get(1).asInt());
        x1 = Math.max(x1, box.get(2).asInt()); y1 = Math.max(y1, box.get(3).asInt());
        if ("figure".equals(block.path("type").asText())) {
          int centerY = (box.get(1).asInt() + box.get(3).asInt()) / 2;
          if ((figureOwner != null && figureOwner == number) || (figureOwner == null && centerY >= questionTop && centerY < questionBottom)) figureIndexes.add(index);
        }
      }
      for (Map.Entry<Integer, Integer> entry : figureOwners.entrySet()) {
        if (entry.getValue() != number || figureIndexes.contains(entry.getKey())) continue;
        JsonNode block = blocks.get(entry.getKey());
        if (block.path("pageNumber").asInt() != pageNumber) continue;
        JsonNode box = block.path("bbox"); if (!box.isArray() || box.size() != 4) continue;
        x0 = Math.min(x0, box.get(0).asInt()); y0 = Math.min(y0, box.get(1).asInt());
        x1 = Math.max(x1, box.get(2).asInt()); y1 = Math.max(y1, box.get(3).asInt());
        figureIndexes.add(entry.getKey());
      }
      if (x1 <= x0 || y1 <= y0) continue;
      ObjectNode mutable = (ObjectNode) question;
      ArrayNode regions = mutable.putArray("sourceRegions");
      ObjectNode region = regions.addObject();
      region.put("pageNumber", pageNumber);
      region.put("x0", clampCoordinate(x0 - 8)); region.put("y0", clampCoordinate(y0 - 8));
      region.put("x1", clampCoordinate(x1 + 8)); region.put("y1", clampCoordinate(y1 + 8));
      ArrayNode figureRegions = mutable.putArray("figureRegions");
      for (int index : figureIndexes) {
        JsonNode block = blocks.get(index);
        JsonNode box = block.path("bbox"); if (!box.isArray() || box.size() != 4) continue;
        ObjectNode figureRegion = figureRegions.addObject(); figureRegion.put("pageNumber", pageNumber);
        figureRegion.put("x0", box.get(0).asInt()); figureRegion.put("y0", box.get(1).asInt()); figureRegion.put("x1", box.get(2).asInt()); figureRegion.put("y1", box.get(3).asInt());
        if (block.hasNonNull("objectKey")) figureRegion.put("objectKey", block.path("objectKey").asText());
      }
      mutable.withArray("warnings").add("source_region_verified_from_ocr_layout");
      log.info("Question region verified from OCR layout: question={}, page={}, bounds=[{},{},{},{}]",
        number, pageNumber, region.get("x0"), region.get("y0"), region.get("x1"), region.get("y1"));
    }
  }

  private Map<Integer, Integer> findCaptionedFigureOwners(ArrayNode blocks) {
    Map<Integer, Integer> owners = new HashMap<>();
    for (int index = 0; index < blocks.size(); index++) {
      if (!"figure".equals(blocks.get(index).path("type").asText())) continue;
      JsonNode figure = blocks.get(index); JsonNode figureBox = figure.path("bbox");
      if (!validBox(figureBox)) continue;
      int page = figure.path("pageNumber").asInt(); JsonNode nearestCaption = null; double nearestDistance = Double.MAX_VALUE;
      for (JsonNode candidate : blocks) {
        if (candidate.path("pageNumber").asInt() != page || "figure".equals(candidate.path("type").asText())) continue;
        int number = figureCaptionNumber(candidate.path("text").asText()); JsonNode captionBox = candidate.path("bbox");
        if (number <= 0 || !validBox(captionBox)) continue;
        double horizontalGap = intervalGap(figureBox.get(0).asDouble(), figureBox.get(2).asDouble(), captionBox.get(0).asDouble(), captionBox.get(2).asDouble());
        double verticalGap = intervalGap(figureBox.get(1).asDouble(), figureBox.get(3).asDouble(), captionBox.get(1).asDouble(), captionBox.get(3).asDouble());
        double distance = verticalGap + horizontalGap * 0.6;
        if (horizontalGap <= 120 && verticalGap <= 100 && distance < nearestDistance) { nearestDistance = distance; nearestCaption = candidate; }
      }
      if (nearestCaption != null) owners.put(index, figureCaptionNumber(nearestCaption.path("text").asText()));
    }
    return owners;
  }

  private double intervalGap(double a0, double a1, double b0, double b1) {
    if (a1 < b0) return b0 - a1;
    if (b1 < a0) return a0 - b1;
    return 0;
  }

  private int figureCaptionNumber(String text) {
    Matcher matcher = Pattern.compile("第\\s*(\\d+)\\s*题\\s*图").matcher(text == null ? "" : text);
    return matcher.find() ? Integer.parseInt(matcher.group(1)) : 0;
  }

  private int findQuestionStart(ArrayNode blocks, int number, int fromIndex) {
    String prefix = String.valueOf(number);
    for (int index = Math.max(0, fromIndex); index < blocks.size(); index++) {
      String text = blocks.get(index).path("text").asText().trim();
      if (!text.startsWith(prefix)) continue;
      String tail = text.substring(prefix.length()).trim();
      if (tail.startsWith(".") || tail.startsWith("．") || tail.startsWith("、") || tail.startsWith(")") || tail.startsWith("）")) return index;
    }
    return -1;
  }

  private int normalizeCoordinate(int value, int dimension) {
    return clampCoordinate(Math.round(value * 1000f / dimension));
  }

  private int clampCoordinate(int value) { return Math.max(0, Math.min(1000, value)); }

  private ExtractionBundle extract(byte[] zip, Path assetDirectory) throws Exception {
    StringBuilder markdown = new StringBuilder(); ArrayNode layout = json.createArrayNode(); Map<String, Path> images = new HashMap<>();
    Files.createDirectories(assetDirectory);
    try (ZipInputStream input = new ZipInputStream(new ByteArrayInputStream(zip))) {
      ZipEntry entry; byte[] buffer = new byte[8192];
      while ((entry = input.getNextEntry()) != null) {
        if (entry.isDirectory()) continue;
        ByteArrayOutputStream bytes = new ByteArrayOutputStream(); int read; while ((read = input.read(buffer)) > 0) bytes.write(buffer, 0, read);
        if (entry.getName().endsWith("full.md") || entry.getName().endsWith(".md")) markdown.append(new String(bytes.toByteArray(), StandardCharsets.UTF_8));
        if (entry.getName().endsWith("content_list.json")) { JsonNode parsed = json.readTree(bytes.toByteArray()); if (parsed.isArray()) layout.addAll((ArrayNode) parsed); }
        String lower = entry.getName().toLowerCase();
        if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) {
          String safeName = UUID.randomUUID().toString().replace("-", "") + lower.substring(lower.lastIndexOf('.'));
          Path stored = assetDirectory.resolve(safeName); Files.write(stored, bytes.toByteArray());
          images.put(entry.getName().replace('\\', '/'), stored.toAbsolutePath().normalize());
        }
      }
    }
    for (JsonNode item : layout) {
      if (!(item instanceof ObjectNode)) continue;
      String imagePath = item.path("img_path").asText(item.path("image_path").asText()).replace('\\', '/');
      if (imagePath.isEmpty()) continue;
      Path stored = images.get(imagePath);
      if (stored == null) for (Map.Entry<String, Path> image : images.entrySet()) if (image.getKey().endsWith(imagePath)) { stored = image.getValue(); break; }
      if (stored != null) ((ObjectNode) item).put("localImagePath", stored.toString());
    }
    return new ExtractionBundle(markdown.toString(), layout);
  }

  public Map<String, Object> status(String paperId, String userId) {
    assertOwner(paperId, userId);
    Map<String,Object> result = jdbc.queryForObject("SELECT id,paper_id,status,stage,progress,provider,request_id,error_code,error_message,retry_count,updated_at FROM teaching_parse_job WHERE paper_id=? ORDER BY created_at DESC LIMIT 1",
      (rs, n) -> { Map<String, Object> row = new LinkedHashMap<>(); row.put("jobId", rs.getString("id")); row.put("paperId", rs.getString("paper_id")); row.put("status", rs.getString("status")); row.put("stage", rs.getString("stage")); row.put("progress", rs.getInt("progress")); row.put("provider", rs.getString("provider")); row.put("externalTaskId", rs.getString("request_id")); row.put("errorCode", rs.getString("error_code")); row.put("errorMessage", rs.getString("error_message")); row.put("retryCount", rs.getInt("retry_count")); row.put("updatedAt", rs.getTimestamp("updated_at")); return row; }, paperId);
    String jobId=string(result.get("jobId"));
    result.put("stages",jdbc.query("SELECT stage,status,attempt,provider,error_code,error_message,started_at,finished_at FROM paper_stage_execution WHERE job_id=? ORDER BY started_at",(rs,n)->{Map<String,Object> row=new LinkedHashMap<>();row.put("stage",rs.getString("stage"));row.put("status",rs.getString("status"));row.put("attempt",rs.getInt("attempt"));row.put("provider",rs.getString("provider"));row.put("errorCode",rs.getString("error_code"));row.put("errorMessage",rs.getString("error_message"));row.put("startedAt",rs.getTimestamp("started_at"));row.put("finishedAt",rs.getTimestamp("finished_at"));return row;},jobId));
    result.put("pages",jdbc.query("SELECT page_number,page_source_type,parse_strategy,has_text_layer,native_text_score,image_coverage,status FROM paper_page WHERE paper_id=? ORDER BY page_number",(rs,n)->{Map<String,Object> row=new LinkedHashMap<>();row.put("pageNumber",rs.getInt("page_number"));row.put("sourceType",rs.getString("page_source_type"));row.put("strategy",rs.getString("parse_strategy"));row.put("hasTextLayer",rs.getBoolean("has_text_layer"));row.put("nativeTextScore",rs.getInt("native_text_score"));row.put("imageCoverage",rs.getBigDecimal("image_coverage"));row.put("status",rs.getString("status"));return row;},paperId));
    result.put("qualityReport",recognitionReports.latest(jobId));
    return result;
  }

  public Map<String, Object> retry(String paperId, String userId) {
    assertOwner(paperId, userId);
    int changed = jdbc.update("UPDATE teaching_parse_job SET provider='',status='queued',stage='queued',progress=0,request_id='',error_code='',error_message='',retry_count=0,result_object_key='',next_retry_at=NULL,locked_at=NULL,finished_at=NULL,updated_at=? WHERE id=(SELECT id FROM (SELECT id FROM teaching_parse_job WHERE paper_id=? ORDER BY created_at DESC LIMIT 1) latest)", now(), paperId);
    if (changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "找不到可重新解析的任务");
    jdbc.update("UPDATE teaching_paper SET status='processing',progress=0,updated_at=? WHERE id=?", now(), paperId);
    return status(paperId, userId);
  }
  private void assertOwner(String paperId, String userId) { Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM teaching_paper WHERE id=? AND creator_id=?", Integer.class, paperId, userId); if (count == null || count == 0) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问该试卷"); }
  private void failOrRetry(Map<String, Object> job, Exception error) {
    Throwable cause = error.getCause() == null ? error : error.getCause();
    int retry = ((Number) job.get("retryCount")).intValue() + 1;
    String code = cause instanceof ProviderException ? ((ProviderException) cause).getCode() : "PROCESSING_ERROR";
    String message = cause.getMessage() == null ? cause.getClass().getSimpleName() : cause.getMessage();
    stageExecutions.failRunning(string(job.get("id")), code, message);
    boolean terminal = retry >= 3 || code.endsWith("NOT_CONFIGURED") || "PAPER_ALREADY_REVIEWED".equals(code);
    log.warn("Paper job state updated after failure: jobId={}, paperId={}, code={}, retryCount={}, terminal={}, message={}",
      job.get("id"), job.get("paperId"), code, retry, terminal, message);
    jdbc.update("UPDATE teaching_parse_job SET status=?,retry_count=?,error_code=?,error_message=?,next_retry_at=?,locked_at=NULL,updated_at=? WHERE id=?",
      terminal ? "failed" : "processing", retry, code, message.substring(0, Math.min(1000, message.length())),
      terminal ? null : Timestamp.valueOf(LocalDateTime.now().plusSeconds(30L * retry)), now(), job.get("id"));
    if (terminal) jdbc.update("UPDATE teaching_paper SET status='failed',updated_at=? WHERE id=?", now(), job.get("paperId"));
  }
  private void unlock(String jobId, int progress) { jdbc.update("UPDATE teaching_parse_job SET progress=?,locked_at=NULL,updated_at=? WHERE id=?", progress, now(), jobId); }
  private void updatePaperProgress(String paperId, int progress) { jdbc.update("UPDATE teaching_paper SET progress=?,updated_at=? WHERE id=?", progress, now(), paperId); }
  private Path paperDirectory(String paperId) { String manifest = jdbc.queryForObject("SELECT pdf_object_key FROM teaching_paper WHERE id=?", String.class, paperId); return Paths.get(manifest).getParent(); }
  private List<Path> sourceFiles(String paperId) throws Exception {
    String manifestValue = jdbc.queryForObject("SELECT pdf_object_key FROM teaching_paper WHERE id=?", String.class, paperId);
    Path manifest = Paths.get(manifestValue); JsonNode sources = json.readTree(manifest.toFile()); List<Path> files = new ArrayList<>();
    if (sources.isArray()) for (JsonNode source : sources) { Path file = manifest.getParent().resolve(source.path("name").asText()).normalize(); if (!file.startsWith(manifest.getParent()) || !Files.isRegularFile(file)) throw new ProviderException("SOURCE_FILES_MISSING", "试卷源文件不存在"); files.add(file); }
    return files;
  }
  private List<Path> normalizedPageFiles(String paperId) {
    return jdbc.query("SELECT normalized_object_key FROM paper_page WHERE paper_id=? ORDER BY page_number", (rs, rowNum) -> Paths.get(rs.getString("normalized_object_key")).toAbsolutePath().normalize(), paperId);
  }
  private int pixel(int normalized, int size) { return Math.round(Math.max(0, Math.min(1000, normalized)) * size / 1000f); }
  private Timestamp now() { return Timestamp.valueOf(LocalDateTime.now()); }
  private String id(String prefix) { return prefix + "_" + UUID.randomUUID().toString().replace("-", ""); }
  private String string(Object value) { return value == null ? "" : String.valueOf(value); }
  private int clamp(int value) { return Math.max(0, Math.min(100, value)); }
  private String normalizeDifficulty(String value) { return "高".equals(value) || "低".equals(value) ? value : "中"; }
  private String normalizeType(String type) { return "选择题".equals(type) || "填空题".equals(type) ? type : "解答题"; }
  private static class ExtractionBundle { final String markdown; final ArrayNode layout; ExtractionBundle(String markdown, ArrayNode layout) { this.markdown = markdown; this.layout = layout; } }
}
