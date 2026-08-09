import type { Editor } from 'tldraw'
import type { RecordedStoreEvent, RecordingPackage } from '../types'
import { flattenRecordingEvents } from '../recording/chunks'

export function loadRecordingBaseline(editor: Editor, recording: RecordingPackage) {
  editor.loadSnapshot(recording.baselineSnapshot)
}

export function applyRecordedEvent(editor: Editor, event: RecordedStoreEvent) {
  editor.store.mergeRemoteChanges(() => {
    editor.store.applyDiff(event.changes as Parameters<typeof editor.store.applyDiff>[0])
  })
}

export function seekRecording(editor: Editor, recording: RecordingPackage, targetTime: number) {
  const events = flattenRecordingEvents(recording)
  const keyframe = findNearestKeyframe(recording, targetTime)
  const startSeq = keyframe?.seq ?? 0

  if (keyframe) {
    editor.loadSnapshot(keyframe.snapshot)
  } else {
    loadRecordingBaseline(editor, recording)
  }

  let cursor = events.findIndex((event) => event.seq > startSeq)
  if (cursor < 0) cursor = events.length

  while (cursor < events.length && events[cursor].timestamp <= targetTime) {
    applyRecordedEvent(editor, events[cursor])
    cursor += 1
  }

  return {
    cursor,
    time: Math.min(targetTime, recording.duration),
    keyframeIndex: keyframe?.index ?? 0,
  }
}

function findNearestKeyframe(recording: RecordingPackage, targetTime: number) {
  const keyframes = recording.keyframes ?? []
  let nearest = null

  for (const keyframe of keyframes) {
    if (keyframe.timestamp <= targetTime) {
      nearest = keyframe
      continue
    }
    break
  }

  return nearest
}
