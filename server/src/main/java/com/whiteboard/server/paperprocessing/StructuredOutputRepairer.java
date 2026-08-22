package com.whiteboard.server.paperprocessing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class StructuredOutputRepairer {
  private final ObjectMapper json;

  public StructuredOutputRepairer(ObjectMapper json) { this.json = json; }

  public JsonNode parse(String value) {
    if (value == null || value.trim().isEmpty()) throw new ProviderException("DEEPSEEK_EMPTY_OUTPUT", "DeepSeek returned empty output");
    String candidate = unwrap(value.trim());
    try { return json.readTree(candidate); } catch (Exception ignored) { }
    try { return json.readTree(repairJsonString(candidate)); }
    catch (Exception error) { throw new ProviderException("DEEPSEEK_INVALID_JSON", "DeepSeek returned invalid JSON after automatic repair"); }
  }

  private String unwrap(String value) {
    if (value.startsWith("```")) {
      int newline = value.indexOf('\n');
      int end = value.lastIndexOf("```");
      if (newline >= 0 && end > newline) value = value.substring(newline + 1, end).trim();
    }
    int objectStart = value.indexOf('{'); int objectEnd = value.lastIndexOf('}');
    int arrayStart = value.indexOf('['); int arrayEnd = value.lastIndexOf(']');
    if (objectStart >= 0 && objectEnd > objectStart && (arrayStart < 0 || objectStart < arrayStart)) return value.substring(objectStart, objectEnd + 1);
    if (arrayStart >= 0 && arrayEnd > arrayStart) return value.substring(arrayStart, arrayEnd + 1);
    return value;
  }

  private String repairJsonString(String value) {
    StringBuilder out = new StringBuilder(value.length() + 32); boolean inString = false; boolean escaped = false;
    for (int i = 0; i < value.length(); i++) {
      char ch = value.charAt(i);
      if (!inString) { out.append(ch); if (ch == '"') inString = true; continue; }
      if (escaped) {
        if ("\"\\/bfnrtu".indexOf(ch) < 0) out.append('\\');
        out.append(ch); escaped = false; continue;
      }
      if (ch == '\\') { escaped = true; continue; }
      if (ch == '"') { inString = false; out.append(ch); continue; }
      if (ch == '\n') out.append("\\n"); else if (ch == '\r') out.append("\\r"); else if (ch == '\t') out.append("\\t");
      else if (ch < 0x20) out.append(' '); else out.append(ch);
    }
    if (escaped) out.append("\\\\");
    return out.toString();
  }
}
