package com.whiteboard.server.classroom;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class ClassroomEventBroker {
  private final ObjectMapper json;private final Map<String,Set<WebSocketSession>> rooms=new ConcurrentHashMap<>();
  public ClassroomEventBroker(ObjectMapper json){this.json=json;}
  public void join(String roomId,WebSocketSession session){rooms.computeIfAbsent(roomId,key->ConcurrentHashMap.newKeySet()).add(session);}
  public void leave(String roomId,WebSocketSession session){Set<WebSocketSession> sessions=rooms.get(roomId);if(sessions!=null){sessions.remove(session);if(sessions.isEmpty())rooms.remove(roomId);}}
  public void publish(String roomId,Map<String,Object> event){try{TextMessage message=new TextMessage(json.writeValueAsString(event));Set<WebSocketSession> sessions=rooms.get(roomId);if(sessions==null)return;for(WebSocketSession session:sessions){try{if(session.isOpen())synchronized(session){session.sendMessage(message);}}catch(Exception ignored){leave(roomId,session);}}}catch(Exception error){throw new IllegalStateException(error);}}
}
