# Local Commercial Loop

This repository now has a local closed loop for the commercial whiteboard flow:

```text
Teacher tldraw
  -> record baseline snapshot
  -> stream event diffs to API room or official tldraw sync room
  -> chunk event log
  -> save recording package through RecordingStorage

API
  -> live SSE viewer room
  -> metadata db.json
  -> object-style storage folder

Viewer
  -> subscribe to SSE stream or connect to @tldraw/sync room
  -> load baseline
  -> apply event diffs read-only

Player
  -> import/load recording package
  -> replay event diffs by timestamp
```

## Run

Terminal 1:

```bash
npm run dev:api
npm run dev:sync
```

Terminal 2:

```bash
npm run dev:http
```

Open the frontend, use `录制` on one browser tab, and `观看` on another tab.
The default live room is `classroom-001`.

For the official tldraw sync path, use `同步写` on the teacher tab and `同步看`
on viewer tabs. This connects to `ws://127.0.0.1:8790/sync/classroom-001`.

Sync room snapshots are persisted locally under:

```text
data/sync/
```

The folder is ignored by git.

## Storage Modes

Local JSON download:

```bash
npm run dev
```

HTTP API storage:

```bash
VITE_RECORDING_STORAGE=http npm run dev
```

The local API currently stores files under `data/`, which is ignored by git.
