const BASE = import.meta.env.VITE_TEACHER_AGENT_API_BASE_URL || 'http://127.0.0.1:8791/api/teacher-agent'
const WS_BASE = import.meta.env.VITE_TEACHER_AGENT_WS_URL || 'ws://127.0.0.1:8791/ws/teaching'

export type CanvasAction = { type: string; payload: Record<string, unknown> }
export type TeachingStep = { id: number; goal: string; say: string; pauseAfterMs: number; actions: CanvasAction[] }
export type GeometryConstraint = { type: string; point?: string; center?: string; segments?: string[]; lines?: string[]; points?: string[] }
export type GeometryAnnotation = { type: string; vertex?: string; value?: string; label?: string }
export type FigureSpec = { type: string; apex?: string; points: string[]; constraints?: GeometryConstraint[]; annotations?: GeometryAnnotation[] }
export type TeachingPlan = { strategy: string; sceneType: string; figure?: FigureSpec; steps: TeachingStep[] }
export type PlanBundle = {
  id: string
  problem: string
  studentLevel: string
  solutionPlan: { givens: string[]; target: string; coreTheorems: string[]; derivation: string[]; answer: string; verification: string }
  teachingPlan: TeachingPlan
}
export type TeachingSession = {
  id: string; planId: string; roomId: string; currentStepIndex: number
  eventSequence: number; status: 'READY'|'RUNNING'|'PAUSED'|'COMPLETED'|'STOPPED'|'FAILED'; error?: string
}
export type TeachingEvent = {
  sequence?: number; type: 'SOCKET_CONNECTED'|'SESSION_STATUS'|'STEP_STARTED'|'STEP_COMPLETED'|'SPEECH'|'CANVAS_ACTION'
  sessionId: string; roomId?: string; payload?: Record<string, unknown>
}

async function call<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init.headers } })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.message || `Teacher Agent 请求失败 (${response.status})`)
  return payload as T
}

export const teacherAgentApi = {
  createPlan: (problem: string, studentLevel = 'NORMAL') => call<PlanBundle>('/plans', { method: 'POST', body: JSON.stringify({ problem, studentLevel }) }),
  createSession: (planId: string, roomId: string) => call<TeachingSession>('/sessions', { method: 'POST', body: JSON.stringify({ planId, roomId, autoStart: false }) }),
  session: (id: string) => call<TeachingSession>(`/sessions/${encodeURIComponent(id)}`),
  command: (id: string, command: 'start'|'pause'|'resume'|'next'|'stop') => call<TeachingSession>(`/sessions/${encodeURIComponent(id)}/${command}`, { method: 'POST' }),
}

export function connectTeacherAgent(sessionId: string, onEvent: (event: TeachingEvent) => void) {
  const socket = new WebSocket(`${WS_BASE.replace(/\/$/, '')}/${encodeURIComponent(sessionId)}`)
  socket.onmessage = message => { try { onEvent(JSON.parse(message.data) as TeachingEvent) } catch { /* malformed frame */ } }
  return { socket, close: () => socket.close() }
}
