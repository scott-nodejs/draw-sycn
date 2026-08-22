import type { RecordingSessionSummary } from '../types'

export async function listRecordings(limit = 20) {
  const baseUrl = import.meta.env.VITE_RECORDING_API_BASE_URL ?? 'http://127.0.0.1:8787/api'
  const response = await fetch(`${baseUrl}/whiteboard/recordings?limit=${limit}`)

  if (!response.ok) {
    throw new Error(`Failed to list recordings: ${response.status}`)
  }

  return (await response.json()) as RecordingSessionSummary[]
}
