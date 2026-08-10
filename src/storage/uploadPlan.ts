import type { RecordingPackage } from '../types'

export type UploadPartType = 'baseline' | 'event-manifest' | 'event-chunk' | 'package' | 'audio'
export type UploadPartStatus = 'pending' | 'uploading' | 'uploaded' | 'failed'

export type UploadPart = {
  id: string
  type: UploadPartType
  status: UploadPartStatus
  sizeBytes: number
  chunkIndex?: number
  error?: string
  mimeType?: string
}

export type UploadPlan = {
  sessionId: string
  parts: UploadPart[]
}

export function createUploadPlan(recording: RecordingPackage, audioBlob?: Blob | null): UploadPlan {
  const parts: UploadPart[] = [
    {
      id: 'baseline-snapshot',
      type: 'baseline',
      status: 'pending',
      sizeBytes: jsonByteSize(recording.baselineSnapshot),
    },
    {
      id: 'event-manifest',
      type: 'event-manifest',
      status: 'pending',
      sizeBytes: jsonByteSize(recording.eventManifest ?? null),
    },
  ]

  if (recording.audio && audioBlob) {
    parts.push({
      id: 'teacher-audio',
      type: 'audio',
      status: 'pending',
      sizeBytes: audioBlob.size,
      mimeType: recording.audio.mimeType,
    })
  }

  for (const chunk of recording.chunks ?? []) {
    parts.push({
      id: `event-chunk-${chunk.index}`,
      type: 'event-chunk',
      status: 'pending',
      sizeBytes: jsonByteSize(chunk),
      chunkIndex: chunk.index,
    })
  }

  parts.push({
    id: 'package',
    type: 'package',
    status: 'pending',
    sizeBytes: jsonByteSize(recording),
  })

  return {
    sessionId: recording.sessionId,
    parts,
  }
}

export function summarizeUploadPlan(plan: UploadPlan | null) {
  if (!plan) {
    return {
      totalParts: 0,
      totalBytes: 0,
    }
  }

  return {
    totalParts: plan.parts.length,
    totalBytes: plan.parts.reduce((total, part) => total + part.sizeBytes, 0),
  }
}

function jsonByteSize(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}
