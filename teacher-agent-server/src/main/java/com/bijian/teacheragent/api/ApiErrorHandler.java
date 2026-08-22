package com.bijian.teacheragent.api;

import org.springframework.http.*; import org.springframework.web.bind.MethodArgumentNotValidException; import org.springframework.web.bind.annotation.*;
import java.time.Instant; import java.util.*;

@RestControllerAdvice
public class ApiErrorHandler {
  @ExceptionHandler(NoSuchElementException.class) public ResponseEntity<Map<String,Object>> notFound(Exception e){return error(HttpStatus.NOT_FOUND,e);}
  @ExceptionHandler({IllegalArgumentException.class,MethodArgumentNotValidException.class}) public ResponseEntity<Map<String,Object>> badRequest(Exception e){return error(HttpStatus.BAD_REQUEST,e);}
  @ExceptionHandler(IllegalStateException.class) public ResponseEntity<Map<String,Object>> conflict(Exception e){HttpStatus status=e.getMessage()!=null&&e.getMessage().contains("DEEPSEEK_API_KEY")?HttpStatus.SERVICE_UNAVAILABLE:HttpStatus.CONFLICT;return error(status,e);}
  private ResponseEntity<Map<String,Object>> error(HttpStatus status,Exception e){Map<String,Object> body=new LinkedHashMap<>();body.put("timestamp",Instant.now());body.put("status",status.value());body.put("error",status.getReasonPhrase());body.put("message",e.getMessage());return ResponseEntity.status(status).body(body);}
}
