# Whiteboard Recording Protocol

This project records tldraw as a baseline snapshot plus an ordered event stream.
The same event stream can later be written to Qiniu Cloud Kodo for replay or forwarded over
WebSocket for live viewer screens.

## Recording Package

```json
{
  "version": 1,
  "protocol": "tldraw-store-diff",
  "sessionId": "lesson_20260808165001",
  "title": "课堂白板录制",
  "createdAt": "2026-08-08T08:50:01.000Z",
  "duration": 2721000,
  "eventCount": 18342,
  "baselineSnapshot": {},
  "events": [],
  "eventManifest": {},
  "chunks": [],
  "keyframes": []
}
```

`baselineSnapshot` is captured when recording starts. Each event stores a
monotonic `seq`, a millisecond `timestamp` relative to the beginning of the
recording, and the tldraw store diff from `editor.store.listen`.

```json
{
  "seq": 128,
  "timestamp": 38762,
  "changes": {
    "added": {},
    "updated": {},
    "removed": {}
  }
}
```

## Production Storage

MySQL should store only searchable metadata and object references.

```text
t_whiteboard_session
id
lesson_id
teacher_id
title
baseline_snapshot_url
event_manifest_url
duration_ms
event_count
created_at
updated_at
```

Qiniu Cloud Kodo should store the large immutable payloads.

```text
whiteboard/{sessionId}/
  baseline-snapshot.json
  event-manifest.json
  events-000001.json.gz
  events-000002.json.gz
  assets/
```

Recommended chunking: flush an event file every 5 seconds, 1000 events, or 1 MB
of uncompressed JSON, whichever comes first. The current frontend already
creates chunk metadata with this policy.

## Replay

Replay loads `baselineSnapshot`, then applies events in timestamp order with
`editor.store.mergeRemoteChanges(() => editor.store.applyDiff(event.changes))`.

For seek support, add periodic keyframe snapshots:

```text
00:00 baseline snapshot
05:00 keyframe snapshot
10:00 keyframe snapshot
15:00 keyframe snapshot
```

Seeking to `37:43` should load the nearest previous keyframe, then apply only
the events between the keyframe and the target timestamp.

The current frontend records keyframes every 5 minutes and also writes a final
keyframe when recording stops.

## Backend Boundary

The frontend should eventually replace `downloadRecording` with a transport
that uploads:

1. baseline snapshot to Qiniu Kodo
2. event chunks to Qiniu Kodo
3. metadata and object URLs to Java/SpringBoot

The recorder protocol should stay stable even if storage changes from local
download to Qiniu direct upload.

See `docs/backend-api.md` for the first Java/SpringBoot API contract.
