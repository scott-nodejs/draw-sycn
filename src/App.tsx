import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  Files,
  FileText,
  FileUp,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  Menu,
  Mic,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Square,
  Users,
  Video,
  X,
} from 'lucide-react'
import { Tldraw, type Editor } from 'tldraw'
import { useSync } from '@tldraw/sync'
import 'tldraw/tldraw.css'
import type { LearningProduct, Paper, Question, RecordingAsset, TeachingTask } from './domain'
import type { RecordingPackage } from './types'
import { startRecording, stopRecording } from './recording'
import { prepareAudioRecorder, type ActiveAudioRecorder } from './recording/audioRecording'
import { flattenRecordingEvents } from './recording/chunks'
import { applyRecordedEvent, loadRecordingBaseline, seekRecording } from './player/replay'
import { createRecordingStorage } from './storage/createRecordingStorage'
import { createSaveTask, runSaveTask, type SaveTaskSnapshot } from './storage/saveTask'
import { teachingRepository } from './services/teachingRepository'
import { syncAssetStore } from './sync/assetStore'
import { createSyncUri, defaultSyncRoomId } from './sync/syncConfig'

type Page = 'papers' | 'questions' | 'review' | 'studio' | 'assets' | 'marketplace' | 'products'
type Recorder = ReturnType<typeof startRecording>
type StudioMode = 'live' | 'record'

const recordingStorage = createRecordingStorage()

