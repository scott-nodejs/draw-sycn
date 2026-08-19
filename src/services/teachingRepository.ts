import { demoAssets, demoPapers, demoProducts, demoQuestions, demoTasks, type ClassAssignment, type ClassGroup, type ClassInvite, type ClassMember, type LearningProduct, type Paper, type Question, type RecordingAsset, type SyncRoom, type TeachingTask } from '../domain'
import { getAuthToken, getStoredSession } from './authService'

export type UploadPaperInput = {
  files: File[]
  title: string
  subject: string
  grade: string
}
export type PaperProcessingStatus = { jobId: string; paperId: string; status: string; stage: string; progress: number; provider: string; externalTaskId: string; errorCode: string; errorMessage: string; retryCount: number; updatedAt: string }
export type QuestionReprocessStatus = { jobId: string; status: 'queued' | 'processing' | 'done' | 'failed' | 'superseded'; stage: string; errorCode: string; errorMessage: string; updatedAt: string; question?: Question }
export type BatchUploadOptions = { grades: string[]; subjects: string[]; defaultGrade: string; defaultSubject: string }

export interface TeachingRepository {
  listPapers(signal?: AbortSignal): Promise<Paper[]>
  getBatchUploadOptions(signal?: AbortSignal): Promise<BatchUploadOptions>
  listQuestions(paperId: string, signal?: AbortSignal): Promise<Question[]>
  listAllQuestions(signal?: AbortSignal): Promise<Question[]>
  listRecordingAssets(signal?: AbortSignal): Promise<RecordingAsset[]>
  listTeachingTasks(signal?: AbortSignal): Promise<TeachingTask[]>
  publishTeachingTask(input: Omit<TeachingTask, 'id' | 'status' | 'publishedAt' | 'applicants'>, signal?: AbortSignal): Promise<TeachingTask>
  listLearningProducts(signal?: AbortSignal): Promise<LearningProduct[]>
  saveLearningProduct(input: LearningProduct, signal?: AbortSignal): Promise<LearningProduct>
  uploadPaper(input: UploadPaperInput, signal?: AbortSignal): Promise<Paper>
  deletePaper(paperId: string, signal?: AbortSignal): Promise<void>
  confirmQuestion(questionId: string, patch: Partial<Question>, signal?: AbortSignal): Promise<Question>
  updateQuestionPresentation(questionId: string, presentationLayout: NonNullable<Question['presentationLayout']>, signal?: AbortSignal): Promise<Question>
  reprocessQuestion(questionId: string, sourceRegions: NonNullable<Question['sourceRegions']>, signal?: AbortSignal): Promise<Question>
  getQuestionReprocessStatus(questionId: string, jobId: string, signal?: AbortSignal): Promise<QuestionReprocessStatus>
  getPaperProcessingStatus(paperId: string, signal?: AbortSignal): Promise<PaperProcessingStatus>
  retryPaperProcessing(paperId: string, signal?: AbortSignal): Promise<void>
  getQuestionCrop(path: string, signal?: AbortSignal): Promise<Blob>
  getPaperPage(paperId: string, pageNumber: number, signal?: AbortSignal): Promise<Blob>
  listClassGroups(signal?: AbortSignal): Promise<ClassGroup[]>
  createClassGroup(input: { name: string; grade: string; description: string }, signal?: AbortSignal): Promise<ClassGroup>
  listClassMembers(groupId: string, signal?: AbortSignal): Promise<ClassMember[]>
  createClassInvite(groupId: string, signal?: AbortSignal): Promise<ClassInvite>
  listClassAssignments(groupId: string, signal?: AbortSignal): Promise<ClassAssignment[]>
  createClassAssignment(groupId: string, input: { contentType: 'paper' | 'question'; contentId?: string; contentIds?: string[]; studentIds: string[]; scheduledAt?: string }, signal?: AbortSignal): Promise<ClassAssignment[]>
  joinClassGroup(inviteCode: string, signal?: AbortSignal): Promise<ClassGroup>
  listStudentClassGroups(signal?: AbortSignal): Promise<ClassGroup[]>
  listStudentClassAssignments(signal?: AbortSignal): Promise<ClassAssignment[]>
  submitStudentAssignment(assignmentId: string, input: { answerText: string; boardSnapshot: unknown }, signal?: AbortSignal): Promise<{ status: string; submittedAt: string }>
  createSyncRoom(groupId: string, studentIds: string[], signal?: AbortSignal): Promise<SyncRoom>
  startSyncRoom(roomId: string, signal?: AbortSignal): Promise<unknown>
  updateSyncRoomQuestion(roomId: string, questionId: string, signal?: AbortSignal): Promise<SyncRoom>
  listStudentSyncRooms(signal?: AbortSignal): Promise<SyncRoom[]>
  closeSyncRoom(roomId: string, signal?: AbortSignal): Promise<void>
}

