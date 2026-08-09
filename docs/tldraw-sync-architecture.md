# tldraw Sync Architecture

The project now has an official tldraw sync path in addition to the earlier SSE
proof-of-concept stream.

## Local Flow

```text
Teacher
  Tldraw store={useSync(...role=teacher)}
        |
        v
scripts/sync-server.mjs
  TLSocketRoom(roomId)
        |
        +--> Viewer role=viewer readonly
        +--> Viewer role=viewer readonly
```

Teacher recording remains independent:

```text
tldraw synced store
       |
       +--> @tldraw/sync websocket
       |
       +--> recorder store.listen(source=user, scope=document)
```

## Run

```bash
npm run dev:sync
npm run dev
```

Open:

- `同步写` for teacher
- `同步看` for viewer

## Local Persistence

`scripts/sync-server.mjs` persists each room snapshot to:

```text
data/sync/{roomId}.json
```

On the first connection for a room, the server loads the saved snapshot into
`InMemorySyncStorage`. On each room change, it debounces and writes the latest
sync snapshot back to disk.

This is not the final production database layer, but it proves the required
boundary:

```text
TLSocketRoom
  -> SyncStorage snapshot
  -> persistent storage
  -> restore after restart
```

## Production Notes

- `scripts/sync-server.mjs` currently uses `InMemorySyncStorage` plus local
  snapshot persistence.
- Production should use SQLite sync storage or a custom sync storage layer with
  database locking/ownership for each room. MySQL is used for business metadata,
  not as a per-stroke realtime sync database.
- A room must have one authoritative server instance. For multiple gateways,
  route the same `roomId` to the same authority or add a room coordinator.
- Viewer clients connect as `role=viewer`, so the server calls
  `handleSocketConnect({ isReadonly: true })`.
- Teacher and assistant roles are the only write-capable roles.
- Assets still need a Qiniu Kodo asset pipeline.
