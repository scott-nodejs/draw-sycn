package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class HybridRecognitionService {
  public static final String NATIVE_ONLY="native-only";
  private final JdbcTemplate jdbc; private final ObjectMapper json; private final NativePdfExtractor nativeExtractor;
  public HybridRecognitionService(JdbcTemplate jdbc,ObjectMapper json,NativePdfExtractor nativeExtractor){this.jdbc=jdbc;this.json=json;this.nativeExtractor=nativeExtractor;}

  public Submission submit(String paperId,List<Path> sources,Path paperDirectory,OcrProvider provider)throws Exception{
    List<Map<String,Object>> pages=pages(paperId);Set<Integer> nativePages=nativeExtractor.nativePages(pages);
    OcrProvider.DocumentArtifacts nativeArtifacts=nativeExtractor.extract(sources,nativePages);
    Path nativeLayout=paperDirectory.resolve("native-layout.json");Path nativeMarkdown=paperDirectory.resolve("native.md");json.writeValue(nativeLayout.toFile(),nativeArtifacts.layout);Files.write(nativeMarkdown,nativeArtifacts.markdown.getBytes(StandardCharsets.UTF_8));
    for(Integer pageNumber:nativePages)jdbc.update("UPDATE paper_page SET status='native_extracted',updated_at=NOW() WHERE paper_id=? AND page_number=?",paperId,pageNumber);
    List<Path> ocrFiles=new ArrayList<>();ArrayNode ocrPageNumbers=json.createArrayNode();
    for(Map<String,Object> page:pages){int pageNumber=((Number)page.get("pageNumber")).intValue();if(nativePages.contains(pageNumber))continue;ocrFiles.add(Paths.get(String.valueOf(page.get("path"))));ocrPageNumbers.add(pageNumber);}
    ObjectNode plan=json.createObjectNode();plan.put("version","v3");plan.set("nativePageNumbers",toArray(nativePages));plan.set("ocrPageNumbers",ocrPageNumbers);
    if(ocrFiles.isEmpty()){json.writeValue(paperDirectory.resolve("recognition-plan.json").toFile(),plan);return new Submission(NATIVE_ONLY,nativePages.size(),0);}
    ArrayNode jobIds=plan.putArray("ocrJobIds"),attempts=plan.putArray("ocrAttempts"),resultUrls=plan.putArray("ocrResultUrls");jobIds.add(provider.submit(ocrFiles,paperId));attempts.add(1);resultUrls.addArray();String requestId=join(jobIds);json.writeValue(paperDirectory.resolve("recognition-plan.json").toFile(),plan);for(JsonNode pageNumber:ocrPageNumbers)jdbc.update("UPDATE paper_page SET status='ocr_submitted',updated_at=NOW() WHERE paper_id=? AND page_number=?",paperId,pageNumber.asInt());
    return new Submission(requestId,nativePages.size(),ocrFiles.size());
  }

  public PollOutcome poll(String paperId,Path paperDirectory,OcrProvider provider,String requestId)throws Exception{
    if(NATIVE_ONLY.equals(requestId))return new PollOutcome(new OcrProvider.PollResult(true,json.createObjectNode().put("mode",NATIVE_ONLY),java.util.Collections.emptyList()),requestId,false);
    Path planPath=paperDirectory.resolve("recognition-plan.json");if(!Files.isRegularFile(planPath))return new PollOutcome(provider.poll(requestId),requestId,false);
    ObjectNode plan=(ObjectNode)json.readTree(planPath.toFile());ArrayNode jobs=(ArrayNode)plan.path("ocrJobIds"),attempts=(ArrayNode)plan.path("ocrAttempts");JsonNode pageNumbers=plan.path("ocrPageNumbers");ArrayNode cached=plan.path("ocrResultUrls").isArray()?(ArrayNode)plan.path("ocrResultUrls"):plan.putArray("ocrResultUrls");while(cached.size()<jobs.size())cached.addArray();ArrayNode raw=json.createArrayNode();List<String> urls=new ArrayList<>();boolean done=true,resubmitted=false,planChanged=false;
    for(int index=0;index<jobs.size();index++){JsonNode saved=cached.path(index);if(saved.isArray()&&saved.size()>0){saved.forEach(value->urls.add(value.asText()));continue;}String jobId=jobs.get(index).asText();try{OcrProvider.PollResult page=provider.poll(jobId);raw.add(page.raw);if(page.done){ArrayNode stored=json.createArrayNode();for(String url:page.resultUrls){stored.add(url);urls.add(url);}cached.set(index,stored);planChanged=true;}else done=false;}catch(ProviderException error){int attempt=attempts.path(index).asInt(1);if(attempt>=3||!"PADDLEOCR_EXTRACT_FAILED".equals(error.getCode()))throw error;List<Path> retryFiles=new ArrayList<>();if(jobs.size()==pageNumbers.size()){int pageNumber=pageNumbers.get(index).asInt();retryFiles.add(pageFile(paperId,pageNumber));jdbc.update("UPDATE paper_page SET status='ocr_retrying',updated_at=NOW() WHERE paper_id=? AND page_number=?",paperId,pageNumber);}else{for(JsonNode pageNumber:pageNumbers){retryFiles.add(pageFile(paperId,pageNumber.asInt()));jdbc.update("UPDATE paper_page SET status='ocr_retrying',updated_at=NOW() WHERE paper_id=? AND page_number=?",paperId,pageNumber.asInt());}}String replacement=provider.submit(retryFiles,paperId);jobs.set(index,json.getNodeFactory().textNode(replacement));attempts.set(index,json.getNodeFactory().numberNode(attempt+1));cached.set(index,json.createArrayNode());done=false;resubmitted=true;planChanged=true;}}
    String updated=join(jobs);if(planChanged)json.writeValue(planPath.toFile(),plan);return new PollOutcome(new OcrProvider.PollResult(done,raw,urls),updated,resubmitted);
  }

  public OcrProvider.DocumentArtifacts complete(String paperId,Path paperDirectory,OcrProvider provider,OcrProvider.PollResult result,Path assetDirectory)throws Exception{
    Path planPath=paperDirectory.resolve("recognition-plan.json");
    // Jobs submitted before recognition V3 have no plan and keep the legacy full-document behavior.
    if(!Files.isRegularFile(planPath))return provider.downloadDocumentArtifacts(result,assetDirectory);
    ArrayNode merged=json.createArrayNode();JsonNode nativeLayout=json.readTree(paperDirectory.resolve("native-layout.json").toFile());if(nativeLayout.isArray())merged.addAll((ArrayNode)nativeLayout);
    JsonNode plan=json.readTree(planPath.toFile());JsonNode pageNumbers=plan.path("ocrPageNumbers");
    if(!NATIVE_ONLY.equals(result.raw.path("mode").asText())){
      OcrProvider.DocumentArtifacts ocr=provider.downloadDocumentArtifacts(result,assetDirectory);
      for(JsonNode source:ocr.layout){ObjectNode block=source.deepCopy();int relative=block.path("page_idx").asInt();if(relative>=0&&relative<pageNumbers.size())block.put("page_idx",pageNumbers.get(relative).asInt()-1);merged.add(block);}
      for(JsonNode pageNumber:pageNumbers)jdbc.update("UPDATE paper_page SET status='ocr_completed',updated_at=NOW() WHERE paper_id=? AND page_number=?",paperId,pageNumber.asInt());
    }
    List<JsonNode> ordered=new ArrayList<>();merged.forEach(ordered::add);ordered.sort(Comparator.comparingInt((JsonNode n)->n.path("page_idx").asInt()).thenComparingInt(n->n.path("bbox").path(1).asInt()));
    ArrayNode layout=json.createArrayNode();StringBuilder markdown=new StringBuilder();int lastPage=-1;
    for(JsonNode block:ordered){layout.add(block);int page=block.path("page_idx").asInt();if(page!=lastPage){markdown.append("\n\n<!-- page:").append(page+1).append(" -->\n");lastPage=page;}String text=block.path("text").asText().trim();if(!text.isEmpty())markdown.append(text).append("\n");}
    return new OcrProvider.DocumentArtifacts(markdown.toString(),layout);
  }

  private List<Map<String,Object>> pages(String paperId){return jdbc.query("SELECT page_number,normalized_object_key,parse_strategy FROM paper_page WHERE paper_id=? ORDER BY page_number",(rs,n)->{Map<String,Object> row=new LinkedHashMap<>();row.put("pageNumber",rs.getInt("page_number"));row.put("path",rs.getString("normalized_object_key"));row.put("strategy",rs.getString("parse_strategy"));return row;},paperId);}
  private Path pageFile(String paperId,int pageNumber){return Paths.get(jdbc.queryForObject("SELECT normalized_object_key FROM paper_page WHERE paper_id=? AND page_number=?",String.class,paperId,pageNumber));}
  private ArrayNode toArray(Set<Integer> values){ArrayNode result=json.createArrayNode();values.stream().sorted().forEach(result::add);return result;}
  private String join(ArrayNode values){List<String> items=new ArrayList<>();values.forEach(value->items.add(value.asText()));return String.join(",",items);}
  public static final class Submission{public final String requestId;public final int nativePages;public final int ocrPages;Submission(String requestId,int nativePages,int ocrPages){this.requestId=requestId;this.nativePages=nativePages;this.ocrPages=ocrPages;}}
  public static final class PollOutcome{public final OcrProvider.PollResult result;public final String requestId;public final boolean resubmitted;PollOutcome(OcrProvider.PollResult result,String requestId,boolean resubmitted){this.result=result;this.requestId=requestId;this.resubmitted=resubmitted;}}
}
