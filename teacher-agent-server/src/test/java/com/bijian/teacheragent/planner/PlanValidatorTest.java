package com.bijian.teacheragent.planner;

import com.bijian.teacheragent.domain.Plans.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import java.util.*;

class PlanValidatorTest {
  private final PlanValidator validator=new PlanValidator();
  @Test void acceptsSeparatedSolutionAndTeachingPlans(){PlanBundle b=new PlanBundle();b.solutionPlan=new SolutionPlan();b.solutionPlan.answer="70°";b.solutionPlan.derivation=Arrays.asList("B=C","40+2B=180");b.teachingPlan=new TeachingPlan();b.teachingPlan.sceneType="geometry";b.teachingPlan.figure=new FigureSpec();b.teachingPlan.figure.type="triangle";b.teachingPlan.figure.points=Arrays.asList("A","B","C");TeachingStep s=new TeachingStep();s.id=1;s.goal="列式";s.say="我们先列出内角和。";CanvasAction a=new CanvasAction();a.type="WRITE_LATEX";a.payload.put("latex","40^\\circ+2B=180^\\circ");s.actions=Arrays.asList(a);b.teachingPlan.steps=Arrays.asList(s);assertDoesNotThrow(()->validator.validate(b));}
  @Test void rejectsUnknownCanvasAction(){PlanBundle b=new PlanBundle();b.solutionPlan=new SolutionPlan();b.solutionPlan.answer="x";b.solutionPlan.derivation=Arrays.asList("x");b.teachingPlan=new TeachingPlan();TeachingStep s=new TeachingStep();s.id=1;s.goal="g";s.say="s";CanvasAction a=new CanvasAction();a.type="RUN_CODE";s.actions=Arrays.asList(a);b.teachingPlan.steps=Arrays.asList(s);assertThrows(IllegalArgumentException.class,()->validator.validate(b));}
}
