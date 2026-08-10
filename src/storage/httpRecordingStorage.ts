import type { RecordingPackage, RecordingSaveResult } from '../types'
import type { RecordingStorage } from './RecordingStorage'

type HttpRecordingStorageOptions = {
  baseUrl: string
  getAccessToken?: () => Promise<string | null> | string | null
}

export function createHttpRecordingStorage(options: HttpRecordingStorageOptions): RecordingStorage {
  return {
    async save(recording, audioBlob) {
      const headers = await createHeaders(options)
      let recordingToSave = recording
      if (audioBlob && recording.audio) {
        const audioForm = new FormData()
        audioForm.set('file', audioBlob, `teacher-audio.${audioExtension(recording.audio.mimeType)}`)
        audioForm.set('mimeType', recording.audio.mimeType)
        audioForm.set('durationMs', String(recording.audio.durationMs))
        audioForm.set('startOffsetMs', String(recording.audio.startOffsetMs))
        const audioHeaders = { ...headers }
        delete audioHeaders['Content-Type']
        const audioResponse = await fetch(`${options.baseUrl}/whiteboard/recordings/${encodeURIComponent(recording.sessionId)}/audio`, {
          method: 'POST', headers: audioHeaders, body: audioForm,
        })
        if (!audioResponse.ok) throw new Error(`Failed to upload recording audio: ${audioResponse.status}`)
        const uploaded = await audioResponse.json() as { audioUrl: string; objectKey: string }
        const audioUrl = uploaded.audioUrl.startsWith('http') ? uploaded.audioUrl : new URL(uploaded.audioUrl, options.baseUrl).toString()
        recordingToSave = { ...recording, audio: { ...recording.audio, url: audioUrl, objectKey: uploaded.objectKey } }
      }
      const response = await fetch(`${options.baseUrl}/whiteboard/recordings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(recordingToSave),
      })

      if (!response.ok) {
        throw new Error(`Failed to save recording: ${response.status}`)
      }

      return (await response.json()) as RecordingSaveResult
    },

    async load(source) {
      if (typeof source !== 'string') {
        throw new Error('HTTP recording storage loads by session id or URL, not by File')
      }

      const headers = await createHeaders(options)
      const endpoint = source.startsWith('http') ? source : `${options.baseUrl}/whiteboard/recordings/${source}`
      const response = await fetch(endpoint, { headers })

      if (!response.ok) {
        throw new Error(`Failed to load recording: ${response.status}`)
      }

      return (await response.json()) as RecordingPackage
    },
  }
}

function audioExtension(mimeType: string) {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4')) return 'm4a'
  return 'webm'
}

async function createHeaders(options: HttpRecordingStorageOptions) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const token = await options.getAccessToken?.()

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}
