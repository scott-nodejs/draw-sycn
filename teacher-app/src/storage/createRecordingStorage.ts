import type { RecordingStorage } from './RecordingStorage'
import { createHttpRecordingStorage } from './httpRecordingStorage'
import { createLocalFileRecordingStorage } from './localFileRecordingStorage'
import { createQiniuRecordingStorage } from './qiniuRecordingStorage'

export function createRecordingStorage(): RecordingStorage {
  const storageMode = import.meta.env.VITE_RECORDING_STORAGE ?? 'qiniu'
  const baseUrl =
    import.meta.env.VITE_RECORDING_API_BASE_URL ??
    import.meta.env.VITE_TEACHING_API_BASE_URL ??
    'http://127.0.0.1:8788/api'

  if (storageMode === 'qiniu') {
    return createQiniuRecordingStorage({
      baseUrl,
    })
  }

  if (storageMode === 'http') {
    return createHttpRecordingStorage({
      baseUrl,
    })
  }

  return createLocalFileRecordingStorage()
}
