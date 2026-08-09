import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Download,
  Expand,
  FileUp,
  Minimize2,
  Monitor,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Save,
  Square,
  StepForward,
} from 'lucide-react'
import { Tldraw, type Editor } from 'tldraw'
import { useSync } from '@tldraw/sync'
import 'tldraw/tldraw.css'
import type { RecordingPackage } from './types'
import type { RecordingSessionSummary } from './types'
import { startRecording, stopRecording } from './recording'
import { flattenRecordingEvents } from './recording/chunks'
import { applyRecordedEvent, loadRecordingBaseline, seekRecording } from './player/replay'
import { createRecordingStorage } from './storage/createRecordingStorage'
import { createSaveTask, runSaveTask, type SaveTaskSnapshot } from './storage/saveTask'
import { createUploadPlan, summarizeUploadPlan, type UploadPlan } from './storage/uploadPlan'
import { createDefaultLiveClient, type LiveMessage } from './live/liveClient'
import { listRecordings } from './storage/recordingCatalog'
import { syncAssetStore } from './sync/assetStore'
import { createSyncUri, defaultSyncRoomId } from './sync/syncConfig'

type Mode = 'teacher' | 'player' | 'viewer' | 'sync-teacher' | 'sync-viewer' | 'catalog'
type Recorder = ReturnType<typeof startRecording>
const recordingStorage = createRecordingStorage()
const liveClient = createDefaultLiveClient()
const defaultRoomId = 'classroom-001'
const viewerOnlyComponents = {
  Toolbar: null,
  StylePanel: null,
  MainMenu: null,
  PageMenu: null,
  ActionsMenu: null,
  ContextMenu: null,
  NavigationPanel: null,
  HelperButtons: null,
  DebugPanel: null,
  Minimap: null,
  QuickActions: null,
  SharePanel: null,
  ZoomMenu: null,
}

export function App() {
  const [mode, setMode] = useState<Mode>('teacher')
  const [classroomMode, setClassroomMode] = useState(false)

  return (
    <div className={classroomMode ? 'app-shell classroom-mode' : 'app-shell'}>
      <header className="topbar" hidden={classroomMode}>
        <div>
          <strong>tldraw Recorder</strong>
          <span>Snapshot + Event Log Workbench</span>
        </div>
        <div className="segmented">
          <button className={mode === 'teacher' ? 'active' : ''} onClick={() => setMode('teacher')}>
            录制
          </button>
          <button className={mode === 'player' ? 'active' : ''} onClick={() => setMode('player')}>
            回放
          </button>
          <button className={mode === 'viewer' ? 'active' : ''} onClick={() => setMode('viewer')}>
            观看
          </button>
          <button className={mode === 'sync-teacher' ? 'active' : ''} onClick={() => setMode('sync-teacher')}>
            同步写
          </button>
          <button className={mode === 'sync-viewer' ? 'active' : ''} onClick={() => setMode('sync-viewer')}>
            同步看
          </button>
          <button className={mode === 'catalog' ? 'active' : ''} onClick={() => setMode('catalog')}>
            课程
          </button>
        </div>
      </header>
      {mode === 'teacher' ? (
        <TeacherScreen classroomMode={classroomMode} setClassroomMode={setClassroomMode} />
      ) : mode === 'player' ? (
        <PlayerScreen />
      ) : mode === 'sync-teacher' ? (
        <SyncTeacherScreen classroomMode={classroomMode} setClassroomMode={setClassroomMode} />
      ) : mode === 'sync-viewer' ? (
        <SyncViewerScreen classroomMode={classroomMode} setClassroomMode={setClassroomMode} />
      ) : mode === 'catalog' ? (
        <CatalogScreen />
      ) : (
        <ViewerScreen classroomMode={classroomMode} setClassroomMode={setClassroomMode} />
      )}
    </div>
  )
}

