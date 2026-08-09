# MySQL and MyBatis-Plus

The Java backend uses MySQL + MyBatis-Plus for business metadata.

It does not store every tldraw stroke in MySQL. Large payloads stay in:

- Qiniu Cloud Kodo for recording snapshots/chunks/assets
- tldraw sync storage for live room authoritative document state

MySQL stores searchable and transactional metadata.

## Environment

```bash
MYSQL_URL=jdbc:mysql://127.0.0.1:3306/whiteboard?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai
MYSQL_USERNAME=root
MYSQL_PASSWORD=...
```

## Schema

Run:

```sql
source server/src/main/resources/schema.sql;
```

Current table:

```text
whiteboard_recording_session
```

Important fields:

- `session_id`
- `lesson_id`
- `teacher_id`
- `room_id`
- `storage_provider`
- `baseline_snapshot_url`
- `event_manifest_url`
- `duration_ms`
- `event_count`
- `chunk_count`
- `status`

## MyBatis-Plus Classes

- `RecordingSessionEntity`
- `RecordingSessionMapper`
- `RecordingService.upsertRecordingSession`

## Runtime Boundary

```text
Recording save
  -> package/chunks written to local or Qiniu
  -> manifest written to MySQL

Replay list/search
  -> query MySQL
  -> fetch manifest/snapshot/chunks by URL

Live sync
  -> tldraw sync storage
  -> MySQL only stores room/session metadata
```
