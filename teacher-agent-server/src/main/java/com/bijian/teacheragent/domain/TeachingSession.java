package com.bijian.teacheragent.domain;

import java.time.Instant;

public class TeachingSession {
  public enum Status { READY, RUNNING, PAUSED, COMPLETED, STOPPED, FAILED }
  public String id, planId, roomId, error; public int currentStepIndex; public long eventSequence;
  public Status status=Status.READY; public Instant createdAt=Instant.now(), updatedAt=Instant.now();
}
