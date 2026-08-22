package com.bijian.teacheragent.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "teacher-agent")
public class TeacherAgentProperties {
  private final Planner planner = new Planner();
  private final Execution execution = new Execution();
  public Planner getPlanner() { return planner; }
  public Execution getExecution() { return execution; }
  public static class Planner {
    private String baseUrl = "https://api.deepseek.com", apiKey = "", model = "deepseek-chat";
    private int timeoutSeconds = 90;
    public String getBaseUrl(){return baseUrl;} public void setBaseUrl(String v){baseUrl=v;}
    public String getApiKey(){return apiKey;} public void setApiKey(String v){apiKey=v;}
    public String getModel(){return model;} public void setModel(String v){model=v;}
    public int getTimeoutSeconds(){return timeoutSeconds;} public void setTimeoutSeconds(int v){timeoutSeconds=v;}
  }
  public static class Execution {
    private double speechCharsPerSecond=5.0; private long minimumSpeechMillis=1200, actionGapMillis=250;
    public double getSpeechCharsPerSecond(){return speechCharsPerSecond;} public void setSpeechCharsPerSecond(double v){speechCharsPerSecond=v;}
    public long getMinimumSpeechMillis(){return minimumSpeechMillis;} public void setMinimumSpeechMillis(long v){minimumSpeechMillis=v;}
    public long getActionGapMillis(){return actionGapMillis;} public void setActionGapMillis(long v){actionGapMillis=v;}
  }
}
