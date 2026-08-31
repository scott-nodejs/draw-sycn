package com.whiteboard.server.paperprocessing;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/papers/{paperId}/processing")
public class PaperProcessingController {
  private final PaperProcessingService processing;
  public PaperProcessingController(PaperProcessingService processing) { this.processing = processing; }
  @GetMapping public Map<String, Object> status(@PathVariable String paperId, @RequestHeader("X-User-Id") String userId) { return processing.status(paperId, userId); }
  @PostMapping("/retry") @ResponseStatus(HttpStatus.ACCEPTED) public Map<String, Object> retry(@PathVariable String paperId, @RequestHeader("X-User-Id") String userId) { return processing.retry(paperId, userId); }
  @PostMapping("/pause") public Map<String, Object> pause(@PathVariable String paperId, @RequestHeader("X-User-Id") String userId) { return processing.pause(paperId, userId); }
  @PostMapping("/resume") @ResponseStatus(HttpStatus.ACCEPTED) public Map<String, Object> resume(@PathVariable String paperId, @RequestHeader("X-User-Id") String userId) { return processing.resume(paperId, userId); }
}
