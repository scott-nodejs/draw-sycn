import { demoAssets, demoPapers, demoProducts, demoQuestions, demoTasks, type LearningProduct, type Paper, type Question, type RecordingAsset, type TeachingTask } from '../domain'

export type UploadPaperInput = {
  file: File
  title: string
  subject: string
  grade: string
}

export interface TeachingRepository {
  listPapers(signal?: AbortSignal): Promise<Paper[]>
  listQuestions(paperId: string, signal?: AbortSignal): Promise<Question[]>
  listRecordingAssets(signal?: AbortSignal): Promise<RecordingAsset[]>
  listTeachingTasks(signal?: AbortSignal): Promise<TeachingTask[]>
  publishTeachingTask(input: Omit<TeachingTask, 'id' | 'status' | 'publishedAt' | 'applicants'>, signal?: AbortSignal): Promise<TeachingTask>
  listLearningProducts(signal?: AbortSignal): Promise<LearningProduct[]>
  saveLearningProduct(input: LearningProduct, signal?: AbortSignal): Promise<LearningProduct>
  uploadPaper(input: UploadPaperInput, signal?: AbortSignal): Promise<Paper>
  confirmQuestion(questionId: string, patch: Partial<Question>, signal?: AbortSignal): Promise<Question>
}

class HttpTeachingRepository implements TeachingRepository {
  constructor(private readonly baseUrl: string) {}

  listPapers(signal?: AbortSignal) {
    return this.request<Paper[]>('/papers', { signal })
  }

  listQuestions(paperId: string, signal?: AbortSignal) {
    return this.request<Question[]>(`/papers/${encodeURIComponent(paperId)}/questions`, { signal })
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
    body.append('file', input.file)
    body.append('title', input.title)
    body.append('subject', input.subject)
    body.append('grade', input.grade)
    return this.request<Paper>('/papers', { method: 'POST', body, signal })
  }

  confirmQuestion(questionId: string, patch: Partial<Question>, signal?: AbortSignal) {
    return this.request<Question>(`/questions/${encodeURIComponent(questionId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
      signal,
    })
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers)
    const userId = import.meta.env.VITE_API_USER_ID
    const organizationId = import.meta.env.VITE_API_ORGANIZATION_ID
    if (userId) headers.set('X-User-Id', userId)
    if (organizationId) headers.set('X-Organization-Id', organizationId)
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers })
    if (!response.ok) {
      throw new Error(`业务接口请求失败 (${response.status})`)
    }
    return response.json() as Promise<T>
  }
}

class DevelopmentTeachingRepository implements TeachingRepository {
  private papers = [...demoPapers]
  private questions = [...demoQuestions]
  private assets = [...demoAssets]
  private tasks = [...demoTasks]
  private products = [...demoProducts]

  async listPapers() {
    return structuredClone(this.papers)
  }

  async listQuestions(paperId: string) {
    return structuredClone(this.questions.filter((question) => question.paperId === paperId))
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

  async confirmQuestion(questionId: string, patch: Partial<Question>) {
    const index = this.questions.findIndex((question) => question.id === questionId)
    if (index < 0) throw new Error('题目不存在或已删除')
    this.questions[index] = { ...this.questions[index], ...patch, status: 'confirmed' }
    return structuredClone(this.questions[index])
  }
}

export const teachingRepository: TeachingRepository = import.meta.env.VITE_TEACHING_API_BASE_URL
  ? new HttpTeachingRepository(import.meta.env.VITE_TEACHING_API_BASE_URL.replace(/\/$/, ''))
  : new DevelopmentTeachingRepository()