function CatalogScreen() {
  const [items, setItems] = useState<RecordingSessionSummary[]>([])
  const [status, setStatus] = useState('加载中')

  useEffect(() => {
    listRecordings()
      .then((recordings) => {
        setItems(recordings)
        setStatus(recordings.length ? '已加载' : '暂无录制')
      })
      .catch((error) => {
        console.error(error)
        setStatus('加载失败')
      })
  }, [])

  return (
    <main className="catalog-page">
      <header className="catalog-header">
        <strong>录制课程</strong>
        <span>{status}</span>
      </header>
      <section className="catalog-list">
        {items.map((item) => (
          <article className="recording-row" key={item.sessionId}>
            <div>
              <strong>{item.title || item.sessionId}</strong>
              <small>{item.sessionId}</small>
            </div>
            <span>{formatMs(item.durationMs)}</span>
            <span>{item.eventCount} events</span>
            <span>{item.storageProvider}</span>
          </article>
        ))}
      </section>
    </main>
  )
}

function SyncTeacherScreen({
  classroomMode,
  setClassroomMode,
}: {
  classroomMode: boolean
  setClassroomMode: (enabled: boolean) => void
}) {
  const editorRef = useRef<Editor | null>(null)
  const recorderRef = useRef<Recorder | null>(null)
  const [recording, setRecording] = useState(false)
  const [lastPackage, setLastPackage] = useState<RecordingPackage | null>(null)
  const [saveTask, setSaveTask] = useState<SaveTaskSnapshot | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const store = useSync({
    uri: createSyncUri(defaultSyncRoomId, 'teacher'),
    assets: syncAssetStore,
  })

  useEffect(() => {
    if (!recording || !recorderRef.current) return
    const timer = window.setInterval(() => {
      setElapsed(Math.round(performance.now() - recorderRef.current!.startedAt))
    }, 200)
    return () => window.clearInterval(timer)
  }, [recording])

  const handleStart = useCallback(() => {
    const editor = editorRef.current
    if (!editor || recording) return
    setLastPackage(null)
    setSaveTask(null)
    setElapsed(0)
    recorderRef.current = startRecording(editor)
    setRecording(true)
  }, [recording])

  const handleStop = useCallback(() => {
    const editor = editorRef.current
    const recorder = recorderRef.current
    if (!editor || !recorder) return
    const pack = stopRecording(editor, recorder, '同步课堂白板录制')
    recorderRef.current = null
    setRecording(false)
    setLastPackage(pack)
    setSaveTask(createSaveTask(pack))
  }, [])

  const handleSave = useCallback(async () => {
    if (!lastPackage) return
    await runSaveTask(recordingStorage, lastPackage, setSaveTask, saveTask)
  }, [lastPackage, saveTask])

  return (
    <main className="workspace">
      <section className="board">
        <Tldraw
          store={store}
          onMount={(editor) => {
            editorRef.current = editor
          }}
        />
      </section>
      <aside className="side-panel">
        <div className="status-row">
          <span className={recording ? 'dot recording' : 'dot'} />
          <div>
            <strong>{recording ? '同步录制中' : '官方 Sync 老师端'}</strong>
            <small>{defaultSyncRoomId}</small>
          </div>
        </div>
        <button className="primary" disabled={recording} onClick={handleStart}>
          <Radio size={18} />
          开始录制
        </button>
        <button className="danger" disabled={!recording} onClick={handleStop}>
          <Square size={18} />
          停止录制
        </button>
        <button disabled={!lastPackage || saveTask?.status === 'running'} onClick={handleSave}>
          {saveTask?.status === 'running' ? <Save size={18} /> : <Download size={18} />}
          {saveTask?.status === 'failed' ? '重试保存' : saveTask?.status === 'running' ? '保存中' : '保存录制包'}
        </button>
        <button onClick={() => setClassroomMode(!classroomMode)}>
          {classroomMode ? <Minimize2 size={18} /> : <Expand size={18} />}
          {classroomMode ? '退出大屏' : '大屏模式'}
        </button>
        <div className="metrics">
          <Metric label="Sync Room" value={defaultSyncRoomId} />
          <Metric label="事件数" value={String(lastPackage?.eventCount ?? recorderRef.current?.events.length ?? 0)} />
          <Metric label="时长" value={formatMs(lastPackage?.duration ?? elapsed)} />
          <Metric label="保存状态" value={formatSaveTask(saveTask)} />
        </div>
      </aside>
      {classroomMode ? (
        <FloatingStatus
          title={recording ? '同步录制中' : 'Sync 老师端'}
          subtitle={`${defaultSyncRoomId} · ${formatMs(elapsed)}`}
          active={recording}
          onExit={() => setClassroomMode(false)}
        />
      ) : null}
    </main>
  )
}

