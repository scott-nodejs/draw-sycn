package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class DeepseekClient {
  private static final Pattern QUESTION_NUMBER = Pattern.compile("(?m)^\\s*(\\d{1,3})\\s*[.．、)）]");
  private final RestTemplate http; private final ObjectMapper json; private final StructuredOutputRepairer outputRepairer; private final String apiKey; private final String baseUrl; private final String model;
  public DeepseekClient(RestTemplateBuilder builder, ObjectMapper json, StructuredOutputRepairer outputRepairer,
      @Value("${DEEPSEEK_API_KEY:}") String apiKey,
      @Value("${DEEPSEEK_API_BASE_URL:https://api.deepseek.com}") String baseUrl,
      @Value("${DEEPSEEK_MODEL:deepseek-chat}") String model) {
    this.http = builder.setConnectTimeout(java.time.Duration.ofSeconds(20)).setReadTimeout(java.time.Duration.ofMinutes(3)).build();
    this.json = json; this.outputRepairer = outputRepairer; this.apiKey = apiKey; this.baseUrl = baseUrl.replaceAll("/$", ""); this.model = model;
  }

  public JsonNode structureQuestions(String markdown, JsonNode layoutBlocks, String subject, String grade) throws Exception {
    if (apiKey.trim().isEmpty()) throw new ProviderException("DEEPSEEK_NOT_CONFIGURED", "未配置 DEEPSEEK_API_KEY");
    String system = "你是商业教学平台的试题原文结构化引擎。只根据 OCR Markdown 与版面块识别题号、题型、题干和选项，禁止解题、推导答案、生成解析或补造原文不存在的信息。必须输出 JSON：{\"questions\":[{\"number\":1,\"type\":\"选择题\",\"stem\":\"\",\"options\":[],\"answer\":\"\",\"analysis\":\"\",\"points\":0,\"confidence\":90,\"difficulty\":\"中\",\"warnings\":[]}]}。只有原文明确印有答案或解析时才原样提取到 answer 或 analysis，否则必须留空；difficulty 必须根据题目表面呈现的知识点综合程度、步骤数量和计算量判断为高、中、低，但不得为判断难度而求解题目。不需要生成页面坐标或裁切区域，这些信息由后端版面算法生成。题型只能是选择题、填空题、解答题。字段内容不要使用 ** 加粗包裹；数学公式保留 $...$ LaTeX，LaTeX 命令使用标准单个反斜杠，禁止二次转义。";
    String user = "年级：" + grade + "\n学科：" + subject + "\nOCR Markdown：\n" + markdown + "\n版面块（pageNumber/bbox/text）：\n" + json.writeValueAsString(layoutBlocks);
    ObjectNode result = (ObjectNode) requestJson(system, user, 6144);
    validate(result);
    supplementMissingQuestions(result, markdown, subject, grade);
    return result;
  }

  private void supplementMissingQuestions(ObjectNode result, String markdown, String subject, String grade) throws Exception {
    Set<Integer> expected = detectedQuestionNumbers(markdown);
    Set<Integer> actual = questionNumbers(result.path("questions"));
    expected.removeAll(actual);
    if (expected.isEmpty()) return;
    List<Integer> missing = new ArrayList<>(expected); java.util.Collections.sort(missing);
    for (int offset = 0; offset < missing.size(); offset += 12) {
      List<Integer> batch = missing.subList(offset, Math.min(offset + 12, missing.size()));
      String system = "你是试卷缺题原文提取引擎。只提取指定题号，禁止返回其他题，禁止解题、推导答案、生成解析或补造。输出格式必须是 {\"questions\":[{\"number\":1,\"type\":\"选择题\",\"stem\":\"\",\"options\":[],\"answer\":\"\",\"analysis\":\"\",\"points\":0,\"confidence\":80,\"difficulty\":\"中\",\"warnings\":[]}]}。只有 OCR 原文明确包含答案或解析时才原样提取，否则 answer 和 analysis 必须留空；difficulty 根据题目表面呈现的知识点综合程度、步骤数量和计算量判断为高、中、低，但不得求解题目。题型只能是选择题、填空题、解答题。";
      String user = "年级：" + grade + "\n学科：" + subject + "\n必须补齐的题号：" + batch + "\nOCR Markdown：\n" + markdown;
      JsonNode supplement = requestJson(system, user, 4096);
      validate(supplement);
      for (JsonNode question : supplement.path("questions")) if (batch.contains(question.path("number").asInt()) && actual.add(question.path("number").asInt())) ((ArrayNode) result.path("questions")).add(question.deepCopy());
    }
    Set<Integer> unresolved = detectedQuestionNumbers(markdown); unresolved.removeAll(questionNumbers(result.path("questions")));
    if (!unresolved.isEmpty()) throw new ProviderException("QUESTION_COUNT_MISMATCH", "结构化结果缺少 OCR 中已识别的题号：" + unresolved);
  }

  private JsonNode requestJson(String system, String user, int maxTokens) throws Exception {
    List<Map<String, String>> messages = new ArrayList<>(); messages.add(message("system", system)); messages.add(message("user", user));
    Map<String, Object> body = new LinkedHashMap<>(); body.put("model", model); body.put("messages", messages); body.put("response_format", java.util.Collections.singletonMap("type", "json_object")); body.put("max_tokens", maxTokens); body.put("stream", false);
    HttpHeaders headers = new HttpHeaders(); headers.setBearerAuth(apiKey); headers.setContentType(MediaType.APPLICATION_JSON);
    String raw = http.postForObject(baseUrl + "/chat/completions", new HttpEntity<Map<String, Object>>(body, headers), String.class);
    JsonNode response = json.readTree(raw); String content = response.path("choices").path(0).path("message").path("content").asText();
    if (content.trim().isEmpty()) throw new ProviderException("DEEPSEEK_EMPTY_OUTPUT", "DeepSeek 返回了空内容");
    return outputRepairer.parse(content);
  }

  private Set<Integer> detectedQuestionNumbers(String markdown) {
    Set<Integer> candidates = new HashSet<>(); Matcher matcher = QUESTION_NUMBER.matcher(markdown);
    while (matcher.find()) { int number = Integer.parseInt(matcher.group(1)); if (number > 0 && number <= 100) candidates.add(number); }
    if (candidates.size() < 3) return new HashSet<>();
    Set<Integer> numbers = new HashSet<>();
    for (Integer number : candidates) if (candidates.contains(number - 1) || candidates.contains(number + 1)) numbers.add(number);
    return numbers;
  }

  private Set<Integer> questionNumbers(JsonNode questions) {
    Set<Integer> numbers = new HashSet<>(); if (questions.isArray()) for (JsonNode question : questions) numbers.add(question.path("number").asInt()); return numbers;
  }

  public JsonNode recognizeQuestionCrop(String markdown, int number, String type) throws Exception {
    if (apiKey.trim().isEmpty()) throw new ProviderException("DEEPSEEK_NOT_CONFIGURED", "DEEPSEEK_API_KEY is not configured");
    String system = "你是试卷单题原文识别校正引擎。输入内容来自老师人工框选后的单题裁图。只识别该题，禁止解题、推导答案、生成解析或补造信息。输出 JSON：" +
      "{\"question\":{\"stem\":\"\",\"options\":[],\"answer\":\"\",\"analysis\":\"\",\"confidence\":90,\"difficulty\":\"中\"}}。只有图片原文明确包含答案或解析时才原样提取，否则 answer 和 analysis 必须留空；difficulty 根据题目表面呈现的知识点综合程度、步骤数量和计算量判断为高、中、低，但不得求解题目。字段内容不要使用 ** 加粗包裹；数学公式保留 $...$ LaTeX，LaTeX 命令使用标准单个反斜杠，禁止二次转义。" +
      "题干不要包含题号、章节标题、下一题内容。";
    String user = "题号：" + number + "\n题型：" + type + "\nMinerU OCR：\n" + markdown;
    List<Map<String, String>> messages = new ArrayList<>(); messages.add(message("system", system)); messages.add(message("user", user));
    Map<String, Object> body = new LinkedHashMap<>(); body.put("model", model); body.put("messages", messages); body.put("response_format", java.util.Collections.singletonMap("type", "json_object")); body.put("max_tokens", 2048); body.put("stream", false);
    HttpHeaders headers = new HttpHeaders(); headers.setBearerAuth(apiKey); headers.setContentType(MediaType.APPLICATION_JSON);
    String raw = http.postForObject(baseUrl + "/chat/completions", new HttpEntity<Map<String, Object>>(body, headers), String.class);
    JsonNode response = json.readTree(raw); String content = response.path("choices").path(0).path("message").path("content").asText();
    JsonNode result = outputRepairer.parse(content).path("question");
    if (!result.isObject() || result.path("stem").asText().trim().isEmpty()) throw new ProviderException("DEEPSEEK_SCHEMA_MISMATCH", "单题重识别结果缺少题干");
    return result;
  }

  public JsonNode classifyKnowledgePoints(JsonNode questions, JsonNode candidates, String subject, String grade) throws Exception {
    if (apiKey.trim().isEmpty()) throw new ProviderException("DEEPSEEK_NOT_CONFIGURED", "未配置 DEEPSEEK_API_KEY");
    String system = "你是教学试题知识点分类器。只能从候选知识点中选择，不得创造 ID。每题选择 1 到 3 个最相关的末级知识点；优先选择直接考查的知识点，不要仅凭题目中的表面词汇判断。输出 JSON：" +
      "{\"matches\":[{\"number\":1,\"knowledgePoints\":[{\"id\":\"\",\"confidence\":90,\"reason\":\"\"}]}]}。" +
      "confidence 为 0 到 100 的整数，reason 不超过 80 个汉字。无法可靠判断时 knowledgePoints 返回空数组。";
    String user = "学科：" + subject + "\n年级：" + grade + "\n题目：\n" + json.writeValueAsString(questions) +
      "\n候选知识点（id/path）：\n" + json.writeValueAsString(candidates);
    List<Map<String, String>> messages = new ArrayList<>(); messages.add(message("system", system)); messages.add(message("user", user));
    Map<String, Object> body = new LinkedHashMap<>(); body.put("model", model); body.put("messages", messages); body.put("response_format", java.util.Collections.singletonMap("type", "json_object")); body.put("max_tokens", 4096); body.put("stream", false);
    HttpHeaders headers = new HttpHeaders(); headers.setBearerAuth(apiKey); headers.setContentType(MediaType.APPLICATION_JSON);
    String raw = http.postForObject(baseUrl + "/chat/completions", new HttpEntity<Map<String, Object>>(body, headers), String.class);
    JsonNode response = json.readTree(raw); String content = response.path("choices").path(0).path("message").path("content").asText();
    JsonNode result = outputRepairer.parse(content);
    if (!result.path("matches").isArray()) throw new ProviderException("DEEPSEEK_SCHEMA_MISMATCH", "知识点分类结果缺少 matches");
    return result;
  }

  private void validate(JsonNode result) {
    JsonNode questions = result.path("questions");
    if (!questions.isArray() || questions.size() == 0) throw new ProviderException("DEEPSEEK_SCHEMA_MISMATCH", "DeepSeek 返回结果缺少题目");
    java.util.Set<Integer> numbers = new java.util.HashSet<>();
    for (JsonNode question : questions) {
      int number = question.path("number").asInt(0);
      if (number <= 0 || !numbers.add(number) || question.path("stem").asText().trim().isEmpty())
        throw new ProviderException("DEEPSEEK_SCHEMA_MISMATCH", "题号必须唯一且题干不能为空");
      String type = question.path("type").asText();
      if (!("选择题".equals(type) || "填空题".equals(type) || "解答题".equals(type)))
        throw new ProviderException("DEEPSEEK_SCHEMA_MISMATCH", "返回了不支持的题型：" + type);
    }
  }
  private Map<String, String> message(String role, String content) { Map<String, String> item = new LinkedHashMap<>(); item.put("role", role); item.put("content", content); return item; }
}