export function App() {
  const [portal, setPortal] = useState<'teacher' | 'student' | 'store'>(() => window.location.hash === '#student' ? 'student' : window.location.hash === '#store' ? 'store' : 'teacher')
  const [page, setPage] = useState<Page>('papers')
  const [papers, setPapers] = useState<Paper[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [assets, setAssets] = useState<RecordingAsset[]>([])
  const [tasks, setTasks] = useState<TeachingTask[]>([])
  const [products, setProducts] = useState<LearningProduct[]>([])
  const [activePaperId, setActivePaperId] = useState('paper-001')
  const [activeQuestionId, setActiveQuestionId] = useState('q-002')
  const [studioMode, setStudioMode] = useState<StudioMode>('live')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const loadWorkspace = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [paperItems, assetItems, taskItems, productItems] = await Promise.all([
        teachingRepository.listPapers(),
        teachingRepository.listRecordingAssets(),
        teachingRepository.listTeachingTasks(),
        teachingRepository.listLearningProducts(),
      ])
      setPapers(paperItems)
      setAssets(assetItems)
      setTasks(taskItems)
      setProducts(productItems)
      const selectedId = paperItems.some((paper) => paper.id === activePaperId) ? activePaperId : paperItems[0]?.id
      if (selectedId) {
        setActivePaperId(selectedId)
        setQuestions(await teachingRepository.listQuestions(selectedId))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载业务数据失败')
    } finally {
      setLoading(false)
    }
  }, [activePaperId])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  const openPaper = useCallback(async (paperId: string) => {
    setActivePaperId(paperId)
    setLoading(true)
    try {
      setQuestions(await teachingRepository.listQuestions(paperId))
      setPage('questions')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载题目失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const openQuestion = useCallback((questionId: string, target: 'review' | 'studio', mode: StudioMode = 'live') => {
    setActiveQuestionId(questionId)
    setStudioMode(mode)
    setPage(target)
  }, [])

  const navigate = useCallback((target: Page) => {
    setPage(target)
    setMobileNavOpen(false)
  }, [])

  if (portal === 'student') {
    return <StudentPortal papers={papers} questions={questions} assets={assets} tasks={tasks} loading={loading} onTaskCreated={(task) => setTasks((items) => [task, ...items])} onSwitchPortal={() => { window.location.hash = ''; setPortal('teacher') }} />
  }

  if (portal === 'store') {
    return <LearningStore products={products.filter((product) => product.status === 'published')} questions={questions} assets={assets} onSwitchPortal={() => { window.location.hash = ''; setPortal('teacher') }} />
  }

  if (page === 'studio') {
    return <TeachingStudio questions={questions} initialQuestionId={activeQuestionId} mode={studioMode} onExit={() => setPage('marketplace')} />
  }

  return (
    <div className="product-shell">
      <Sidebar page={page} open={mobileNavOpen} onNavigate={navigate} onClose={() => setMobileNavOpen(false)} />
      <div className="product-main">
        <Topbar onMenu={() => setMobileNavOpen(true)} onSwitchPortal={() => { window.location.hash = 'student'; setPortal('student') }} onSwitchStore={() => { window.location.hash = 'store'; setPortal('store') }} />
        {error ? <ErrorBanner message={error} onRetry={() => void loadWorkspace()} /> : null}
        {loading ? (
          <LoadingState />
        ) : page === 'papers' ? (
          <PaperLibrary papers={papers} onPaperOpen={openPaper} onPaperCreated={(paper) => setPapers((items) => [paper, ...items])} />
        ) : page === 'questions' ? (
          <QuestionList
            paper={papers.find((paper) => paper.id === activePaperId)}
            questions={questions}
            onBack={() => setPage('papers')}
            onReview={(id) => openQuestion(id, 'review')}
            onTeach={(id, mode) => openQuestion(id, 'studio', mode)}
          />
        ) : page === 'review' ? (
          <QuestionReview
            paper={papers.find((paper) => paper.id === activePaperId)}
            questions={questions}
            activeQuestionId={activeQuestionId}
            onSelect={setActiveQuestionId}
            onBack={() => setPage('questions')}
            onConfirmed={(question) => setQuestions((items) => items.map((item) => (item.id === question.id ? question : item)))}
          />
        ) : page === 'marketplace' ? (
          <TeacherTaskMarketplace tasks={tasks} onAccept={(task) => { setStudioMode(task.serviceType === '录制讲解' ? 'record' : 'live'); setPage('studio') }} />
        ) : page === 'products' ? (
          <TeacherProductLibrary products={products} papers={papers} assets={assets} onSaved={(product) => setProducts((items) => items.some((item) => item.id === product.id) ? items.map((item) => item.id === product.id ? product : item) : [product, ...items])} />
        ) : (
          <RecordingLibrary assets={assets} />
        )}
      </div>
    </div>
  )
}

function Sidebar({ page, open, onNavigate, onClose }: { page: Page; open: boolean; onNavigate: (page: Page) => void; onClose: () => void }) {
  const items: Array<{ id: Page; label: string; icon: typeof Files }> = [
    { id: 'marketplace', label: '任务大厅', icon: BriefcaseBusiness },
    { id: 'papers', label: '试卷库', icon: Files },
    { id: 'questions', label: '题目管理', icon: ListChecks },
    { id: 'studio', label: '讲题工作台', icon: BookOpenCheck },
    { id: 'assets', label: '录制内容', icon: Video },
    { id: 'products', label: '内容商品', icon: FileCheck2 },
  ]
  return (
    <>
      {open ? <button className="nav-scrim" aria-label="关闭菜单" onClick={onClose} /> : null}
      <aside className={`product-sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Sparkles size={18} /></div><div><strong>知问讲堂</strong><span>AI 讲题内容平台</span></div></div>
        <nav className="main-nav">
          <span className="nav-caption">教学内容</span>
          {items.map(({ id, label, icon: Icon }) => (
            <button key={id} className={page === id || (id === 'questions' && page === 'review') ? 'active' : ''} onClick={() => onNavigate(id)}>
              <Icon size={18} /><span>{label}</span>{id === 'questions' ? <span className="nav-count">18</span> : null}
            </button>
          ))}
          <span className="nav-caption spaced">系统</span>
          <button><Users size={18} /><span>成员与权限</span></button>
          <button><Settings size={18} /><span>平台设置</span></button>
        </nav>
        <div className="sidebar-plan"><span>专业版</span><strong>本月 AI 解析 24 / 100 份</strong><div><i style={{ width: '24%' }} /></div><button>查看用量</button></div>
        <div className="sidebar-user"><div className="avatar">王</div><div><strong>王老师</strong><span>高中数学教研组</span></div><MoreHorizontal size={18} /></div>
      </aside>
    </>
  )
}

function Topbar({ onMenu, onSwitchPortal, onSwitchStore }: { onMenu: () => void; onSwitchPortal: () => void; onSwitchStore: () => void }) {
  return <header className="product-topbar"><button className="icon-button mobile-menu" onClick={onMenu} aria-label="打开菜单"><Menu size={20} /></button><div className="workspace-switch"><span>杭州知问教育</span><ChevronDown size={15} /></div><div className="topbar-actions"><button className="portal-switch" onClick={onSwitchStore}>预览学习 Web</button><button className="portal-switch" onClick={onSwitchPortal}>预览学生端</button><button className="icon-button" aria-label="帮助"><CircleHelp size={19} /></button><button className="support-button">联系支持</button></div></header>
}

function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="page-header"><div>{eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}<h1>{title}</h1><p>{description}</p></div>{actions ? <div className="page-actions">{actions}</div> : null}</div>
}

function PaperLibrary({ papers, onPaperOpen, onPaperCreated }: { papers: Paper[]; onPaperOpen: (id: string) => void; onPaperCreated: (paper: Paper) => void }) {
  const [uploadOpen, setUploadOpen] = useState(false)
  const ready = papers.filter((paper) => paper.status === 'ready').length
  const pending = papers.reduce((total, paper) => total + Math.max(0, paper.questionCount - paper.reviewedCount), 0)
  const taught = papers.reduce((total, paper) => total + paper.taughtCount, 0)
  return <main className="page-content">
    <PageHeader title="试卷库" description="上传和管理试卷，由 AI 完成版面分析、题目切分和结构化识别。" actions={<button className="button primary" onClick={() => setUploadOpen(true)}><FileUp size={17} />上传试卷 PDF</button>} />
    <section className="metric-grid"><MetricCard label="全部试卷" value={String(papers.length)} note={`${ready} 份已完成处理`} icon={<Files size={19} />} /><MetricCard label="待校对题目" value={String(pending)} note="建议优先完成高置信度较低题目" icon={<FileCheck2 size={19} />} tone="warning" /><MetricCard label="已完成讲题" value={String(taught)} note="包含直播切片与单题录制" icon={<Video size={19} />} tone="success" /></section>
    <section className="content-card"><div className="card-toolbar"><div><h2>全部试卷</h2><span>共 {papers.length} 份</span></div><div className="toolbar-controls"><label className="search-field"><Search size={17} /><input placeholder="搜索试卷名称" /></label><button className="button secondary">全部状态<ChevronDown size={15} /></button></div></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>试卷名称</th><th>AI 处理状态</th><th>题目校对</th><th>讲题进度</th><th>上传时间</th><th></th></tr></thead><tbody>{papers.map((paper) => <tr key={paper.id}><td><button className="title-link" onClick={() => void onPaperOpen(paper.id)}><span className="file-icon"><FileText size={18} /></span><span><strong>{paper.title}</strong><small>{paper.grade} · {paper.subject} · {paper.pageCount || '—'} 页</small></span></button></td><td><PaperStatusBadge paper={paper} /></td><td><strong>{paper.reviewedCount}</strong><span className="muted"> / {paper.questionCount || '—'}</span></td><td><div className="inline-progress"><div><i style={{ width: `${paper.questionCount ? (paper.taughtCount / paper.questionCount) * 100 : 0}%` }} /></div><span>{paper.taughtCount}/{paper.questionCount || '—'}</span></div></td><td className="muted">{paper.uploadedAt}</td><td><button className="icon-button" aria-label="更多操作"><MoreHorizontal size={18} /></button></td></tr>)}</tbody></table></div>
    </section>
    {uploadOpen ? <UploadPaperDialog onClose={() => setUploadOpen(false)} onCreated={(paper) => { onPaperCreated(paper); setUploadOpen(false) }} /> : null}
  </main>
}

function UploadPaperDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (paper: Paper) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) return setError('请选择 PDF 试卷文件')
    setSubmitting(true); setError(null)
    try { onCreated(await teachingRepository.uploadPaper({ file, title: title.trim() || file.name.replace(/\.pdf$/i, ''), subject: '数学', grade: '高三' })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '上传失败') }
    finally { setSubmitting(false) }
  }
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="上传试卷"><button className="modal-scrim" aria-label="关闭" onClick={onClose} /><form className="modal" onSubmit={(event) => void submit(event)}><div className="modal-header"><div><h2>上传试卷 PDF</h2><p>文件上传后将创建异步 AI 解析任务，完成前不会生成正式题目。</p></div><button type="button" className="icon-button" onClick={onClose}><X size={19} /></button></div><label className="dropzone"><FileUp size={28} /><strong>{file ? file.name : '选择或拖入 PDF 文件'}</strong><span>单个文件不超过 100 MB，支持扫描版试卷</span><input type="file" accept="application/pdf" onChange={(event) => { const next = event.target.files?.[0] ?? null; setFile(next); if (next && !title) setTitle(next.name.replace(/\.pdf$/i, '')) }} /></label><label className="field-label">试卷名称<input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：高三数学第一次月考" /></label>{error ? <div className="form-error">{error}</div> : null}<div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}上传并开始解析</button></div></form></div>
}

function QuestionList({ paper, questions, onBack, onReview, onTeach }: { paper?: Paper; questions: Question[]; onBack: () => void; onReview: (id: string) => void; onTeach: (id: string, mode: StudioMode) => void }) {
  return <main className="page-content"><button className="back-link" onClick={onBack}><ArrowLeft size={16} />返回试卷库</button><PageHeader eyebrow={`${paper?.grade ?? ''} · ${paper?.subject ?? ''}`} title={paper?.title ?? '题目管理'} description="校对 AI 切题结果，并为已确认的题目安排直播或录制。" actions={<><button className="button secondary"><Check size={17} />批量确认</button><button className="button primary" onClick={() => questions[0] && onTeach(questions[0].id, 'live')}><Radio size={17} />创建讲题直播</button></>} />
    <div className="workflow-strip"><div className="done"><Check size={15} /><span>PDF 已上传</span></div><i /><div className="done"><Check size={15} /><span>AI 已切题</span></div><i /><div className="current"><span>3</span><span>人工校对</span></div><i /><div><span>4</span><span>发布题目</span></div></div>
    <section className="content-card"><div className="card-toolbar"><div><h2>题目列表</h2><span>{questions.length} 道题 · {questions.filter((item) => item.status === 'review').length} 道待校对</span></div><div className="toolbar-controls"><label className="search-field"><Search size={17} /><input placeholder="搜索题号或题目内容" /></label><button className="button secondary">全部题型<ChevronDown size={15} /></button></div></div>
      <div className="table-scroll"><table className="data-table question-table"><thead><tr><th>题目</th><th>题型</th><th>AI 置信度</th><th>校对状态</th><th>讲题状态</th><th>操作</th></tr></thead><tbody>{questions.map((question) => <tr key={question.id}><td><div className="question-cell"><span>{question.number}</span><div><strong>{question.stem}</strong><small>{question.points} 分 · 答案 {question.answer}</small></div></div></td><td>{question.type}</td><td><Confidence value={question.confidence} /></td><td><StatusBadge status={question.status === 'confirmed' ? 'success' : 'warning'}>{question.status === 'confirmed' ? '已确认' : '待校对'}</StatusBadge></td><td>{question.teachingStatus === 'recorded' ? <StatusBadge status="success">已发布</StatusBadge> : question.teachingStatus === 'draft' ? <StatusBadge status="neutral">有草稿</StatusBadge> : <span className="muted">未讲解</span>}</td><td><div className="row-actions">{question.status === 'review' ? <button className="text-button" onClick={() => onReview(question.id)}>校对</button> : <button className="text-button" onClick={() => onTeach(question.id, 'record')}>开始讲题</button>}<button className="icon-button"><MoreHorizontal size={18} /></button></div></td></tr>)}</tbody></table></div>
    </section>
  </main>
}

function QuestionReview({ paper, questions, activeQuestionId, onSelect, onBack, onConfirmed }: { paper?: Paper; questions: Question[]; activeQuestionId: string; onSelect: (id: string) => void; onBack: () => void; onConfirmed: (question: Question) => void }) {
  const question = questions.find((item) => item.id === activeQuestionId) ?? questions[0]
  const [draft, setDraft] = useState(question)
  const [saving, setSaving] = useState(false)
  useEffect(() => setDraft(question), [question])
  if (!draft) return <EmptyState title="暂无可校对题目" description="AI 切题完成后，题目会出现在这里。" />
  const confirm = async () => { setSaving(true); try { onConfirmed(await teachingRepository.confirmQuestion(draft.id, draft)); } finally { setSaving(false) } }
  return <main className="review-page"><header className="review-header"><button className="back-link" onClick={onBack}><ArrowLeft size={16} />返回题目列表</button><div><strong>{paper?.title}</strong><span>切题校对 · {questions.filter((item) => item.status === 'review').length} 道待处理</span></div><button className="button primary" disabled={saving} onClick={() => void confirm()}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}确认当前题目</button></header><div className="review-layout"><aside className="question-rail"><div className="rail-title"><strong>题目</strong><span>{questions.length} 道</span></div>{questions.map((item) => <button key={item.id} className={item.id === draft.id ? 'active' : ''} onClick={() => onSelect(item.id)}><span>{item.number}</span><div><strong>第 {item.number} 题</strong><small>{item.type} · {item.confidence}%</small></div>{item.status === 'confirmed' ? <Check size={15} /> : null}</button>)}</aside><section className="pdf-review"><div className="pdf-toolbar"><span>原始试卷 · 第 1 页 / {paper?.pageCount ?? 1}</span><span>−　100%　＋</span></div><div className="pdf-sheet"><div className="paper-heading">高三数学第一次月考</div><p>一、选择题：本题共 8 小题，每小题 5 分。</p><div className="crop-box"><span>第 {draft.number} 题</span><strong>{draft.number}. {draft.stem}</strong>{draft.options?.map((option, index) => <p key={option}>{String.fromCharCode(65 + index)}. {option}</p>)}</div><p className="faded-question">{draft.number + 1}. 下一题内容区域……</p></div></section><aside className="review-form"><div className="panel-heading"><div><strong>结构化结果</strong><span>AI 置信度 {draft.confidence}%</span></div><Sparkles size={18} /></div><label className="field-label">题号<input className="text-input" value={draft.number} type="number" onChange={(event) => setDraft({ ...draft, number: Number(event.target.value) })} /></label><label className="field-label">题型<select className="text-input" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Question['type'] })}><option>选择题</option><option>填空题</option><option>解答题</option></select></label><label className="field-label">题目正文<textarea className="text-input textarea" value={draft.stem} onChange={(event) => setDraft({ ...draft, stem: event.target.value })} /></label><label className="field-label">答案<input className="text-input" value={draft.answer} onChange={(event) => setDraft({ ...draft, answer: event.target.value })} /></label><label className="field-label">解析<textarea className="text-input textarea" value={draft.analysis} onChange={(event) => setDraft({ ...draft, analysis: event.target.value })} /></label><div className="review-tip"><Sparkles size={16} /><span>确认后题目才会进入可讲解状态，所有人工修改将保留审计记录。</span></div></aside></div></main>
}

function TeachingStudio({ questions, initialQuestionId, mode, onExit }: { questions: Question[]; initialQuestionId: string; mode: StudioMode; onExit: () => void }) {
  const queue = questions.filter((question) => question.status === 'confirmed')
  const initialIndex = Math.max(0, queue.findIndex((question) => question.id === initialQuestionId))
  const [index, setIndex] = useState(initialIndex)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [lastPackage, setLastPackage] = useState<RecordingPackage | null>(null)
  const [saveTask, setSaveTask] = useState<SaveTaskSnapshot | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const editorRef = useRef<Editor | null>(null)
  const recorderRef = useRef<Recorder | null>(null)
  const audioRecorderRef = useRef<ActiveAudioRecorder | null>(null)
  const store = useSync({ uri: createSyncUri(defaultSyncRoomId, 'teacher'), assets: syncAssetStore })
  const current = queue[index]
  useEffect(() => { if (!recording || !recorderRef.current) return; const timer = window.setInterval(() => setElapsed(performance.now() - recorderRef.current!.startedAt), 250); return () => window.clearInterval(timer) }, [recording])
  const start = async () => {
    if (!editorRef.current || recording || starting) return
    setStarting(true); setAudioError(null); setAudioBlob(null); setElapsed(0); setLastPackage(null); setSaveTask(null)
    try {
      const preparedAudio = await prepareAudioRecorder()
      const recorder = startRecording(editorRef.current)
      recorderRef.current = recorder
      audioRecorderRef.current = preparedAudio.start(recorder.startedAt)
      setRecording(true)
    } catch (cause) {
      const message = cause instanceof DOMException && cause.name === 'NotAllowedError' ? '麦克风权限被拒绝，请允许访问麦克风后重试。' : cause instanceof Error ? cause.message : '无法启动麦克风录制'
      setAudioError(message)
      window.alert(message)
    } finally { setStarting(false) }
  }
  const stop = async () => {
    if (!editorRef.current || !recorderRef.current) return
    const pack = stopRecording(editorRef.current, recorderRef.current, `${current?.number ? `第 ${current.number} 题` : '讲题'}${mode === 'live' ? '直播回放' : '录制'}`)
    recorderRef.current = null; setRecording(false)
    try {
      if (!audioRecorderRef.current) throw new Error('音频录制轨道不存在')
      const audio = await audioRecorderRef.current.stop()
      pack.audio = audio.track
      setAudioBlob(audio.blob)
    } catch (cause) {
      setAudioError(cause instanceof Error ? cause.message : '停止录音失败')
    } finally { audioRecorderRef.current = null }
    setLastPackage(pack); setSaveTask(createSaveTask(pack))
  }
  const save = async () => { if (lastPackage) await runSaveTask(recordingStorage, lastPackage, setSaveTask, saveTask, audioBlob) }
  return <main className="studio-page"><header className="studio-header"><div><button className="icon-button" onClick={onExit}><ArrowLeft size={19} /></button><div><strong>{mode === 'live' ? '直播讲题' : '单题录制'} · 高三数学第一次月考</strong><span>房间 {defaultSyncRoomId}</span></div></div><div className="studio-status"><span className={recording ? 'live-dot' : 'idle-dot'} />{recording ? `${mode === 'live' ? '直播并录制中' : '录制中'} ${formatMs(elapsed)}` : '准备就绪'}</div><button className="button secondary" onClick={onExit}>退出工作台</button></header><div className="studio-layout"><aside className="studio-queue"><div className="queue-heading"><div><strong>本场题目</strong><span>{queue.length} 道</span></div><button className="icon-button"><Plus size={17} /></button></div>{queue.map((question, questionIndex) => <button key={question.id} className={`${index === questionIndex ? 'active' : ''} ${questionIndex < index ? 'done' : ''}`} onClick={() => setIndex(questionIndex)}><span>{questionIndex < index ? <Check size={15} /> : question.number}</span><div><strong>第 {question.number} 题</strong><small>{question.type} · {question.points} 分</small></div></button>)}</aside><section className="studio-board"><div className="question-overlay"><span>第 {current?.number} 题 · {current?.type}</span><strong>{current?.stem}</strong>{current?.options ? <div>{current.options.map((option, optionIndex) => <span key={option}>{String.fromCharCode(65 + optionIndex)}. {option}</span>)}</div> : null}</div><Tldraw store={store} onMount={(editor) => { editorRef.current = editor }} /></section><aside className="studio-control"><section><h3>{mode === 'live' ? '直播控制' : '录制控制'}</h3><div className="device-row"><span><Mic size={17} />麦克风</span><StatusBadge status="success">正常</StatusBadge></div>{mode === 'live' ? <div className="viewer-metric"><Users size={18} /><div><strong>{recording ? '12' : '0'}</strong><span>在线学生</span></div></div> : null}{!recording ? <button className="button primary full" onClick={start}><Radio size={17} />{mode === 'live' ? '开始直播并录制' : '开始录制'}</button> : <button className="button danger full" onClick={stop}><Square size={16} />{mode === 'live' ? '结束直播' : '结束录制'}</button>}{lastPackage ? <button className="button secondary full" disabled={saveTask?.status === 'running'} onClick={() => void save()}><Save size={17} />{saveTask?.status === 'succeeded' ? '已保存' : saveTask?.status === 'running' ? '上传中…' : '保存录制内容'}</button> : null}</section><section><h3>当前题目</h3><div className="current-question-summary"><strong>第 {current?.number} 题</strong><span>{current?.type} · {current?.points} 分</span></div><button className="button secondary full" disabled={index >= queue.length - 1} onClick={() => setIndex((value) => Math.min(queue.length - 1, value + 1))}>完成并切换下一题<ChevronRight size={17} /></button><p className="control-note">切换题目时会记录当前题目的结束时间和下一题的开始时间，用于直播回放自动分段。</p></section></aside></div></main>
}

function RecordingLibraryLegacy({ assets }: { assets: RecordingAsset[] }) {
  return <main className="page-content"><PageHeader title="录制内容" description="统一管理直播回放、按题切片和单题录制，并完成审核与发布。" actions={<button className="button primary"><FileCheck2 size={17} />批量发布</button>} /><section className="metric-grid"><MetricCard label="可发布内容" value={String(assets.filter((item) => item.status === 'ready' && !item.published).length)} note="已完成处理，等待审核" icon={<FileCheck2 size={19} />} /><MetricCard label="处理中" value={String(assets.filter((item) => item.status === 'processing').length)} note="转码、切片或封面生成中" icon={<LoaderCircle size={19} />} tone="warning" /><MetricCard label="本月已发布" value={String(assets.filter((item) => item.published).length)} note="学生端可正常访问" icon={<Play size={19} />} tone="success" /></section><section className="content-card"><div className="card-toolbar"><div><h2>内容资产</h2><span>共 {assets.length} 条</span></div><div className="toolbar-controls"><label className="search-field"><Search size={17} /><input placeholder="搜索题目或场次" /></label><button className="button secondary">全部来源<ChevronDown size={15} /></button></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>内容名称</th><th>来源</th><th>时长</th><th>处理状态</th><th>发布状态</th><th>创建时间</th><th></th></tr></thead><tbody>{assets.map((asset) => <tr key={asset.id}><td><div className="asset-title"><span><Play size={17} /></span><strong>{asset.title}</strong></div></td><td>{asset.source}</td><td>{asset.duration}</td><td>{asset.status === 'ready' ? <StatusBadge status="success">可播放</StatusBadge> : asset.status === 'processing' ? <StatusBadge status="warning">处理中</StatusBadge> : <StatusBadge status="danger">处理失败</StatusBadge>}</td><td>{asset.published ? <StatusBadge status="success">已发布</StatusBadge> : <span className="muted">草稿</span>}</td><td className="muted">{asset.createdAt}</td><td><div className="row-actions"><button className="text-button">预览</button><button className="icon-button"><MoreHorizontal size={18} /></button></div></td></tr>)}</tbody></table></div></section></main>
}

function RecordingLibrary({ assets }: { assets: RecordingAsset[] }) {
  const [selectedAsset, setSelectedAsset] = useState<RecordingAsset | null>(null)
  return <main className="page-content"><PageHeader title="录制内容" description="管理 tldraw 基线快照与事件时序包，审核后发布为可交互白板回放。" actions={<button className="button primary"><FileCheck2 size={17} />批量发布</button>} /><section className="metric-grid"><MetricCard label="可发布内容" value={String(assets.filter((item) => item.status === 'ready' && !item.published).length)} note="时序包已校验，等待审核" icon={<FileCheck2 size={19} />} /><MetricCard label="处理中" value={String(assets.filter((item) => item.status === 'processing').length)} note="事件分片、关键帧或音频对齐中" icon={<LoaderCircle size={19} />} tone="warning" /><MetricCard label="本月已发布" value={String(assets.filter((item) => item.published).length)} note="学生端可按题回放" icon={<Play size={19} />} tone="success" /></section><section className="content-card"><div className="card-toolbar"><div><h2>tldraw 时序录制</h2><span>共 {assets.length} 条</span></div><div className="toolbar-controls"><label className="search-field"><Search size={17} /><input placeholder="搜索题目或场次" /></label><button className="button secondary">全部来源<ChevronDown size={15} /></button></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>内容名称</th><th>录制来源</th><th>时长</th><th>时序包状态</th><th>发布状态</th><th>创建时间</th><th></th></tr></thead><tbody>{assets.map((asset) => <tr key={asset.id}><td><div className="asset-title"><span><Play size={17} /></span><strong>{asset.title}</strong></div></td><td>{asset.source}</td><td>{asset.duration}</td><td>{asset.status === 'ready' ? <StatusBadge status="success">可回放</StatusBadge> : asset.status === 'processing' ? <StatusBadge status="warning">生成关键帧中</StatusBadge> : <StatusBadge status="danger">处理失败</StatusBadge>}</td><td>{asset.published ? <StatusBadge status="success">已发布</StatusBadge> : <span className="muted">草稿</span>}</td><td className="muted">{asset.createdAt}</td><td><div className="row-actions"><button className="text-button" onClick={() => setSelectedAsset(asset)}>时序预览</button><button className="icon-button"><MoreHorizontal size={18} /></button></div></td></tr>)}</tbody></table></div></section>{selectedAsset ? <ReplayDialog asset={selectedAsset} onClose={() => setSelectedAsset(null)} /> : null}</main>
}

function ReplayDialog({ asset, onClose }: { asset: RecordingAsset; onClose: () => void }) {
  return <div className="replay-dialog-layer" role="dialog" aria-modal="true" aria-label="tldraw 时序回放"><header><div><span className="eyebrow">老师审核预览</span><strong>{asset.title}</strong></div><div><span>基线快照 + 事件时序 + 音频轨道</span><button className="icon-button" onClick={onClose}><X size={19} /></button></div></header><TldrawSequencePlayer sessionId={asset.id} title={asset.title} /></div>
}

function TeacherProductLibrary({ products, papers, assets, onSaved }: { products: LearningProduct[]; papers: Paper[]; assets: RecordingAsset[]; onSaved: (product: LearningProduct) => void }) {
  const [editing, setEditing] = useState<LearningProduct | null>(null)
  const published = products.filter((product) => product.status === 'published')
  const revenue = published.reduce((total, product) => total + product.price * product.sales, 0)
  const createProduct = () => setEditing({ id: crypto.randomUUID(), teacherName: '王老师', title: '', subtitle: '', subject: '数学', grade: '高三', productType: '整卷讲解', paperId: papers[0]?.id, questionIds: [], recordingAssetIds: assets.filter((asset) => asset.status === 'ready').map((asset) => asset.id), price: 39, status: 'draft', coverStyle: 'indigo', lessonCount: assets.length, duration: '待计算', sales: 0, rating: 0, description: '', highlights: ['tldraw 白板时序回放', '按题自由跳转', '永久有效'] })
  return <main className="page-content"><PageHeader title="内容商品" description="将审核通过的试卷或单题时序录制包装为学习商品，设置价格后发布到学习 Web。" actions={<button className="button primary" onClick={createProduct}><Plus size={17} />创建内容商品</button>} /><section className="metric-grid"><MetricCard label="已发布商品" value={String(published.length)} note={`${products.filter((product) => product.status === 'draft').length} 个草稿待完善`} icon={<ShoppingBag size={19} />} /><MetricCard label="累计购买" value={String(published.reduce((total, product) => total + product.sales, 0))} note="购买后永久进入学生内容库" icon={<Users size={19} />} tone="success" /><MetricCard label="内容销售额" value={`¥${revenue.toLocaleString('zh-CN')}`} note="未扣除平台技术服务费" icon={<ShoppingCart size={19} />} tone="warning" /></section><section className="content-card"><div className="card-toolbar"><div><h2>商品列表</h2><span>整卷、专题和单题均可独立定价</span></div><div className="toolbar-controls"><label className="search-field"><Search size={17} /><input placeholder="搜索商品名称" /></label><button className="button secondary">全部状态<ChevronDown size={15} /></button></div></div><div className="table-scroll"><table className="data-table product-table"><thead><tr><th>商品</th><th>内容类型</th><th>售价</th><th>销量</th><th>评分</th><th>状态</th><th></th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="product-name-cell"><div className={`mini-product-cover ${product.coverStyle}`}><BookOpenCheck size={18} /></div><div><strong>{product.title}</strong><small>{product.lessonCount} 讲 · {product.duration}</small></div></div></td><td>{product.productType}</td><td><strong className="price-text">¥{product.price}</strong></td><td>{product.sales}</td><td>{product.rating ? `${product.rating} ★` : '—'}</td><td>{product.status === 'published' ? <StatusBadge status="success">销售中</StatusBadge> : product.status === 'reviewing' ? <StatusBadge status="warning">审核中</StatusBadge> : <StatusBadge status="neutral">草稿</StatusBadge>}</td><td><div className="row-actions"><button className="text-button" onClick={() => setEditing(product)}>编辑定价</button><button className="icon-button"><MoreHorizontal size={18} /></button></div></td></tr>)}</tbody></table></div></section>{editing ? <ProductEditorDialog product={editing} papers={papers} assets={assets} onClose={() => setEditing(null)} onSaved={(product) => { onSaved(product); setEditing(null) }} /> : null}</main>
}

function ProductEditorDialog({ product, papers, assets, onClose, onSaved }: { product: LearningProduct; papers: Paper[]; assets: RecordingAsset[]; onClose: () => void; onSaved: (product: LearningProduct) => void }) {
  const [draft, setDraft] = useState(product)
  const [saving, setSaving] = useState(false)
  const save = async (publish: boolean) => { setSaving(true); try { onSaved(await teachingRepository.saveLearningProduct({ ...draft, status: publish ? 'published' : 'draft', publishedAt: publish ? new Date().toISOString().slice(0, 10) : draft.publishedAt })) } finally { setSaving(false) } }
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="编辑内容商品"><button className="modal-scrim" onClick={onClose} /><section className="modal product-editor"><div className="modal-header"><div><span className="eyebrow">内容商品</span><h2>{product.title || '创建新商品'}</h2><p>只有审核通过的 tldraw 时序录制可以作为付费内容发布。</p></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><div className="product-editor-layout"><div className="product-form"><label className="field-label">商品名称<input className="text-input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：高三数学月考逐题精讲" /></label><label className="field-label">一句话介绍<input className="text-input" value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} /></label><div className="two-fields"><label className="field-label">商品类型<select className="text-input" value={draft.productType} onChange={(event) => setDraft({ ...draft, productType: event.target.value as LearningProduct['productType'] })}><option>整卷讲解</option><option>专题合集</option><option>单题精讲</option></select></label><label className="field-label">关联试卷<select className="text-input" value={draft.paperId} onChange={(event) => setDraft({ ...draft, paperId: event.target.value })}>{papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.title}</option>)}</select></label></div><label className="field-label">商品介绍<textarea className="text-input textarea" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><div className="asset-selector"><div><strong>已关联录制资产</strong><span>{draft.recordingAssetIds.length} 个 tldraw 时序包</span></div>{assets.map((asset) => <label key={asset.id}><input type="checkbox" checked={draft.recordingAssetIds.includes(asset.id)} onChange={(event) => setDraft({ ...draft, recordingAssetIds: event.target.checked ? [...draft.recordingAssetIds, asset.id] : draft.recordingAssetIds.filter((id) => id !== asset.id) })} /><span><strong>{asset.title}</strong><small>{asset.duration} · {asset.status === 'ready' ? '可发布' : '处理中'}</small></span></label>)}</div></div><aside className="pricing-panel"><div className={`product-cover-preview ${draft.coverStyle}`}><span>{draft.grade} · {draft.subject}</span><strong>{draft.title || '商品名称'}</strong><small>{draft.productType} · tldraw 时序精讲</small></div><label className="field-label">销售价格<div className="money-input"><span>¥</span><input type="number" min="0" step="0.1" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })} /></div></label><p>平台支持按商品永久购买。正式结算时将根据平台协议扣除技术服务费。</p><div className="publish-check"><Check size={15} /><span>已关联 {draft.recordingAssetIds.length} 个录制资产</span></div></aside></div><div className="modal-actions"><button className="button secondary" disabled={saving} onClick={() => void save(false)}>保存草稿</button><button className="button primary" disabled={saving || !draft.title || draft.recordingAssetIds.length === 0} onClick={() => void save(true)}>{saving ? <LoaderCircle className="spin" size={17} /> : <FileCheck2 size={17} />}定价并发布</button></div></section></div>
}

function TeacherTaskMarketplace({ tasks, onAccept }: { tasks: TeachingTask[]; onAccept: (task: TeachingTask) => void }) {
  const [selected, setSelected] = useState<TeachingTask | null>(null)
  const openTasks = tasks.filter((task) => task.status === 'open')
  return <main className="page-content"><PageHeader title="任务大厅" description="学生发布真实讲题需求，老师根据专业方向、时间和服务价格自主接单。" actions={<button className="button secondary"><CalendarDays size={17} />我的履约日程</button>} /><section className="teacher-market-summary"><div><span>今日可接任务</span><strong>{openTasks.length}</strong><small>其中 {openTasks.filter((task) => task.subject === '数学').length} 个匹配你的教学方向</small></div><div><span>本月已完成</span><strong>18</strong><small>按时交付率 100%</small></div><div><span>预计收入</span><strong>¥2,680</strong><small>待结算 ¥438</small></div><div className="teacher-score"><span>服务评分</span><strong>4.9 <Star size={16} fill="currentColor" /></strong><small>来自 126 次学生评价</small></div></section><div className="market-layout"><section className="task-feed"><div className="market-filter"><div><button className="active">智能推荐</button><button>最新发布</button><button>价格优先</button></div><div><button className="button secondary">高中数学<ChevronDown size={15} /></button><button className="button secondary">可直播<ChevronDown size={15} /></button></div></div>{openTasks.map((task) => <article className="teacher-task-card" key={task.id}><div className="task-card-top"><div><StatusBadge status={task.serviceType === '直播讲解' ? 'danger' : 'neutral'}>{task.serviceType}</StatusBadge><span>{task.publishedAt}</span></div><strong>¥{task.budget}</strong></div><h2>{task.title}</h2><p>{task.description}</p><div className="task-tags">{task.tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="task-meta"><span><Users size={15} />{task.studentGrade} · {task.studentName}</span><span><ListChecks size={15} />{task.questionCount} 道题</span><span><Clock3 size={15} />{task.expectedAt}</span><span>{task.applicants} 位老师正在申请</span></div><div className="task-actions"><button className="button secondary" onClick={() => setSelected(task)}>查看需求</button><button className="button primary" onClick={() => setSelected(task)}>申请接单</button></div></article>)}</section><aside className="market-side"><section><h3>接单规则</h3><ol><li><span>1</span><p><strong>确认能力与时间</strong><small>接单后需在约定时间内完成履约</small></p></li><li><span>2</span><p><strong>学生选择老师</strong><small>申请后由学生查看履历并确认</small></p></li><li><span>3</span><p><strong>平台担保交易</strong><small>完成交付并确认后结算服务费</small></p></li></ol></section><section className="teacher-profile-card"><div className="avatar">王</div><strong>完善老师服务档案</strong><p>补充擅长领域和可服务时间，提高推荐匹配率。</p><div><i style={{ width: '76%' }} /></div><span>完整度 76%</span><button className="button secondary full">继续完善</button></section></aside></div>{selected ? <TaskAcceptDialog task={selected} onClose={() => setSelected(null)} onConfirm={() => { const task = selected; setSelected(null); onAccept(task) }} /> : null}</main>
}

function TaskAcceptDialog({ task, onClose, onConfirm }: { task: TeachingTask; onClose: () => void; onConfirm: () => void }) {
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="申请接单"><button className="modal-scrim" onClick={onClose} /><section className="modal task-dialog"><div className="modal-header"><div><span className="eyebrow">申请接单</span><h2>{task.title}</h2><p>{task.studentGrade} · {task.questionCount} 道题 · {task.serviceType}</p></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><div className="task-detail-price"><div><span>学生预算</span><strong>¥{task.budget}</strong></div><div><span>期望完成</span><strong>{task.expectedAt}</strong></div><div><span>平台服务保障</span><strong>担保交易</strong></div></div><div className="task-requirement"><strong>需求说明</strong><p>{task.description}</p></div><label className="field-label">给学生的申请说明<textarea className="text-input textarea" defaultValue="你好，我擅长高中数学对应专题，可以按时完成讲解。直播中会先梳理解题方法，再逐题互动答疑。" /></label><div className="modal-actions"><button className="button secondary" onClick={onClose}>暂不申请</button><button className="button primary" onClick={onConfirm}><Check size={17} />确认申请</button></div></section></div>
}

function StudentPortal({ papers, questions, assets, tasks, loading, onTaskCreated, onSwitchPortal }: { papers: Paper[]; questions: Question[]; assets: RecordingAsset[]; tasks: TeachingTask[]; loading: boolean; onTaskCreated: (task: TeachingTask) => void; onSwitchPortal: () => void }) {
  const [view, setView] = useState<'home' | 'live' | 'replay' | 'tasks'>('home')
  const [publishOpen, setPublishOpen] = useState(false)
  const [activeQuestionId, setActiveQuestionId] = useState(questions[0]?.id ?? 'q-001')
  if (loading) return <div className="student-portal"><LoadingState /></div>
  if (view === 'live') return <StudentLiveRoom questions={questions} onExit={() => setView('home')} />
  if (view === 'replay') return <StudentReplay questions={questions} assets={assets} activeQuestionId={activeQuestionId} onSelect={setActiveQuestionId} onExit={() => setView('home')} />
  if (view === 'tasks') return <StudentTaskCenter tasks={tasks.filter((task) => task.studentName === '陈同学')} onBack={() => setView('home')} onPublish={() => setPublishOpen(true)} publishOpen={publishOpen} onClosePublish={() => setPublishOpen(false)} onTaskCreated={onTaskCreated} />
  const publishedAssets = assets.filter((asset) => asset.published || asset.status === 'ready')
  return <div className="student-portal"><StudentHeader active="home" onNavigate={(target) => target === 'tasks' ? setView('tasks') : setView('home')} onSwitchPortal={onSwitchPortal} /><main className="student-content"><section className="student-demand-hero"><div><span className="eyebrow">一对一讲题服务</span><h1>不会的题，找专业老师讲明白</h1><p>上传试卷或错题，说明你的需求和时间。平台匹配专业老师，支持直播互动和录制讲解。</p><div><button className="student-primary" onClick={() => setPublishOpen(true)}><Plus size={18} />发布讲题任务</button><button className="student-ghost" onClick={() => setView('tasks')}>查看我的任务</button></div><div className="trust-row"><span><Check size={14} />老师实名认证</span><span><Check size={14} />平台担保交易</span><span><Check size={14} />不满意可申诉</span></div></div><div className="student-order-preview"><div><span>进行中的任务</span><StatusBadge status="warning">等待直播</StatusBadge></div><h2>高三数学第一次月考讲评</h2><p>王老师已接单 · 今天 19:30</p><div className="order-steps"><span className="done"><Check size={13} />已发布</span><i /><span className="done"><Check size={13} />已接单</span><i /><span className="active">待讲解</span><i /><span>确认完成</span></div><button onClick={() => setView('live')}>进入订单详情<ChevronRight size={16} /></button></div></section><section className="student-section student-service-section"><div className="section-heading"><div><h2>选择你需要的服务</h2><p>从一道难题到整张试卷，都能找到合适的老师</p></div></div><div className="service-grid"><button onClick={() => setPublishOpen(true)}><span><Radio size={22} /></span><div><strong>直播互动讲题</strong><p>与老师实时沟通，当场解决疑问</p></div><ChevronRight size={18} /></button><button onClick={() => setPublishOpen(true)}><span><Video size={22} /></span><div><strong>录制讲解交付</strong><p>老师按题录制，可随时反复观看</p></div><ChevronRight size={18} /></button><button onClick={() => setPublishOpen(true)}><span><FileText size={22} /></span><div><strong>整卷系统讲评</strong><p>上传试卷，按薄弱点定制讲解</p></div><ChevronRight size={18} /></button></div></section><section className="student-section"><div className="section-heading"><div><h2>最近学习</h2><p>你的讲题订单会沉淀为长期学习内容</p></div><button>查看全部<ChevronRight size={16} /></button></div><div className="lesson-grid">{publishedAssets.slice(0, 3).map((asset, index) => <button className="lesson-card" key={asset.id} onClick={() => { setActiveQuestionId(asset.questionIds[0]); setView('replay') }}><div className={`lesson-cover cover-${index + 1}`}><span><Play size={20} /></span><small>{asset.duration}</small></div><div><span className="lesson-tag">{asset.source}</span><h3>{asset.title}</h3><p>高三数学第一次月考</p><div className="lesson-progress"><div><i style={{ width: index === 0 ? '68%' : '0%' }} /></div><span>{index === 0 ? '已学习 68%' : '未开始'}</span></div></div></button>)}</div></section></main>{publishOpen ? <PublishTaskDialog onClose={() => setPublishOpen(false)} onCreated={(task) => { onTaskCreated(task); setPublishOpen(false); setView('tasks') }} /> : null}</div>
}

function StudentHeader({ active, onNavigate, onSwitchPortal }: { active: 'home' | 'tasks'; onNavigate: (target: 'home' | 'tasks') => void; onSwitchPortal?: () => void }) {
  return <header className="student-topbar"><div className="student-brand"><span><Sparkles size={18} /></span><strong>知问课堂</strong></div><nav><button className={active === 'home' ? 'active' : ''} onClick={() => onNavigate('home')}>学习首页</button><button className={active === 'tasks' ? 'active' : ''} onClick={() => onNavigate('tasks')}>我的任务</button><button>我的课程</button><button>学习记录</button></nav><div>{onSwitchPortal ? <button className="portal-switch" onClick={onSwitchPortal}>返回老师端</button> : null}<div className="avatar">陈</div></div></header>
}

function StudentTaskCenter({ tasks, onBack, onPublish, publishOpen, onClosePublish, onTaskCreated }: { tasks: TeachingTask[]; onBack: () => void; onPublish: () => void; publishOpen: boolean; onClosePublish: () => void; onTaskCreated: (task: TeachingTask) => void }) {
  return <div className="student-portal"><StudentHeader active="tasks" onNavigate={(target) => target === 'home' && onBack()} /><main className="student-task-page"><PageHeader title="我的讲题任务" description="查看老师申请、履约进度、交付内容和售后状态。" actions={<button className="button primary" onClick={onPublish}><Plus size={17} />发布新任务</button>} /><div className="student-task-tabs"><button className="active">全部任务 <span>{tasks.length}</span></button><button>待选老师</button><button>待讲解</button><button>待确认</button><button>已完成</button></div><section className="student-orders">{tasks.map((task) => <article key={task.id}><div className="student-order-head"><div><span>订单 {task.id.toUpperCase()}</span><small>{task.publishedAt}</small></div><TaskStatusLabel status={task.status} /></div><div className="student-order-body"><div className="order-subject"><span><FileText size={20} /></span><div><strong>{task.title}</strong><p>{task.studentGrade} · {task.subject} · {task.questionCount} 道题 · {task.serviceType}</p><div className="task-tags">{task.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div></div><div className="order-teacher">{task.teacherName ? <><div className="avatar">{task.teacherName.slice(0, 1)}</div><div><span>服务老师</span><strong>{task.teacherName}</strong></div></> : <><div className="applicant-stack"><span>王</span><span>李</span><span>周</span></div><div><span>老师申请</span><strong>{task.applicants} 位</strong></div></>}</div><div className="order-time"><span>期望时间</span><strong>{task.expectedAt}</strong></div><div className="order-price"><span>订单金额</span><strong>¥{task.budget}</strong></div></div><div className="student-order-actions">{task.status === 'open' ? <><span>已有老师申请，选择后进入平台担保</span><button className="button primary">选择老师</button></> : task.status === 'scheduled' ? <><span>老师将在约定时间开始直播</span><button className="button primary">查看订单</button></> : <><span>讲解内容已交付，请及时确认</span><button className="button secondary">查看回放</button><button className="button primary">确认完成</button></>}</div></article>)}</section></main>{publishOpen ? <PublishTaskDialog onClose={onClosePublish} onCreated={onTaskCreated} /> : null}</div>
}

function PublishTaskDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (task: TeachingTask) => void }) {
  const [step, setStep] = useState(1)
  const [serviceType, setServiceType] = useState<TeachingTask['serviceType']>('直播讲解')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState(89)
  const [submitting, setSubmitting] = useState(false)
  const publish = async () => { setSubmitting(true); try { onCreated(await teachingRepository.publishTeachingTask({ studentName: '陈同学', studentGrade: '高三', subject: '数学', title: title || '数学错题一对一讲解', description: description || '希望老师梳理解题思路，并对重点步骤进行详细讲解。', questionCount: 3, serviceType, expectedAt: '明天 20:00 前', budget, tags: ['高中数学', '错题讲解'] })) } finally { setSubmitting(false) } }
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="发布讲题任务"><button className="modal-scrim" onClick={onClose} /><section className="modal publish-task-modal"><div className="modal-header"><div><span className="eyebrow">发布讲题任务</span><h2>{step === 1 ? '上传题目与试卷' : step === 2 ? '说明讲题需求' : '确认预算与时间'}</h2><p>第 {step} 步，共 3 步</p></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><div className="publish-progress"><i className={step >= 1 ? 'active' : ''} /><i className={step >= 2 ? 'active' : ''} /><i className={step >= 3 ? 'active' : ''} /></div>{step === 1 ? <><label className="dropzone task-upload"><FileUp size={28} /><strong>上传试卷 PDF 或题目图片</strong><span>支持 PDF、JPG、PNG，AI 将自动识别题目</span><input type="file" accept="application/pdf,image/*" /></label><div className="upload-security"><Check size={15} /><span>文件仅用于本次讲题服务，老师接单后才可查看</span></div></> : step === 2 ? <><label className="field-label">任务标题<input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：月考函数与导数错题讲解" /></label><label className="field-label">期望讲解方式<div className="service-select">{(['直播讲解', '录制讲解', '均可'] as const).map((type) => <button className={serviceType === type ? 'active' : ''} key={type} onClick={() => setServiceType(type)}>{type === '直播讲解' ? <Radio size={18} /> : type === '录制讲解' ? <Video size={18} /> : <BookOpenCheck size={18} />}<span>{type}</span></button>)}</div></label><label className="field-label">补充要求<textarea className="text-input textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="告诉老师你的薄弱点、希望重点讲解的题目和讲解方式" /></label></> : <><div className="publish-price"><label className="field-label">任务预算<div className="money-input"><span>¥</span><input type="number" value={budget} onChange={(event) => setBudget(Number(event.target.value))} /></div></label><div className="price-guide"><span>同类任务参考价</span><strong>¥69–129</strong><small>最终价格由服务内容、题目数量和老师资历决定</small></div></div><label className="field-label">期望完成时间<select className="text-input"><option>明天 20:00 前</option><option>后天 18:00 前</option><option>本周内</option></select></label><div className="escrow-note"><Check size={17} /><div><strong>平台担保交易</strong><span>确认老师后再付款，讲解完成并由你确认后才会结算给老师。</span></div></div></>}<div className="modal-actions"><button className="button secondary" onClick={() => step === 1 ? onClose() : setStep((value) => value - 1)}>{step === 1 ? '取消' : '上一步'}</button>{step < 3 ? <button className="button primary" onClick={() => setStep((value) => value + 1)}>下一步<ChevronRight size={16} /></button> : <button className="button primary" disabled={submitting} onClick={() => void publish()}>{submitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}确认发布</button>}</div></section></div>
}

function TaskStatusLabel({ status }: { status: TeachingTask['status'] }) {
  if (status === 'open') return <StatusBadge status="warning">等待选择老师</StatusBadge>
  if (status === 'scheduled') return <StatusBadge status="neutral">待讲解</StatusBadge>
  if (status === 'delivered') return <StatusBadge status="success">待确认</StatusBadge>
  return <StatusBadge status="neutral">进行中</StatusBadge>
}

function StudentLiveRoom({ questions, onExit }: { questions: Question[]; onExit: () => void }) {
  const store = useSync({ uri: createSyncUri(defaultSyncRoomId, 'viewer'), assets: syncAssetStore })
  const current = questions[1] ?? questions[0]
  return <div className="student-room"><header><div><button className="icon-button" onClick={onExit}><ArrowLeft size={19} /></button><div><strong>高三数学第一次月考讲评</strong><span>王老师 · 直播中</span></div></div><div className="student-live-status"><span className="live-dot" />LIVE　18:36</div><button className="button secondary">课堂反馈</button></header><main><section className="viewer-board"><div className="question-overlay student"><span>第 {current?.number} 题 · {current?.type}</span><strong>{current?.stem}</strong></div><Tldraw store={store} components={{ Toolbar: null, StylePanel: null, MainMenu: null, PageMenu: null, ActionsMenu: null, ContextMenu: null, NavigationPanel: null, HelperButtons: null, DebugPanel: null, Minimap: null, QuickActions: null, SharePanel: null, ZoomMenu: null }} onMount={(editor) => { editor.updateInstanceState({ isReadonly: true }) }} /></section><aside className="student-room-panel"><div className="teacher-profile"><div className="avatar">王</div><div><strong>王老师</strong><span>高中数学 · 12 年教龄</span></div></div><section><h3>本场讲题</h3>{questions.slice(0, 5).map((question) => <div className={question.id === current?.id ? 'active' : ''} key={question.id}><span>{question.number}</span><div><strong>第 {question.number} 题</strong><small>{question.type}</small></div>{question.id === current?.id ? <span>讲解中</span> : null}</div>)}</section><div className="student-question-box"><strong>有疑问？</strong><p>提交问题后老师可以在直播中看到。</p><button className="button secondary full">举手提问</button></div></aside></main></div>
}

function StudentReplayLegacy({ questions, activeQuestionId, onSelect, onExit }: { questions: Question[]; activeQuestionId: string; onSelect: (id: string) => void; onExit: () => void }) {
  const question = questions.find((item) => item.id === activeQuestionId) ?? questions[0]
  return <div className="replay-page"><header className="student-topbar"><div className="student-brand"><span><Sparkles size={18} /></span><strong>知问课堂</strong></div><button className="back-link" onClick={onExit}><ArrowLeft size={16} />返回学习首页</button><div className="avatar">陈</div></header><main><div className="replay-heading"><div><span>高三数学第一次月考</span><h1>逐题讲解</h1></div><div><strong>{questions.filter((item) => item.teachingStatus !== 'unrecorded').length}</strong> / {questions.length} 题已学习</div></div><div className="replay-layout"><aside className="replay-list"><div><strong>试卷题目</strong><span>{questions.length} 题</span></div>{questions.map((item) => <button className={item.id === question?.id ? 'active' : ''} key={item.id} onClick={() => onSelect(item.id)}><span>{item.number}</span><div><strong>第 {item.number} 题</strong><small>{item.type} · {item.points} 分</small></div>{item.teachingStatus === 'recorded' ? <Check size={15} /> : null}</button>)}</aside><section className="replay-player"><div className="video-placeholder"><div><Play size={30} /></div><span>白板事件回放 + 教师音频</span></div><div className="fake-timeline"><button><Play size={16} /></button><span>01:48</span><div><i style={{ width: '41%' }} /></div><span>04:26</span></div><article><span className="eyebrow">第 {question?.number} 题 · {question?.type}</span><h2>{question?.stem}</h2><div className="answer-panel"><strong>答案：{question?.answer}</strong><p>{question?.analysis}</p></div></article></section></div></main></div>
}

function StudentReplay({ questions, assets, activeQuestionId, onSelect, onExit }: { questions: Question[]; assets: RecordingAsset[]; activeQuestionId: string; onSelect: (id: string) => void; onExit: () => void }) {
  const question = questions.find((item) => item.id === activeQuestionId) ?? questions[0]
  const asset = assets.find((item) => item.questionIds.includes(question?.id ?? ''))
  return <div className="replay-page"><header className="student-topbar"><div className="student-brand"><span><Sparkles size={18} /></span><strong>知问课堂</strong></div><button className="back-link" onClick={onExit}><ArrowLeft size={16} />返回学习首页</button><div className="avatar">陈</div></header><main><div className="replay-heading"><div><span>高三数学第一次月考</span><h1>tldraw 逐题时序回放</h1></div><div><strong>{questions.filter((item) => item.teachingStatus !== 'unrecorded').length}</strong> / {questions.length} 题已学习</div></div><div className="replay-layout"><aside className="replay-list"><div><strong>试卷题目</strong><span>{questions.length} 题</span></div>{questions.map((item) => <button className={item.id === question?.id ? 'active' : ''} key={item.id} onClick={() => onSelect(item.id)}><span>{item.number}</span><div><strong>第 {item.number} 题</strong><small>{item.type} · {item.points} 分</small></div>{item.teachingStatus === 'recorded' ? <Check size={15} /> : null}</button>)}</aside><section className="sequence-learning"><TldrawSequencePlayer sessionId={asset?.id} title={asset?.title ?? `第 ${question?.number} 题讲解`} compact /><article><span className="eyebrow">第 {question?.number} 题 · {question?.type}</span><h2>{question?.stem}</h2><div className="answer-panel"><strong>答案：{question?.answer}</strong><p>{question?.analysis}</p></div></article></section></div></main></div>
}

function TldrawSequencePlayer({ sessionId, title, compact = false }: { sessionId?: string; title: string; compact?: boolean }) {
  const editorRef = useRef<Editor | null>(null)
  const timerRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cursorRef = useRef(0)
  const fallbackClockRef = useRef(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [recording, setRecording] = useState<RecordingPackage | null>(null)
  const [loading, setLoading] = useState(Boolean(sessionId))
  const [error, setError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [time, setTime] = useState(0)
  const events = useMemo(() => recording ? flattenRecordingEvents(recording) : [], [recording])
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) { window.cancelAnimationFrame(timerRef.current); timerRef.current = null }
    audioRef.current?.pause()
  }, [])
  const mountRecording = useCallback((pack: RecordingPackage) => {
    audioRef.current?.pause()
    audioRef.current = pack.audio?.url ? new Audio(pack.audio.url) : null
    if (audioRef.current) audioRef.current.preload = 'metadata'
    cursorRef.current = 0
    setRecording(pack); setCursor(0); setTime(0); setError(null)
    window.setTimeout(() => { if (editorRef.current) { loadRecordingBaseline(editorRef.current, pack); editorRef.current.updateInstanceState({ isReadonly: true }) } }, 0)
  }, [])

  useEffect(() => {
    if (!sessionId) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    recordingStorage.load(sessionId).then((pack) => { if (!cancelled) mountRecording(pack) }).catch(() => { if (!cancelled) setError('该开发数据尚未绑定真实录制包；正式环境将按 sessionId 加载基线快照和事件分片。') }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [mountRecording, sessionId])

  const playFrom = useCallback((index: number) => {
    if (!recording || !editorRef.current) return
    cursorRef.current = index
    fallbackClockRef.current = performance.now() - time
    const audio = audioRef.current
    if (audio && recording.audio) {
      audio.currentTime = Math.max(0, (time - recording.audio.startOffsetMs) / 1000)
      void audio.play().catch(() => setError('音频无法播放，请检查音频地址或浏览器自动播放策略。'))
    }
    setPlaying(true)
    const tick = () => {
      const timelineTime = audio && recording.audio
        ? Math.min(recording.duration, audio.currentTime * 1000 + recording.audio.startOffsetMs)
        : Math.min(recording.duration, performance.now() - fallbackClockRef.current)
      let nextCursor = cursorRef.current
      while (nextCursor < events.length && events[nextCursor].timestamp <= timelineTime) {
        applyRecordedEvent(editorRef.current!, events[nextCursor])
        nextCursor += 1
      }
      cursorRef.current = nextCursor
      setCursor(nextCursor)
      setTime(timelineTime)
      if (timelineTime >= recording.duration || (audio?.ended ?? false)) {
        setPlaying(false); timerRef.current = null; return
      }
      timerRef.current = window.requestAnimationFrame(tick)
    }
    timerRef.current = window.requestAnimationFrame(tick)
  }, [events, recording, time])
  const seek = useCallback((target: number) => {
    if (!recording || !editorRef.current) return
    clearTimer(); setPlaying(false)
    const result = seekRecording(editorRef.current, recording, target)
    cursorRef.current = result.cursor
    if (audioRef.current && recording.audio) audioRef.current.currentTime = Math.max(0, (target - recording.audio.startOffsetMs) / 1000)
    setCursor(result.cursor); setTime(result.time)
  }, [clearTimer, recording])
  const reset = useCallback(() => {
    if (!recording || !editorRef.current) return
    clearTimer(); loadRecordingBaseline(editorRef.current, recording)
    if (audioRef.current) audioRef.current.currentTime = 0
    cursorRef.current = 0; setCursor(0); setTime(0); setPlaying(false)
  }, [clearTimer, recording])
  useEffect(() => clearTimer, [clearTimer])

  return <section className={`sequence-player ${compact ? 'compact' : ''}`}><div className="sequence-stage"><Tldraw onMount={(editor) => { editorRef.current = editor; editor.updateInstanceState({ isReadonly: true }); if (recording) loadRecordingBaseline(editor, recording) }} components={{ Toolbar: null, StylePanel: null, MainMenu: null, PageMenu: null, ActionsMenu: null, ContextMenu: null, NavigationPanel: null, HelperButtons: null, DebugPanel: null, Minimap: null, QuickActions: null, SharePanel: null, ZoomMenu: null }} />{loading ? <div className="sequence-message"><LoaderCircle className="spin" size={22} /><strong>正在加载 tldraw 时序包</strong></div> : error || !recording ? <div className="sequence-message"><BookOpenCheck size={23} /><strong>{title}</strong><span>{compact ? '老师正在整理白板事件和音频时间轴，完成后即可回放。' : error ?? '尚未生成录制时序包'}</span>{!compact ? <><input ref={inputRef} type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void recordingStorage.load(file).then(mountRecording) }} /><button className="button secondary" onClick={() => inputRef.current?.click()}>导入本地录制包验证</button></> : null}</div> : null}</div><div className="sequence-controls"><button className="icon-button" disabled={!recording} onClick={() => playing ? (clearTimer(), setPlaying(false)) : playFrom(cursor)}>{playing ? <Pause size={17} /> : <Play size={17} />}</button><button className="icon-button" disabled={!recording} onClick={reset}><RotateCcw size={16} /></button><span>{formatMs(time)}</span><input type="range" min={0} max={recording?.duration ?? 0} step={50} value={time} disabled={!recording} onChange={(event) => seek(Number(event.target.value))} /><span>{formatMs(recording?.duration ?? 0)}</span><div className="sequence-meta"><span>{events.length} 个事件</span><span>{recording?.keyframes?.length ?? 0} 个关键帧</span></div></div></section>
}

function LearningStore({ products, questions, assets, onSwitchPortal }: { products: LearningProduct[]; questions: Question[]; assets: RecordingAsset[]; onSwitchPortal: () => void }) {
  const [view, setView] = useState<'home' | 'detail' | 'library'>('home')
  const [selectedId, setSelectedId] = useState(products[0]?.id)
  const [purchasedIds, setPurchasedIds] = useState<string[]>(products.slice(0, 1).map((product) => product.id))
  const selected = products.find((product) => product.id === selectedId) ?? products[0]
  const header = <header className="store-header"><div className="store-brand"><span><Sparkles size={18} /></span><div><strong>知问学习</strong><small>让每一道题都有好老师讲明白</small></div></div><nav><button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}>发现好课</button><button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}>我的内容库</button><button>分类</button></nav><label className="store-search"><Search size={17} /><input placeholder="搜索试卷、题目或老师" /></label><div><button className="portal-switch" onClick={onSwitchPortal}>返回老师端</button><div className="avatar">陈</div></div></header>
  if (view === 'detail' && selected) {
    const purchased = purchasedIds.includes(selected.id)
    const firstAsset = assets.find((asset) => selected.recordingAssetIds.includes(asset.id))
    return <div className="learning-store">{header}<main className="store-detail"><button className="back-link" onClick={() => setView('home')}><ArrowLeft size={16} />返回课程列表</button><section className="product-detail-hero"><div className={`store-detail-cover ${selected.coverStyle}`}><span>{selected.grade} · {selected.subject}</span><strong>{selected.productType}</strong><small>tldraw 白板时序精讲</small></div><div className="product-detail-info"><span className="eyebrow">{selected.productType}</span><h1>{selected.title}</h1><p>{selected.subtitle}</p><div className="product-rating"><strong>{selected.rating} ★</strong><span>{selected.sales} 人已购买</span><span>{selected.lessonCount} 讲 · {selected.duration}</span></div><div className="product-highlights">{selected.highlights.map((highlight) => <span key={highlight}><Check size={14} />{highlight}</span>)}</div><div className="buy-box"><div><span>限时价格</span><strong>¥{selected.price}</strong>{selected.originalPrice ? <del>¥{selected.originalPrice}</del> : null}</div>{purchased ? <button className="store-buy purchased" onClick={() => setView('library')}><BookOpenCheck size={18} />已购买，开始学习</button> : <button className="store-buy" onClick={() => setPurchasedIds((items) => [...items, selected.id])}><ShoppingCart size={18} />立即购买</button>}</div><div className="store-guarantees"><span><Check size={14} />平台安全支付</span><span><Check size={14} />购买后永久有效</span><span><Check size={14} />支持内容申诉</span></div></div></section><section className="product-detail-body"><div><h2>内容介绍</h2><p>{selected.description}</p><h2>课程目录</h2><div className="store-catalog">{questions.slice(0, Math.min(5, selected.lessonCount)).map((question, index) => <div key={question.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>第 {question.number} 题 · {question.type}</strong><small>{question.stem}</small></div><span>{purchased ? '可回放' : '购买后解锁'}</span></div>)}</div></div><aside><div className="teacher-intro"><div className="avatar">王</div><div><strong>{selected.teacherName}</strong><span>高中数学认证老师</span></div><p>专注高中数学方法教学，擅长将复杂问题拆解成可复用的解题步骤。</p><div><span><strong>4.9</strong>老师评分</span><span><strong>1,286</strong>学习人数</span></div></div></aside></section></main></div>
  }
  if (view === 'library') {
    const purchased = products.filter((product) => purchasedIds.includes(product.id))
    const activeProduct = purchased[0]
    const firstAsset = assets.find((asset) => activeProduct?.recordingAssetIds.includes(asset.id))
    return <div className="learning-store">{header}<main className="store-library"><PageHeader title="我的内容库" description="购买的整卷、专题和单题讲解会永久保存在这里。" /><div className="library-layout"><aside>{purchased.map((product) => <button className={product.id === activeProduct?.id ? 'active' : ''} key={product.id}><div className={`mini-product-cover ${product.coverStyle}`}><BookOpenCheck size={17} /></div><div><strong>{product.title}</strong><small>{product.lessonCount} 讲 · 已学习 32%</small></div></button>)}</aside><section><div className="library-heading"><div><span>正在学习</span><h2>{activeProduct?.title}</h2></div><span>购买后永久有效</span></div><TldrawSequencePlayer compact sessionId={firstAsset?.id} title={firstAsset?.title ?? activeProduct?.title ?? '学习内容'} /></section></div></main></div>
  }
  return <div className="learning-store">{header}<main className="store-home"><section className="store-hero"><div><span className="eyebrow">专业老师 · 真实板书 · 按题回放</span><h1>找到适合你的<br />试卷与题目精讲</h1><p>不是录屏视频。每一笔板书都按真实讲解时序重现，支持按题跳转和反复回放。</p><button onClick={() => { setSelectedId(products[0]?.id); setView('detail') }}>查看精选内容<ChevronRight size={17} /></button></div><div className="store-hero-visual"><div className="floating-sheet sheet-back" /><div className="floating-sheet"><span>高三数学</span><strong>月考试卷<br />逐题精讲</strong><small>22 道题 · tldraw 时序回放</small><div><i /><i /><i /></div></div><div className="floating-player"><Play size={18} /><span>正在回放第 8 题</span></div></div></section><section className="store-category"><button className="active">精选推荐</button><button>整卷讲解</button><button>专题合集</button><button>单题精讲</button><button>免费内容</button></section><section className="store-products"><div className="section-heading"><div><h2>本周精选</h2><p>来自平台认证老师的高质量时序讲解</p></div></div><div className="store-product-grid">{products.map((product) => <button key={product.id} onClick={() => { setSelectedId(product.id); setView('detail') }}><div className={`store-product-cover ${product.coverStyle}`}><span>{product.grade} · {product.subject}</span><strong>{product.title}</strong><small>{product.productType}</small><div><BookOpenCheck size={15} />{product.lessonCount} 讲</div></div><div><span className="product-type">{product.productType}</span><h3>{product.title}</h3><p>{product.subtitle}</p><div className="product-teacher"><span className="avatar">王</span><span>{product.teacherName}</span><span>{product.rating} ★</span></div><div className="product-price"><strong>¥{product.price}</strong>{product.originalPrice ? <del>¥{product.originalPrice}</del> : null}<span>{product.sales} 人购买</span></div></div></button>)}</div></section></main></div>
}

function MetricCard({ label, value, note, icon, tone = 'default' }: { label: string; value: string; note: string; icon: React.ReactNode; tone?: 'default' | 'warning' | 'success' }) { return <article className={`metric-card ${tone}`}><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div><i>{icon}</i></article> }
function PaperStatusBadge({ paper }: { paper: Paper }) { if (paper.status === 'processing') return <div className="processing-status"><span><LoaderCircle className="spin" size={15} />AI 解析中</span><div><i style={{ width: `${paper.progress}%` }} /></div><small>{paper.progress}%</small></div>; if (paper.status === 'review') return <StatusBadge status="warning">待校对</StatusBadge>; return <StatusBadge status="success">处理完成</StatusBadge> }
function StatusBadge({ status, children }: { status: 'success' | 'warning' | 'neutral' | 'danger'; children: React.ReactNode }) { return <span className={`status-badge ${status}`}>{children}</span> }
function Confidence({ value }: { value: number }) { return <div className={`confidence ${value < 90 ? 'low' : ''}`}><div><i style={{ width: `${value}%` }} /></div><span>{value}%</span></div> }
function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="error-banner"><span>{message}</span><button onClick={onRetry}>重新加载</button></div> }
function LoadingState() { return <div className="loading-state"><LoaderCircle className="spin" size={26} /><strong>正在加载教学内容</strong><span>请稍候…</span></div> }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="empty-state"><FileText size={28} /><strong>{title}</strong><span>{description}</span></div> }
function formatMs(ms: number) { const seconds = Math.floor(ms / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` }
