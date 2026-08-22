export const defaultSyncRoomId = 'classroom-001'

export function createSyncUri(roomId: string, role: 'teacher' | 'viewer') {
  const baseUrl = import.meta.env.VITE_TLDRAW_SYNC_URL ?? 'ws://127.0.0.1:8790/sync'
  const sessionId = getOrCreateSessionId(role)
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(roomId)}`)
  url.searchParams.set('role', role)
  url.searchParams.set('appSessionId', sessionId)
  const token=localStorage.getItem('teacher-agent.auth-session');if(token){try{const parsed=JSON.parse(token);if(parsed?.token)url.searchParams.set('accessToken',parsed.token)}catch{/* ignore invalid legacy session */}}
  return url.toString()
}

function getOrCreateSessionId(role: string) {
  const key = `whiteboard:${role}:sessionId`
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing

  const id = `${role}_${crypto.randomUUID()}`
  window.sessionStorage.setItem(key, id)
  return id
}
