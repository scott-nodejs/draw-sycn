import type { RecordingPackage, RecordingSaveResult } from '../types'
import type { RecordingStorage } from './RecordingStorage'

export type SaveTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export type SaveTaskSnapshot = {
  id: string
  status: SaveTaskStatus
  startedAt?: string
  lastAttemptAt?: string
  finishedAt?: string
  error?: string
  retryCount: number
  result?: RecordingSaveResult
}

export function createSaveTask(recording: RecordingPackage): SaveTaskSnapshot {
  return {
    id: recording.sessionId,
    status: 'queued',
    retryCount: 0,
  }
}

export async function runSaveTask(
  storage: RecordingStorage,
  recording: RecordingPackage,
  onChange: (task: SaveTaskSnapshot) => void,
  previousTask?: SaveTaskSnapshot | null,
  audioBlob?: Blob | null,
) {
  const now = new Date().toISOString()
  const runningTask: SaveTaskSnapshot = {
    id: recording.sessionId,
    status: 'running',
    startedAt: previousTask?.startedAt ?? now,
    lastAttemptAt: now,
    retryCount: previousTask?.status === 'failed' ? previousTask.retryCount + 1 : previousTask?.retryCount ?? 0,
  }
  onChange(runningTask)

  try {
    const result = await storage.save(recording, audioBlob)
    const finishedTask: SaveTaskSnapshot = {
      ...runningTask,
      status: 'succeeded',
      finishedAt: new Date().toISOString(),
      result,
    }
    onChange(finishedTask)
    return finishedTask
  } catch (error) {
    const failedTask: SaveTaskSnapshot = {
      ...runningTask,
      status: 'failed',
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown save error',
    }
    onChange(failedTask)
    return failedTask
  }
}
