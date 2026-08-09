# Production Roadmap

The current repository is a working local closed loop. It is not yet a
production deployment. This roadmap keeps the commercial build honest.

## Phase 1: Recorder Core

Done:

- tldraw editor recording
- baseline snapshot at recording start
- document-scoped user diff events
- event chunk manifest
- replay engine
- local file storage adapter
- HTTP storage adapter boundary

## Phase 2: Backend MVP

Current local API:

- `POST /api/whiteboard/recordings`
- `GET /api/whiteboard/recordings/{sessionId}`
- `POST /api/whiteboard/rooms/{roomId}/start`
- `POST /api/whiteboard/rooms/{roomId}/events`
- `GET /api/whiteboard/rooms/{roomId}/stream`

Production Java/SpringBoot replacement:

- Authenticated teacher and viewer sessions
- MySQL table for recording metadata via MyBatis-Plus
- Qiniu Cloud Kodo object storage for snapshots and event chunks
- Qiniu upload-token direct upload for large chunk uploads
- Server-side validation of tldraw protocol version
- Idempotent recording save by `sessionId`

## Phase 3: Live Classroom

Current local live mode supports both SSE and official `@tldraw/sync`.
The commercial primary path should use `@tldraw/sync` for editor/viewer rooms,
with SSE kept as a simpler one-way broadcast fallback where useful.

Production options:

- Keep SSE for one-way Teacher -> Viewer broadcast
- Use WebSocket gateway for lower latency and bidirectional control messages
- Use `@tldraw/sync` for authoritative tldraw rooms
- Keep one room authoritative across the cluster; use sticky routing or a room
  coordinator before adding multiple sync server instances

For this product, keep viewers read-only by default. Teacher and assistant
roles should be the only write-capable clients.

## Phase 4: Reliability

Must-have before real classroom pilots:

- Upload retry queue
- Chunk checksums
- Recording resume after network failure
- Periodic keyframe snapshots for seek
- Viewer reconnection with latest baseline/keyframe
- Clock drift handling for replay
- Asset upload pipeline for images and files

## Phase 5: Security

Must-have before commercial launch:

- JWT or session auth
- Role-based access: teacher, assistant, viewer, admin
- Room join tokens
- Private Kodo buckets
- Signed download URLs for private Kodo objects
- Audit log for lesson access
- Rate limiting for live event publish endpoints

## Phase 6: Operations

Must-have before launch:

- API request logs
- Live room metrics
- Recording save failure alerts
- Object storage lifecycle policy
- Daily database backups
- Error reporting from frontend
- Browser/device compatibility matrix for touch screens