class HttpTeachingRepository implements TeachingRepository {
  constructor(private readonly baseUrl: string) {}

  listPapers(signal?: AbortSignal) {
    return this.request<Paper[]>('/papers', { signal })
  }

  getBatchUploadOptions(signal?: AbortSignal) {
    return this.request<BatchUploadOptions>('/batch-upload-options', { signal })
  }

  listQuestions(paperId: string, signal?: AbortSignal) {
    return this.request<Question[]>(`/papers/${encodeURIComponent(paperId)}/questions`, { signal })
  }

  listAllQuestions(signal?: AbortSignal) {
    return this.request<Question[]>('/questions', { signal })
  }

  listRecordingAssets(signal?: AbortSignal) {
    return this.request<RecordingAsset[]>('/teaching-assets', { signal })
  }

  listTeachingTasks(signal?: AbortSignal) {
    return this.request<TeachingTask[]>('/teaching-tasks', { signal })
  }

  publishTeachingTask(input: Omit<TeachingTask, 'id' | 'status' | 'publishedAt' | 'applicants'>, signal?: AbortSignal) {
    return this.request<TeachingTask>('/teaching-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal })
  }

  listLearningProducts(signal?: AbortSignal) {
    return this.request<LearningProduct[]>('/learning-products', { signal })
  }

  saveLearningProduct(input: LearningProduct, signal?: AbortSignal) {
    return this.request<LearningProduct>(`/learning-products/${encodeURIComponent(input.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal })
  }

  uploadPaper(input: UploadPaperInput, signal?: AbortSignal) {
    const body = new FormData()
    input.files.forEach((file) => body.append('file', file))
    body.append('title', input.title)
    body.append('subject', input.subject)
    body.append('grade', input.grade)
    return this.request<Paper>('/papers', { method: 'POST', body, signal })
  }

  async deletePaper(paperId: string, signal?: AbortSignal) {
    await this.request<unknown>(`/papers/${encodeURIComponent(paperId)}`, { method: 'DELETE', signal })
  }

  confirmQuestion(questionId: string, patch: Partial<Question>, signal?: AbortSignal) {
    return this.request<Question>(`/questions/${encodeURIComponent(questionId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
      signal,
    })
  }

  updateQuestionPresentation(questionId: string, presentationLayout: NonNullable<Question['presentationLayout']>, signal?: AbortSignal) {
    return this.request<Question>(`/questions/${encodeURIComponent(questionId)}/presentation`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ presentationLayout }), signal })
  }

  reprocessQuestion(questionId: string, sourceRegions: NonNullable<Question['sourceRegions']>, signal?: AbortSignal) {
    return this.request<Question>(`/questions/${encodeURIComponent(questionId)}/reprocess`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceRegions }), signal,
    })
  }

  getQuestionReprocessStatus(questionId: string, jobId: string, signal?: AbortSignal) {
    return this.request<QuestionReprocessStatus>(`/questions/${encodeURIComponent(questionId)}/reprocess/${encodeURIComponent(jobId)}`, { signal })
  }

  getPaperProcessingStatus(paperId: string, signal?: AbortSignal) { return this.request<PaperProcessingStatus>(`/papers/${encodeURIComponent(paperId)}/processing`, { signal }) }
  async retryPaperProcessing(paperId: string, signal?: AbortSignal) { await this.request<unknown>(`/papers/${encodeURIComponent(paperId)}/processing/retry`, { method: 'POST', signal }) }
  async getQuestionCrop(path: string, signal?: AbortSignal) {
    const headers = new Headers(); const userId = getStoredSession()?.user.id ?? import.meta.env.VITE_API_USER_ID; const token = getAuthToken()
    if (userId) headers.set('X-User-Id', userId); if (token) headers.set('Authorization', `Bearer ${token}`)
    const response = await fetch(`${this.baseUrl}${path.replace(/^\/api/, '')}`, { headers, signal })
    if (!response.ok) throw new Error(`题目裁图加载失败 (${response.status})`)
    return response.blob()
  }

  async getPaperPage(paperId: string, pageNumber: number, signal?: AbortSignal) {
    return this.getQuestionCrop(`/api/papers/${encodeURIComponent(paperId)}/pages/${pageNumber}`, signal)
  }

  listClassGroups(signal?: AbortSignal) { return this.request<ClassGroup[]>('/teacher/class-groups', { signal }) }
  createClassGroup(input: { name: string; grade: string; description: string }, signal?: AbortSignal) { return this.request<ClassGroup>('/teacher/class-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal }) }
  listClassMembers(groupId: string, signal?: AbortSignal) { return this.request<ClassMember[]>(`/teacher/class-groups/${encodeURIComponent(groupId)}/members`, { signal }) }
  createClassInvite(groupId: string, signal?: AbortSignal) { return this.request<ClassInvite>(`/teacher/class-groups/${encodeURIComponent(groupId)}/invites`, { method: 'POST', signal }) }
  listClassAssignments(groupId: string, signal?: AbortSignal) { return this.request<ClassAssignment[]>(`/teacher/class-groups/${encodeURIComponent(groupId)}/assignments`, { signal }) }
  createClassAssignment(groupId: string, input: { contentType: 'paper' | 'question'; contentId?: string; contentIds?: string[]; studentIds: string[]; scheduledAt?: string }, signal?: AbortSignal) { return this.request<ClassAssignment[]>(`/teacher/class-groups/${encodeURIComponent(groupId)}/assignments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal }) }
  joinClassGroup(inviteCode: string, signal?: AbortSignal) { return this.request<ClassGroup>('/student/class-groups/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ inviteCode }), signal }) }
  listStudentClassGroups(signal?: AbortSignal) { return this.request<ClassGroup[]>('/student/class-groups', { signal }) }
  listStudentClassAssignments(signal?: AbortSignal) { return this.request<ClassAssignment[]>('/student/class-assignments', { signal }) }
  submitStudentAssignment(assignmentId: string, input: { answerText: string; boardSnapshot: unknown }, signal?: AbortSignal) { return this.request<{ status: string; submittedAt: string }>(`/student/class-assignments/${encodeURIComponent(assignmentId)}/submissions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal }) }
  createSyncRoom(groupId: string, studentIds: string[], signal?: AbortSignal) { return this.request<SyncRoom>(`/teacher/class-groups/${encodeURIComponent(groupId)}/sync-rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentIds }), signal }) }
  startSyncRoom(roomId: string, signal?: AbortSignal) { return this.request(`/classroom/rooms/${encodeURIComponent(roomId)}/start`, { method: 'POST', signal }) }
  updateSyncRoomQuestion(roomId: string, questionId: string, signal?: AbortSignal) { return this.request<SyncRoom>(`/teacher/sync-rooms/${encodeURIComponent(roomId)}/current-question`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionId }), signal }) }
  listStudentSyncRooms(signal?: AbortSignal) { return this.request<SyncRoom[]>('/student/sync-rooms', { signal }) }
  closeSyncRoom(roomId: string, signal?: AbortSignal) { return this.request<void>(`/classroom/rooms/${encodeURIComponent(roomId)}/end`, { method: 'POST', signal }) }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers)
    const userId = getStoredSession()?.user.id ?? import.meta.env.VITE_API_USER_ID
    const token = getAuthToken()
    const organizationId = import.meta.env.VITE_API_ORGANIZATION_ID
    if (userId) headers.set('X-User-Id', userId)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (organizationId) headers.set('X-Organization-Id', organizationId)
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers })
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { message?: string } | null
      throw new Error(payload?.message ?? `业务接口请求失败 (${response.status})`)
    }
    if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }
}

class DevelopmentTeachingRepository implements TeachingRepository {
  private papers = [...demoPapers]
  private questions = [...demoQuestions]
  private assets = [...demoAssets]
  private tasks = [...demoTasks]
  private products = [...demoProducts]
  async getQuestionCrop() { return new Blob() }
  async getPaperPage() { return new Blob() }
  async getQuestionReprocessStatus(_questionId: string, jobId: string) { return { jobId, status: 'done' as const, stage: 'done', errorCode: '', errorMessage: '', updatedAt: new Date().toISOString() } }
  async listClassGroups() { return [] }
  async createClassGroup(input: { name: string; grade: string; description: string }) { return { id: crypto.randomUUID(), teacherId: 'local', memberCount: 0, createdAt: new Date().toISOString(), ...input } }
  async listClassMembers() { return [] }
  async createClassInvite(groupId: string) { return { groupId, inviteCode: 'LOCAL888', expiresAt: new Date(Date.now() + 7 * 864e5).toISOString() } }
  async listClassAssignments() { return [] }
  async createClassAssignment(groupId: string, input: { contentType: 'paper' | 'question'; contentId?: string; contentIds?: string[]; studentIds: string[]; scheduledAt?: string }) { return (input.contentIds?.length ? input.contentIds : [input.contentId ?? '']).map((contentId) => ({ id: crypto.randomUUID(), groupId, groupName: '', contentType: input.contentType, contentId, title: contentId, recipientType: 'student' as const, recipientCount: input.studentIds.length, status: input.scheduledAt ? 'scheduled' as const : 'published' as const, scheduledAt: input.scheduledAt, createdAt: new Date().toISOString() })) }
  async joinClassGroup(inviteCode: string) { return { id: inviteCode, teacherId: 'local', name: '本地班级', grade: '', description: '', memberCount: 1, createdAt: new Date().toISOString() } }
  async listStudentClassGroups() { return [] }
  async listStudentClassAssignments() { return [] }
  async submitStudentAssignment() { return { status: 'submitted', submittedAt: new Date().toISOString() } }
  async createSyncRoom(groupId: string) { return { id: crypto.randomUUID(), groupId, groupName: '本地班级', teacherId: 'local', teacherName: '老师', title: '课堂同步看板', status: 'NOT_STARTED' as const, createdAt: new Date().toISOString() } }
  async startSyncRoom() { return {} }
  async updateSyncRoomQuestion(roomId: string, questionId: string) { return { id: roomId, groupId: 'local', groupName: '本地班级', teacherId: 'local', teacherName: '老师', title: '课堂同步看板', status: 'ACTIVE' as const, createdAt: new Date().toISOString(), currentQuestion: { id: questionId, number: 0, type: '', stem: '' } } }
  async listStudentSyncRooms() { return [] }
  async closeSyncRoom() { return undefined }

  async listPapers() {
    return structuredClone(this.papers)
  }

  async getBatchUploadOptions() {
    return { grades: ['小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级', '初一', '初二', '初三', '高一', '高二', '高三'], subjects: ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理', '科学'], defaultGrade: '高三', defaultSubject: '数学' }
  }

  async listQuestions(paperId: string) {
    return structuredClone(this.questions.filter((question) => question.paperId === paperId))
  }

  async listAllQuestions() {
    return structuredClone(this.questions.filter((question) => question.status === 'confirmed'))
  }

  async listRecordingAssets() {
    return structuredClone(this.assets)
  }

  async listTeachingTasks() {
    return structuredClone(this.tasks)
  }

  async publishTeachingTask(input: Omit<TeachingTask, 'id' | 'status' | 'publishedAt' | 'applicants'>) {
    const task: TeachingTask = { ...input, id: crypto.randomUUID(), status: 'open', publishedAt: '刚刚', applicants: 0 }
    this.tasks = [task, ...this.tasks]
    return structuredClone(task)
  }

  async listLearningProducts() {
    return structuredClone(this.products)
  }

  async saveLearningProduct(input: LearningProduct) {
    const index = this.products.findIndex((product) => product.id === input.id)
    if (index >= 0) this.products[index] = input
    else this.products = [input, ...this.products]
    return structuredClone(input)
  }

  async uploadPaper(input: UploadPaperInput) {
    const paper: Paper = {
      id: crypto.randomUUID(),
      title: input.title,
      subject: input.subject,
      grade: input.grade,
      source: '教师上传',
      uploadedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      pageCount: 0,
      questionCount: 0,
      reviewedCount: 0,
      taughtCount: 0,
      progress: 0,
      status: 'processing',
    }
    this.papers = [paper, ...this.papers]
    return structuredClone(paper)
  }

  async deletePaper(paperId: string) {
    this.papers = this.papers.filter((paper) => paper.id !== paperId)
    this.questions = this.questions.filter((question) => question.paperId !== paperId)
  }

  async confirmQuestion(questionId: string, patch: Partial<Question>) {
    const index = this.questions.findIndex((question) => question.id === questionId)
    if (index < 0) throw new Error('题目不存在或已删除')
    this.questions[index] = { ...this.questions[index], ...patch, status: 'confirmed' }
    return structuredClone(this.questions[index])
  }
  async updateQuestionPresentation(questionId: string, presentationLayout: NonNullable<Question['presentationLayout']>) {
    const index = this.questions.findIndex((question) => question.id === questionId); if (index < 0) throw new Error('题目不存在')
    this.questions[index] = { ...this.questions[index], presentationLayout }; return structuredClone(this.questions[index])
  }

  async reprocessQuestion(questionId: string, sourceRegions: NonNullable<Question['sourceRegions']>) {
    const index = this.questions.findIndex((question) => question.id === questionId)
    if (index < 0) throw new Error('题目不存在')
    this.questions[index] = { ...this.questions[index], sourceRegions, status: 'review' }
    return structuredClone(this.questions[index])
  }

  async getPaperProcessingStatus(paperId: string) {
    const paper = this.papers.find((item) => item.id === paperId)
    return { jobId: `job-${paperId}`, paperId, status: paper?.status === 'failed' ? 'failed' : paper?.status === 'review' ? 'review' : 'processing', stage: paper?.status === 'review' ? 'review_required' : 'mineru_running', progress: paper?.progress ?? 0, provider: 'mineru', externalTaskId: '', errorCode: '', errorMessage: '', retryCount: 0, updatedAt: new Date().toISOString() }
  }

  async retryPaperProcessing(paperId: string) { this.papers = this.papers.map((paper) => paper.id === paperId ? { ...paper, status: 'processing', progress: 0 } : paper) }
}

export const teachingRepository: TeachingRepository = import.meta.env.VITE_TEACHING_API_BASE_URL
  ? new HttpTeachingRepository(import.meta.env.VITE_TEACHING_API_BASE_URL.replace(/\/$/, ''))
  : new DevelopmentTeachingRepository()
