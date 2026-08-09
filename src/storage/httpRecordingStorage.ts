import type { RecordingPackage, RecordingSaveResult } from '../types'
import type { RecordingStorage } from './RecordingStorage'

type HttpRecordingStorageOptions = {
  baseUrl: string
  getAccessToken?: () => Promise<string | null> | string | null
}

export function createHttpRecordingStorage(options: HttpRecordingStorageOptions): RecordingStorage {
  return {
    async save(recording) {
      const headers = await createHeaders(options)
      const response = await fetch(`${options.baseUrl}/whiteboard/recordings`, {
        method: 'POST',
        headers,
        body: JSON.stringify(recording),
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