function SyncViewerScreen({
  classroomMode,
  setClassroomMode,
}: {
  classroomMode: boolean
  setClassroomMode: (enabled: boolean) => void
}) {
  const store = useSync({
    uri: createSyncUri(defaultSyncRoomId, 'viewer'),
    assets: syncAssetStore,
  })

  return (
    <main className="workspace">
      <section className="board">
        <Tldraw
          store={store}
          onMount={(editor) => {
            editor.updateInstanceState({ isReadonly: true })
          }}
          components={viewerOnlyComponents}
        />
      </section>
      <aside className="side-panel">
        <div className="status-row">
          <span className="dot recording" />
          <div>
            <strong>官方 Sync 观看端</strong>
            <small>{defaultSyncRoomId}</small>
          </div>
        </div>
        <button disabled>
          <Monitor size={18} />
          只读同步
        </button>
        <button onClick={() => setClassroomMode(!classroomMode)}>
          {classroomMode ? <Minimize2 size={18} /> : <Expand size={18} />}
          {classroomMode ? '退出大屏' : '大屏模式'}
        </button>
        <div className="metrics">
          <Metric label="Sync Room" value={defaultSyncRoomId} />
          <Metric label="权限" value="readonly" />
        </div>
      </aside>
      <div className="viewer-badge">
        <span className="dot recording" />
        <strong>Sync 观看中</strong>
        <small>{defaultSyncRoomId}</small>
      </div>
      {classroomMode ? (
        <FloatingStatus
          title="Sync 观看中"
          subtitle={defaultSyncRoomId}
          active
          onExit={() => setClassroomMode(false)}
        />
      ) : null}
    </main>
  )
}

