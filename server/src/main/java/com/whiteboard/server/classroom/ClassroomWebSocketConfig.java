package com.whiteboard.server.classroom;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration @EnableWebSocket
public class ClassroomWebSocketConfig implements WebSocketConfigurer {
  private final ClassroomWebSocketHandler handler;public ClassroomWebSocketConfig(ClassroomWebSocketHandler handler){this.handler=handler;}
  @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry){registry.addHandler(handler,"/ws/classroom/*").setAllowedOriginPatterns("*");}
}
