package com.bijian.teacheragent.ws;

import com.bijian.teacheragent.store.InMemoryStore;
import org.springframework.stereotype.Component; import org.springframework.web.socket.*; import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class TeachingWebSocketHandler extends TextWebSocketHandler {
  private final InMemoryStore store; private final TeachingEventBroker broker;
  public TeachingWebSocketHandler(InMemoryStore s,TeachingEventBroker b){store=s;broker=b;}
  public void afterConnectionEstablished(WebSocketSession socket)throws Exception {String path=socket.getUri().getPath();String id=path.substring(path.lastIndexOf('/')+1);store.session(id);socket.getAttributes().put("sessionId",id);broker.join(id,socket);socket.sendMessage(new TextMessage("{\"type\":\"SOCKET_CONNECTED\",\"sessionId\":\""+id+"\"}"));}
  public void afterConnectionClosed(WebSocketSession socket,CloseStatus status){Object id=socket.getAttributes().get("sessionId");if(id!=null)broker.leave(String.valueOf(id),socket);}
}
