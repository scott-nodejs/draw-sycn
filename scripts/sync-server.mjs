import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import Database from 'better-sqlite3'
import { InMemorySyncStorage, NodeSqliteWrapper, SQLiteSyncStorage, TLSocketRoom } from '@tldraw/sync-core'

const port = Number(process.env.SYNC_PORT ?? 8790)
const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const syncDataRoot = process.env.SYNC_DATA_ROOT ?? join(projectRoot, 'data', 'sync')
const syncStorageMode = process.env.SYNC_STORAGE ?? 'sqlite'
const rooms = new Map()
const pendingSaves = new Map()

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

  if (url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ status: 'ok', rooms: rooms.size }))
    return
  }

  response.writeHead(404, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ message: 'Not found' }))
})

const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
  const match = url.pathname.match(/^\/sync\/([^/]+)$/)

  if (!match) {
    socket.destroy()
    return
  }

  const roomId = decodeURIComponent(match[1])
  const role = url.searchParams.get('role') ?? 'viewer'
  const sessionId = url.searchParams.get('sessionId') ?? randomUUID()
  const isReadonly = role !== 'teacher' && role !== 'assistant'

  wss.handleUpgrade(request, socket, head, (ws) => {
    const room = getRoom(roomId)
    room.handleSocketConnect({
      sessionId,
      socket: ws,
      isReadonly,
    })
  })
})

server.listen(port, '127.0.0.1', () => {
  console.log(`tldraw sync server listening on ws://127.0.0.1:${port}/sync/{roomId}`)
  console.log(`sync snapshots stored in ${syncDataRoot}`)
  console.log(`sync storage mode: ${syncStorageMode}`)
})

async function persistRoomSnapshot(roomId, storage) {
  const path = getRoomSnapshotPath(roomId)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(storage.getSnapshot(), null, 2)}\n`)
}

function loadRoomSnapshot(roomId) {
  try {
    const text = readFileSync(getRoomSnapshotPath(roomId), 'utf8')
    return JSON.parse(text)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

function schedulePersistRoomSnapshot(roomId, storage) {
  const existing = pendingSaves.get(roomId)
  if (existing) {
    clearTimeout(existing)
  }

  const timer = setTimeout(() => {
    pendingSaves.delete(roomId)
    persistRoomSnapshot(roomId, storage).catch((error) => {
      console.error(`[sync:${roomId}] failed to persist snapshot`, error)
    })
  }, Number(process.env.SYNC_SAVE_DEBOUNCE_MS ?? 500))

  pendingSaves.set(roomId, timer)
}

function getRoomSnapshotPath(roomId) {
  const safeRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(syncDataRoot, `${safeRoomId}.json`)
}

function getRoomSqlitePath(roomId) {
  const safeRoomId = roomId.replace(/[^a-zA-Z0-9_-]/g, '_')
  return join(syncDataRoot, `${safeRoomId}.sqlite`)
}

function getRoom(roomId) {
  const existing = rooms.get(roomId)
  if (existing && !existing.isClosed()) {
    return existing
  }

  const storage = createRoomStorage(roomId)

  const room = new TLSocketRoom({
    storage,
    log: {
      warn: (...args) => console.warn(`[sync:${roomId}]`, ...args),
      error: (...args) => console.error(`[sync:${roomId}]`, ...args),
    },
    onSessionRemoved: (currentRoom, { numSessionsRemaining }) => {
      if (numSessionsRemaining === 0 && process.env.SYNC_CLOSE_EMPTY_ROOMS === 'true') {
        currentRoom.close()
        rooms.delete(roomId)
      }
    },
  })

  rooms.set(roomId, room)
  return room
}

function createRoomStorage(roomId) {
  if (syncStorageMode === 'json') {
    const loadedSnapshot = loadRoomSnapshot(roomId)
    const storage = new InMemorySyncStorage({
      snapshot: loadedSnapshot ?? undefined,
      onChange() {
        schedulePersistRoomSnapshot(roomId, storage)
      },
    })
    return storage
  }

  mkdirSyncCompat(syncDataRoot)
  const db = new Database(getRoomSqlitePath(roomId))
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  const sql = new NodeSqliteWrapper(db)
  return new SQLiteSyncStorage({ sql })
}

function mkdirSyncCompat(path) {
  try {
    // better-sqlite3 opens synchronously, so ensure the folder exists before opening.
    mkdirSync(path, { recursive: true })
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
  }
}

async function flushAndClose() {
  for (const [roomId, timer] of pendingSaves) {
    clearTimeout(timer)
    pendingSaves.delete(roomId)
  }

  await Promise.all(
    Array.from(rooms.entries()).map(async ([roomId, room]) => {
      if (syncStorageMode === 'json') {
        await persistRoomSnapshot(roomId, room.storage)
      }
      room.close()
    }),
  )

  process.exit(0)
}

process.on('SIGINT', () => {
  flushAndClose().catch((error) => {
    console.error(error)
    process.exit(1)
  })
})

process.on('SIGTERM', () => {
  flushAndClose().catch((error) => {
    console.error(error)
    process.exit(1)
  })
})
