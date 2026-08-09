import type { Editor, StoreListenerFilters, TLStoreSnapshot } from 'tldraw'
import type { RecordedStoreEvent, RecordingKeyframe, RecordingPackage } from './types'
import { attachEventChunks } from './recording/chunks'

type RecorderState = {
  startedAt: number
  baselineSnapshot: TLStoreSnapshot
  events: RecordedStoreEvent[]
  keyframes: RecordingKeyframe[]
  lastKeyframeAt: number
  unlisten: () => void
}

type StartRecordingOptions = {
  onEvent?: (event: RecordedStoreEvent) => void
  keyframeIntervalMs?: number
}

const defaultKeyframeIntervalMs = 5 * 60 * 1000

export function createSessionId() {
  return `lesson_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`
}

export function startRecording(editor: Editor, options: StartRecordingOptions = {}): RecorderState {
  const startedAt = performance.now()
  const baselineSnapshot = editor.store.getStoreSnapshot('document') as TLStoreSnapshot
  const keyframeIntervalMs = options.keyframeIntervalMs ?? defaultKeyframeIntervalMs
  const filters: Partial<StoreListenerFilters> = {
    source: 'user',
    scope: 'document',
  }
  const events: RecordedStoreEvent[] = []
  const keyframes: RecordingKeyframe[] = []
  let lastKeyframeAt = 0
  const unlisten = editor.store.listen((entry) => {
    const timestamp = Math.round(performance.now() - startedAt)
    const event = {
      seq: events.length + 1,
      timestamp,
      changes: entry.changes as RecordedStoreEvent['changes'],
    }
    events.push(event)

    if (timestamp - lastKeyframeAt >= keyframeIntervalMs) {
      lastKeyframeAt = timestamp
      keyframes.push(createKeyframe(editor, keyframes.length + 1, timestamp, event.seq))
    }

    options.onEvent?.(event)
  }, filters)

  return { startedAt, baselineSnapshot, events, keyframes, lastKeyframeAt, unlisten }
}

export function stopRecording(
  _editor: Editor,
  state: RecorderState,
  title: string,
  sessionId = createSessionId(),
): RecordingPackage {
  state.unlisten()

  const duration = Math.round(performance.now() - state.startedAt)
  const lastEvent = state.events.at(-1)
  const finalKeyframes =
    lastEvent && state.keyframes.at(-1)?.seq !== lastEvent.seq
      ? [...state.keyframes, createKeyframe(_editor, state.keyframes.length + 1, duration, lastEvent.seq)]
      : state.keyframes

  return attachEventChunks({
    version: 1,
    protocol: 'tldraw-store-diff',
    sessionId,
    title,
    createdAt: new Date().toISOString(),
    duration,
    eventCount: state.events.length,
    baselineSnapshot: state.baselineSnapshot,
    events: state.events,
    keyframes: finalKeyframes,
  })
}

function createKeyframe(editor: Editor, index: number, timestamp: number, seq: number): RecordingKeyframe {
  return {
    index,
    timestamp,
    seq,
    snapshot: editor.store.getStoreSnapshot('document') as TLStoreSnapshot,
  }
}
