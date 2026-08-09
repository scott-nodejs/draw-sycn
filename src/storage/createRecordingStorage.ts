import type { RecordingStorage } from './RecordingStorage'
import { createHttpRecordingStorage } from './httpRecordingStorage'
import { createLocalFileRecordingStorage } from './localFileRecordingStorage'
import { createQiniuRecordingStorage } from './qiniuRecordingStorage'

export function createRecordingStorage(): RecordingStorage {
  if (import.meta.env.VITE_RECORDING_STORAGE === 'qiniu') {
    return createQiniuRecordingStorage({
      baseUrl: import.meta.env.VITE_RECORDING_API_BASE_URL ?? 'http://127.0.0.1:8787/api',
    })
  }

  if (import.meta.env.VITE_RECORDING_STORAGE === 'http') {
    return createHttpRecordingStorage({
      baseUrl: import.meta.env.VITE_RECORDING_API_BASE_URL ?? 'http://127.0.0.1:8787/api',
    })
  }

  return createLocalFileRecordingStorage()
}
