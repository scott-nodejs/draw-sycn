package com.bijian.teacheragent.ws;

import org.springframework.context.annotation.Configuration; import org.springframework.web.socket.config.annotation.*;

@Configuration @EnableWebSocket
public class TeachingWebSocketConfig implements WebSocketConfigurer {
  private final TeachingWebSocketHandler handler; public TeachingWebSocketConfig(TeachingWebSocketHandler h){handler=h;}
  public void registerWebSocketHandlers(WebSocketHandlerRegistry registry){registry.addHandler(handler,"/ws/teaching/*").setAllowedOriginPatterns("*");}
}
