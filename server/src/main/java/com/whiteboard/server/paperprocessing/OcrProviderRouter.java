package com.whiteboard.server.paperprocessing;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OcrProviderRouter {
  private final OcrProvider selected;
  private final List<OcrProvider> providers;

  public OcrProviderRouter(List<OcrProvider> providers, @Value("${OCR_PROVIDER:paddleocr}") String configured) {
    this.providers = providers;
    this.selected = providers.stream().filter(provider -> provider.name().equalsIgnoreCase(configured)).findFirst()
      .orElseThrow(() -> new IllegalStateException("Unsupported OCR_PROVIDER: " + configured));
  }

  public OcrProvider selected() { return selected; }
  public OcrProvider byName(String name) { return name == null || name.trim().isEmpty() ? selected : providers.stream().filter(provider -> provider.name().equalsIgnoreCase(name)).findFirst().orElse(selected); }
}
