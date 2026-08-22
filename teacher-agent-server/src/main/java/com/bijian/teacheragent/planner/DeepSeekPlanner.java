package com.bijian.teacheragent.planner;

import com.bijian.teacheragent.config.TeacherAgentProperties;
import com.bijian.teacheragent.domain.Plans.PlanBundle;
import com.fasterxml.jackson.databind.*;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@Service
public class DeepSeekPlanner {
  private final TeacherAgentProperties properties; private final ObjectMapper json; private final PlanValidator validator;
  public DeepSeekPlanner(TeacherAgentProperties p,ObjectMapper j,PlanValidator v){properties=p;json=j;validator=v;}
  public PlanBundle plan(String problem,String studentLevel) {
    TeacherAgentProperties.Planner p=properties.getPlanner();
    if(p.getApiKey()==null||p.getApiKey().trim().isEmpty()) throw new IllegalStateException("尚未配置 DEEPSEEK_API_KEY");
    SimpleClientHttpRequestFactory f=new SimpleClientHttpRequestFactory(); f.setConnectTimeout(10000); f.setReadTimeout(p.getTimeoutSeconds()*1000);
    RestTemplate client=new RestTemplate(f); HttpHeaders headers=new HttpHeaders(); headers.setBearerAuth(p.getApiKey()); headers.setContentType(MediaType.APPLICATION_JSON);
    Map<String,Object> body=new LinkedHashMap<>(); body.put("model",p.getModel()); body.put("temperature",0.1); body.put("response_format",Collections.singletonMap("type","json_object"));
    body.put("messages",Arrays.asList(message("system",SYSTEM_PROMPT+LAYOUT_RULES),message("user","学生水平："+studentLevel+"\n题目："+problem)));
    ResponseEntity<JsonNode> response=client.exchange(trimSlash(p.getBaseUrl())+"/chat/completions",HttpMethod.POST,new HttpEntity<>(body,headers),JsonNode.class);
    try {
      String content=response.getBody().path("choices").path(0).path("message").path("content").asText();
      PlanBundle bundle=json.readValue(stripFence(content),PlanBundle.class); bundle.problem=problem; bundle.studentLevel=studentLevel; validator.validate(bundle); return bundle;
    } catch(Exception e) { throw new IllegalArgumentException("规划模型返回的 JSON 不符合 TeachingPlan 协议: "+e.getMessage(),e); }
  }
  private Map<String,String> message(String role,String content){Map<String,String> m=new LinkedHashMap<>();m.put("role",role);m.put("content",content);return m;}
  private String trimSlash(String s){return s.endsWith("/")?s.substring(0,s.length()-1):s;}
  private String stripFence(String s){String v=s.trim();if(v.startsWith("```")){int nl=v.indexOf('\n');int end=v.lastIndexOf("```");if(nl>=0&&end>nl)v=v.substring(nl+1,end).trim();}return v;}
  private static final String SYSTEM_PROMPT="你是严谨的中学数学解题与教学规划器。先完整求解并自检，再规划真人老师式讲解。只输出 JSON，不输出 Markdown。根对象必须是：{\"solutionPlan\":{\"givens\":[string],\"target\":string,\"coreTheorems\":[string],\"derivation\":[string],\"answer\":string,\"verification\":string},\"teachingPlan\":{\"strategy\":string,\"steps\":[{\"id\":从1连续递增,\"goal\":string,\"say\":自然口语中文,\"pauseAfterMs\":非负整数,\"actions\":[{\"type\":动作类型,\"payload\":object}]}]}}。动作仅可用 DRAW_TRIANGLE、MARK_EQUAL、MARK_ANGLE、WRITE_LATEX、HIGHLIGHT、DRAW_LINE、DRAW_POINT、DRAW_CIRCLE、ERASE、PAUSE。先保证数学正确；TeachingPlan 不得泄露内部推理措辞；每步只做一个明确教学目标；payload 使用语义字段（points、segments、vertex、label、latex、target 等）。";
  private static final String LAYOUT_RULES=" TeachingPlan 还必须包含 sceneType（algebra、geometry、analytic-geometry 或 function）。几何题必须包含 figure：{type,points,apex,constraints,annotations}。例如等腰三角形：figure.type=triangle，points=[A,B,C]，apex=A，constraints=[{type:equal_length,segments:[AB,AC]}]，annotations=[{type:angle,vertex:A,value:40°}]。模型绝对不能输出 x、y、width、fontSize 等排版坐标；布局完全由程序计算。步骤 actions 只表达语义。几何图由 figure 一次建立，步骤中不重复 DRAW_TRIANGLE。WRITE_LATEX 的 latex 字段只能放一行简洁数学表达式，不得放英文或中文解释，不得使用 \\because、\\therefore、\\text；解释全部放入 say。每个 WRITE_LATEX 动作只写一行推导。";
}
