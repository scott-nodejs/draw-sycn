package com.whiteboard.server.teaching;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class LibreOfficeDocumentConverter {
  private final String configuredBinary;
  public LibreOfficeDocumentConverter(@Value("${LIBREOFFICE_BIN:}") String configuredBinary) { this.configuredBinary = configuredBinary == null ? "" : configuredBinary.trim(); }

  public void convertToPdf(Path source, Path target) throws Exception {
    Path output = Files.createTempDirectory(source.getParent(), "libreoffice-output-");
    Path profile = Files.createTempDirectory("libreoffice-profile-");
    try {
      ProcessBuilder builder = new ProcessBuilder(binary(), "-env:UserInstallation=" + profile.toUri(), "--headless", "--convert-to", "pdf", "--outdir", output.toString(), source.toString());
      builder.redirectErrorStream(true);
      Process process = builder.start();
      ByteArrayOutputStream log = new ByteArrayOutputStream();
      Thread reader = new Thread(() -> { try { byte[] buffer = new byte[4096]; int count; while ((count = process.getInputStream().read(buffer)) != -1) log.write(buffer, 0, count); } catch (Exception ignored) {} });
      reader.start();
      if (!process.waitFor(120, TimeUnit.SECONDS)) { process.destroyForcibly(); throw new IllegalStateException("Word 转 PDF 超时"); }
      reader.join(3000);
      Path converted = output.resolve(stripExtension(source.getFileName().toString()) + ".pdf");
      if (process.exitValue() != 0 || !Files.isRegularFile(converted)) throw new IllegalStateException("Word 转 PDF 失败：" + new String(log.toByteArray(), StandardCharsets.UTF_8));
      Files.move(converted, target, StandardCopyOption.REPLACE_EXISTING);
    } finally { deleteTree(output); deleteTree(profile); }
  }

  private String binary() {
    if (!configuredBinary.isEmpty()) return configuredBinary;
    List<String> candidates = Arrays.asList("/usr/local/bin/libreoffice", "/usr/bin/libreoffice", "/opt/libreoffice25.8/program/soffice", "libreoffice");
    for (String candidate : candidates) if (!candidate.startsWith("/") || Files.isExecutable(java.nio.file.Paths.get(candidate))) return candidate;
    return "libreoffice";
  }
  private String stripExtension(String name) { int dot = name.lastIndexOf('.'); return dot > 0 ? name.substring(0, dot) : name; }
  private void deleteTree(Path root) { if (root == null || !Files.exists(root)) return; try (java.util.stream.Stream<Path> paths = Files.walk(root)) { paths.sorted(java.util.Comparator.reverseOrder()).forEach(path -> { try { Files.deleteIfExists(path); } catch (Exception ignored) {} }); } catch (Exception ignored) {} }
}
