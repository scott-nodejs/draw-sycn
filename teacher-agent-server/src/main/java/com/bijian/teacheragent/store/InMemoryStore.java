package com.bijian.teacheragent.store;

import com.bijian.teacheragent.domain.Plans.PlanBundle;
import com.bijian.teacheragent.domain.TeachingSession;
import org.springframework.stereotype.Component;
import java.util.*; import java.util.concurrent.*;

@Component
public class InMemoryStore {
  private final Map<String,PlanBundle> plans=new ConcurrentHashMap<>(); private final Map<String,TeachingSession> sessions=new ConcurrentHashMap<>();
  public PlanBundle save(PlanBundle p){p.id=UUID.randomUUID().toString();p.createdAt=java.time.Instant.now();plans.put(p.id,p);return p;}
  public PlanBundle plan(String id){PlanBundle p=plans.get(id);if(p==null)throw new NoSuchElementException("Teaching plan not found: "+id);return p;}
  public TeachingSession save(TeachingSession s){sessions.put(s.id,s);return s;}
  public TeachingSession session(String id){TeachingSession s=sessions.get(id);if(s==null)throw new NoSuchElementException("Teaching session not found: "+id);return s;}
}
