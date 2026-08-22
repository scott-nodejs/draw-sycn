package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class PageInspector {
  private final JdbcTemplate jdbc; private final ObjectMapper json;
  public PageInspector(JdbcTemplate jdbc, ObjectMapper json) { this.jdbc = jdbc; this.json = json; }

  public void inspect(String paperId, List<Path> sources) throws Exception {
    int globalPage = 0;
    for (Path source : sources) {
      String name = source.getFileName().toString().toLowerCase();
      if (!name.endsWith(".pdf")) { update(paperId, ++globalPage, "image", ParseStrategy.FULL_OCR, false, 0, 1d, 0); continue; }
      try (PDDocument document = PDDocument.load(source.toFile())) {
        PDFTextStripper stripper = new PDFTextStripper(); stripper.setSortByPosition(true);
        for (int index = 0; index < document.getNumberOfPages(); index++) {
          stripper.setStartPage(index + 1); stripper.setEndPage(index + 1);
          String text = stripper.getText(document); int visible = visibleCharacters(text); int broken = brokenCharacters(text);
          int score = visible == 0 ? 0 : Math.max(0, Math.min(100, 100 - broken * 100 / visible));
          boolean hasText = visible >= 24;
          ParseStrategy strategy = hasText && score >= 95 && visible >= 80 ? ParseStrategy.NATIVE : hasText && score >= 80 ? ParseStrategy.NATIVE_WITH_FORMULA_OCR : ParseStrategy.FULL_OCR;
          update(paperId, ++globalPage, hasText ? "native_pdf" : "scanned_pdf", strategy, hasText, score, hasText ? 0d : 1d, visible);
        }
      }
    }
  }

  private void update(String paperId, int page, String sourceType, ParseStrategy strategy, boolean hasText, int score, double imageCoverage, int textCharacters) throws Exception {
    Integer imageQuality=jdbc.queryForObject("SELECT quality_score FROM paper_page WHERE paper_id=? AND page_number=?",Integer.class,paperId,page);
    if(imageQuality!=null&&imageQuality<65&&strategy!=ParseStrategy.NATIVE)strategy=ParseStrategy.IMAGE_REPAIR_THEN_OCR;
    Map<String,Object> detail = new LinkedHashMap<>(); detail.put("version", "v3"); detail.put("textCharacters", textCharacters); detail.put("routingReason", hasText ? "usable_text_layer" : "text_layer_missing_or_sparse");
    jdbc.update("UPDATE paper_page SET page_source_type=?,parse_strategy=?,has_text_layer=?,native_text_score=?,image_coverage=?,inspection_json=?,status='inspected',updated_at=? WHERE paper_id=? AND page_number=?",
      sourceType, strategy.name().toLowerCase(), hasText ? 1 : 0, score, imageCoverage, json.writeValueAsString(detail), Timestamp.valueOf(LocalDateTime.now()), paperId, page);
  }

  private int visibleCharacters(String text) { if (text == null) return 0; int count = 0; for (int i=0;i<text.length();i++) if (!Character.isWhitespace(text.charAt(i))) count++; return count; }
  private int brokenCharacters(String text) { if (text == null) return 0; int count = 0; for (int i=0;i<text.length();i++) { char ch=text.charAt(i); if (ch=='\uFFFD' || (ch < 0x20 && !Character.isWhitespace(ch))) count++; } return count; }
}
