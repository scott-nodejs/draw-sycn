import type { RecordingPackage, RecordingSaveResult } from '../types'

export type RecordingStorage = {
  save(recording: RecordingPackage): Promise<RecordingSaveResult>
  load(source: File | string): Promise<RecordingPackage>
}
