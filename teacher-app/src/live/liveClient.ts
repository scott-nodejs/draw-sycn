import type { TLStoreSnapshot } from 'tldraw'
import type { RecordedStoreEvent } from '../types'

export type LiveMessage =
  | {
      type: 'baseline'
      roomId: string
      baselineSnapshot: TLStoreSnapshot
      timestamp: number
    }
  | {
      type: 'event'
      roomId: string
      event: RecordedStoreEvent
      timestamp: number
    }

type LiveClientOptions = {
  baseUrl: string
}

type LiveSubscriptionOptions = {
  onOpen?: () => void
  onError?: () => void
}

export function createLiveClient(options: LiveClientOptions) {
  return {
    async startRoom(roomId: string, baselineSnapshot: TLStoreSnapshot) {
      const response = await fetch(`${options.baseUrl}/whiteboard/rooms/${encodeURIComponent(roomId)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baselineSnapshot }),
      })

      if (!response.ok) {
        throw new Error(`Failed to start live room: ${response.status}`)
      }
    },

    async publishEvent(roomId: string, event: RecordedStoreEvent) {
      const response = await fetch(`${options.baseUrl}/whiteboard/rooms/${encodeURIComponent(roomId)}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      })

      if (!response.ok) {
        throw new Error(`Failed to publish live event: ${response.status}`)
      }
    },

    subscribe(
      roomId: string,
      onMessage: (message: LiveMessage) => void,
      subscriptionOptions: LiveSubscriptionOptions = {},
    ) {
      const eventSource = new EventSource(
        `${options.baseUrl}/whiteboard/rooms/${encodeURIComponent(roomId)}/stream`,
      )

      eventSource.onopen = () => {
        subscriptionOptions.onOpen?.()
      }

      eventSource.onerror = () => {
        subscriptionOptions.onError?.()
      }

      eventSource.onmessage = (event) => {
        onMessage(JSON.parse(event.data) as LiveMessage)
      }

      return () => eventSource.close()
    },
  }
}

export function createDefaultLiveClient() {
  return createLiveClient({
    baseUrl: import.meta.env.VITE_RECORDING_API_BASE_URL ?? 'http://127.0.0.1:8787/api',
  })
}
