export type UserRole = 'teacher' | 'student'
export type AuthUser = { id: string; mobile: string; email?: string; displayName: string; role: UserRole; status: string }
export type AuthSession = { token: string; expiresAt: string; user: AuthUser }

const storageKey = 'teacher-agent.auth-session'
const baseUrl = import.meta.env.VITE_TEACHING_API_BASE_URL?.replace(/\/api\/?$/, '/api')

export function getStoredSession(): AuthSession | null {
  try { const value = localStorage.getItem(storageKey); return value ? JSON.parse(value) as AuthSession : null } catch { return null }
}
export function getAuthToken() { return getStoredSession()?.token ?? null }

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.message ?? `请求失败 (${response.status})`)
  return payload as T
}

function save(session: AuthSession) { localStorage.setItem(storageKey, JSON.stringify(session)); return session }

export const authService = {
  async restore() {
    const session = getStoredSession()
    if (!session) return null
    if (!baseUrl) return session
    try {
      const user = await request<AuthUser>('/auth/me', { headers: { Authorization: `Bearer ${session.token}` } })
      return save({ ...session, user })
    } catch { localStorage.removeItem(storageKey); return null }
  },
  async login(account: string, password: string) {
    if (!baseUrl) {
      const users = JSON.parse(localStorage.getItem('teacher-agent.local-users') ?? '[]') as Array<AuthUser & { password: string }>
      const user = users.find((item) => (item.mobile === account || item.email === account) && item.password === password)
      if (!user) throw new Error('账号或密码错误')
      return save({ token: crypto.randomUUID(), expiresAt: new Date(Date.now() + 30 * 864e5).toISOString(), user })
    }
    return save(await request<AuthSession>('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, password }) }))
  },
  async register(input: { mobile: string; email?: string; password: string; displayName: string; role: UserRole }) {
    if (!baseUrl) {
      const users = JSON.parse(localStorage.getItem('teacher-agent.local-users') ?? '[]') as Array<AuthUser & { password: string }>
      if (users.some((item) => item.mobile === input.mobile)) throw new Error('该手机号已注册')
      const user: AuthUser & { password: string } = { id: crypto.randomUUID(), status: 'active', ...input }
      users.push(user); localStorage.setItem('teacher-agent.local-users', JSON.stringify(users))
      return save({ token: crypto.randomUUID(), expiresAt: new Date(Date.now() + 30 * 864e5).toISOString(), user })
    }
    return save(await request<AuthSession>('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }))
  },
  async logout() {
    const session = getStoredSession()
    if (baseUrl && session) await request('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${session.token}` } }).catch(() => undefined)
    localStorage.removeItem(storageKey)
  },
}
