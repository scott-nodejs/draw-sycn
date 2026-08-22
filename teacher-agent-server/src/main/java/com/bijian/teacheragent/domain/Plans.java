package com.bijian.teacheragent.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.time.Instant;
import java.util.*;

public final class Plans {
  private Plans() {}
  @JsonIgnoreProperties(ignoreUnknown=true)
  public static class PlanBundle {
    public String id, problem, studentLevel; public SolutionPlan solutionPlan; public TeachingPlan teachingPlan; public Instant createdAt;
  }
  @JsonIgnoreProperties(ignoreUnknown=true)
  public static class SolutionPlan {
    public List<String> givens=new ArrayList<>(), coreTheorems=new ArrayList<>(), derivation=new ArrayList<>();
    public String target, answer, verification;
  }
  @JsonIgnoreProperties(ignoreUnknown=true)
  public static class TeachingPlan {
    public String strategy, sceneType;
    public FigureSpec figure;
    public List<TeachingStep> steps=new ArrayList<>();
  }
  @JsonIgnoreProperties(ignoreUnknown=true)
  public static class FigureSpec {
    public String type, apex;
    public List<String> points=new ArrayList<>();
    public List<GeometryConstraint> constraints=new ArrayList<>();
    public List<GeometryAnnotation> annotations=new ArrayList<>();
  }
  @JsonIgnoreProperties(ignoreUnknown=true)
  public static class GeometryConstraint {
    public String type, point, center;
    public List<String> segments=new ArrayList<>(), lines=new ArrayList<>(), points=new ArrayList<>();
  }
  @JsonIgnoreProperties(ignoreUnknown=true)
  public static class GeometryAnnotation { public String type, vertex, value, label; }
  @JsonIgnoreProperties(ignoreUnknown=true)
  public static class TeachingStep {
    public int id; public String goal, say; public long pauseAfterMs; public List<CanvasAction> actions=new ArrayList<>();
  }
  @JsonIgnoreProperties(ignoreUnknown=true)
  public static class CanvasAction {
    public String type; public Map<String,Object> payload=new LinkedHashMap<>();
  }
}
