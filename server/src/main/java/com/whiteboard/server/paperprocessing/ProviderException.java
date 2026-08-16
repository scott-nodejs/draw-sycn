package com.whiteboard.server.paperprocessing;

public class ProviderException extends RuntimeException {
  private final String code;
  public ProviderException(String code, String message) { super(message); this.code = code; }
  public String getCode() { return code; }
}
