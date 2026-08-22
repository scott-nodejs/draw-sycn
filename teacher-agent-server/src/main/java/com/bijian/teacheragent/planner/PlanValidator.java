package com.bijian.teacheragent.planner;

import com.bijian.teacheragent.domain.Plans.*;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
public class PlanValidator {
  private static final Set<String> ACTIONS=new HashSet<>(Arrays.asList("DRAW_TRIANGLE","MARK_EQUAL","MARK_ANGLE","WRITE_LATEX","HIGHLIGHT","DRAW_LINE","DRAW_POINT","DRAW_CIRCLE","ERASE","PAUSE"));
  public void validate(PlanBundle bundle) {
    List<String> errors=new ArrayList<>();
    if(bundle==null) errors.add("模型未返回计划");
    else {
      if(bundle.solutionPlan==null) errors.add("缺少 solutionPlan");
      else { if(blank(bundle.solutionPlan.answer)) errors.add("solutionPlan.answer 为空"); if(bundle.solutionPlan.derivation==null||bundle.solutionPlan.derivation.isEmpty()) errors.add("推导链为空"); }
      if(bundle.teachingPlan==null||bundle.teachingPlan.steps==null||bundle.teachingPlan.steps.isEmpty()) errors.add("教学步骤为空");
      else for(int i=0;i<bundle.teachingPlan.steps.size();i++) {
        TeachingStep step=bundle.teachingPlan.steps.get(i);
        if(step.id!=i+1) errors.add("步骤 id 必须从 1 连续递增");
        if(blank(step.goal)||blank(step.say)) errors.add("步骤 "+step.id+" 缺少 goal 或 say");
        if(step.actions==null) step.actions=new ArrayList<>();
        for(CanvasAction action:step.actions) if(action==null||!ACTIONS.contains(action.type)) errors.add("步骤 "+step.id+" 含未知动作: "+(action==null?"null":action.type));
      }
      if(bundle.teachingPlan!=null&&"geometry".equals(bundle.teachingPlan.sceneType)) {
        if(bundle.teachingPlan.figure==null) errors.add("几何题缺少 figure 语义图形");
        else if(bundle.teachingPlan.figure.points==null||bundle.teachingPlan.figure.points.size()<3) errors.add("几何图至少需要三个点");
      }
    }
    if(!errors.isEmpty()) throw new IllegalArgumentException(String.join("；",errors));
  }
  private boolean blank(String value){return value==null||value.trim().isEmpty();}
}
