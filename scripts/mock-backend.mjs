import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(root, '..')
const dataRoot = join(projectRoot, 'data')
const objectRoot = join(dataRoot, 'storage', 'whiteboard')
const dbPath = join(dataRoot, 'db.json')
const port = Number(process.env.PORT ?? 8787)
const rooms = new Map()

const server = createServer(async (request, response) => {
  try {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

    const audioMatch = url.pathname.match(/^\/api\/whiteboard\/recordings\/([^/]+)\/audio$/)
    if (request.method === 'POST' && audioMatch) {
      const sessionId = decodeURIComponent(audioMatch[1])
      const uploaded = await readMultipartFile(request)
      if (!uploaded.contentType.startsWith('audio/')) throw new Error('Expected an audio upload')
      const extension = uploaded.contentType.includes('ogg') ? 'ogg' : uploaded.contentType.includes('mp4') ? 'm4a' : 'webm'
      const sessionDir = join(objectRoot, sessionId)
      await mkdir(sessionDir, { recursive: true })
      const fileName = `teacher-audio.${extension}`
      await writeFile(join(sessionDir, fileName), uploaded.data)
      sendJson(response, 200, { objectKey: `${sessionId}/${fileName}`, audioUrl: `/api/whiteboard/recordings/${encodeURIComponent(sessionId)}/audio` })
      return
    }

    if (request.method === 'GET' && audioMatch) {
      const sessionId = decodeURIComponent(audioMatch[1])
      const audio = await findAudioFile(sessionId)
      if (!audio) { sendJson(response, 404, { message: 'Audio not found' }); return }
      response.writeHead(200, { 'Content-Type': audio.contentType, 'Accept-Ranges': 'bytes', 'Content-Length': audio.data.length })
      response.end(audio.data)
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/whiteboard/recordings') {
      const recording = await readJsonBody(request)
      validateRecording(recording)

      const manifest = await saveRecording(recording)
      sendJson(response, 200, { manifest, package: recording })
      return
    }

    const roomStartMatch = url.pathname.match(/^\/api\/whiteboard\/rooms\/([^/]+)\/start$/)
    if (request.method === 'POST' && roomStartMatch) {
      const roomId = decodeURIComponent(roomStartMatch[1])
      const body = await readJsonBody(request)
      const room = getRoom(roomId)
      room.baselineSnapshot = body.baselineSnapshot
      broadcastRoom(roomId, {
        type: 'baseline',
        roomId,
        baselineSnapshot: body.baselineSnapshot,
        timestamp: Date.now(),
      })
      sendJson(response, 200, { roomId, status: 'started' })
      return
    }

    const roomEventMatch = url.pathname.match(/^\/api\/whiteboard\/rooms\/([^/]+)\/events$/)
    if (request.method === 'POST' && roomEventMatch) {
      const roomId = decodeURIComponent(roomEventMatch[1])
      const body = await readJsonBody(request)
      broadcastRoom(roomId, {
        type: 'event',
        roomId,
        event: body.event,
        timestamp: Date.now(),
      })
      sendJson(response, 200, { roomId, status: 'published' })
      return
    }

    const roomSnapshotMatch = url.pathname.match(/^\/api\/whiteboard\/rooms\/([^/]+)\/snapshot$/)
    if (request.method === 'GET' && roomSnapshotMatch) {
      const roomId = decodeURIComponent(roomSnapshotMatch[1])
      const room = getRoom(roomId)

      if (!room.baselineSnapshot) {
        sendJson(response, 404, { message: 'Room has no active baseline' })
        return
      }

      sendJson(response, 200, { roomId, baselineSnapshot: room.baselineSnapshot })
      return
    }

    const roomStreamMatch = url.pathname.match(/^\/api\/whiteboard\/rooms\/([^/]+)\/stream$/)
    if (request.method === 'GET' && roomStreamMatch) {
      const roomId = decodeURIComponent(roomStreamMatch[1])
      const room = getRoom(roomId)
      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      })
      response.write('\n')
      room.clients.add(response)

      if (room.baselineSnapshot) {
        writeSse(response, {
          type: 'baseline',
          roomId,
          baselineSnapshot: room.baselineSnapshot,
          timestamp: Date.now(),
        })
      }

      request.on('close', () => {
        room.clients.delete(response)
      })
      return
    }

    const match = url.pathname.match(/^\/api\/whiteboard\/recordings\/([^/]+)$/)
    if (request.method === 'GET' && match) {
      const sessionId = decodeURIComponent(match[1])
      const recording = await loadRecording(sessionId)

      if (!recording) {
        sendJson(response, 404, { message: 'Recording not found' })
        return
      }

      sendJson(response, 200, recording)
      return
    }

    sendJson(response, 404, { message: 'Not found' })
  } catch (error) {
    sendJson(response, 500, {
      message: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Whiteboard API listening on http://127.0.0.1:${port}`)
})

async function saveRecording(recording) {
  const sessionDir = join(objectRoot, recording.sessionId)
  await mkdir(sessionDir, { recursive: true })

  await writeJson(join(sessionDir, 'baseline-snapshot.json'), recording.baselineSnapshot)
  await writeJson(join(sessionDir, 'event-manifest.json'), recording.eventManifest ?? null)

  if (Array.isArray(recording.chunks) && recording.chunks.length > 0) {
    for (const chunk of recording.chunks) {
      const filename = `events-${String(chunk.index).padStart(6, '0')}.json`
      await writeJson(join(sessionDir, filename), chunk)
    }
  } else {
    await writeJson(join(sessionDir, 'events-000001.json'), {
      version: 1,
      protocol: 'tldraw-store-diff-chunk',
      sessionId: recording.sessionId,
      index: 1,
      startSeq: recording.events[0]?.seq ?? 0,
      endSeq: recording.events.at(-1)?.seq ?? 0,
      startTimestamp: recording.events[0]?.timestamp ?? 0,
      endTimestamp: recording.events.at(-1)?.timestamp ?? 0,
      events: recording.events,
    })
  }

  await writeJson(join(sessionDir, 'package.json'), recording)

  const manifest = {
    sessionId: recording.sessionId,
    title: recording.title,
    createdAt: recording.createdAt,
    duration: recording.duration,
    eventCount: recording.eventCount,
    chunkCount: recording.eventManifest?.chunkCount ?? recording.chunks?.length ?? 1,
    baselineSnapshotUrl: `local://whiteboard/${recording.sessionId}/baseline-snapshot.json`,
    eventManifestUrl: `local://whiteboard/${recording.sessionId}/event-manifest.json`,
  }

  const db = await readDb()
  db.recordings[recording.sessionId] = manifest
  await writeJson(dbPath, db)

  return manifest
}

async function loadRecording(sessionId) {
  const packagePath = join(objectRoot, sessionId, 'package.json')

  try {
    return JSON.parse(await readFile(packagePath, 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function readDb() {
  try {
    return JSON.parse(await readFile(dbPath, 'utf8'))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
    return { recordings: {} }
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function readJsonBody(request) {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function readMultipartFile(request) {
  const contentType = request.headers['content-type'] ?? ''
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/)
  if (!boundaryMatch) throw new Error('Missing multipart boundary')
  const boundary = Buffer.from(`--${boundaryMatch[1] ?? boundaryMatch[2]}`)
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const body = Buffer.concat(chunks)
  const fileHeader = Buffer.from('name="file"')
  const fieldIndex = body.indexOf(fileHeader)
  if (fieldIndex < 0) throw new Error('Missing audio file field')
  const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), fieldIndex)
  if (headerEnd < 0) throw new Error('Invalid multipart file header')
  const nextBoundary = body.indexOf(boundary, headerEnd + 4)
  if (nextBoundary < 0) throw new Error('Invalid multipart file body')
  const header = body.subarray(fieldIndex, headerEnd).toString('utf8')
  const partType = header.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim() ?? 'application/octet-stream'
  return { contentType: partType, data: body.subarray(headerEnd + 4, Math.max(headerEnd + 4, nextBoundary - 2)) }
}

async function findAudioFile(sessionId) {
  for (const extension of ['webm', 'ogg', 'm4a']) {
    try {
      const data = await readFile(join(objectRoot, sessionId, `teacher-audio.${extension}`))
      const contentType = extension === 'ogg' ? 'audio/ogg' : extension === 'm4a' ? 'audio/mp4' : 'audio/webm'
      return { data, contentType }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
  return null
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      baselineSnapshot: null,
      clients: new Set(),
    })
  }

  return rooms.get(roomId)
}

function broadcastRoom(roomId, message) {
  const room = getRoom(roomId)
  for (const client of room.clients) {
    writeSse(client, message)
  }
}

function writeSse(response, message) {
  response.write(`data: ${JSON.stringify(message)}\n\n`)
}

function validateRecording(recording) {
  if (recording?.version !== 1 || recording?.protocol !== 'tldraw-store-diff') {
    throw new Error('Unsupported recording protocol')
  }

  if (!recording.sessionId || !recording.baselineSnapshot || !Array.isArray(recording.events)) {
    throw new Error('Invalid recording package')
  }
}
