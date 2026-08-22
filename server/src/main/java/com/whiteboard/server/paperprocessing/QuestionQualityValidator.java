package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class QuestionQualityValidator {
  public void validate(JsonNode result) {
    JsonNode questions=result.path("questions");
    if(!questions.isArray() || questions.size()==0) throw new ProviderException("QUESTION_QUALITY_FAILED","No questions were recognized");
    Set<Integer> numbers=new HashSet<>();
    for(JsonNode question:questions){
      int number=question.path("number").asInt();
      if(number<=0 || !numbers.add(number) || question.path("stem").asText().trim().isEmpty()) throw new ProviderException("QUESTION_QUALITY_FAILED","Question number must be unique and stem cannot be empty");
      JsonNode regions=question.path("sourceRegions");
      if(!regions.isArray() || regions.size()==0) throw new ProviderException("QUESTION_REGION_MISSING","Question "+number+" has no verified source region");
      for(JsonNode region:regions){int page=region.path("pageNumber").asInt();int x0=region.path("x0").asInt(-1),y0=region.path("y0").asInt(-1),x1=region.path("x1").asInt(-1),y1=region.path("y1").asInt(-1);if(page<=0||x0<0||y0<0||x1>1000||y1>1000||x1<=x0||y1<=y0)throw new ProviderException("QUESTION_REGION_INVALID","Question "+number+" has an invalid source region");}
    }
  }
}
