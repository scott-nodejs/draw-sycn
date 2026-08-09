# Touchscreen and Viewer Acceptance

This checklist is for classroom touch displays and read-only viewer screens.

## Teacher Touch Screen

Target environment:

- Windows 10/11
- Chrome or Edge
- Capacitive touch or active pen
- 1920x1080 minimum

Acceptance:

- Pen strokes appear immediately while writing.
- Start/stop/save controls are large enough for touch.
- Classroom mode hides browser-like product chrome inside the app.
- Recording timer remains visible in classroom mode.
- Save failure shows a retry path.
- Long recordings show chunk count and estimated upload size.

## Viewer Screen

Acceptance:

- Viewer opens in read-only mode.
- tldraw editing toolbar and menus are hidden.
- Viewer shows connection state: connecting, waiting, live, reconnecting.
- Viewer receives baseline when teacher starts.
- Viewer receives live event diffs after baseline.
- Viewer can enter classroom mode with only the board and status overlay.
- Reconnecting state appears when the stream is interrupted.

## Replay

Acceptance:

- Imported recording loads from baseline snapshot.
- Play/pause/step controls work.
- Timeline slider seeks to target time.
- Seek uses nearest keyframe and does not replay from 0 for long recordings.
- Keyframe metric updates after seeking.

## Known Pre-Production Items

- Camera-follow is not yet implemented.
- Asset upload and image rendering need a dedicated Kodo asset pipeline.
- True multi-room selection is still hardcoded to `classroom-001`.
- The current live path uses SSE; production may switch to WebSocket if latency
  or gateway scaling requires it.
