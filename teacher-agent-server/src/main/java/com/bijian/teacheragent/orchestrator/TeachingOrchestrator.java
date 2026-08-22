package com.bijian.teacheragent.orchestrator;

import com.bijian.teacheragent.config.TeacherAgentProperties;
import com.bijian.teacheragent.domain.Plans.*;
import com.bijian.teacheragent.domain.TeachingSession;
import com.bijian.teacheragent.store.InMemoryStore;
import com.bijian.teacheragent.ws.TeachingEventBroker;
import org.springframework.stereotype.Service;
import javax.annotation.PreDestroy;
import java.time.Instant; import java.util.*; import java.util.concurrent.*;

@Service
public class TeachingOrchestrator {
  private final InMemoryStore store; private final TeachingEventBroker events; private final TeacherAgentProperties properties;
  private final ScheduledExecutorService executor=Executors.newScheduledThreadPool(2); private final Map<String,ScheduledFuture<?>> pending=new ConcurrentHashMap<>();
  public TeachingOrchestrator(InMemoryStore s,TeachingEventBroker e,TeacherAgentProperties p){store=s;events=e;properties=p;}
  public TeachingSession create(String planId,String roomId){store.plan(planId);TeachingSession s=new TeachingSession();s.id=UUID.randomUUID().toString();s.planId=planId;s.roomId=roomId;return store.save(s);}
  public TeachingSession start(String id){TeachingSession s=store.session(id);synchronized(s){if(s.status!=TeachingSession.Status.READY&&s.status!=TeachingSession.Status.PAUSED)throw new IllegalStateException("当前状态不能开始: "+s.status);s.status=TeachingSession.Status.RUNNING;s.updatedAt=Instant.now();}events.publish(s,"SESSION_STATUS",snapshot(s));scheduleStep(s,0);return s;}
  public TeachingSession pause(String id){TeachingSession s=store.session(id);synchronized(s){if(s.status!=TeachingSession.Status.RUNNING)throw new IllegalStateException("只有运行中的会话可以暂停");s.status=TeachingSession.Status.PAUSED;s.updatedAt=Instant.now();}cancel(id);events.publish(s,"SESSION_STATUS",snapshot(s));return s;}
  public TeachingSession resume(String id){return start(id);}
  public TeachingSession next(String id){TeachingSession s=store.session(id);synchronized(s){if(s.status!=TeachingSession.Status.READY&&s.status!=TeachingSession.Status.PAUSED)throw new IllegalStateException("单步执行要求 READY 或 PAUSED 状态");s.status=TeachingSession.Status.PAUSED;}executeStep(s,false);return s;}
  public TeachingSession stop(String id){TeachingSession s=store.session(id);cancel(id);synchronized(s){s.status=TeachingSession.Status.STOPPED;s.updatedAt=Instant.now();}events.publish(s,"SESSION_STATUS",snapshot(s));return s;}
  private void scheduleStep(TeachingSession s,long delay){cancel(s.id);pending.put(s.id,executor.schedule(()->executeStep(s,true),delay,TimeUnit.MILLISECONDS));}
  private void executeStep(TeachingSession s,boolean autoContinue){
    TeachingStep step; synchronized(s){if(autoContinue&&s.status!=TeachingSession.Status.RUNNING)return;TeachingPlan plan=store.plan(s.planId).teachingPlan;if(s.currentStepIndex>=plan.steps.size()){complete(s);return;}step=plan.steps.get(s.currentStepIndex);}
    try {
      events.publish(s,"STEP_STARTED",stepMeta(step));
      Map<String,Object> speech=new LinkedHashMap<>();speech.put("text",step.say);speech.put("stepId",step.id);speech.put("estimatedDurationMs",speechDuration(step.say));events.publish(s,"SPEECH",speech);
      for(CanvasAction action:step.actions){Map<String,Object> canvas=new LinkedHashMap<>();canvas.put("stepId",step.id);canvas.put("action",action);events.publish(s,"CANVAS_ACTION",canvas);}
      synchronized(s){s.currentStepIndex++;s.updatedAt=Instant.now();}events.publish(s,"STEP_COMPLETED",stepMeta(step));
      if(s.currentStepIndex>=store.plan(s.planId).teachingPlan.steps.size()){complete(s);return;}
      if(autoContinue)scheduleStep(s,speechDuration(step.say)+step.pauseAfterMs+step.actions.size()*properties.getExecution().getActionGapMillis());
    } catch(Exception e){synchronized(s){s.status=TeachingSession.Status.FAILED;s.error=e.getMessage();s.updatedAt=Instant.now();}events.publish(s,"SESSION_STATUS",snapshot(s));}
  }
  private void complete(TeachingSession s){cancel(s.id);synchronized(s){s.status=TeachingSession.Status.COMPLETED;s.updatedAt=Instant.now();}events.publish(s,"SESSION_STATUS",snapshot(s));}
  private long speechDuration(String text){long estimate=(long)(text.length()/properties.getExecution().getSpeechCharsPerSecond()*1000);return Math.max(properties.getExecution().getMinimumSpeechMillis(),estimate);}
  private Map<String,Object> stepMeta(TeachingStep step){Map<String,Object> m=new LinkedHashMap<>();m.put("stepId",step.id);m.put("goal",step.goal);return m;}
  private Map<String,Object> snapshot(TeachingSession s){Map<String,Object> m=new LinkedHashMap<>();m.put("status",s.status);m.put("currentStepIndex",s.currentStepIndex);m.put("error",s.error);return m;}
  private void cancel(String id){ScheduledFuture<?> f=pending.remove(id);if(f!=null)f.cancel(false);}
  @PreDestroy public void shutdown(){executor.shutdownNow();}
}
