package com.whiteboard.server.organizer;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/teacher/question-set-marketplace")
public class QuestionSetMarketplaceController {
  private final QuestionSetMarketplaceService marketplace;
  public QuestionSetMarketplaceController(QuestionSetMarketplaceService marketplace){this.marketplace=marketplace;}
  @GetMapping public List<Map<String,Object>> store(){return marketplace.store();}
  @GetMapping("/mine") public List<Map<String,Object>> mine(@RequestHeader("X-User-Id") String teacherId){return marketplace.mine(teacherId);}
  @PostMapping("/{setId}/purchases") @ResponseStatus(HttpStatus.CREATED)
  public Map<String,Object> purchase(@PathVariable String setId,@RequestHeader("X-User-Id") String teacherId){return marketplace.purchase(setId,teacherId);}
}
