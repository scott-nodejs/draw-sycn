package com.whiteboard.server.classroom;

import com.whiteboard.server.auth.AuthService;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class ClassroomWebSocketHandler extends TextWebSocketHandler {
  private final AuthService auth;private final ClassroomRoomService rooms;private final ClassroomEventBroker broker;
  public ClassroomWebSocketHandler(AuthService auth,ClassroomRoomService rooms,ClassroomEventBroker broker){this.auth=auth;this.rooms=rooms;this.broker=broker;}
  @Override public void afterConnectionEstablished(WebSocketSession session)throws Exception{try{String path=session.getUri().getPath();String roomId=URLDecoder.decode(path.substring(path.lastIndexOf('/')+1),StandardCharsets.UTF_8.name());String token=query(session,"token");Map<String,Object> user=auth.authenticate(token);rooms.room(roomId,String.valueOf(user.get("id")),String.valueOf(user.get("role")));session.getAttributes().put("roomId",roomId);session.getAttributes().put("userId",String.valueOf(user.get("id")));broker.join(roomId,session);session.sendMessage(new TextMessage("{\"event\":\"SOCKET_CONNECTED\",\"roomId\":\""+roomId+"\"}"));}catch(Exception error){session.close(CloseStatus.POLICY_VIOLATION);}}
  @Override public void afterConnectionClosed(WebSocketSession session,CloseStatus status){Object roomId=session.getAttributes().get("roomId");if(roomId!=null)broker.leave(String.valueOf(roomId),session);}
  @Override public void handleTransportError(WebSocketSession session,Throwable error)throws Exception{if(session.isOpen())session.close(CloseStatus.SERVER_ERROR);}
  private String query(WebSocketSession session,String name)throws Exception{String query=session.getUri().getRawQuery();if(query==null)return null;for(String item:query.split("&")){String[] pair=item.split("=",2);if(pair.length==2&&name.equals(URLDecoder.decode(pair[0],StandardCharsets.UTF_8.name())))return URLDecoder.decode(pair[1],StandardCharsets.UTF_8.name());}return null;}
}
