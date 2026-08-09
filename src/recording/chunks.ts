import type {
  RecordedStoreEvent,
  RecordingEventChunk,
  RecordingEventManifest,
  RecordingPackage,
} from '../types'

export type ChunkingOptions = {
  maxEventsPerChunk: number
  maxDurationMs: number
  maxBytesPerChunk: number
}

export const defaultChunkingOptions: ChunkingOptions = {
  maxEventsPerChunk: 1000,
  maxDurationMs: 5000,
  maxBytesPerChunk: 1024 * 1024,
}

export function attachEventChunks(
  recording: RecordingPackage,
  options: ChunkingOptions = defaultChunkingOptions,
): RecordingPackage {
  const chunks = createEventChunks(recording.sessionId, recording.events, options)
  const eventManifest = createEventManifest(recording.sessionId, chunks)

  return {
    ...recording,
    chunks,
    eventManifest,
  }
}

export function createEventChunks(
  sessionId: string,
  events: RecordedStoreEvent[],
  options: ChunkingOptions = defaultChunkingOptions,
) {
  const chunks: RecordingEventChunk[] = []
  let bucket: RecordedStoreEvent[] = []
  let bucketStartTimestamp = 0
  let bucketBytes = 0

  for (const event of events) {
    if (bucket.length === 0) {
      bucketStartTimestamp = event.timestamp
      bucketBytes = 0
    }

    bucket.push(event)
    bucketBytes += estimateJsonByteSize(event)

    const duration = event.timestamp - bucketStartTimestamp
    if (
      bucket.length >= options.maxEventsPerChunk ||
      duration >= options.maxDurationMs ||
      bucketBytes >= options.maxBytesPerChunk
    ) {
      chunks.push(createChunk(sessionId, chunks.length + 1, bucket))
      bucket = []
      bucketBytes = 0
    }
  }

  if (bucket.length > 0) {
    chunks.push(createChunk(sessionId, chunks.length + 1, bucket))
  }

  return chunks
}

export function createEventManifest(sessionId: string, chunks: RecordingEventChunk[]): RecordingEventManifest {
  const pointers = chunks.map((chunk) => ({
    index: chunk.index,
    fileName: createChunkFileName(chunk.index),
    startSeq: chunk.startSeq,
    endSeq: chunk.endSeq,
    startTimestamp: chunk.startTimestamp,
    endTimestamp: chunk.endTimestamp,
    eventCount: chunk.events.length,
    byteSize: estimateJsonByteSize(chunk),
  }))

  return {
    version: 1,
    protocol: 'tldraw-store-diff-chunks',
    sessionId,
    chunkCount: chunks.length,
    eventCount: chunks.reduce((total, chunk) => total + chunk.events.length, 0),
    chunks: pointers,
  }
}

export function flattenRecordingEvents(recording: RecordingPackage) {
  if (recording.chunks?.length) {
    return recording.chunks.flatMap((chunk) => chunk.events)
  }

  return recording.events
}

export function createChunkFileName(index: number) {
  return `events-${String(index).padStart(6, '0')}.json`
}

function createChunk(sessionId: string, index: number, events: RecordedStoreEvent[]): RecordingEventChunk {
  const first = events[0]
  const last = events[events.length - 1]

  return {
    version: 1,
    protocol: 'tldraw-store-diff-chunk',
    sessionId,
    index,
    startSeq: first.seq,
    endSeq: last.seq,
    startTimestamp: first.timestamp,
    endTimestamp: last.timestamp,
    events,
  }
}

function estimateJsonByteSize(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}
