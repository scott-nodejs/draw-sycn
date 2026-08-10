import type {
  RecordingPackage,
  RecordingSaveResult,
  RecordingUploadCompleteRequest,
  RecordingUploadInitRequest,
  RecordingUploadInitResponse,
} from '../types'
import { createUploadPlan } from './uploadPlan'
import type { RecordingStorage } from './RecordingStorage'

type QiniuRecordingStorageOptions = {
  baseUrl: string
}

export function createQiniuRecordingStorage(options: QiniuRecordingStorageOptions): RecordingStorage {
  return {
    async save(recording, audioBlob) {
      const uploadPlan = createUploadPlan(recording, audioBlob)
      const initRequest: RecordingUploadInitRequest = {
        sessionId: recording.sessionId,
        title: recording.title,
        duration: recording.duration,
        eventCount: recording.eventCount,
        chunkCount: recording.eventManifest?.chunkCount ?? 0,
        parts: uploadPlan.parts.map((part) => ({
          id: part.id,
          type: part.type,
          sizeBytes: part.sizeBytes,
          chunkIndex: part.chunkIndex,
          mimeType: part.mimeType,
        })),
      }

      const initResponse = await postJson<RecordingUploadInitResponse>(
        `${options.baseUrl}/whiteboard/recordings/qiniu/init`,
        initRequest,
      )

      const payloads = createPartPayloads(recording, audioBlob)
      for (const part of initResponse.parts) {
        const payload = payloads.get(part.id)
        if (!payload) {
          throw new Error(`Missing upload payload for part ${part.id}`)
        }

        await uploadToQiniu(part.uploadUrl, part.uploadToken, part.objectKey, payload)
      }

      const completeRequest: RecordingUploadCompleteRequest = {
        sessionId: recording.sessionId,
        uploadId: initResponse.uploadId,
        title: recording.title,
        duration: recording.duration,
        eventCount: recording.eventCount,
        chunkCount: recording.eventManifest?.chunkCount ?? 0,
        audioMimeType: recording.audio?.mimeType,
        audioDurationMs: recording.audio?.durationMs,
        audioStartOffsetMs: recording.audio?.startOffsetMs,
        parts: initResponse.parts.map((part) => ({
          id: part.id,
          objectKey: part.objectKey,
        })),
      }

      return postJson<RecordingSaveResult>(
        `${options.baseUrl}/whiteboard/recordings/${encodeURIComponent(recording.sessionId)}/qiniu/complete`,
        completeRequest,
      )
    },

    async load(source) {
      if (typeof source !== 'string') {
        throw new Error('Qiniu recording storage loads by session id or URL, not by File')
      }

      const response = await fetch(`${options.baseUrl}/whiteboard/recordings/${encodeURIComponent(source)}`)
      if (!response.ok) {
        throw new Error(`Failed to load recording: ${response.status}`)
      }

      return (await response.json()) as RecordingPackage
    },
  }
}

function createPartPayloads(recording: RecordingPackage, audioBlob?: Blob | null) {
  const payloads = new Map<string, unknown>()
  payloads.set('baseline-snapshot', recording.baselineSnapshot)
  payloads.set('event-manifest', recording.eventManifest ?? null)
  payloads.set('package', recording)
  if (audioBlob) payloads.set('teacher-audio', audioBlob)

  for (const chunk of recording.chunks ?? []) {
    payloads.set(`event-chunk-${chunk.index}`, chunk)
  }

  return payloads
}

async function uploadToQiniu(uploadUrl: string, token: string, key: string, payload: unknown) {
  const formData = new FormData()
  const blob = payload instanceof Blob ? payload : new Blob([JSON.stringify(payload)], { type: 'application/json' })
  formData.set('token', token)
  formData.set('key', key)
  formData.set('file', blob, key.split('/').pop() ?? 'part.json')

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Failed to upload ${key} to Qiniu: ${response.status}`)
  }
}

async function postJson<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return (await response.json()) as T
}
