import type { TLAssetStore } from 'tldraw'

export const syncAssetStore: TLAssetStore = {
  async upload(asset) { return { src: asset.props.src ?? '' } },
  resolve(asset) { return asset.props.src },
}

export function createViewerSyncUri(roomId: string) {
  const configured = import.meta.env.VITE_SYNC_SERVER_URL || 'ws://127.0.0.1:8790'
  const base = configured.replace(/\/$/, '').endsWith('/sync') ? configured.replace(/\/$/, '') : `${configured.replace(/\/$/, '')}/sync`
  const key = 'zhiwen.student.sync-session'
  let sessionId = sessionStorage.getItem(key)
  if (!sessionId) { sessionId = `student_${crypto.randomUUID()}`; sessionStorage.setItem(key, sessionId) }
  const url = new URL(`${base}/${encodeURIComponent(roomId)}`)
  url.searchParams.set('role', 'viewer')
  url.searchParams.set('appSessionId', sessionId)
  return url.toString()
}
