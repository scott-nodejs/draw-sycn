package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class DocumentNormalizer {
  private static final Logger log = LoggerFactory.getLogger(DocumentNormalizer.class);
  private final JdbcTemplate jdbc;
  private final ObjectMapper json;

  public DocumentNormalizer(JdbcTemplate jdbc, ObjectMapper json) { this.jdbc = jdbc; this.json = json; }

  public int normalize(String paperId, List<Path> sources, Path paperDirectory) throws Exception {
    Path pagesDirectory = paperDirectory.resolve("pages");
    Files.createDirectories(pagesDirectory);
    jdbc.update("DELETE FROM paper_page WHERE paper_id=?", paperId);
    Set<Integer> splitPages = splitPages(paperId);
    int pageNumber = 0, sourcePageNumber = 0;
    for (Path source : sources) {
      String lowerName = source.getFileName().toString().toLowerCase();
      log.info("Normalizing paper source: paperId={}, source={}", paperId, source.getFileName());
      if (lowerName.endsWith(".pdf")) {
        try (PDDocument document = PDDocument.load(source.toFile(), MemoryUsageSetting.setupTempFileOnly())) {
          log.info("PDF opened for normalization: paperId={}, source={}, pages={}", paperId, source.getFileName(), document.getNumberOfPages());
          PDFRenderer renderer = new PDFRenderer(document);
          for (int index = 0; index < document.getNumberOfPages(); index++) {
            log.info("Rendering PDF page: paperId={}, source={}, page={}/{}", paperId, source.getFileName(), index + 1, document.getNumberOfPages());
            BufferedImage image = renderer.renderImageWithDPI(index, 180, ImageType.RGB);
            try {
              sourcePageNumber++;
              pageNumber = saveSourcePage(paperId, pageNumber, sourcePageNumber, source, image, pagesDirectory, splitPages);
            } finally {
              image.flush();
            }
          }
        }
      } else {
        BufferedImage image = ImageIO.read(source.toFile());
        if (image == null) throw new ProviderException("UNSUPPORTED_IMAGE", "无法读取图片：" + source.getFileName());
        try {
          sourcePageNumber++;
          pageNumber = saveSourcePage(paperId, pageNumber, sourcePageNumber, source, image, pagesDirectory, splitPages);
        } finally {
          image.flush();
        }
      }
    }
    if (pageNumber == 0) throw new ProviderException("EMPTY_DOCUMENT", "文档中没有可处理的页面");
    return pageNumber;
  }

  private int saveSourcePage(String paperId, int pageNumber, int sourcePageNumber, Path source, BufferedImage image, Path pagesDirectory, Set<Integer> splitPages) throws Exception {
    if (!splitPages.contains(sourcePageNumber)) {
      savePage(paperId, ++pageNumber, source, image, pagesDirectory);
      return pageNumber;
    }
    if (image.getWidth() < 2) throw new ProviderException("PAGE_SPLIT_TOO_NARROW", "第 " + sourcePageNumber + " 页宽度不足，无法拆分");
    int middle = image.getWidth() / 2;
    savePage(paperId, ++pageNumber, source, image.getSubimage(0, 0, middle, image.getHeight()), pagesDirectory);
    savePage(paperId, ++pageNumber, source, image.getSubimage(middle, 0, image.getWidth() - middle, image.getHeight()), pagesDirectory);
    log.info("Source page split into left and right pages: paperId={}, sourcePage={}", paperId, sourcePageNumber);
    return pageNumber;
  }

  private Set<Integer> splitPages(String paperId) throws Exception {
    String value = jdbc.queryForObject("SELECT COALESCE(page_split_config_json,'[]') FROM teaching_paper WHERE id=?", String.class, paperId);
    Set<Integer> result = new HashSet<>(); JsonNode parsed = json.readTree(value == null ? "[]" : value);
    if (parsed.isArray()) for (JsonNode item : parsed) if (item.asInt() > 0) result.add(item.asInt());
    return result;
  }

  private void savePage(String paperId, int pageNumber, Path source, BufferedImage image, Path pagesDirectory) throws Exception {
    Path normalized = pagesDirectory.resolve(String.format("page-%04d.png", pageNumber));
    if (!ImageIO.write(image, "png", normalized.toFile())) throw new ProviderException("IMAGE_NORMALIZE_FAILED", "页面图片标准化失败");
    Timestamp now = Timestamp.valueOf(LocalDateTime.now());
    jdbc.update("INSERT INTO paper_page (id,paper_id,page_number,source_object_key,normalized_object_key,width,height,quality_score,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      "page_" + UUID.randomUUID().toString().replace("-", ""), paperId, pageNumber, source.toString(), normalized.toString(), image.getWidth(), image.getHeight(), 100, "normalized", now, now);
    log.info("Normalized page saved: paperId={}, pageNumber={}, width={}, height={}, output={}", paperId, pageNumber, image.getWidth(), image.getHeight(), normalized.getFileName());
  }
}
