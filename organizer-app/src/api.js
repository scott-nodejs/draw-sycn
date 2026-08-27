const base = import.meta.env.VITE_API_BASE_URL || '/api';
const key = 'organizer_session_v1';
export const session = { get: () => { try {
        return JSON.parse(localStorage.getItem(key) || 'null');
    }
    catch {
        return null;
    } }, set: (v) => v ? localStorage.setItem(key, JSON.stringify(v)) : localStorage.removeItem(key) };
async function request(path, init = {}) { const headers = new Headers(init.headers); const current = session.get(); if (current) {
    headers.set('Authorization', `Bearer ${current.token}`);
    headers.set('X-User-Id', current.user.id);
    headers.set('X-User-Role', current.user.role);
} const response = await fetch(base + path, { ...init, headers }); if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message || `请求失败 (${response.status})`);
} if (response.status === 204)
    return undefined; return response.json(); }
async function authenticatedBlob(path) { const headers = new Headers(); const current = session.get(); if (current) {
    headers.set('Authorization', `Bearer ${current.token}`);
    headers.set('X-User-Id', current.user.id);
    headers.set('X-User-Role', current.user.role);
} const normalized = path.startsWith('/api/') ? path.slice(4) : path; const response = await fetch(base + normalized, { headers }); if (!response.ok)
    throw new Error(`图片加载失败 (${response.status})`); return response.blob(); }
export const api = {
    login: (account, password) => request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, password }) }),
    register: (displayName, mobile, password) => request('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName, mobile, password, role: 'organizer' }) }),
    dashboard: () => request('/organizer/dashboard'), papers: () => request('/organizer/papers'),
    upload: (files, data) => { const body = new FormData(); files.forEach(f => body.append('file', f)); Object.entries(data).forEach(([k, v]) => body.append(k, v)); return request('/organizer/papers', { method: 'POST', body }); },
    deletePaper: (id) => request(`/organizer/papers/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    processing: (id) => request(`/papers/${encodeURIComponent(id)}/processing`), retry: (id) => request(`/papers/${encodeURIComponent(id)}/processing/retry`, { method: 'POST' }), confirmedQuestions: () => request('/organizer/questions'),
    knowledgePoints: () => request('/organizer/knowledge-points'), createKnowledgePoint: (data) => request('/organizer/knowledge-points', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }), assignKnowledgePoints: (questionId, knowledgePointIds) => request(`/organizer/questions/${encodeURIComponent(questionId)}/knowledge-points`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ knowledgePointIds }) }),
    questions: (id) => request(`/organizer/papers/${encodeURIComponent(id)}/questions`),
    saveQuestion: (q) => request(`/organizer/questions/${encodeURIComponent(q.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) }),
    reprocessQuestion: (id, sourceRegions) => request(`/questions/${encodeURIComponent(id)}/reprocess`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceRegions }) }),
    reprocessStatus: (id, jobId) => request(`/questions/${encodeURIComponent(id)}/reprocess/${encodeURIComponent(jobId)}`),
    sets: () => request('/organizer/question-sets'), createSet: (data) => request('/organizer/question-sets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }), updateSet: (id, data) => request(`/organizer/question-sets/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }), publishSet: (id) => request(`/organizer/question-sets/${encodeURIComponent(id)}/publish`, { method: 'POST' }), unpublishSet: (id) => request(`/organizer/question-sets/${encodeURIComponent(id)}/unpublish`, { method: 'POST' }), deleteSet: (id) => request(`/organizer/question-sets/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    pageBlob: (paperId, pageNumber) => authenticatedBlob(`/papers/${encodeURIComponent(paperId)}/pages/${pageNumber}`),
    pageLocation: (paperId, pageNumber) => request(`/papers/${encodeURIComponent(paperId)}/pages/${pageNumber}/location`),
    assetBlob: (path) => authenticatedBlob(path),
    cropUrl: (path) => base.replace(/\/api$/, '') + path
};
