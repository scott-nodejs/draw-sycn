package com.whiteboard.server.paperprocessing;

import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
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

  public DocumentNormalizer(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  public int normalize(String paperId, List<Path> sources, Path paperDirectory) throws Exception {
    Path pagesDirectory = paperDirectory.resolve("pages");
    Files.createDirectories(pagesDirectory);
    jdbc.update("DELETE FROM paper_page WHERE paper_id=?", paperId);
    int pageNumber = 0;
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
              pageNumber++;
              savePage(paperId, pageNumber, source, image, pagesDirectory);
            } finally {
              image.flush();
            }
          }
        }
      } else {
        BufferedImage image = ImageIO.read(source.toFile());
        if (image == null) throw new ProviderException("UNSUPPORTED_IMAGE", "无法读取图片：" + source.getFileName());
        try {
          pageNumber++;
          savePage(paperId, pageNumber, source, image, pagesDirectory);
        } finally {
          image.flush();
        }
      }
    }
    if (pageNumber == 0) throw new ProviderException("EMPTY_DOCUMENT", "文档中没有可处理的页面");
    return pageNumber;
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
