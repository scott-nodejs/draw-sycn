package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class DeepseekClient {
  private final RestTemplate http; private final ObjectMapper json; private final String apiKey; private final String baseUrl; private final String model;
  public DeepseekClient(RestTemplateBuilder builder, ObjectMapper json,
      @Value("${DEEPSEEK_API_KEY:}") String apiKey,
      @Value("${DEEPSEEK_API_BASE_URL:https://api.deepseek.com}") String baseUrl,
      @Value("${DEEPSEEK_MODEL:deepseek-chat}") String model) {
    this.http = builder.setConnectTimeout(java.time.Duration.ofSeconds(20)).setReadTimeout(java.time.Duration.ofMinutes(3)).build();
    this.json = json; this.apiKey = apiKey; this.baseUrl = baseUrl.replaceAll("/$", ""); this.model = model;
  }

  public JsonNode structureQuestions(String markdown, JsonNode layoutBlocks, String subject, String grade) throws Exception {
    if (apiKey.trim().isEmpty()) throw new ProviderException("DEEPSEEK_NOT_CONFIGURED", "未配置 DEEPSEEK_API_KEY");
    String system = "你是商业教学平台的试卷切题与难度评估引擎。根据 OCR Markdown 与版面块识别完整题目边界，禁止补造原文不存在的信息。必须输出 JSON：{\"questions\":[{\"number\":1,\"type\":\"选择题\",\"stem\":\"\",\"options\":[],\"answer\":\"\",\"analysis\":\"\",\"points\":0,\"confidence\":90,\"difficulty\":\"中\",\"sourceRegions\":[{\"pageNumber\":1,\"x0\":0,\"y0\":0,\"x1\":1000,\"y1\":300}],\"warnings\":[]}]}。题型只能是选择题、填空题、解答题；difficulty 只能是高、中、低，请结合年级、学科、知识点综合程度、推理步骤和计算量评估；pageNumber 从 1 开始，坐标范围 0 到 1000。题目跨页时返回多个区域。无法确定的答案或解析留空。stem、options、answer、analysis 不要使用 ** 加粗包裹；数学公式保留 $...$ LaTeX，LaTeX 命令使用标准单个反斜杠，禁止二次转义。";
    String user = "年级：" + grade + "\n学科：" + subject + "\nOCR Markdown：\n" + markdown + "\n版面块（pageNumber/bbox/text）：\n" + json.writeValueAsString(layoutBlocks);
    List<Map<String, String>> messages = new ArrayList<>(); messages.add(message("system", system)); messages.add(message("user", user));
    Map<String, Object> body = new LinkedHashMap<>(); body.put("model", model); body.put("messages", messages); body.put("response_format", java.util.Collections.singletonMap("type", "json_object")); body.put("max_tokens", 8192); body.put("stream", false);
    HttpHeaders headers = new HttpHeaders(); headers.setBearerAuth(apiKey); headers.setContentType(MediaType.APPLICATION_JSON);
    String raw = http.postForObject(baseUrl + "/chat/completions", new HttpEntity<Map<String, Object>>(body, headers), String.class);
    JsonNode response = json.readTree(raw); String content = response.path("choices").path(0).path("message").path("content").asText();
    if (content.trim().isEmpty()) throw new ProviderException("DEEPSEEK_EMPTY_OUTPUT", "DeepSeek 返回了空内容");
    JsonNode result;
    try { result = json.readTree(content); } catch (Exception error) { throw new ProviderException("DEEPSEEK_INVALID_JSON", "DeepSeek 返回的题目 JSON 无法解析"); }
    validate(result);
    return result;
  }

  public JsonNode recognizeQuestionCrop(String markdown, int number, String type) throws Exception {
    if (apiKey.trim().isEmpty()) throw new ProviderException("DEEPSEEK_NOT_CONFIGURED", "DEEPSEEK_API_KEY is not configured");
    String system = "你是试卷单题识别校正引擎。输入内容来自老师人工框选后的单题裁图。只识别该题，不得补造信息。输出 JSON：" +
      "{\"question\":{\"stem\":\"\",\"options\":[],\"answer\":\"\",\"analysis\":\"\",\"confidence\":90,\"difficulty\":\"中\"}}。difficulty 只能是高、中、低，需要根据解题所需推理步骤、知识点综合程度和计算量评估。字段内容不要使用 ** 加粗包裹；数学公式保留 $...$ LaTeX，LaTeX 命令使用标准单个反斜杠，禁止二次转义。" +
      "题干不要包含题号、章节标题、下一题内容；图片中没有答案或解析时必须留空。";
    String user = "题号：" + number + "\n题型：" + type + "\nMinerU OCR：\n" + markdown;
    List<Map<String, String>> messages = new ArrayList<>(); messages.add(message("system", system)); messages.add(message("user", user));
    Map<String, Object> body = new LinkedHashMap<>(); body.put("model", model); body.put("messages", messages); body.put("response_format", java.util.Collections.singletonMap("type", "json_object")); body.put("max_tokens", 4096); body.put("stream", false);
    HttpHeaders headers = new HttpHeaders(); headers.setBearerAuth(apiKey); headers.setContentType(MediaType.APPLICATION_JSON);
    String raw = http.postForObject(baseUrl + "/chat/completions", new HttpEntity<Map<String, Object>>(body, headers), String.class);
    JsonNode response = json.readTree(raw); String content = response.path("choices").path(0).path("message").path("content").asText();
    JsonNode result = json.readTree(content).path("question");
    if (!result.isObject() || result.path("stem").asText().trim().isEmpty()) throw new ProviderException("DEEPSEEK_SCHEMA_MISMATCH", "单题重识别结果缺少题干");
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
      if (!question.path("sourceRegions").isArray() || question.path("sourceRegions").size() == 0)
        throw new ProviderException("DEEPSEEK_SCHEMA_MISMATCH", "第 " + number + " 题缺少原卷坐标");
    }
  }
  private Map<String, String> message(String role, String content) { Map<String, String> item = new LinkedHashMap<>(); item.put("role", role); item.put("content", content); return item; }
}