function TeacherScreen({
  classroomMode,
  setClassroomMode,
}: {
  classroomMode: boolean
  setClassroomMode: (enabled: boolean) => void
}) {
  const editorRef = useRef<Editor | null>(null)
  const recorderRef = useRef<Recorder | null>(null)
  const [recording, setRecording] = useState(false)
  const [lastPackage, setLastPackage] = useState<RecordingPackage | null>(null)
  const [saveTask, setSaveTask] = useState<SaveTaskSnapshot | null>(null)
  const [uploadPlan, setUploadPlan] = useState<UploadPlan | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [liveState, setLiveState] = useState<'idle' | 'starting' | 'live' | 'error'>('idle')

  useEffect(() => {
    if (!recording || !recorderRef.current) return
    const timer = window.setInterval(() => {
      setElapsed(Math.round(performance.now() - recorderRef.current!.startedAt))
    }, 200)
    return () => window.clearInterval(timer)
  }, [recording])

  const handleStart = useCallback(async () => {
    const editor = editorRef.current
    if (!editor || recording) return
    setLastPackage(null)
    setSaveTask(null)
    setUploadPlan(null)
    setElapsed(0)
    setLiveState('starting')
    const recorder = startRecording(editor, {
      onEvent: (event) => {
        void liveClient.publishEvent(defaultRoomId, event).catch((error) => {
          console.error(error)
          setLiveState('error')
        })
      },
    })
    recorderRef.current = recorder
    await liveClient
      .startRoom(defaultRoomId, recorder.baselineSnapshot)
      .then(() => setLiveState('live'))
      .catch((error) => {
        console.error(error)
        setLiveState('error')
      })
    setRecording(true)
  }, [recording])

  const handleStop = useCallback(() => {
    const editor = editorRef.current
    const recorder = recorderRef.current
    if (!editor || !recorder) return
    const pack = stopRecording(editor, recorder, '课堂白板录制')
    recorderRef.current = null
    setRecording(false)
    setLastPackage(pack)
    setSaveTask(createSaveTask(pack))
    setUploadPlan(createUploadPlan(pack))
  }, [])

  const uploadSummary = useMemo(() => summarizeUploadPlan(uploadPlan), [uploadPlan])

  const handleSave = useCallback(async () => {
    if (!lastPackage) return
    await runSaveTask(recordingStorage, lastPackage, setSaveTask, saveTask)
  }, [lastPackage, saveTask])

  return (
    <main className="workspace">
      <section className="board">
        <Tldraw
          onMount={(editor) => {
            editorRef.current = editor
          }}
        />
      </section>
      <aside className="side-panel">
        <div className="status-row">
          <span className={recording ? 'dot recording' : 'dot'} />
          <div>
            <strong>{recording ? '正在录制' : '未录制'}</strong>
            <small>{formatMs(elapsed)}</small>
          </div>
        </div>
        <button className="primary" disabled={recording} onClick={handleStart}>
          <Radio size={18} />
          开始录制
        </button>
        <button className="danger" disabled={!recording} onClick={handleStop}>
          <Square size={18} />
          停止录制
        </button>
        <button disabled={!lastPackage || saveTask?.status === 'running'} onClick={handleSave}>
          {saveTask?.status === 'running' ? <Save size={18} /> : <Download size={18} />}
          {saveTask?.status === 'failed' ? '重试保存' : saveTask?.status === 'running' ? '保存中' : '保存录制包'}
        </button>
        <button onClick={() => setClassroomMode(!classroomMode)}>
          {classroomMode ? <Minimize2 size={18} /> : <Expand size={18} />}
          {classroomMode ? '退出大屏' : '大屏模式'}
        </button>
        <div className="metrics">
          <Metric label="事件数" value={String(lastPackage?.eventCount ?? recorderRef.current?.events.length ?? 0)} />
          <Metric label="分片数" value={String(lastPackage?.eventManifest?.chunkCount ?? '-')} />
          <Metric label="时长" value={formatMs(lastPackage?.duration ?? elapsed)} />
          <Metric label="Session" value={lastPackage?.sessionId ?? '-'} />
          <Metric label="直播房间" value={defaultRoomId} />
          <Metric label="直播状态" value={formatLiveState(liveState)} />
          <Metric label="保存状态" value={formatSaveTask(saveTask)} />
          <Metric label="重试次数" value={String(saveTask?.retryCount ?? 0)} />
          <Metric label="上传部件" value={String(uploadSummary.totalParts)} />
          <Metric label="估算大小" value={formatBytes(uploadSummary.totalBytes)} />
        </div>
      </aside>
      {classroomMode ? (
        <FloatingStatus
          title={recording ? '正在录制' : '老师端'}
          subtitle={`${formatMs(elapsed)} · ${formatLiveState(liveState)}`}
          active={recording}
          onExit={() => setClassroomMode(false)}
        />
      ) : null}
    </main>
  )
}

