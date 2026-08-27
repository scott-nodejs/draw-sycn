package com.whiteboard.server.teaching;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Iterator;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import org.springframework.stereotype.Component;

@Component
public class PaperPagePreviewService {
  private static final int MAX_WIDTH = 1400;
  private static final float JPEG_QUALITY = 0.78f;

  public synchronized Path preview(Path source) throws Exception {
    Path directory = source.getParent().resolve("preview");
    String sourceName = source.getFileName().toString();
    String baseName = sourceName.replaceFirst("(?i)\\.[^.]+$", "");
    Path target = directory.resolve(baseName + ".jpg");
    if (Files.isRegularFile(target) && Files.getLastModifiedTime(target).compareTo(Files.getLastModifiedTime(source)) >= 0) return target;

    BufferedImage original = ImageIO.read(source.toFile());
    if (original == null) throw new IllegalStateException("无法读取试卷页面图片");
    int width = Math.min(MAX_WIDTH, original.getWidth());
    int height = Math.max(1, Math.round(original.getHeight() * (width / (float) original.getWidth())));
    BufferedImage preview = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
    Graphics2D graphics = preview.createGraphics();
    try {
      graphics.setColor(Color.WHITE);
      graphics.fillRect(0, 0, width, height);
      graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
      graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
      graphics.drawImage(original, 0, 0, width, height, null);
    } finally {
      graphics.dispose();
    }

    Files.createDirectories(directory);
    Path temporary = Files.createTempFile(directory, baseName + "-", ".jpg.tmp");
    try {
      writeJpeg(preview, temporary);
      try { Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE); }
      catch (AtomicMoveNotSupportedException error) { Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING); }
    } finally {
      Files.deleteIfExists(temporary);
    }
    return target;
  }

  private void writeJpeg(BufferedImage image, Path target) throws Exception {
    Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
    if (!writers.hasNext()) throw new IllegalStateException("系统缺少 JPEG 编码器");
    ImageWriter writer = writers.next();
    try (ImageOutputStream output = ImageIO.createImageOutputStream(target.toFile())) {
      writer.setOutput(output);
      ImageWriteParam parameters = writer.getDefaultWriteParam();
      parameters.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
      parameters.setCompressionQuality(JPEG_QUALITY);
      writer.write(null, new IIOImage(image, null, null), parameters);
    } finally {
      writer.dispose();
    }
  }
}
