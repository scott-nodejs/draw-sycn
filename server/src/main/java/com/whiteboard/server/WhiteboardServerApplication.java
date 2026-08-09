package com.whiteboard.server;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.whiteboard.server.**.mapper")
public class WhiteboardServerApplication {
  public static void main(String[] args) {
    SpringApplication.run(WhiteboardServerApplication.class, args);
  }
}
