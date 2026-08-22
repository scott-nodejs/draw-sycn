package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.springframework.stereotype.Component;

@Component
public class NativePdfExtractor {
  private final ObjectMapper json;
  public NativePdfExtractor(ObjectMapper json) { this.json=json; }

  public OcrProvider.DocumentArtifacts extract(List<Path> sources, Set<Integer> selectedPages) throws Exception {
    StringBuilder markdown=new StringBuilder(); ArrayNode layout=json.createArrayNode(); int globalPage=0;
    for(Path source:sources){
      if(!source.getFileName().toString().toLowerCase().endsWith(".pdf")){globalPage++;continue;}
      try(PDDocument document=PDDocument.load(source.toFile())){
        for(int index=0;index<document.getNumberOfPages();index++){
          int pageNumber=++globalPage; if(!selectedPages.contains(pageNumber))continue;
          PDPage page=document.getPage(index); PageStripper stripper=new PageStripper(json,layout,pageNumber-1,page.getMediaBox().getWidth(),page.getMediaBox().getHeight());
          stripper.setSortByPosition(true); stripper.setStartPage(index+1); stripper.setEndPage(index+1);
          String text=stripper.getText(document).trim(); if(!text.isEmpty())markdown.append("\n\n<!-- page:").append(pageNumber).append(" -->\n").append(text);
        }
      }
    }
    return new OcrProvider.DocumentArtifacts(markdown.toString(),layout);
  }

  public Set<Integer> nativePages(List<java.util.Map<String,Object>> pages){Set<Integer> result=new HashSet<>();for(java.util.Map<String,Object> page:pages)if("native".equals(String.valueOf(page.get("strategy"))))result.add(((Number)page.get("pageNumber")).intValue());return result;}

  private static final class PageStripper extends PDFTextStripper {
    private final ObjectMapper json; private final ArrayNode blocks; private final int pageIndex; private final float width; private final float height;
    PageStripper(ObjectMapper json,ArrayNode blocks,int pageIndex,float width,float height)throws IOException{this.json=json;this.blocks=blocks;this.pageIndex=pageIndex;this.width=width;this.height=height;}
    @Override protected void writeString(String text,List<TextPosition> positions)throws IOException{
      super.writeString(text,positions); String normalized=text==null?"":text.trim(); if(normalized.isEmpty()||positions.isEmpty())return;
      float x0=Float.MAX_VALUE,y0=Float.MAX_VALUE,x1=0,y1=0;
      for(TextPosition p:positions){x0=Math.min(x0,p.getXDirAdj());y0=Math.min(y0,p.getYDirAdj()-p.getHeightDir());x1=Math.max(x1,p.getXDirAdj()+p.getWidthDirAdj());y1=Math.max(y1,p.getYDirAdj());}
      ObjectNode block=blocks.addObject();block.put("page_idx",pageIndex);block.put("type","text");block.put("text",normalized);block.put("coordinateWidth",Math.max(1,Math.round(width)));block.put("coordinateHeight",Math.max(1,Math.round(height)));
      ArrayNode box=block.putArray("bbox");box.add(Math.max(0,Math.round(x0))).add(Math.max(0,Math.round(y0))).add(Math.min(Math.round(width),Math.round(x1))).add(Math.min(Math.round(height),Math.round(y1)));
    }
  }
}
