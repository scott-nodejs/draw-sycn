import type { TLStoreSnapshot } from 'tldraw'

export type RecordedStoreEvent = {
  seq: number
  timestamp: number
  changes: {
    added: Record<string, unknown>
    updated: Record<string, [unknown, unknown]>
    removed: Record<string, unknown>
  }
}

export type RecordingPackage = {
  version: 1
  protocol: 'tldraw-store-diff'
  sessionId: string
  title: string
  createdAt: string
  duration: number
  eventCount: number
  baselineSnapshot: TLStoreSnapshot
  events: RecordedStoreEvent[]
  eventManifest?: RecordingEventManifest
  chunks?: RecordingEventChunk[]
  keyframes?: RecordingKeyframe[]
  audio?: RecordingAudioTrack
  paperId?: string
  questionIds?: string[]
  questionSegments?: RecordingQuestionSegment[]
}

export type RecordingQuestionSegment = {
  questionId: string
  questionNumber: number
  startMs: number
  endMs: number
}

export type RecordingAudioTrack = {
  version: 1
  mimeType: string
  codec?: string
  durationMs: number
  startOffsetMs: number
  sizeBytes: number
  objectKey?: string
  url?: string
}

export type RecordingManifest = {
  sessionId: string
  title: string
  createdAt: string
  duration: number
  eventCount: number
  baselineSnapshotUrl?: string
  eventManifestUrl?: string
  chunkCount?: number
  audioUrl?: string
  audioMimeType?: string
  audioDurationMs?: number
  audioStartOffsetMs?: number
}

export type RecordingSaveResult = {
  manifest: RecordingManifest
  package?: RecordingPackage
}

export type RecordingUploadInitRequest = {
  sessionId: string
  title: string
  duration: number
  eventCount: number
  chunkCount: number
  parts: Array<{
    id: string
    type: string
    sizeBytes: number
    chunkIndex?: number
    mimeType?: string
  }>
}

export type RecordingUploadInitResponse = {
  sessionId: string
  uploadId: string
  parts: Array<{
    id: string
    uploadUrl: string
    objectKey: string
    method: 'POST'
    uploadToken: string
  }>
}

export type RecordingUploadCompleteRequest = {
  sessionId: string
  uploadId: string
  title: string
  duration: number
  eventCount: number
  chunkCount: number
  audioMimeType?: string
  audioDurationMs?: number
  audioStartOffsetMs?: number
  paperId?: string
  questionIds?: string[]
  questionSegments?: RecordingQuestionSegment[]
  parts: Array<{
    id: string
    objectKey: string
  }>
}

export type RecordingSessionSummary = {
  sessionId: string
  lessonId?: string
  teacherId?: string
  roomId?: string
  title: string
  storageProvider: string
  baselineSnapshotUrl: string
  eventManifestUrl: string
  durationMs: number
  eventCount: number
  chunkCount: number
  status: number
  createdAt: string
  updatedAt: string
}

export type RecordingKeyframe = {
  index: number
  timestamp: number
  seq: number
  snapshot: TLStoreSnapshot
}

export type RecordingChunkPointer = {
  index: number
  fileName: string
  startSeq: number
  endSeq: number
  startTimestamp: number
  endTimestamp: number
  eventCount: number
  byteSize: number
}

export type RecordingEventManifest = {
  version: 1
  protocol: 'tldraw-store-diff-chunks'
  sessionId: string
  chunkCount: number
  eventCount: number
  chunks: RecordingChunkPointer[]
}

export type RecordingEventChunk = {
  version: 1
  protocol: 'tldraw-store-diff-chunk'
  sessionId: string
  index: number
  startSeq: number
  endSeq: number
  startTimestamp: number
  endTimestamp: number
  events: RecordedStoreEvent[]
}
