# Whiteboard Backend API Draft

This is the first backend contract for replacing local JSON downloads with a
Java/SpringBoot service plus MySQL and Qiniu Cloud Kodo.

## Save Recording

```http
POST /api/whiteboard/recordings
Content-Type: application/json
Authorization: Bearer {token}
```

Request body is a `RecordingPackage`:

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
  "events": []
}
```

Response:

```json
{
  "manifest": {
    "sessionId": "lesson_20260808165001",
    "title": "课堂白板录制",
    "createdAt": "2026-08-08T08:50:01.000Z",
    "duration": 2721000,
    "eventCount": 18342,
    "baselineSnapshotUrl": "qiniu://bucket/whiteboard/lesson_20260808165001/baseline-snapshot.json",
    "eventManifestUrl": "qiniu://bucket/whiteboard/lesson_20260808165001/event-manifest.json"
  }
}
```

First production implementation can accept the full package in one request.
The next step should switch to Qiniu direct uploads for large classes.

## Load Recording

```http
GET /api/whiteboard/recordings/{sessionId}
Authorization: Bearer {token}
```

Response body is a `RecordingPackage`. The backend may assemble it from Kodo
snapshot and event chunk files.

## Future Large-File Flow

For 45 minute classes, avoid sending one huge JSON payload through SpringBoot.

```text
POST /api/whiteboard/recordings/qiniu/init
  -> returns sessionId, Qiniu object keys, upload URLs and upload tokens

POST baseline-snapshot.json to Qiniu upload URL with token/key/file
POST events-000001.json.gz to Qiniu upload URL with token/key/file
POST events-000002.json.gz to Qiniu upload URL with token/key/file

POST /api/whiteboard/recordings/{sessionId}/qiniu/complete
  -> validates Kodo objects and inserts MySQL metadata
```

The frontend `RecordingStorage` interface is designed so this flow can replace
the current local file adapter without changing the recorder or replay engine.

### Init Upload

```http
POST /api/whiteboard/recordings/qiniu/init
```

```json
{
  "sessionId": "lesson_20260808165001",
  "title": "课堂白板录制",
  "duration": 2721000,
  "eventCount": 18342,
  "chunkCount": 18,
  "parts": [
    { "id": "baseline-snapshot", "type": "baseline", "sizeBytes": 38211 },
    { "id": "event-manifest", "type": "event-manifest", "sizeBytes": 2048 },
    { "id": "event-chunk-1", "type": "event-chunk", "chunkIndex": 1, "sizeBytes": 73422 }
  ]
}
```

Response:

```json
{
  "sessionId": "lesson_20260808165001",
  "uploadId": "qiniu_lesson_20260808165001",
  "parts": [
    {
      "id": "baseline-snapshot",
      "uploadUrl": "https://upload.qiniup.com",
      "objectKey": "whiteboard/lesson_20260808165001/baseline-snapshot.json",
      "method": "POST",
      "uploadToken": "Qiniu upload token"
    }
  ]
}
```

### Complete Upload

```http
POST /api/whiteboard/recordings/{sessionId}/qiniu/complete
```

The backend verifies required Kodo objects, writes MySQL metadata, and returns
the same `RecordingManifest` used by the simple save endpoint.

The Java endpoint signs Qiniu upload tokens when `QINIU_ACCESS_KEY`,
`QINIU_SECRET_KEY`, and `QINIU_BUCKET` are set. Enable frontend direct upload
with `VITE_RECORDING_STORAGE=qiniu`.

## Local Closed-Loop API

The repository includes a lightweight Node API for local end-to-end testing:

```bash
npm run dev:api
```

It stores:

```text
data/db.json
data/storage/whiteboard/{sessionId}/
  baseline-snapshot.json
  event-manifest.json
  events-000001.json
  package.json
```

To make the frontend use this API instead of local JSON download:

```bash
VITE_RECORDING_STORAGE=http npm run dev
```

This API is intentionally shaped like the future Java/SpringBoot service, so it
can be replaced without changing recorder and player logic.

The `server/` directory now contains the Java/SpringBoot implementation of this
same API. It currently uses filesystem storage for the simple save path and
Qiniu upload-token signing for the direct-upload path. Replace metadata writes
with MySQL before production launch.

## Live Room API

Start or reset a live room baseline:

```http
POST /api/whiteboard/rooms/{roomId}/start
```

Publish a tldraw diff event:

```http
POST /api/whiteboard/rooms/{roomId}/events
```

Subscribe to one-way viewer stream:

```http
GET /api/whiteboard/rooms/{roomId}/stream
```

The local implementation uses Server-Sent Events. Production can keep this for
read-only viewing or replace it with WebSocket without changing the recording
event protocol.
