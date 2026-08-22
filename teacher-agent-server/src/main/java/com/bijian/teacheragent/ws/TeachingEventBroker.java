package com.bijian.teacheragent.ws;

import com.bijian.teacheragent.domain.TeachingSession;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import java.time.Instant; import java.util.*; import java.util.concurrent.*;

@Component
public class TeachingEventBroker {
  private final ObjectMapper json; private final Map<String,Set<WebSocketSession>> subscribers=new ConcurrentHashMap<>();
  public TeachingEventBroker(ObjectMapper json){this.json=json;}
  public void join(String id,WebSocketSession s){subscribers.computeIfAbsent(id,k->ConcurrentHashMap.newKeySet()).add(s);}
  public void leave(String id,WebSocketSession s){Set<WebSocketSession> set=subscribers.get(id);if(set!=null){set.remove(s);if(set.isEmpty())subscribers.remove(id);}}
  public void publish(TeachingSession session,String type,Object payload){
    Map<String,Object> event=new LinkedHashMap<>(); synchronized(session){event.put("sequence",++session.eventSequence);} event.put("type",type);event.put("sessionId",session.id);event.put("roomId",session.roomId);event.put("timestamp",Instant.now().toString());event.put("payload",payload);
    try {TextMessage message=new TextMessage(json.writeValueAsString(event));Set<WebSocketSession> set=subscribers.get(session.id);if(set!=null)for(WebSocketSession s:set)try{if(s.isOpen())synchronized(s){s.sendMessage(message);}}catch(Exception e){leave(session.id,s);}}catch(Exception e){throw new IllegalStateException(e);}
  }
}
