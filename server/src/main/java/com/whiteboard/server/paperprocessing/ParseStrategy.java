package com.whiteboard.server.paperprocessing;

public enum ParseStrategy {
  NATIVE,
  NATIVE_WITH_FORMULA_OCR,
  NATIVE_WITH_REGION_OCR,
  FULL_OCR,
  IMAGE_REPAIR_THEN_OCR
}
