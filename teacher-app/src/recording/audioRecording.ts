import type { RecordingAudioTrack } from '../types'

export type PreparedAudioRecorder = {
  start(masterStartedAt: number): ActiveAudioRecorder
  cancel(): void
}

export type ActiveAudioRecorder = {
  startedAt: number
  startOffsetMs: number
  mimeType: string
  stop(): Promise<{ blob: Blob; track: RecordingAudioTrack }>
}

const preferredMimeTypes = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
]

export async function prepareAudioRecorder(): Promise<PreparedAudioRecorder> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('当前浏览器不支持麦克风录制')
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    video: false,
  })
  const mimeType = preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
  const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 96_000 } : undefined)
  let consumed = false

  return {
    start(masterStartedAt) {
      if (consumed) throw new Error('录音器已经使用')
      consumed = true
      const chunks: Blob[] = []
      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      })
      const startedAt = performance.now()
      const startOffsetMs = Math.max(0, Math.round(startedAt - masterStartedAt))
      mediaRecorder.start(1_000)

      return {
        startedAt,
        startOffsetMs,
        mimeType: mediaRecorder.mimeType || mimeType || 'audio/webm',
        stop() {
          return new Promise((resolve, reject) => {
            const durationMs = Math.max(0, Math.round(performance.now() - startedAt))
            mediaRecorder.addEventListener('error', () => reject(new Error('麦克风录制失败')), { once: true })
            mediaRecorder.addEventListener('stop', () => {
              stopTracks(stream)
              const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm'
              const blob = new Blob(chunks, { type: actualMimeType })
              resolve({
                blob,
                track: {
                  version: 1,
                  mimeType: actualMimeType,
                  codec: actualMimeType.includes('opus') ? 'opus' : undefined,
                  durationMs,
                  startOffsetMs,
                  sizeBytes: blob.size,
                },
              })
            }, { once: true })
            if (mediaRecorder.state === 'inactive') {
              stopTracks(stream)
              reject(new Error('录音器未启动'))
              return
            }
            mediaRecorder.requestData()
            mediaRecorder.stop()
          })
        },
      }
    },
    cancel() {
      if (!consumed) stopTracks(stream)
      consumed = true
    },
  }
}

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop()
}
