# Whiteboard Recorder

A commercial-grade tldraw whiteboard recording foundation:

- Teacher recording
- Read-only live viewer
- Snapshot + event-log replay
- Chunked event protocol
- Pluggable local/HTTP storage
- Qiniu Cloud Kodo direct-upload adapter
- Local API for end-to-end development

## Run Locally

Install dependencies:

```bash
npm install
```

Local file mode:

```bash
npm run dev
```

Commercial closed-loop mode:

```bash
npm run dev:api
npm run dev:sync
```

In another terminal:

```bash
npm run dev:http
```

Open the frontend and use:

- `录制` for the teacher whiteboard
- `观看` for read-only live viewing
- `同步写` for the official `@tldraw/sync` teacher room
- `同步看` for the official `@tldraw/sync` read-only viewer room
- `回放` for recorded package playback

## Key Docs

- `docs/recording-protocol.md`
- `docs/backend-api.md`
- `docs/local-commercial-loop.md`
- `docs/production-roadmap.md`
- `docs/touchscreen-acceptance.md`
- `docs/tldraw-sync-architecture.md`
- `docs/mysql-mybatis-plus.md`

## Java Backend

The `server/` directory contains a Spring Boot 2.7 backend compatible with Java
8. It implements the same recording and live room API as the local Node server.

Build it:

```bash
cd server
mvn -q -s maven-central-settings.xml -DskipTests package
```

Run it:

```bash
cd server
mvn -q -s maven-central-settings.xml spring-boot:run
```

It listens on `http://127.0.0.1:8788`. Point the frontend at it with:

```bash
VITE_RECORDING_STORAGE=http VITE_RECORDING_API_BASE_URL=http://127.0.0.1:8788/api npm run dev
```

The Java backend expects MySQL for metadata:

```bash
MYSQL_URL=jdbc:mysql://127.0.0.1:3306/whiteboard?useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai
MYSQL_USERNAME=root
MYSQL_PASSWORD=...
```

Create tables with:

```sql
source server/src/main/resources/schema.sql;
```

Qiniu Kodo direct upload needs these backend environment variables:

```bash
QINIU_ACCESS_KEY=...
QINIU_SECRET_KEY=...
QINIU_BUCKET=...
QINIU_UPLOAD_URL=https://upload.qiniup.com
QINIU_PUBLIC_DOMAIN=https://your-domain.example.com
```

Then run the frontend with:

```bash
VITE_RECORDING_STORAGE=qiniu VITE_RECORDING_API_BASE_URL=http://127.0.0.1:8788/api npm run dev
```

The local tldraw sync server persists room snapshots under `data/sync/`.