function ViewerScreen({
  classroomMode,
  setClassroomMode,
}: {
  classroomMode: boolean
  setClassroomMode: (enabled: boolean) => void
}) {
  const editorRef = useRef<Editor | null>(null)
  const [connected, setConnected] = useState(false)
  const [messageCount, setMessageCount] = useState(0)
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'live' | 'reconnecting'>('connecting')

  useEffect(() => {
    const unsubscribe = liveClient.subscribe(
      defaultRoomId,
      (message: LiveMessage) => {
        const editor = editorRef.current
        if (!editor) return

        if (message.type === 'baseline') {
          editor.loadSnapshot(message.baselineSnapshot)
          editor.updateInstanceState({ isReadonly: true })
          setConnected(true)
          setStatus('live')
          return
        }

        applyRecordedEvent(editor, message.event)
        setMessageCount((count) => count + 1)
      },
      {
        onOpen: () => {
          setConnected(true)
          setStatus((current) => (current === 'live' ? 'live' : 'waiting'))
        },
        onError: () => {
          setConnected(false)
          setStatus('reconnecting')
        },
      },
    )

    return unsubscribe
  }, [])

  return (
    <main className="workspace">
      <section className="board">
        <Tldraw
          onMount={(editor) => {
            editorRef.current = editor
            editor.updateInstanceState({ isReadonly: true })
          }}
          components={viewerOnlyComponents}
        />
      </section>
      <aside className="side-panel">
        <div className="status-row">
          <span className={connected ? 'dot recording' : 'dot'} />
          <div>
            <strong>{formatViewerStatus(status)}</strong>
            <small>{defaultRoomId}</small>
          </div>
        </div>
        <button disabled>
          <Monitor size={18} />
          只读观看
        </button>
        <button onClick={() => setClassroomMode(!classroomMode)}>
          {classroomMode ? <Minimize2 size={18} /> : <Expand size={18} />}
          {classroomMode ? '退出大屏' : '大屏模式'}
        </button>
        <div className="metrics">
          <Metric label="房间" value={defaultRoomId} />
          <Metric label="接收事件" value={String(messageCount)} />
          <Metric label="连接" value={formatViewerStatus(status)} />
        </div>
      </aside>
      <div className="viewer-badge">
        <span className={connected ? 'dot recording' : 'dot'} />
        <strong>{formatViewerStatus(status)}</strong>
        <small>{messageCount} events</small>
      </div>
      {classroomMode ? (
        <FloatingStatus
          title={formatViewerStatus(status)}
          subtitle={`${defaultRoomId} · ${messageCount} events`}
          active={connected}
          onExit={() => setClassroomMode(false)}
        />
      ) : null}
    </main>
  )
}

