import type { RecordingPackage, RecordingSaveResult } from '../types'
import type { RecordingStorage } from './RecordingStorage'

export function createLocalFileRecordingStorage(): RecordingStorage {
  return {
    async save(recording) {
      downloadJson(recording, `${recording.sessionId}.json`)

      return {
        manifest: {
          sessionId: recording.sessionId,
          title: recording.title,
          createdAt: recording.createdAt,
          duration: recording.duration,
          eventCount: recording.eventCount,
          chunkCount: recording.eventManifest?.chunkCount ?? 0,
        },
        package: recording,
      }
    },

    async load(source) {
      if (typeof source !== 'string') {
        return readRecordingFile(source)
      }

      const response = await fetch(source)
      if (!response.ok) {
        throw new Error(`Failed to load recording package: ${response.status}`)
      }

      return (await response.json()) as RecordingPackage
    },
  }
}

function downloadJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

async function readRecordingFile(file: File) {
  const text = await file.text()
  const parsed = JSON.parse(text) as RecordingPackage
  validateRecordingPackage(parsed)
  return parsed
}

function validateRecordingPackage(recording: RecordingPackage) {
  if (recording.version !== 1 || recording.protocol !== 'tldraw-store-diff') {
    throw new Error('Unsupported recording package protocol')
  }

  if (!recording.baselineSnapshot || !Array.isArray(recording.events)) {
    throw new Error('Invalid recording package')
  }

  if (recording.chunks && recording.eventManifest?.chunkCount !== recording.chunks.length) {
    throw new Error('Recording chunk manifest does not match chunk payloads')
  }
}
