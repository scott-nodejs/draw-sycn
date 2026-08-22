package com.whiteboard.server.teaching;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiErrorHandler {
  @ExceptionHandler(MaxUploadSizeExceededException.class)
  public ResponseEntity<Map<String, Object>> handleUploadLimit(MaxUploadSizeExceededException error, HttpServletRequest request) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("timestamp", LocalDateTime.now().toString());
    body.put("status", 413);
    body.put("error", "Payload Too Large");
    body.put("message", "上传文件过大：单个文件不能超过 100MB");
    body.put("path", request.getRequestURI());
    return ResponseEntity.status(413).body(body);
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException error, HttpServletRequest request) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("timestamp", LocalDateTime.now().toString());
    body.put("status", error.getStatus().value());
    body.put("error", error.getStatus().getReasonPhrase());
    body.put("message", error.getReason());
    body.put("path", request.getRequestURI());
    return ResponseEntity.status(error.getStatus()).body(body);
  }
}