function PlayerScreen() {
  const editorRef = useRef<Editor | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const [recording, setRecording] = useState<RecordingPackage | null>(null)
  const [playing, setPlaying] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [time, setTime] = useState(0)
  const [lastKeyframeIndex, setLastKeyframeIndex] = useState(0)

  const events = useMemo(() => (recording ? flattenRecordingEvents(recording) : []), [recording])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const resetToSnapshot = useCallback(() => {
    const editor = editorRef.current
    if (!editor || !recording) return
    clearTimer()
    loadRecordingBaseline(editor, recording)
    setCursor(0)
    setTime(0)
    setLastKeyframeIndex(0)
    setPlaying(false)
  }, [clearTimer, recording])

  const applyEvent = useCallback((event: RecordingPackage['events'][number]) => {
    const editor = editorRef.current
    if (!editor) return
    applyRecordedEvent(editor, event)
  }, [])

  const playFrom = useCallback(
    (index: number) => {
      if (!recording || index >= events.length) {
        setPlaying(false)
        return
      }
      setPlaying(true)
      const previousTimestamp = index === 0 ? 0 : events[index - 1].timestamp
      const delay = Math.max(0, events[index].timestamp - previousTimestamp)

      timerRef.current = window.setTimeout(() => {
        applyEvent(events[index])
        setCursor(index + 1)
        setTime(events[index].timestamp)
        playFrom(index + 1)
      }, delay)
    },
    [applyEvent, events, recording],
  )

  const handlePlay = useCallback(() => {
    if (!recording || playing) return
    playFrom(cursor)
  }, [cursor, playFrom, playing, recording])

  const handlePause = useCallback(() => {
    clearTimer()
    setPlaying(false)
  }, [clearTimer])

  const handleStep = useCallback(() => {
    if (!recording || cursor >= events.length) return
    handlePause()
    applyEvent(events[cursor])
    setCursor(cursor + 1)
    setTime(events[cursor].timestamp)
  }, [applyEvent, cursor, events, handlePause, recording])

  const handleSeek = useCallback(
    (targetTime: number) => {
      const editor = editorRef.current
      if (!editor || !recording) return

      handlePause()
      const seekResult = seekRecording(editor, recording, targetTime)
      setCursor(seekResult.cursor)
      setTime(seekResult.time)
      setLastKeyframeIndex(seekResult.keyframeIndex)
    },
    [handlePause, recording],
  )

  const progress = useMemo(() => {
    if (!recording || recording.duration === 0) return 0
    return Math.min(100, Math.round((time / recording.duration) * 100))
  }, [recording, time])

  const handleFile = useCallback(async (file: File) => {
    const pack = await recordingStorage.load(file)
    setRecording(pack)
    setCursor(0)
    setTime(0)
    setLastKeyframeIndex(0)
    setPlaying(false)
    window.setTimeout(() => {
      const editor = editorRef.current
      if (editor) loadRecordingBaseline(editor, pack)
    }, 0)
  }, [])

  useEffect(() => clearTimer, [clearTimer])

  return (
    <main className="workspace">
      <section className="board">
        <Tldraw
          onMount={(editor) => {
            editorRef.current = editor
          }}
        />
      </section>
      <aside className="side-panel">
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="application/json"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
            event.currentTarget.value = ''
          }}
        />
        <button className="primary" onClick={() => inputRef.current?.click()}>
          <FileUp size={18} />
          导入录制包
        </button>
        <button disabled={!recording || playing} onClick={handlePlay}>
          <Play size={18} />
          播放
        </button>
        <button disabled={!playing} onClick={handlePause}>
          <Pause size={18} />
          暂停
        </button>
        <button disabled={!recording || cursor >= events.length} onClick={handleStep}>
          <StepForward size={18} />
          单步
        </button>
        <button disabled={!recording} onClick={resetToSnapshot}>
          <RotateCcw size={18} />
          重置
        </button>
        <label className="timeline">
          <span>{formatMs(time)}</span>
          <input
            type="range"
            min={0}
            max={recording?.duration ?? 0}
            step={100}
            value={time}
            disabled={!recording}
            onChange={(event) => handleSeek(Number(event.currentTarget.value))}
          />
          <span>{formatMs(recording?.duration ?? 0)}</span>
        </label>
        <div className="progress-track">
          <div style={{ width: `${progress}%` }} />
        </div>
        <div className="metrics">
          <Metric label="标题" value={recording?.title ?? '-'} />
          <Metric label="进度" value={`${cursor}/${events.length}`} />
          <Metric label="时间" value={`${formatMs(time)} / ${formatMs(recording?.duration ?? 0)}`} />
          <Metric label="Keyframe" value={`${lastKeyframeIndex}/${recording?.keyframes?.length ?? 0}`} />
        </div>
      </aside>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  )
}

function FloatingStatus({
  title,
  subtitle,
  active,
  onExit,
}: {
  title: string
  subtitle: string
  active: boolean
  onExit: () => void
}) {
  return (
    <div className="floating-status">
      <span className={active ? 'dot recording' : 'dot'} />
      <div>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
      <button onClick={onExit} aria-label="退出大屏模式">
        <Minimize2 size={18} />
      </button>
    </div>
  )
}

function formatMs(ms: number) {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatSaveTask(task: SaveTaskSnapshot | null) {
  if (!task) return '-'
  if (task.status === 'queued') return '待保存'
  if (task.status === 'running') return '保存中'
  if (task.status === 'succeeded') return '已保存'
  if (task.status === 'failed') return task.error ? `失败: ${task.error}` : '保存失败'
  return '-'
}

function formatLiveState(state: 'idle' | 'starting' | 'live' | 'error') {
  if (state === 'starting') return '启动中'
  if (state === 'live') return '直播中'
  if (state === 'error') return '异常'
  return '-'
}

function formatViewerStatus(state: 'connecting' | 'waiting' | 'live' | 'reconnecting') {
  if (state === 'connecting') return '连接中'
  if (state === 'waiting') return '等待老师开始'
  if (state === 'live') return '直播中'
  return '重连中'
}
