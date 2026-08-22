import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { QuestionContent } from "./components/QuestionContent";
import {
  ArrowLeft,
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
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
  Trash2,
  Users,
  Video,
  X,
} from "lucide-react";
import { Tldraw, type Editor } from "tldraw";
import { useSync } from "@tldraw/sync";
import "tldraw/tldraw.css";
import type {
  LearningProduct,
  ClassAssignment,
  ClassGroup,
  ClassInvite,
  ClassMember,
  Paper,
  Question,
  RecordingAsset,
  SyncRoom,
  TeachingTask,
} from "./domain";
import type { RecordingPackage, RecordingQuestionSegment } from "./types";
import { startRecording, stopRecording } from "./recording";
import {
  prepareAudioRecorder,
  type ActiveAudioRecorder,
} from "./recording/audioRecording";
import { flattenRecordingEvents } from "./recording/chunks";
import {
  applyRecordedEvent,
  loadRecordingBaseline,
  seekRecording,
} from "./player/replay";
import { createRecordingStorage } from "./storage/createRecordingStorage";
import {
  createSaveTask,
  runSaveTask,
  type SaveTaskSnapshot,
} from "./storage/saveTask";
import { teachingRepository } from "./services/teachingRepository";
import type { PaperProcessingStatus } from "./services/teachingRepository";
import type { BatchUploadOptions } from "./services/teachingRepository";
import {
  authService,
  getStoredSession,
  type AuthSession,
} from "./services/authService";
import { classroomApi, type ClassroomMember, type HandRaiseItem } from "./services/classroomApi";
import { RtcRoomManager } from "./services/rtc/RtcRoomManager";
import type { RtcConnectionState } from "./services/rtc/RtcProvider";
import { connectClassroomSocket } from "./services/classroomSocket";
import { syncAssetStore } from "./sync/assetStore";
import { createSyncUri, defaultSyncRoomId } from "./sync/syncConfig";

type Page =
  | "papers"
  | "questions"
  | "question-bank"
  | "question-sets"
  | "class-groups"
  | "classroom-records"
  | "review"
  | "studio"
  | "studio-room"
  | "assets"
  | "marketplace"
  | "products";
type Recorder = ReturnType<typeof startRecording>;
type StudioMode = "live" | "record";
type StudioScope = "single" | "paper";

const recordingStorage = createRecordingStorage();

export function App() {
  const [portal, setPortal] = useState<"teacher" | "student" | "store">(() =>
    window.location.hash === "#store" ? "store" : "teacher",
  );
  const [page, setPage] = useState<Page>(() => {
    const requested = new URLSearchParams(window.location.search).get("page");
    return requested === "question-sets" ? "question-sets" : "papers";
  });
  const [papers, setPapers] = useState<Paper[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assets, setAssets] = useState<RecordingAsset[]>([]);
  const [tasks, setTasks] = useState<TeachingTask[]>([]);
  const [products, setProducts] = useState<LearningProduct[]>([]);
  const [activePaperId, setActivePaperId] = useState("paper-001");
  const activePaperIdRef = useRef(activePaperId);
  const [reviewPaper, setReviewPaper] = useState<Paper | undefined>();
  const [reviewExitPage, setReviewExitPage] = useState<Page>("questions");
  const [activeQuestionId, setActiveQuestionId] = useState("q-002");
  const [studioMode, setStudioMode] = useState<StudioMode>("live");
  const [studioQuestions, setStudioQuestions] = useState<Question[]>([]);
  const [studioScope, setStudioScope] = useState<StudioScope>("paper");
  const [studioExitPage, setStudioExitPage] = useState<Page>("questions");
  const [studioAudienceCount, setStudioAudienceCount] = useState(0);
  const [activeSyncRoomId, setActiveSyncRoomId] = useState(defaultSyncRoomId);
  const [studioOpeningPaperId, setStudioOpeningPaperId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(() =>
    getStoredSession(),
  );
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => { activePaperIdRef.current = activePaperId; }, [activePaperId]);

  useEffect(() => {
    void authService
      .restore()
      .then(setAuthSession)
      .finally(() => setAuthReady(true));
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [paperItems, assetItems, taskItems, productItems] =
        await Promise.all([
          teachingRepository.listPapers(),
          teachingRepository.listRecordingAssets(),
          teachingRepository.listTeachingTasks(),
          teachingRepository.listLearningProducts(),
        ]);
      setPapers(paperItems);
      setAssets(assetItems);
      setTasks(taskItems);
      setProducts(productItems);
      const currentPaperId = activePaperIdRef.current;
      const selectedId = paperItems.some((paper) => paper.id === currentPaperId)
        ? currentPaperId
        : paperItems[0]?.id;
      if (selectedId) {
        setActivePaperId(selectedId);
        setQuestions(await teachingRepository.listQuestions(selectedId));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载业务数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady || (portal === "teacher" && !authSession)) return;
    void loadWorkspace();
  }, [authReady, authSession, loadWorkspace, portal]);

  const openPaper = useCallback(async (paperId: string) => {
    setActivePaperId(paperId);
    setLoading(true);
    try {
      setQuestions(await teachingRepository.listQuestions(paperId));
      setReviewPaper(undefined);
      setReviewExitPage("questions");
      setPage("questions");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载题目失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const openQuestion = useCallback(
    (
      questionId: string,
      target: "review" | "studio",
      mode: StudioMode = "live",
    ) => {
      setActiveQuestionId(questionId);
      setStudioMode(mode);
      if (target === "studio") {
        setStudioQuestions(questions);
        setStudioScope("paper");
        setStudioExitPage("questions");
      }
      if (target === "review") {
        setReviewPaper(undefined);
        setReviewExitPage("questions");
      }
      setPage(target === "studio" ? "studio-room" : target);
    },
    [questions],
  );

  const openStudioPaper = useCallback(
    async (paperId: string, mode: StudioMode) => {
      setStudioOpeningPaperId(paperId);
      setError(null);
      try {
        const paperQuestions = await teachingRepository.listQuestions(paperId);
        const confirmedQuestions = paperQuestions.filter(
          (question) => question.status === "confirmed",
        );
        if (!confirmedQuestions.length)
          throw new Error("这份试卷还没有已确认的题目，请先完成题目校对");
        setActivePaperId(paperId);
        setQuestions(paperQuestions);
        setStudioQuestions(paperQuestions);
        setStudioScope("paper");
        setStudioExitPage((current) =>
          current === "class-groups" ? current : "questions",
        );
        setActiveQuestionId(confirmedQuestions[0].id);
        setStudioMode(mode);
        setPage("studio-room");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "加载讲题试卷失败");
      } finally {
        setStudioOpeningPaperId(null);
      }
    },
    [],
  );

  const teachBankQuestion = useCallback((question: Question) => {
    setActivePaperId(question.paperId);
    setActiveQuestionId(question.id);
    setStudioQuestions([question]);
    setStudioScope("single");
    setStudioMode("record");
    setStudioExitPage("question-bank");
    setPage("studio-room");
  }, []);

  const navigate = useCallback((target: Page) => {
    setPage(target);
    setMobileNavOpen(false);
  }, []);

  if (portal === "student") {
    if (!authReady) return <div className="auth-loading"><LoaderCircle className="spin" size={25} /><span>正在恢复登录状态</span></div>;
    if (!authSession || authSession.user.role !== "student") return <TeacherAuth role="student" onAuthenticated={setAuthSession} />;
    return (
      <StudentLearningPortal
        loading={loading}
        studentName={authSession.user.displayName}
        onLogout={() => void authService.logout().then(() => setAuthSession(null))}
        onSwitchPortal={() => {
          window.location.hash = "";
          setPortal("teacher");
        }}
      />
    );
  }

  if (portal === "store") {
    return (
      <TeacherAgentStore
        products={products.filter((product) => product.status === "published")}
        questions={questions}
        assets={assets}
        onSwitchPortal={() => {
          window.location.hash = "";
          setPortal("teacher");
        }}
      />
    );
  }

  if (!authReady)
    return (
      <div className="auth-loading">
        <LoaderCircle className="spin" size={25} />
        <span>正在恢复登录状态</span>
      </div>
    );
  if (!authSession || authSession.user.role !== "teacher")
    return <TeacherAuth onAuthenticated={setAuthSession} />;

  if (page === "studio-room") {
    return (
      <TeachingStudio
        paper={papers.find((paper) => paper.id === activePaperId)}
        questions={studioQuestions}
        initialQuestionId={activeQuestionId}
        mode={studioMode}
        scope={studioScope}
        audienceCount={studioAudienceCount}
        syncRoomId={activeSyncRoomId}
        onLiveEnded={async () => {
          if (studioMode === "live" && studioExitPage === "class-groups")
            await teachingRepository.closeSyncRoom(activeSyncRoomId);
        }}
        onExit={() => {
          const exit = async () => {
            if (studioMode === "live" && studioExitPage === "class-groups")
              await teachingRepository.closeSyncRoom(activeSyncRoomId);
            setPage(studioExitPage);
          };
          void exit().catch((cause) =>
            setError(cause instanceof Error ? cause.message : "关闭同步房间失败"),
          );
        }}
        onRecordingSaved={async () => {
          const [assetItems, paperItems, questionItems] = await Promise.all([
            teachingRepository.listRecordingAssets(),
            teachingRepository.listPapers(),
            teachingRepository.listQuestions(activePaperId),
          ]);
          setAssets(assetItems);
          setPapers(paperItems);
          setQuestions(questionItems);
          setStudioQuestions(questionItems);
        }}
      />
    );
  }

  return (
    <div className="product-shell">
      <Sidebar
        page={page}
        open={mobileNavOpen}
        onNavigate={navigate}
        onClose={() => setMobileNavOpen(false)}
      />
      <div className="product-main">
        <Topbar
          userName={authSession.user.displayName}
          onLogout={() =>
            void authService.logout().then(() => setAuthSession(null))
          }
          onMenu={() => setMobileNavOpen(true)}
          onSwitchPortal={() => {
            window.open(import.meta.env.VITE_STUDENT_APP_URL || "http://127.0.0.1:5174", "_blank");
          }}
          onSwitchStore={() => {
            window.open(import.meta.env.VITE_TEACHER_AGENT_WEB_URL || "http://127.0.0.1:5176", "_blank", "noopener,noreferrer");
          }}
        />
        {error ? (
          <ErrorBanner message={error} onRetry={() => void loadWorkspace()} />
        ) : null}
        {loading ? (
          <LoadingState />
        ) : page === "papers" ? (
          <PaperLibrary
            papers={papers}
            onPaperOpen={openPaper}
            onPaperCreated={(paper) => setPapers((items) => [paper, ...items])}
            onPaperDeleted={(paperId) => setPapers((items) => items.filter((paper) => paper.id !== paperId))}
            onRefresh={() => void loadWorkspace()}
          />
        ) : page === "questions" ? (
          <QuestionList
            paper={reviewPaper ?? papers.find((paper) => paper.id === activePaperId)}
            questions={questions}
            onBack={() => setPage("papers")}
            onReview={(id) => openQuestion(id, "review")}
            onTeach={(id, mode) => openQuestion(id, "studio", mode)}
            onQuestionUpdated={(question) =>
              setQuestions((items) =>
                items.map((item) =>
                  item.id === question.id ? question : item,
                ),
              )
            }
          />
        ) : page === "question-sets" ? (
          <QuestionSetCenter onBack={() => setPage("question-bank")} />
        ) : page === "question-bank" ? (
          <QuestionBank papers={papers} onTeach={teachBankQuestion} onOpenQuestionSets={() => setPage("question-sets")} />
        ) : page === "class-groups" ? (
          <ClassGroupManager papers={papers} onStartBoardSync={async (groupId,studentIds) => { const room=await teachingRepository.createSyncRoom(groupId,studentIds);await teachingRepository.startSyncRoom(room.id);setActiveSyncRoomId(room.id);setStudioAudienceCount(studentIds.length);setStudioMode("live");setStudioExitPage("class-groups");setPage("studio"); }} />
        ) : page === "classroom-records" ? (
          <TeacherSyncRoomsPage />
        ) : page === "review" ? (
          <QuestionReview
            paper={papers.find((paper) => paper.id === activePaperId)}
            questions={questions}
            activeQuestionId={activeQuestionId}
            onSelect={setActiveQuestionId}
            onBack={() => setPage(reviewExitPage)}
            onConfirmed={(question) => {
              setQuestions((items) =>
                items.map((item) =>
                  item.id === question.id ? question : item,
                ),
              );
              void teachingRepository.listPapers().then(setPapers);
            }}
          />
        ) : page === "studio" ? (
          <StudioPaperSelector
            papers={papers}
            openingPaperId={studioOpeningPaperId}
            onOpen={(paperId, mode) => void openStudioPaper(paperId, mode)}
          />
        ) : page === "marketplace" ? (
          <TeacherTaskMarketplace
            tasks={tasks}
            onAccept={(task) => {
              setStudioMode(
                task.serviceType === "录制讲解" ? "record" : "live",
              );
              setPage("studio");
            }}
          />
        ) : page === "products" ? (
          <TeacherProductLibrary
            products={products}
            papers={papers}
            questions={questions}
            assets={assets}
            onSaved={(product) =>
              setProducts((items) =>
                items.some((item) => item.id === product.id)
                  ? items.map((item) =>
                      item.id === product.id ? product : item,
                    )
                  : [product, ...items],
              )
            }
          />
        ) : (
          <RecordingLibrary assets={assets} />
        )}
      </div>
    </div>
  );
}

function TeacherAuth({
  onAuthenticated,
  role = "teacher",
}: {
  onAuthenticated: (session: AuthSession) => void;
  role?: "teacher" | "student";
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [account, setAccount] = useState("");
  const [mobile, setMobile] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (mode === "register" && !/^1\d{10}$/.test(mobile))
      return setMessage("请输入正确的 11 位手机号");
    if (password.length < 8) return setMessage("密码至少需要 8 位");
    if (mode === "register" && password !== confirmPassword)
      return setMessage("两次输入的密码不一致");
    if (mode === "register" && !agreed)
      return setMessage("请阅读并同意用户协议与隐私政策");
    setSubmitting(true);
    try {
      onAuthenticated(
        mode === "login"
          ? await authService.login(account, password)
          : await authService.register({
              mobile,
              password,
              displayName,
              role,
            }),
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "操作失败，请稍后重试",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="teacher-auth">
      <section className="auth-story">
        <div className="auth-brand">
          <span>
            <Sparkles size={20} />
          </span>
          <strong>笔尖云堂</strong>
        </div>
        <div>
          <span className="eyebrow">TEACH · RECORD · GROW</span>
          <h1>
            {role === "student" ? "让每一道题，" : "让每一次讲题，"}
            <br />
            {role === "student" ? "都有清晰的学习过程。" : "都成为可持续的内容资产。"}
          </h1>
          <p>
            {role === "student" ? "加入老师的班级，接收试题，在个人看板上完成解题并提交给老师。" : "从 AI 切题、直播与录制，到内容发布和收益管理，一个账号完成老师的全部工作。"}
          </p>
          <ul>
            <li>
              <Check size={16} />
              真实板书与音频同步回放
            </li>
            <li>
              <Check size={16} />
              试卷、题目与录制资产统一管理
            </li>
            <li>
              <Check size={16} />
              免费试看、商品定价和销售闭环
            </li>
          </ul>
        </div>
        <small>© 2026 笔尖云堂 · 专业教学内容平台</small>
      </section>
      <main className="auth-panel">
        <form onSubmit={submit}>
          <div className="auth-title">
            <span>{mode === "login" ? "欢迎回来" : `创建${role === "student" ? "学生" : "老师"}账号`}</span>
            <h2>
              {mode === "login" ? `登录${role === "student" ? "学生学习台" : "老师工作台"}` : role === "student" ? "开始你的班级学习" : "开始建立你的教学资产"}
            </h2>
            <p>
              {mode === "login"
                ? "使用注册手机号或邮箱登录。"
                : "注册后可继续完善认证资料和服务信息。"}
            </p>
          </div>
          {mode === "register" ? (
            <>
              <label className="field-label">
                真实姓名
                <input
                  className="text-input"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="用于老师主页与交易服务"
                  required
                />
              </label>
              <label className="field-label">
                手机号
                <input
                  className="text-input"
                  autoComplete="tel"
                  value={mobile}
                  onChange={(event) =>
                    setMobile(
                      event.target.value.replace(/\D/g, "").slice(0, 11),
                    )
                  }
                  placeholder="请输入 11 位手机号"
                  required
                />
              </label>
            </>
          ) : (
            <label className="field-label">
              手机号或邮箱
              <input
                className="text-input"
                autoComplete="username"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="请输入登录账号"
                required
              />
            </label>
          )}
          <label className="field-label">
            密码
            <input
              className="text-input"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 8 位字符"
              required
            />
          </label>
          {mode === "register" ? (
            <>
              <label className="field-label">
                确认密码
                <input
                  className="text-input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="再次输入密码"
                  required
                />
              </label>
              <label className="auth-agreement">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                />
                <span>我已阅读并同意《用户协议》和《隐私政策》</span>
              </label>
            </>
          ) : (
            <div className="auth-assist">
              <label>
                <input type="checkbox" />
                记住登录
              </label>
              <button type="button">忘记密码？</button>
            </div>
          )}
          {message ? <div className="auth-error">{message}</div> : null}
          <button className="auth-submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="spin" size={18} /> : null}
            {mode === "login" ? "登录" : "注册并进入工作台"}
          </button>
          <div className="auth-switch">
            <span>
              {mode === "login" ? "还没有老师账号？" : "已经注册过？"}
            </span>
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setMessage(null);
              }}
            >
              {mode === "login" ? "立即注册" : "返回登录"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

function Sidebar({
  page,
  open,
  onNavigate,
  onClose,
}: {
  page: Page;
  open: boolean;
  onNavigate: (page: Page) => void;
  onClose: () => void;
}) {
  const items: Array<{ id: Page; label: string; icon: typeof Files }> = [
    { id: "marketplace", label: "任务大厅", icon: BriefcaseBusiness },
    { id: "papers", label: "批次库", icon: Files },
    { id: "question-bank", label: "试题库", icon: ListChecks },
    { id: "class-groups", label: "班级组", icon: Users },
    { id: "classroom-records", label: "同步课堂", icon: Radio },
    { id: "assets", label: "录制内容", icon: Video },
    { id: "products", label: "内容商品", icon: FileCheck2 },
  ];
  return (
    <>
      {open ? (
        <button className="nav-scrim" aria-label="关闭菜单" onClick={onClose} />
      ) : null}
      <aside className={`product-sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={18} />
          </div>
          <div>
            <strong>笔尖云堂</strong>
            <span>AI 讲题内容平台</span>
          </div>
        </div>
        <nav className="main-nav">
          <span className="nav-caption">教学内容</span>
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={
                page === id || (id === "studio" && page === "studio-room")
                  ? "active"
                  : ""
              }
              onClick={() => onNavigate(id)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
          <span className="nav-caption spaced">系统</span>
          <button>
            <Users size={18} />
            <span>成员与权限</span>
          </button>
          <button>
            <Settings size={18} />
            <span>平台设置</span>
          </button>
        </nav>
        <div className="sidebar-plan">
          <span>专业版</span>
          <strong>本月 AI 解析 24 / 100 份</strong>
          <div>
            <i style={{ width: "24%" }} />
          </div>
          <button>查看用量</button>
        </div>
        <div className="sidebar-user">
          <div className="avatar">王</div>
          <div>
            <strong>王老师</strong>
            <span>高中数学教研组</span>
          </div>
          <MoreHorizontal size={18} />
        </div>
      </aside>
    </>
  );
}

function Topbar({
  userName,
  onLogout,
  onMenu,
  onSwitchPortal,
  onSwitchStore,
}: {
  userName: string;
  onLogout: () => void;
  onMenu: () => void;
  onSwitchPortal: () => void;
  onSwitchStore: () => void;
}) {
  return (
    <header className="product-topbar">
      <button
        className="icon-button mobile-menu"
        onClick={onMenu}
        aria-label="打开菜单"
      >
        <Menu size={20} />
      </button>
      <div className="workspace-switch">
        <span>笔尖云堂</span>
        <ChevronDown size={15} />
      </div>
      <div className="topbar-actions">
        <button className="portal-switch" onClick={onSwitchStore}>
          预览学习 Web
        </button>
        <button className="portal-switch" onClick={onSwitchPortal}>
          预览学生端
        </button>
        <button className="icon-button" aria-label="帮助">
          <CircleHelp size={19} />
        </button>
        <span className="topbar-user">{userName}</span>
        <button className="support-button" onClick={onLogout}>
          退出登录
        </button>
      </div>
    </header>
  );
}

function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

function PaperLibrary({
  papers,
  onPaperOpen,
  onPaperCreated,
  onPaperDeleted,
  onRefresh,
}: {
  papers: Paper[];
  onPaperOpen: (id: string) => void;
  onPaperCreated: (paper: Paper) => void;
  onPaperDeleted: (paperId: string) => void;
  onRefresh: () => void;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [processing, setProcessing] = useState<
    Record<string, PaperProcessingStatus>
  >({});
  const ready = papers.filter((paper) => paper.status === "ready").length;
  const pending = papers.reduce(
    (total, paper) =>
      total + Math.max(0, paper.questionCount - paper.reviewedCount),
    0,
  );
  const taught = papers.reduce((total, paper) => total + paper.taughtCount, 0);
  const filteredPapers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return papers.filter((paper) => !keyword || paper.title.toLowerCase().includes(keyword));
  }, [papers, query]);
  const totalPages = Math.max(1, Math.ceil(filteredPapers.length / pageSize));
  const pagedPapers = filteredPapers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => setCurrentPage(1), [query]);
  useEffect(() => setCurrentPage((page) => Math.min(page, totalPages)), [totalPages]);
  useEffect(() => {
    const active = papers.filter(
      (paper) => paper.status === "processing" || paper.status === "failed",
    );
    if (!active.length) return;
    let disposed = false;
    const refresh = async () => {
      const results = await Promise.all(
        active
          .map(
            async (paper) =>
              [
                paper.id,
                await teachingRepository.getPaperProcessingStatus(paper.id),
              ] as const,
          )
          .map((promise) => promise.catch(() => null)),
      );
      if (disposed) return;
      const next = Object.fromEntries(
        results.filter(
          (item): item is readonly [string, PaperProcessingStatus] =>
            Boolean(item),
        ),
      );
      setProcessing(next);
      if (Object.values(next).some((item) => item.status === "review"))
        onRefresh();
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [onRefresh, papers]);
  const deleteBatch = async (paper: Paper) => {
    if (!window.confirm(`确定删除批次“${paper.title}”吗？该批次下的试题和识别结果也会删除，且无法恢复。`)) return;
    setDeletingId(paper.id);
    try {
      await teachingRepository.deletePaper(paper.id);
      onPaperDeleted(paper.id);
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "删除批次失败");
    } finally {
      setDeletingId(null);
    }
  };
  const retryBatch = async (paper: Paper) => {
    setRetryingId(paper.id);
    try {
      await teachingRepository.retryPaperProcessing(paper.id);
      setProcessing((current) => ({
        ...current,
        [paper.id]: {
          jobId: current[paper.id]?.jobId ?? "",
          paperId: paper.id,
          status: "queued",
          stage: "queued",
          progress: 0,
          provider: "",
          externalTaskId: "",
          errorCode: "",
          errorMessage: "",
          retryCount: 0,
          updatedAt: new Date().toISOString(),
        },
      }));
      onRefresh();
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "重新解析提交失败，请稍后重试");
    } finally {
      setRetryingId(null);
    }
  };
  return (
    <main className="page-content">
      <PageHeader
        title="批次库"
        description="按上传批次管理文件，由 AI 完成版面分析、题目切分和结构化识别。"
        actions={
          <button
            className="button primary"
            onClick={() => setUploadOpen(true)}
          >
            <FileUp size={17} />
            上传批次
          </button>
        }
      />
      <section className="metric-grid">
        <MetricCard
          label="全部批次"
          value={String(papers.length)}
          note={`${ready} 份已完成处理`}
          icon={<Files size={19} />}
        />
        <MetricCard
          label="待校对题目"
          value={String(pending)}
          note="建议优先完成高置信度较低题目"
          icon={<FileCheck2 size={19} />}
          tone="warning"
        />
        <MetricCard
          label="已完成讲题"
          value={String(taught)}
          note="包含直播切片与单题录制"
          icon={<Video size={19} />}
          tone="success"
        />
      </section>
      <section className="content-card">
        <div className="card-toolbar">
          <div>
            <h2>全部批次</h2>
            <span>共 {papers.length} 个</span>
          </div>
          <div className="toolbar-controls">
            <label className="search-field">
              <Search size={17} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索批次名称" />
            </label>
            <button className="button secondary">
              全部状态
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>批次名称</th>
                <th>AI 处理状态</th>
                <th>题目校对</th>
                <th>讲题进度</th>
                <th>上传时间</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!pagedPapers.length ? <EmptyTableRow columns={6} message={query.trim() ? "没有找到匹配的批次" : "暂无批次，请先上传文件"} /> : null}
              {pagedPapers.map((paper) => (
                <tr key={paper.id}>
                  <td>
                    <button
                      className="title-link"
                      onClick={() => void onPaperOpen(paper.id)}
                    >
                      <span className="file-icon">
                        <FileText size={18} />
                      </span>
                      <span>
                        <strong>{paper.title}</strong>
                        <small>
                          {paper.grade} · {paper.subject} ·{" "}
                          {paper.pageCount || "—"} 页
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <PaperStatusBadge
                      paper={paper}
                      processing={processing[paper.id]}
                    />
                  </td>
                  <td>
                    <strong>{paper.reviewedCount}</strong>
                    <span className="muted">
                      {" "}
                      / {paper.questionCount || "—"}
                    </span>
                  </td>
                  <td>
                    <div className="inline-progress">
                      <div>
                        <i
                          style={{
                            width: `${paper.questionCount ? (paper.taughtCount / paper.questionCount) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span>
                        {paper.taughtCount}/{paper.questionCount || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="muted">{paper.uploadedAt}</td>
                  <td>
                    <div className="row-actions batch-row-actions">
                      <button
                        className="text-button"
                        disabled={retryingId === paper.id || !(paper.status === "failed" || processing[paper.id]?.status === "failed")}
                        onClick={() => void retryBatch(paper)}
                      >
                        {retryingId === paper.id ? "提交中" : "重新解析"}
                      </button>
                      <button className="icon-button danger" aria-label="删除批次" title={paper.taughtCount > 0 ? "该批次已有讲解记录，不能删除" : "删除批次"} disabled={deletingId === paper.id || paper.taughtCount > 0} onClick={() => void deleteBatch(paper)}>
                        {deletingId === paper.id ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination current={currentPage} total={totalPages} totalItems={filteredPapers.length} onChange={setCurrentPage} />
      </section>
      {uploadOpen ? (
        <UploadPaperDialog
          onClose={() => setUploadOpen(false)}
          onCreated={(paper) => {
            onPaperCreated(paper);
            setUploadOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

function UploadPaperDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (paper: Paper) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("高三");
  const [subject, setSubject] = useState("数学");
  const [uploadOptions, setUploadOptions] = useState<BatchUploadOptions>({
    grades: ["高三"], subjects: ["数学"], defaultGrade: "高三", defaultSubject: "数学",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void teachingRepository.getBatchUploadOptions(controller.signal).then((options) => {
      setUploadOptions(options);
      setGrade(options.defaultGrade || options.grades[0] || "");
      setSubject(options.defaultSubject || options.subjects[0] || "");
    }).catch(() => undefined);
    return () => controller.abort();
  }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!files.length) return setError("请选择 PDF 或试卷图片");
    setSubmitting(true);
    setError(null);
    try {
      const input = {
        files,
        title:
          title.trim() ||
          files[0].name.replace(/\.(pdf|jpe?g|png|webp)$/i, ""),
        subject,
        grade,
      };
      const created = await teachingRepository.uploadPaper(input);
      onCreated(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "上传失败");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-label="上传批次"
    >
      <button className="modal-scrim" aria-label="关闭" onClick={onClose} />
      <form className="modal" onSubmit={(event) => void submit(event)}>
        <div className="modal-header">
          <div>
            <h2>上传 PDF 或试卷图片</h2>
            <p>上传后将创建异步 AI 解析批次，图片会按照选择顺序合并处理。</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <label className="dropzone">
          <FileUp size={28} />
          <strong>
            {files.length
              ? files.length === 1
                ? files[0].name
                : `已选择 ${files.length} 张试卷图片`
              : "选择或拖入 PDF / 图片"}
          </strong>
          <span>
            支持 PDF、JPG、PNG、WEBP；PDF 限 1 个，图片最多 30 张，总大小不超过
            100 MB
          </span>
          <input
            type="file"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const next = Array.from(event.target.files ?? []);
              const hasPdf = next.some(
                (item) =>
                  item.type === "application/pdf" || /\.pdf$/i.test(item.name),
              );
              const hasImage = next.some((item) =>
                item.type.startsWith("image/"),
              );
              if ((hasPdf && hasImage) || (hasPdf && next.length > 1)) {
                setFiles([]);
                setError("PDF 与图片不能混合上传，且每次只能选择一个 PDF");
                return;
              }
              if (next.length > 30) {
                setFiles([]);
                setError("图片最多支持 30 张");
                return;
              }
              if (
                next.reduce((total, item) => total + item.size, 0) >
                100 * 1024 * 1024
              ) {
                setFiles([]);
                setError("上传文件总大小不能超过 100 MB");
                return;
              }
              setError(null);
              setFiles(next);
              if (next[0] && !title)
                setTitle(next[0].name.replace(/\.(pdf|jpe?g|png|webp)$/i, ""));
            }}
          />
        </label>
        {files.length > 1 ? (
          <div className="upload-file-summary">
            {files.slice(0, 4).map((item, index) => (
              <span key={`${item.name}-${index}`}>
                {index + 1}. {item.name}
              </span>
            ))}
            {files.length > 4 ? (
              <small>另有 {files.length - 4} 张图片</small>
            ) : null}
          </div>
        ) : null}
        <label className="field-label">
          批次名称
          <input
            className="text-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：高三数学第一次月考"
          />
        </label>
        <div className="form-field-row">
          <label className="field-label">
            年级
            <select className="text-input" value={grade} onChange={(event) => setGrade(event.target.value)}>
              {uploadOptions.grades.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field-label">
            学科
            <select className="text-input" value={subject} onChange={(event) => setSubject(event.target.value)}>
              {uploadOptions.subjects.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            取消
          </button>
          <button className="button primary" disabled={submitting}>
            {submitting ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Sparkles size={17} />
            )}
            上传并开始解析
          </button>
        </div>
      </form>
    </div>
  );
}

function QuestionBank({
  papers,
  onTeach,
  onOpenQuestionSets,
}: {
  papers: Paper[];
  onTeach: (question: Question) => void;
  onOpenQuestionSets: () => void;
}) {
  const [items, setItems] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewing, setPreviewing] = useState<Question | null>(null);
  const pageSize = 10;
  const paperMap = useMemo(
    () => new Map(papers.map((paper) => [paper.id, paper])),
    [papers],
  );
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void teachingRepository.listAllQuestions()
      .then((questions) => { if (!cancelled) setItems(questions.filter((question) => question.status === "confirmed")); })
      .catch((cause) => {
        if (!cancelled)
          setLoadError(
            cause instanceof Error ? cause.message : "加载试题库失败",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const normalizedQuery = query.trim().toLowerCase();
  const visible = items.filter(
    (question) =>
      !normalizedQuery ||
      question.stem.toLowerCase().includes(normalizedQuery) ||
      String(question.number).includes(normalizedQuery) ||
      (question.sourceTitle ?? paperMap.get(question.paperId)?.title ?? "")
        .toLowerCase()
        .includes(normalizedQuery),
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const pagedQuestions = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => setCurrentPage(1), [query]);
  useEffect(() => setCurrentPage((page) => Math.min(page, totalPages)), [totalPages]);
  return (
    <main className="page-content">
      <PageHeader
        title="试题库"
        description="汇总所有已完成校对的试题，可按题目内容或来源批次查找。"
        actions={<button className="button primary" onClick={onOpenQuestionSets}><ShoppingBag size={17}/>试题集</button>}
      />
      <section className="metric-grid">
        <MetricCard
          label="全部试题"
          value={String(items.length)}
          note={`来自 ${new Set(items.map((item) => item.paperId)).size} 个批次`}
          icon={<ListChecks size={19} />}
        />
        <MetricCard
          label="未讲解"
          value={String(
            items.filter((item) => item.teachingStatus !== "recorded").length,
          )}
          note="可以进入单题讲解"
          icon={<FileCheck2 size={19} />}
          tone="warning"
        />
        <MetricCard
          label="已讲解"
          value={String(
            items.filter((item) => item.teachingStatus === "recorded").length,
          )}
          note="已有讲解内容"
          icon={<Check size={19} />}
          tone="success"
        />
      </section>
      <section className="content-card">
        <div className="card-toolbar">
          <div>
            <h2>全部试题</h2>
            <span>当前显示 {visible.length} 道</span>
          </div>
          <div className="toolbar-controls">
            <label className="search-field">
              <Search size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索题目或来源批次"
              />
            </label>
          </div>
        </div>
        {loading ? (
          <LoadingState />
        ) : loadError ? (
          <ErrorBanner
            message={loadError}
            onRetry={() => window.location.reload()}
          />
        ) : (
          <div className="table-scroll">
            <table className="data-table question-table">
              <thead>
                <tr>
                  <th>试题</th>
                  <th>来源批次</th>
                  <th>题型</th>
                  <th>难度</th>
                  <th>校对状态</th>
                  <th>讲题状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {!pagedQuestions.length ? <EmptyTableRow columns={7} message={query.trim() ? "没有找到匹配的试题" : "暂无试题，请先解析批次"} /> : null}
                {pagedQuestions.map((question) => (
                  <tr key={question.id}>
                    <td>
                      <div className="question-cell">
                        <span>{question.number}</span>
                        <div>
                          <strong><QuestionContent value={question.stem} /></strong>
                          <small>
                            {question.points} 分 · 答案 {question.answer || "—"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>
                        {question.sourceTitle ?? paperMap.get(question.paperId)?.title ?? "独立试题"}
                      </strong>
                      <div className="muted">
                        {question.sourceGrade ?? paperMap.get(question.paperId)?.grade} ·{" "}
                        {question.sourceSubject ?? paperMap.get(question.paperId)?.subject}
                      </div>
                    </td>
                    <td>{question.type}</td>
                    <td><DifficultyBadge value={question.difficulty} /></td>
                    <td>
                      <StatusBadge
                        status={
                          question.status === "confirmed"
                            ? "success"
                            : "warning"
                        }
                      >
                        {question.status === "confirmed" ? "已确认" : "待校对"}
                      </StatusBadge>
                    </td>
                    <td>
                      {question.teachingStatus === "recorded" ? (
                        <StatusBadge status="success">已讲解</StatusBadge>
                      ) : question.teachingStatus === "draft" ? (
                        <StatusBadge status="neutral">有草稿</StatusBadge>
                      ) : (
                        <span className="muted">未讲解</span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="text-button" onClick={() => setPreviewing(question)}>预览样式</button>
                        {question.status === "confirmed" ? <button className="text-button" onClick={() => onTeach(question)}>单题讲解</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !loadError ? <Pagination current={currentPage} total={totalPages} totalItems={visible.length} onChange={setCurrentPage} /> : null}
      </section>
      {previewing ? (
        <QuestionPresentationPreview
          question={previewing}
          onClose={() => setPreviewing(null)}
          onSaved={(updated) => {
            setItems((questions) => questions.map((question) => question.id === updated.id ? updated : question));
            setPreviewing(updated);
          }}
        />
      ) : null}
    </main>
  );
}

function QuestionSetCenter({onBack}:{onBack:()=>void}) {
  const [tab,setTab]=useState<"mine"|"store">(() => new URLSearchParams(window.location.search).get("tab")==="store"?"store":"mine");
  const [mine,setMine]=useState<LearningProduct[]>([]);
  const [storeItems,setStoreItems]=useState<LearningProduct[]>([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");
  const load=useCallback(async()=>{setLoading(true);try{const [owned,store]=await Promise.all([teachingRepository.listMyQuestionSets(),teachingRepository.listQuestionSetStore()]);setMine(owned);setStoreItems(store)}catch(cause){setMessage(cause instanceof Error?cause.message:"加载试题集失败")}finally{setLoading(false)}},[]);
  useEffect(()=>{void load()},[load]);
  const items=tab==="mine"?mine:storeItems;
  return <main className="page-content"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/>返回试题库</button><PageHeader eyebrow="QUESTION SETS" title="试题集" description="购买整理完成的高质量试题，减少重复切题、校对和结构化整理工作。"/><div className="question-set-tabs"><button className={tab==="mine"?"active":""} onClick={()=>setTab("mine")}><span className="question-set-tab-icon"><BookOpenCheck size={20}/></span><span><strong>我的试题集</strong><small>已创建和已购买的内容</small></span><b>{mine.length}</b></button><button className={tab==="store"?"active":""} onClick={()=>setTab("store")}><span className="question-set-tab-icon"><ShoppingBag size={20}/></span><span><strong>试题集商店</strong><small>发现已整理的优质题目</small></span><b>{storeItems.length}</b></button></div>{message?<div className="invite-code"><span>{message}</span></div>:null}{loading?<LoadingState/>:<section className="question-set-grid">{items.length?items.map(item=><article className="content-card question-set-card" key={item.id}><div className={`product-cover-preview ${item.coverStyle}`}><span>{item.subject} · {item.grade}</span><strong>{item.title}</strong></div><div className="question-set-card-body"><div><span className="eyebrow">{item.teacherName||"专业整理团队"}</span><h2>{item.title}</h2><p>{item.subtitle||item.description||"已完成题目切分、识别与人工校对"}</p></div><div className="question-set-meta"><span>{item.questionIds.length||item.lessonCount} 道题</span><strong>¥{item.price.toFixed(2)}</strong></div>{tab==="store"?<button className="button primary full" onClick={()=>void teachingRepository.createQuestionSetPurchase(item.id).then(order=>setMessage(order.status==='pending'?"订单已创建，支付成功后将自动加入我的试题集":"试题集已加入我的内容")).catch(cause=>setMessage(cause instanceof Error?cause.message:"创建订单失败"))}>购买试题集</button>:<button className="button secondary full">查看与导入题库</button>}</div></article>):<EmptyCollection message={tab==="mine"?"还没有试题集。购买成功或由整理端创建后会出现在这里。":"商店暂时没有已上架的试题集。"}/>}</section>}</main>;
}

function QuestionList({
  paper,
  questions,
  onBack,
  onReview,
  onTeach,
  onQuestionUpdated,
}: {
  paper?: Paper;
  questions: Question[];
  onBack: () => void;
  onReview: (id: string) => void;
  onTeach: (id: string, mode: StudioMode) => void;
  onQuestionUpdated: (question: Question) => void;
}) {
  const [previewing, setPreviewing] = useState<Question | null>(null);
  return (
    <main className="page-content">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={16} />
        返回批次库
      </button>
      <PageHeader
        eyebrow={`${paper?.grade ?? ""} · ${paper?.subject ?? ""}`}
        title={paper?.title ?? "试卷详情"}
        description="查看本试卷的解析结果、校对题目，并为已确认的题目安排直播或录制。"
        actions={
          <>
            <button className="button secondary">
              <Check size={17} />
              批量确认
            </button>
            <button
              className="button primary"
              onClick={() =>
                questions.find((item) => item.status === "confirmed") &&
                onTeach(
                  questions.find((item) => item.status === "confirmed")!.id,
                  "live",
                )
              }
            >
              <Radio size={17} />
              开始讲题
            </button>
          </>
        }
      />
      <div className="workflow-strip">
        <div className="done">
          <Check size={15} />
          <span>PDF 已上传</span>
        </div>
        <i />
        <div className="done">
          <Check size={15} />
          <span>AI 已切题</span>
        </div>
        <i />
        <div className="current">
          <span>3</span>
          <span>人工校对</span>
        </div>
        <i />
        <div>
          <span>4</span>
          <span>发布题目</span>
        </div>
      </div>
      <section className="content-card">
        <div className="card-toolbar">
          <div>
            <h2>题目列表</h2>
            <span>
              {questions.length} 道题 ·{" "}
              {questions.filter((item) => item.status === "review").length}{" "}
              道待校对
            </span>
          </div>
          <div className="toolbar-controls">
            <label className="search-field">
              <Search size={17} />
              <input placeholder="搜索题号或题目内容" />
            </label>
            <button className="button secondary">
              全部题型
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table question-table">
            <thead>
              <tr>
                <th>题目</th>
                <th>题型</th>
                <th>难度</th>
                <th>AI 置信度</th>
                <th>校对状态</th>
                <th>讲题状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {!questions.length ? <EmptyTableRow columns={7} message="当前试卷暂无题目，请等待解析完成" /> : null}
              {questions.map((question) => (
                <tr key={question.id}>
                  <td>
                    <div className="question-cell">
                      <span>{question.number}</span>
                      <div>
                        <strong><QuestionContent value={question.stem} /></strong>
                        <small>
                          {question.points} 分 · 答案 {question.answer}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{question.type}</td>
                  <td><DifficultyBadge value={question.difficulty} /></td>
                  <td>
                    <Confidence value={question.confidence} />
                  </td>
                  <td>
                    <StatusBadge
                      status={
                        question.status === "confirmed" ? "success" : "warning"
                      }
                    >
                      {question.status === "confirmed" ? "已确认" : "待校对"}
                    </StatusBadge>
                  </td>
                  <td>
                    {question.teachingStatus === "recorded" ? (
                      <StatusBadge status="success">已发布</StatusBadge>
                    ) : question.teachingStatus === "draft" ? (
                      <StatusBadge status="neutral">有草稿</StatusBadge>
                    ) : (
                      <span className="muted">未讲解</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        onClick={() => setPreviewing(question)}
                      >
                        预览版式
                      </button>
                      <button
                        className="text-button"
                        onClick={() => onReview(question.id)}
                      >
                        {question.status === "confirmed" ? "重新校对" : "校对"}
                      </button>
                      {question.status === "confirmed" ? (
                        <button
                          className="text-button"
                          onClick={() => onTeach(question.id, "record")}
                        >
                          开始讲题
                        </button>
                      ) : null}
                      <button className="icon-button">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {previewing ? (
        <QuestionPresentationPreview
          question={previewing}
          onClose={() => setPreviewing(null)}
          onSaved={(updated) => {
            setPreviewing(updated);
            onQuestionUpdated(updated);
          }}
        />
      ) : null}
    </main>
  );
}

function QuestionFigurePreview({ urls }: { urls?: string[] }) {
  const [images, setImages] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrls: string[] = [];
    setImages([]);
    if (!urls?.length) return () => controller.abort();
    void Promise.all(
      urls.map((url) =>
        teachingRepository.getQuestionCrop(url, controller.signal),
      ),
    )
      .then((blobs) => {
        objectUrls = blobs.map((blob) => URL.createObjectURL(blob));
        setImages(objectUrls);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          console.error("题目图片加载失败", error);
      });
    return () => {
      controller.abort();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [urls]);
  if (!urls?.length) return null;
  return (
    <div className="review-figure-preview">
      <span>识别出的题目图片</span>
      <div>
        {images.map((url, index) => (
          <img key={url} src={url} alt={`题目图片 ${index + 1}`} />
        ))}
      </div>
    </div>
  );
}

type PresentationLayout = NonNullable<Question["presentationLayout"]>;
type PresentationBlock = PresentationLayout["blocks"][number];

function defaultPresentationLayout(question: Question): PresentationLayout {
  const blocks: PresentationBlock[] = [
    { id: "stem", kind: "stem", x: 4, y: 5, width: 92 },
    { id: "options", kind: "options", x: 4, y: 24, width: 92 },
  ];
  (question.figureUrls ?? []).forEach((_, index) =>
    blocks.push({
      id: `figure-${index}`,
      kind: "figure",
      figureIndex: index,
      x: 4 + (index % 2) * 47,
      y: 43 + Math.floor(index / 2) * 25,
      width: 44,
    }),
  );
  return { width: 100, height: 320, blocks };
}

function PresentationContent({
  question,
  layout,
  figureUrls,
  editing = false,
  onChange,
}: {
  question: Question;
  layout: PresentationLayout;
  figureUrls: string[];
  editing?: boolean;
  onChange?: (layout: PresentationLayout) => void;
}) {
  const begin = (
    event: ReactPointerEvent<HTMLElement>,
    block: PresentationBlock,
    resize: boolean,
  ) => {
    if (!editing || !onChange) return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = event.currentTarget.closest<HTMLElement>(
      ".presentation-canvas",
    );
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const sx = event.clientX;
    const sy = event.clientY;
    const start = { ...block };
    const move = (pointer: PointerEvent) => {
      const dx = ((pointer.clientX - sx) * 100) / bounds.width;
      const dy = ((pointer.clientY - sy) * 100) / bounds.height;
      onChange({
        ...layout,
        blocks: layout.blocks.map((item) =>
          item.id !== block.id
            ? item
            : resize
              ? {
                  ...item,
                  width: Math.max(15, Math.min(100 - item.x, start.width + dx)),
                }
              : {
                  ...item,
                  x: Math.max(0, Math.min(100 - item.width, start.x + dx)),
                  y: Math.max(0, Math.min(92, start.y + dy)),
                },
        ),
      });
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };
  return (
    <>
      {layout.blocks.map((block) => (
        <div
          key={block.id}
          className={`presentation-block ${block.kind} ${editing ? "editing" : ""}`}
          style={{
            left: `${block.x}%`,
            top: `${block.y}%`,
            width: `${block.width}%`,
          }}
          onPointerDown={(event) => begin(event, block, false)}
        >
          {block.kind === "stem" ? (
            <strong><QuestionContent value={question.stem} /></strong>
          ) : block.kind === "options" ? (
            <div className="presentation-options">
              {question.options?.map((option, index) => (
                <span key={`${option}-${index}`}>
                  {String.fromCharCode(65 + index)}. <QuestionContent value={option} />
                </span>
              ))}
            </div>
          ) : figureUrls[block.figureIndex ?? -1] ? (
            <img
              src={figureUrls[block.figureIndex ?? -1]}
              alt={`题目图片 ${(block.figureIndex ?? 0) + 1}`}
            />
          ) : null}
          {editing ? (
            <i onPointerDown={(event) => begin(event, block, true)} />
          ) : null}
        </div>
      ))}
    </>
  );
}

function AutoPresentationCanvas({
  question,
  figureUrls,
}: {
  question: Question;
  figureUrls: string[];
}) {
  const layout = question.presentationLayout!;
  const canvasRef = useRef<HTMLDivElement>(null);
  const coordinateHeight = Math.max(
    110,
    Math.min(620, layout.height > 100 ? layout.height : 220),
  );
  const [height, setHeight] = useState(coordinateHeight);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    const measure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const top = canvas.getBoundingClientRect().top;
        const blocks = Array.from(
          canvas.querySelectorAll<HTMLElement>(".presentation-block"),
        );
        const bottom = blocks.reduce(
          (maximum, block) =>
            Math.max(maximum, block.getBoundingClientRect().bottom - top),
          0,
        );
        if (bottom > 0)
          setHeight(Math.max(90, Math.min(620, Math.ceil(bottom + 14))));
      });
    };
    const observer = new ResizeObserver(measure);
    canvas
      .querySelectorAll(".presentation-block, img")
      .forEach((element) => observer.observe(element));
    measure();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [layout, figureUrls, coordinateHeight]);
  return (
    <div
      ref={canvasRef}
      className="presentation-canvas studio-presentation"
      style={{ height: `${height}px` }}
    >
      <div
        className="presentation-coordinate-plane"
        style={{ height: `${coordinateHeight}px` }}
      >
        <PresentationContent
          question={question}
          layout={layout}
          figureUrls={figureUrls}
        />
      </div>
    </div>
  );
}

function QuestionPresentationEditor({
  question,
  onClose,
  onSaved,
}: {
  question: Question;
  onClose: () => void;
  onSaved: (question: Question) => void;
}) {
  const [layout, setLayout] = useState<PresentationLayout>(() => {
    const current =
      question.presentationLayout ?? defaultPresentationLayout(question);
    return { ...current, height: current.height > 150 ? current.height : 420 };
  });
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let urls: string[] = [];
    void Promise.all(
      (question.figureUrls ?? []).map((path) =>
        teachingRepository.getQuestionCrop(path, controller.signal),
      ),
    ).then((blobs) => {
      urls = blobs.map((blob) => URL.createObjectURL(blob));
      setImages(urls);
    });
    return () => {
      controller.abort();
      urls.forEach(URL.revokeObjectURL);
    };
  }, [question.id, question.figureUrls]);
  const save = async () => {
    setSaving(true);
    try {
      onSaved(
        await teachingRepository.updateQuestionPresentation(
          question.id,
          layout,
        ),
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };
  const beginCanvasResize = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = layout.height;
    const move = (pointer: PointerEvent) =>
      setLayout((current) => ({
        ...current,
        height: Math.max(
          110,
          Math.min(620, startHeight + pointer.clientY - startY),
        ),
      }));
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };
  return (
    <div className="presentation-editor-layer" role="dialog" aria-modal="true">
      <div className="presentation-editor">
        <header>
          <div>
            <strong>编辑试题版式</strong>
            <span>
              拖动模块调整位置，拖动右下角调整宽度；拖动画布底边调整工作台题卡高度
            </span>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <div className="presentation-editor-body">
          <div
            className="presentation-canvas"
            style={{ height: `${layout.height}px`, minHeight: 0 }}
          >
            <PresentationContent
              question={question}
              layout={layout}
              figureUrls={images}
              editing
              onChange={setLayout}
            />
            <div
              className="presentation-canvas-resizer"
              onPointerDown={beginCanvasResize}
            >
              <span>拖动调整画布高度</span>
            </div>
          </div>
        </div>
        <footer>
          <button
            className="button secondary"
            onClick={() => setLayout(defaultPresentationLayout(question))}
          >
            恢复默认
          </button>
          <div>
            <button className="button secondary" onClick={onClose}>
              取消
            </button>
            <button
              className="button primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Save size={16} />
              )}
              保存版式
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function QuestionPresentationPreview({
  question,
  onClose,
  onSaved,
}: {
  question: Question;
  onClose: () => void;
  onSaved: (question: Question) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    let urls: string[] = [];
    void Promise.all(
      (question.figureUrls ?? []).map((path) =>
        teachingRepository.getQuestionCrop(path, controller.signal),
      ),
    ).then((blobs) => {
      urls = blobs.map((blob) => URL.createObjectURL(blob));
      setImages(urls);
    });
    return () => {
      controller.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [question.id, question.figureUrls]);
  if (editing)
    return (
      <QuestionPresentationEditor
        question={question}
        onClose={() => setEditing(false)}
        onSaved={(updated) => {
          onSaved(updated);
          setEditing(false);
        }}
      />
    );
  const layout =
    question.presentationLayout ?? defaultPresentationLayout(question);
  const previewHeight = layout.height > 150 ? layout.height : 270;
  return (
    <div className="presentation-editor-layer" role="dialog" aria-modal="true">
      <div className="presentation-preview-dialog">
        <header>
          <div>
            <strong>试题版式预览</strong>
            <span>工作台将按照此版式和画布高度展示</span>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        <div className="presentation-editor-body">
          <div
            className="presentation-canvas"
            style={{ height: `${previewHeight}px`, minHeight: 0 }}
          >
            <PresentationContent
              question={question}
              layout={layout}
              figureUrls={images}
            />
          </div>
        </div>
        <footer>
          <button className="button secondary" onClick={onClose}>
            关闭
          </button>
          <button className="button primary" onClick={() => setEditing(true)}>
            人工调整版式
          </button>
        </footer>
      </div>
    </div>
  );
}

function QuestionReview({
  paper,
  questions,
  activeQuestionId,
  onSelect,
  onBack,
  onConfirmed,
}: {
  paper?: Paper;
  questions: Question[];
  activeQuestionId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  onConfirmed: (question: Question) => void;
}) {
  const question =
    questions.find((item) => item.id === activeQuestionId) ?? questions[0];
  const [draft, setDraft] = useState(question);
  const [saving, setSaving] = useState(false);
  const [pageUrl, setPageUrl] = useState<string>();
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState<string>();
  const [recognizing, setRecognizing] = useState(false);
  const [recognitionStage, setRecognitionStage] = useState("");
  const [presentationEditing, setPresentationEditing] = useState(false);
  const activePageNumber = draft?.sourceRegions?.[0]?.pageNumber ?? 1;
  const activeRegions = (draft?.sourceRegions ?? [])
    .map((region, index) => ({ region, index }))
    .filter(({ region }) => region.pageNumber === activePageNumber);
  useEffect(() => setDraft(question), [question]);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = "";
    if (!paper?.id) {
      setPageUrl(undefined);
      return () => controller.abort();
    }
    setPageLoading(true);
    setPageError(undefined);
    void teachingRepository
      .getPaperPage(paper.id, activePageNumber, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setPageUrl(objectUrl);
      })
      .catch((error) => {
        setPageUrl(undefined);
        setPageError(
          error instanceof Error ? error.message : "试卷页面加载失败",
        );
      })
      .finally(() => setPageLoading(false));
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paper?.id, activePageNumber]);
  if (!draft)
    return (
      <EmptyState
        title="暂无可校对题目"
        description="AI 切题完成后，题目会出现在这里。"
      />
    );
  const regionsDirty =
    JSON.stringify(draft.sourceRegions ?? []) !==
    JSON.stringify(question?.sourceRegions ?? []);
  const beginRegionEdit = (
    event: ReactPointerEvent<HTMLElement>,
    regionIndex: number,
    mode: "move" | "resize",
  ) => {
    if (recognizing) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget;
    const page = target.closest<HTMLElement>(".paper-page");
    const region = draft.sourceRegions?.[regionIndex];
    if (!page || !region) return;
    const bounds = page.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = { ...region };
    target.setPointerCapture(event.pointerId);
    const move = (pointer: PointerEvent) => {
      const dx = Math.round(((pointer.clientX - startX) * 1000) / bounds.width);
      const dy = Math.round(
        ((pointer.clientY - startY) * 1000) / bounds.height,
      );
      setDraft((current) => {
        if (!current?.sourceRegions?.[regionIndex]) return current;
        const regions = current.sourceRegions.map((item, index) => {
          if (index !== regionIndex) return item;
          if (mode === "resize")
            return {
              ...item,
              x1: Math.max(start.x0 + 20, Math.min(1000, start.x1 + dx)),
              y1: Math.max(start.y0 + 20, Math.min(1000, start.y1 + dy)),
            };
          const width = start.x1 - start.x0;
          const height = start.y1 - start.y0;
          const x0 = Math.max(0, Math.min(1000 - width, start.x0 + dx));
          const y0 = Math.max(0, Math.min(1000 - height, start.y0 + dy));
          return { ...item, x0, y0, x1: x0 + width, y1: y0 + height };
        });
        return { ...current, sourceRegions: regions };
      });
    };
    const end = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      target.removeEventListener("pointercancel", end);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
    target.addEventListener("pointercancel", end);
  };
  const reprocessRegion = async () => {
    if (!draft.sourceRegions?.length || !regionsDirty || recognizing) return;
    setRecognizing(true);
    setRecognitionStage("正在提交识别任务…");
    try {
      const queued = await teachingRepository.reprocessQuestion(
        draft.id,
        draft.sourceRegions,
      );
      setDraft(queued);
      onConfirmed(queued);
      setRecognitionStage("已提交，等待 OCR 处理…");
      if (!queued.reprocessJobId) throw new Error("后台未返回重新识别任务编号");
      let completed = false;
      for (let attempt = 0; attempt < 90; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        const status = await teachingRepository.getQuestionReprocessStatus(
          draft.id,
          queued.reprocessJobId,
        );
        setRecognitionStage(
          status.status === "queued"
            ? "任务排队中…"
            : status.stage.endsWith("_running")
              ? "OCR 正在识别题目与图片…"
              : "正在处理识别结果…",
        );
        if (status.status === "failed")
          throw new Error(status.errorMessage || "重新识别失败");
        if (status.status === "superseded")
          throw new Error("该识别任务已被新的任务替代");
        if (status.status !== "done") continue;
        const latest = status.question;
        if (latest) {
          setDraft(latest);
          onConfirmed(latest);
        }
        completed = true;
        break;
      }
      if (!completed) throw new Error("重新识别等待超时，请稍后重试");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "重新识别失败");
    } finally {
      setRecognizing(false);
      setRecognitionStage("");
    }
  };
  const confirm = async () => {
    setSaving(true);
    try {
      onConfirmed(await teachingRepository.confirmQuestion(draft.id, draft));
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="review-page">
      <header className="review-header">
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={16} />
          返回题目列表
        </button>
        <div>
          <strong>{paper?.title}</strong>
          <span>
            切题校对 ·{" "}
            {questions.filter((item) => item.status === "review").length}{" "}
            道待处理
          </span>
        </div>
        <button
          className="button primary"
          disabled={saving}
          onClick={() => void confirm()}
        >
          {saving ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Check size={17} />
          )}
          确认当前题目
        </button>
      </header>
      <div className="review-layout">
        <aside className="question-rail">
          <div className="rail-title">
            <strong>题目</strong>
            <span>{questions.length} 道</span>
          </div>
          {questions.map((item) => (
            <button
              key={item.id}
              className={item.id === draft.id ? "active" : ""}
              onClick={() => onSelect(item.id)}
            >
              <span>{item.number}</span>
              <div>
                <strong>第 {item.number} 题</strong>
                <small>
                  {item.type} · {item.confidence}%
                </small>
              </div>
              {item.status === "confirmed" ? <Check size={15} /> : null}
            </button>
          ))}
        </aside>
        <section className="pdf-review">
          <div className="pdf-toolbar">
            <span>
              原始试卷 · 第 {activePageNumber} 页 / {paper?.pageCount ?? 1}
            </span>
            {recognizing ? (
              <span className="recognition-progress">
                <LoaderCircle className="spin" size={13} />
                {recognitionStage}
              </span>
            ) : (
              <span>拖动红框调整位置，拖动右下角调整大小</span>
            )}
          </div>
          <div className="paper-page-stage">
            {pageLoading ? (
              <div className="paper-page-message">
                <LoaderCircle className="spin" size={20} />
                正在加载试卷页面
              </div>
            ) : pageUrl ? (
              <div className="paper-page">
                <img
                  src={pageUrl}
                  alt={`${paper?.title ?? "试卷"}第 ${activePageNumber} 页`}
                  draggable={false}
                />
                {activeRegions.map(({ region, index }) => (
                  <div
                    key={`${draft.id}-${index}`}
                    className={`question-region editable ${recognizing ? "recognizing" : ""}`}
                    onPointerDown={(event) =>
                      beginRegionEdit(event, index, "move")
                    }
                    style={{
                      left: `${region.x0 / 10}%`,
                      top: `${region.y0 / 10}%`,
                      width: `${(region.x1 - region.x0) / 10}%`,
                      height: `${(region.y1 - region.y0) / 10}%`,
                    }}
                  >
                    <span>第 {draft.number} 题</span>
                    {regionsDirty || recognizing ? (
                      <button
                        className="question-region-recognize"
                        disabled={recognizing}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation();
                          void reprocessRegion();
                        }}
                      >
                        {recognizing ? (
                          <LoaderCircle className="spin" size={12} />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        {recognizing ? "识别中…" : "重新识别"}
                      </button>
                    ) : null}
                    <i
                      className="question-region-resize"
                      onPointerDown={(event) =>
                        beginRegionEdit(event, index, "resize")
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="paper-page-message">
                {pageError ?? "试卷页面加载失败"}
              </div>
            )}
          </div>
        </section>
        <aside className="review-form">
          <div className="panel-heading">
            <div>
              <strong>结构化结果</strong>
              <span>AI 置信度 {draft.confidence}%</span>
            </div>
            <Sparkles size={18} />
          </div>
          <label className="field-label">
            题号
            <input
              className="text-input"
              value={draft.number}
              type="number"
              onChange={(event) =>
                setDraft({ ...draft, number: Number(event.target.value) })
              }
            />
          </label>
          <label className="field-label">
            题型
            <select
              className="text-input"
              value={draft.type}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  type: event.target.value as Question["type"],
                })
              }
            >
              <option>选择题</option>
              <option>填空题</option>
              <option>解答题</option>
            </select>
          </label>
          <label className="field-label">
            难度
            <select
              className="text-input"
              value={draft.difficulty ?? "中"}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  difficulty: event.target.value as Question["difficulty"],
                })
              }
            >
              <option value="低">低</option>
              <option value="中">中</option>
              <option value="高">高</option>
            </select>
          </label>
          <label className="field-label">
            题目正文
            <textarea
              className="text-input textarea"
              value={draft.stem}
              onChange={(event) =>
                setDraft({ ...draft, stem: event.target.value })
              }
            />
          </label>
          <QuestionFigurePreview urls={draft.figureUrls} />
          {draft.figureUrls?.length ? (
            <button
              className="button secondary full presentation-edit-button"
              onClick={() => setPresentationEditing(true)}
            >
              编辑试题版式
            </button>
          ) : null}
          <label className="field-label">
            答案
            <input
              className="text-input"
              value={draft.answer}
              onChange={(event) =>
                setDraft({ ...draft, answer: event.target.value })
              }
            />
          </label>
          <label className="field-label">
            解析
            <textarea
              className="text-input textarea"
              value={draft.analysis}
              onChange={(event) =>
                setDraft({ ...draft, analysis: event.target.value })
              }
            />
          </label>
          <div className="review-tip">
            <Sparkles size={16} />
            <span>
              调整红框后可单独重新识别；确认题目只保存校对结果，不会触发识别。
            </span>
          </div>
        </aside>
      </div>
      {presentationEditing ? (
        <QuestionPresentationEditor
          question={draft}
          onClose={() => setPresentationEditing(false)}
          onSaved={(updated) => {
            setDraft(updated);
            onConfirmed(updated);
          }}
        />
      ) : null}
    </main>
  );
}

function StudioPaperSelector({
  papers,
  openingPaperId,
  onOpen,
}: {
  papers: Paper[];
  openingPaperId: string | null;
  onOpen: (paperId: string, mode: StudioMode) => void;
}) {
  const parsedPapers = papers.filter(
    (paper) =>
      (paper.status === "ready" || paper.status === "review") &&
      paper.questionCount > 0,
  );
  return (
    <main className="page-content studio-paper-picker">
      <PageHeader
        title="讲题工作台"
        description="先选择一份已解析的试卷，工作台会加载该试卷中已经校对确认的题目。"
      />
      {parsedPapers.length ? (
        <section className="studio-paper-grid">
          {parsedPapers.map((paper) => {
            const available = paper.reviewedCount > 0;
            const opening = openingPaperId === paper.id;
            return (
              <article className="studio-paper-card" key={paper.id}>
                <div className="studio-paper-icon">
                  <BookOpenCheck size={22} />
                </div>
                <div className="studio-paper-info">
                  <div>
                    <StatusBadge
                      status={paper.status === "ready" ? "success" : "warning"}
                    >
                      {paper.status === "ready" ? "已完成" : "待继续校对"}
                    </StatusBadge>
                    <span>
                      {paper.grade} · {paper.subject}
                    </span>
                  </div>
                  <h2>{paper.title}</h2>
                  <p>
                    共 {paper.questionCount} 题，{paper.reviewedCount}{" "}
                    题已确认可讲
                  </p>
                </div>
                <div className="studio-paper-actions">
                  <button
                    className="button secondary"
                    disabled={!available || opening}
                    onClick={() => onOpen(paper.id, "record")}
                  >
                    {opening ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Video size={16} />
                    )}
                    单题录制
                  </button>
                  <button
                    className="button primary"
                    disabled={!available || opening}
                    onClick={() => onOpen(paper.id, "live")}
                  >
                    {opening ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Radio size={16} />
                    )}
                    进入讲题
                  </button>
                </div>
                {!available ? (
                  <small className="studio-paper-warning">
                    需要先在题目管理中完成至少一道题的校对
                  </small>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : (
        <section className="empty-state">
          <BookOpenCheck size={30} />
          <h2>还没有可讲解的试卷</h2>
          <p>请先上传试卷并等待解析完成，再到题目管理中确认题目。</p>
        </section>
      )}
    </main>
  );
}

function TeachingStudio({
  paper,
  questions,
  initialQuestionId,
  mode,
  scope,
  audienceCount,
  syncRoomId,
  onLiveEnded,
  onExit,
  onRecordingSaved,
}: {
  paper?: Paper;
  questions: Question[];
  initialQuestionId: string;
  mode: StudioMode;
  scope: StudioScope;
  audienceCount?: number;
  syncRoomId: string;
  onLiveEnded: () => Promise<void>;
  onExit: () => void;
  onRecordingSaved: () => Promise<void>;
}) {
  const queue = questions.filter((question) => question.status === "confirmed");
  const initialIndex = Math.max(
    0,
    queue.findIndex((question) => question.id === initialQuestionId),
  );
  const [index, setIndex] = useState(initialIndex);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastPackage, setLastPackage] = useState<RecordingPackage | null>(null);
  const [saveTask, setSaveTask] = useState<SaveTaskSnapshot | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const questionBoardSnapshotsRef = useRef(
    new Map<string, ReturnType<Editor["getSnapshot"]>>(),
  );
  const recorderRef = useRef<Recorder | null>(null);
  const liveRoomClosedRef = useRef(false);
  const rtcRef = useRef<RtcRoomManager | null>(null);
  const [rtcState,setRtcState]=useState<RtcConnectionState>('DISCONNECTED');
  const [rtcMuted,setRtcMuted]=useState(false);
  const [roomMembers,setRoomMembers]=useState<ClassroomMember[]>([]);
  const [handRaises,setHandRaises]=useState<HandRaiseItem[]>([]);

  useEffect(()=>{
    if(mode!=='live'||!syncRoomId)return
    const refresh=()=>Promise.all([classroomApi.members(syncRoomId),classroomApi.handRaises(syncRoomId)]).then(([members,raises])=>{setRoomMembers(members);setHandRaises(raises)}).catch(()=>undefined)
    void refresh();const timer=window.setInterval(()=>void refresh(),2000);return()=>window.clearInterval(timer)
  },[mode,syncRoomId])
  useEffect(()=>{
    if(mode!=='live'||!syncRoomId)return
    const heartbeat=()=>void classroomApi.teacherHeartbeat(syncRoomId).catch(()=>undefined)
    heartbeat();const timer=window.setInterval(heartbeat,15000);return()=>window.clearInterval(timer)
  },[mode,syncRoomId])
  useEffect(()=>{if(mode!=='live'||!syncRoomId)return;return connectClassroomSocket(syncRoomId,()=>{void Promise.all([classroomApi.members(syncRoomId),classroomApi.handRaises(syncRoomId)]).then(([members,raises])=>{setRoomMembers(members);setHandRaises(raises)})})},[mode,syncRoomId])
  useEffect(()=>()=>{void rtcRef.current?.disconnect().catch(()=>undefined)},[])

  useEffect(() => {
    if (mode !== "live" || recording || !lastPackage || liveRoomClosedRef.current) return;
    liveRoomClosedRef.current = true;
    void onLiveEnded().catch((cause) => {
      liveRoomClosedRef.current = false;
      setAudioError(cause instanceof Error ? cause.message : "关闭同步房间失败");
    });
  }, [lastPackage, mode, onLiveEnded, recording]);
  const audioRecorderRef = useRef<ActiveAudioRecorder | null>(null);
  const questionSegmentsRef = useRef<RecordingQuestionSegment[]>([]);
  const current = queue[index];
  useEffect(() => {
    if (mode !== "live" || !syncRoomId || !current?.id) return;
    void teachingRepository
      .updateSyncRoomQuestion(syncRoomId, current.id)
      .catch((cause) =>
        setAudioError(
          cause instanceof Error ? cause.message : "同步当前题目失败",
        ),
      );
  }, [current?.id, mode, syncRoomId]);
  const [questionFigureUrls, setQuestionFigureUrls] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrls: string[] = [];
    setQuestionFigureUrls([]);
    if (!current?.figureUrls?.length) return () => controller.abort();
    void Promise.all(
      current.figureUrls.map((path) =>
        teachingRepository.getQuestionCrop(path, controller.signal),
      ),
    )
      .then((blobs) => {
        objectUrls = blobs.map((blob) => URL.createObjectURL(blob));
        setQuestionFigureUrls(objectUrls);
      })
      .catch((error) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          console.error("题目原图加载失败", error);
      });
    return () => {
      controller.abort();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [current?.id]);
  useEffect(() => {
    if (!recording || !recorderRef.current) return;
    const timer = window.setInterval(
      () => setElapsed(performance.now() - recorderRef.current!.startedAt),
      250,
    );
    return () => window.clearInterval(timer);
  }, [recording]);
  const start = async () => {
    if (!editorRef.current || recording || starting) return;
    setStarting(true);
    setAudioError(null);
    setAudioBlob(null);
    setElapsed(0);
    setLastPackage(null);
    setSaveTask(null);
    try {
      if(mode==='live'){
        const rtc=new RtcRoomManager();rtcRef.current=rtc;rtc.onStateChange(setRtcState)
        await rtc.connect(await classroomApi.rtcToken(syncRoomId));await rtc.startMicrophone();await classroomApi.connected(syncRoomId)
      }
      const preparedAudio = await prepareAudioRecorder();
      const recorder = startRecording(editorRef.current);
      recorderRef.current = recorder;
      questionSegmentsRef.current = current
        ? [{ questionId: current.id, questionNumber: current.number, startMs: 0, endMs: 0 }]
        : [];
      audioRecorderRef.current = preparedAudio.start(recorder.startedAt);
      setRecording(true);
    } catch (cause) {
      if(mode==='live'){void rtcRef.current?.disconnect().catch(()=>undefined);rtcRef.current=null}
      const message =
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "麦克风权限被拒绝，请允许访问麦克风后重试。"
          : cause instanceof Error
            ? cause.message
            : "无法启动麦克风录制";
      setAudioError(message);
      window.alert(message);
    } finally {
      setStarting(false);
    }
  };
  const stop = async (confirmed=false) => {
    if (!editorRef.current || !recorderRef.current) return;
    if(mode==='live'&&!confirmed&&!window.confirm('确认结束本次课堂？结束后所有学生将自动退出同步课堂。'))return;
    const stoppedAt = Math.max(0, Math.round(performance.now() - recorderRef.current.startedAt));
    const activeSegment = questionSegmentsRef.current.at(-1);
    if (activeSegment) activeSegment.endMs = Math.max(activeSegment.startMs, stoppedAt);
    const pack = stopRecording(
      editorRef.current,
      recorderRef.current,
      `${current?.number ? `第 ${current.number} 题` : "讲题"}${mode === "live" ? "直播回放" : "录制"}`,
    );
    pack.paperId = paper?.id;
    pack.questionSegments = questionSegmentsRef.current.map((segment) => ({ ...segment }));
    pack.questionIds = [...new Set(pack.questionSegments.map((segment) => segment.questionId))];
    recorderRef.current = null;
    setRecording(false);
    let capturedAudioBlob: Blob | null = null;
    try {
      if (!audioRecorderRef.current) throw new Error("音频录制轨道不存在");
      const audio = await audioRecorderRef.current.stop();
      pack.audio = audio.track;
      capturedAudioBlob = audio.blob;
      setAudioBlob(capturedAudioBlob);
    } catch (cause) {
      setAudioError(cause instanceof Error ? cause.message : "停止录音失败");
    } finally {
      audioRecorderRef.current = null;
    }
    const initialSaveTask = createSaveTask(pack);
    setLastPackage(pack);
    setSaveTask(initialSaveTask);
    const completedTask = await runSaveTask(
      recordingStorage,
      pack,
      setSaveTask,
      initialSaveTask,
      capturedAudioBlob,
    );
    if (completedTask.status === "succeeded") await onRecordingSaved();
    if (mode === "live") {
      try {
        await rtcRef.current?.disconnect();rtcRef.current=null;setRtcState('DISCONNECTED');
        await classroomApi.rtcLeave(syncRoomId).catch(()=>undefined);
        await onLiveEnded();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "关闭同步房间失败";
        setAudioError(message);
        window.alert(message);
      }
    }
  };
  const save = async () => {
    if (lastPackage) {
      const completedTask = await runSaveTask(
        recordingStorage,
        lastPackage,
        setSaveTask,
        saveTask,
        audioBlob,
      );
      if (completedTask.status === "succeeded") await onRecordingSaved();
    }
  };
  const switchQuestion = (targetIndex: number) => {
    const editor = editorRef.current;
    const target = queue[targetIndex];
    if (!editor || !current || !target || targetIndex === index) return;

    if (recording && recorderRef.current) {
      const switchedAt = Math.max(0, Math.round(performance.now() - recorderRef.current.startedAt));
      const activeSegment = questionSegmentsRef.current.at(-1);
      if (activeSegment) activeSegment.endMs = Math.max(activeSegment.startMs, switchedAt);
      questionSegmentsRef.current.push({
        questionId: target.id,
        questionNumber: target.number,
        startMs: switchedAt,
        endMs: switchedAt,
      });
    }

    questionBoardSnapshotsRef.current.set(current.id, editor.getSnapshot());
    const targetSnapshot = questionBoardSnapshotsRef.current.get(target.id);
    if (targetSnapshot) {
      editor.loadSnapshot(targetSnapshot);
    } else {
      editor.deleteShapes([...editor.getCurrentPageShapeIds()]);
    }
    editor.clearHistory();
    setIndex(targetIndex);
  };
  const handleExit=async()=>{
    if(mode==='live'&&!window.confirm('确认结束本次课堂？结束后所有学生将自动退出同步课堂。'))return
    if(recording){await stop(true);onExit();return}
    await rtcRef.current?.disconnect().catch(()=>undefined);rtcRef.current=null
    if(mode==='live'){await classroomApi.rtcLeave(syncRoomId).catch(()=>undefined);await onLiveEnded()}
    onExit()
  }
  return (
    <main className="studio-page">
      <header className="studio-header">
        <div>
          <button className="icon-button" onClick={()=>void handleExit()}>
            <ArrowLeft size={19} />
          </button>
          <div>
            <strong>
              {scope === "single" ? "单题讲解" : mode === "live" ? "看板同步" : "整卷录制"} · {paper?.title ?? "未命名试卷"}
            </strong>
            <span>
              {paper ? `${paper.grade} · ${paper.subject} · ` : ""}{scope === "single" ? `第 ${current?.number ?? "—"} 题` : mode === "live" ? `${audienceCount ?? 0} 名学生同步观看` : "本地白板录制"}
            </span>
          </div>
        </div>
        <div className="studio-status">
          <span className={recording ? "live-dot" : "idle-dot"} />
          {recording
            ? `${mode === "live" ? "直播并录制中" : "录制中"} ${formatMs(elapsed)}`
            : "准备就绪"}
        </div>
        <button className="button secondary" onClick={()=>void handleExit()}>
          退出工作台
        </button>
      </header>
      <div
        className={`studio-layout ${queueCollapsed ? "queue-collapsed" : ""}`}
      >
        <button
          className="studio-drawer-toggle queue-toggle"
          aria-label={queueCollapsed ? "展开题目列表" : "收起题目列表"}
          onClick={() => setQueueCollapsed((value) => !value)}
        >
          {queueCollapsed ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronLeft size={16} />
          )}
        </button>
        <aside className="studio-queue">
          <div className="queue-heading">
            <div>
              <strong>本场题目</strong>
              <span>{queue.length} 道</span>
            </div>
            <button className="icon-button">
              <Plus size={17} />
            </button>
          </div>
          {queue.map((question, questionIndex) => (
            <button
              key={question.id}
              className={`${index === questionIndex ? "active" : ""} ${questionIndex < index ? "done" : ""}`}
              onClick={() => switchQuestion(questionIndex)}
            >
              <span>
                {questionIndex < index ? <Check size={15} /> : question.number}
              </span>
              <div>
                <strong>第 {question.number} 题</strong>
                <small>
                  {question.type} · {question.points} 分
                </small>
              </div>
            </button>
          ))}
        </aside>
        <section className="studio-board">
          <div
            className={`question-overlay ${current?.presentationLayout ? "custom-presentation" : questionFigureUrls.length ? "with-figures" : ""}`}
          >
            <span>
              第 {current?.number} 题 · {current?.type}
            </span>
            {current?.presentationLayout ? (
              <AutoPresentationCanvas
                question={current}
                figureUrls={questionFigureUrls}
              />
            ) : (
              <>
                <strong><QuestionContent value={current?.stem} /></strong>
                {current?.options ? (
                  <div>
                    {current.options.map((option, optionIndex) => (
                      <span key={option}>
                        {String.fromCharCode(65 + optionIndex)}. <QuestionContent value={option} />
                      </span>
                    ))}
                  </div>
                ) : null}
                {questionFigureUrls.length ? (
                  <div className="question-figures">
                    {questionFigureUrls.map((url, figureIndex) => (
                      <img
                        key={url}
                        src={url}
                        alt={`第 ${current?.number} 题几何图${figureIndex + 1}`}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
          <TeachingCanvas
            mode={mode}
            roomId={syncRoomId}
            onMount={(editor) => {
              editorRef.current = editor;
              editor.deleteShapes([...editor.getCurrentPageShapeIds()]);
              editor.clearHistory();
              if (current)
                questionBoardSnapshotsRef.current.set(
                  current.id,
                  editor.getSnapshot(),
                );
            }}
          />
        </section>
        <aside className="studio-control">
          <section>
            <h3>{mode === "live" ? "直播控制" : "录制控制"}</h3>
            <div className="device-row">
              <span>
                <Mic size={17} />
                麦克风
              </span>
              <StatusBadge status="success">正常</StatusBadge>
            </div>
            {mode === "live" ? (
              <><div className="viewer-metric">
                <Users size={18} />
                <div>
                  <strong>{roomMembers.filter(item=>item.presenceStatus==='ONLINE').length}</strong>
                  <span>在线学生</span>
                </div>
              </div><button className="button secondary full" disabled={rtcState!=='CONNECTED'} onClick={async()=>{const next=!rtcMuted;if(next)await rtcRef.current?.mute();else await rtcRef.current?.unmute();await classroomApi.mute(syncRoomId,next);setRtcMuted(next)}}><Mic size={16}/>{rtcMuted?'取消静音':'静音麦克风'}</button></>
            ) : null}
            {!recording ? (
              <button className="button primary full" onClick={start}>
                <Radio size={17} />
                {mode === "live" ? "开始直播并录制" : "开始录制"}
              </button>
            ) : (
              <button className="button danger full" onClick={()=>void stop()}>
                <Square size={16} />
                {mode === "live" ? "结束直播" : "结束录制"}
              </button>
            )}
            {lastPackage ? (
              <button
                className="button secondary full"
                disabled={saveTask?.status === "running"}
                onClick={() => void save()}
              >
                <Save size={17} />
                {saveTask?.status === "succeeded"
                  ? "已上传至七牛云"
                  : saveTask?.status === "running"
                    ? "上传中…"
                    : saveTask?.status === "failed"
                      ? "上传失败，点击重试"
                      : "等待上传"}
              </button>
            ) : null}
          </section>
          {mode==='live'?<section>
            <h3>举手队列（{handRaises.filter(item=>item.status==='WAITING').length}）</h3>
            {handRaises.length?handRaises.map(item=><div className="current-question-summary" key={item.id}><strong>{item.studentName}</strong><span>{item.status==='WAITING'?`等待 ${item.waitSeconds} 秒`:item.status}</span><div className="studio-inline-actions">{item.status==='WAITING'?<><button className="button primary" onClick={()=>void classroomApi.invite(syncRoomId,item.studentId)}>允许提问</button><button className="button secondary" onClick={()=>void classroomApi.reject(syncRoomId,item.studentId)}>忽略</button></>:item.status==='CONNECTED'?<><button className="button secondary" onClick={()=>void classroomApi.muteStudent(syncRoomId,item.studentId)}>静音</button><button className="button danger" onClick={()=>void classroomApi.kick(syncRoomId,item.studentId)}>结束连麦</button></>:null}</div></div>):<p className="control-note">暂无学生举手</p>}
            <h3>学生权限</h3>
            {roomMembers.map(member=><div className="device-row" key={member.studentId}><span>{member.studentName}</span><button className="button secondary" onClick={()=>void classroomApi.canvas(syncRoomId,member.studentId,!member.canWriteCanvas)}>{member.canWriteCanvas?'收回书写':'授权书写'}</button></div>)}
          </section>:null}
          <section>
            <h3>当前题目</h3>
            <div className="current-question-summary">
              <strong>第 {current?.number} 题</strong>
              <span>
                {current?.type} · {current?.points} 分
              </span>
            </div>
            <button
              className="button secondary full"
              disabled={index >= queue.length - 1}
              onClick={() =>
                switchQuestion(Math.min(queue.length - 1, index + 1))
              }
            >
              完成并切换下一题
              <ChevronRight size={17} />
            </button>
            <p className="control-note">
              切换题目时会记录当前题目的结束时间和下一题的开始时间，用于直播回放自动分段。
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}

function TeachingCanvas({
  mode,
  roomId,
  onMount,
}: {
  mode: StudioMode;
  roomId: string;
  onMount: (editor: Editor) => void;
}) {
  return mode === "live" ? (
    <SyncedTeachingCanvas roomId={roomId} onMount={onMount} />
  ) : (
    <Tldraw onMount={onMount} />
  );
}

function SyncedTeachingCanvas({
  roomId,
  onMount,
}: {
  roomId: string;
  onMount: (editor: Editor) => void;
}) {
  const store = useSync({
    uri: createSyncUri(roomId, "teacher"),
    assets: syncAssetStore,
  });
  return <Tldraw store={store} onMount={(editor) => {
    configureClassroomViewport(editor);
    onMount(editor);
  }} />;
}

const CLASSROOM_CANVAS_BOUNDS = { x: 0, y: 0, w: 1600, h: 900 };

function configureClassroomViewport(editor: Editor) {
  editor.setCameraOptions({
    isLocked: true,
    wheelBehavior: "none",
    constraints: {
      bounds: CLASSROOM_CANVAS_BOUNDS,
      padding: { x: 24, y: 24 },
      origin: { x: 0.5, y: 0.5 },
      initialZoom: "fit-min",
      baseZoom: "fit-min",
      behavior: "fixed",
    },
  });
  requestAnimationFrame(() => editor.zoomToBounds(CLASSROOM_CANVAS_BOUNDS, {
    inset: 24,
    immediate: true,
  }));
}

function RecordingLibraryLegacy({ assets }: { assets: RecordingAsset[] }) {
  return (
    <main className="page-content">
      <PageHeader
        title="录制内容"
        description="统一管理直播回放、按题切片和单题录制，并完成审核与发布。"
        actions={
          <button className="button primary">
            <FileCheck2 size={17} />
            批量发布
          </button>
        }
      />
      <section className="metric-grid">
        <MetricCard
          label="可发布内容"
          value={String(
            assets.filter((item) => item.status === "ready" && !item.published)
              .length,
          )}
          note="已完成处理，等待审核"
          icon={<FileCheck2 size={19} />}
        />
        <MetricCard
          label="处理中"
          value={String(
            assets.filter((item) => item.status === "processing").length,
          )}
          note="转码、切片或封面生成中"
          icon={<LoaderCircle size={19} />}
          tone="warning"
        />
        <MetricCard
          label="本月已发布"
          value={String(assets.filter((item) => item.published).length)}
          note="学生端可正常访问"
          icon={<Play size={19} />}
          tone="success"
        />
      </section>
      <section className="content-card">
        <div className="card-toolbar">
          <div>
            <h2>内容资产</h2>
            <span>共 {assets.length} 条</span>
          </div>
          <div className="toolbar-controls">
            <label className="search-field">
              <Search size={17} />
              <input placeholder="搜索题目或场次" />
            </label>
            <button className="button secondary">
              全部来源
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>内容名称</th>
                <th>来源</th>
                <th>时长</th>
                <th>处理状态</th>
                <th>发布状态</th>
                <th>创建时间</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!assets.length ? <EmptyTableRow columns={7} message="暂无录制内容" /> : null}
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <div className="asset-title">
                      <span>
                        <Play size={17} />
                      </span>
                      <strong>{asset.title}</strong>
                    </div>
                  </td>
                  <td>{asset.source}</td>
                  <td>{asset.duration}</td>
                  <td>
                    {asset.status === "ready" ? (
                      <StatusBadge status="success">可播放</StatusBadge>
                    ) : asset.status === "processing" ? (
                      <StatusBadge status="warning">处理中</StatusBadge>
                    ) : (
                      <StatusBadge status="danger">处理失败</StatusBadge>
                    )}
                  </td>
                  <td>
                    {asset.published ? (
                      <StatusBadge status="success">已发布</StatusBadge>
                    ) : (
                      <span className="muted">草稿</span>
                    )}
                  </td>
                  <td className="muted">{asset.createdAt}</td>
                  <td>
                    <div className="row-actions">
                      <button className="text-button">预览</button>
                      <button className="icon-button">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function RecordingLibrary({ assets }: { assets: RecordingAsset[] }) {
  const [selectedAsset, setSelectedAsset] = useState<RecordingAsset | null>(
    null,
  );
  return (
    <main className="page-content">
      <PageHeader
        title="录制内容"
        description="管理 tldraw 基线快照与事件时序包，审核后发布为可交互白板回放。"
        actions={
          <button className="button primary">
            <FileCheck2 size={17} />
            批量发布
          </button>
        }
      />
      <section className="metric-grid">
        <MetricCard
          label="可发布内容"
          value={String(
            assets.filter((item) => item.status === "ready" && !item.published)
              .length,
          )}
          note="时序包已校验，等待审核"
          icon={<FileCheck2 size={19} />}
        />
        <MetricCard
          label="处理中"
          value={String(
            assets.filter((item) => item.status === "processing").length,
          )}
          note="事件分片、关键帧或音频对齐中"
          icon={<LoaderCircle size={19} />}
          tone="warning"
        />
        <MetricCard
          label="本月已发布"
          value={String(assets.filter((item) => item.published).length)}
          note="学生端可按题回放"
          icon={<Play size={19} />}
          tone="success"
        />
      </section>
      <section className="content-card">
        <div className="card-toolbar">
          <div>
            <h2>tldraw 时序录制</h2>
            <span>共 {assets.length} 条</span>
          </div>
          <div className="toolbar-controls">
            <label className="search-field">
              <Search size={17} />
              <input placeholder="搜索题目或场次" />
            </label>
            <button className="button secondary">
              全部来源
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>内容名称</th>
                <th>录制来源</th>
                <th>时长</th>
                <th>时序包状态</th>
                <th>发布状态</th>
                <th>创建时间</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!assets.length ? <EmptyTableRow columns={7} message="暂无录制内容，请先完成一次讲题录制" /> : null}
              {assets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <div className="asset-title">
                      <span>
                        <Play size={17} />
                      </span>
                      <strong>{asset.title}</strong>
                    </div>
                  </td>
                  <td>{asset.source}</td>
                  <td>{asset.duration}</td>
                  <td>
                    {asset.status === "ready" ? (
                      <StatusBadge status="success">可回放</StatusBadge>
                    ) : asset.status === "processing" ? (
                      <StatusBadge status="warning">生成关键帧中</StatusBadge>
                    ) : (
                      <StatusBadge status="danger">处理失败</StatusBadge>
                    )}
                  </td>
                  <td>
                    {asset.published ? (
                      <StatusBadge status="success">已发布</StatusBadge>
                    ) : (
                      <span className="muted">草稿</span>
                    )}
                  </td>
                  <td className="muted">{asset.createdAt}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        onClick={() => setSelectedAsset(asset)}
                      >
                        时序预览
                      </button>
                      <button className="icon-button">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {selectedAsset ? (
        <ReplayDialog
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      ) : null}
    </main>
  );
}

function ReplayDialog({
  asset,
  onClose,
}: {
  asset: RecordingAsset;
  onClose: () => void;
}) {
  return (
    <div
      className="replay-dialog-layer"
      role="dialog"
      aria-modal="true"
      aria-label="tldraw 时序回放"
    >
      <header>
        <div>
          <span className="eyebrow">老师审核预览</span>
          <strong>{asset.title}</strong>
        </div>
        <div>
          <span>基线快照 + 事件时序 + 音频轨道</span>
          <button className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
      </header>
      <TldrawSequencePlayer sessionId={asset.id} title={asset.title} />
    </div>
  );
}

function TeacherProductLibrary({
  products,
  papers,
  questions,
  assets,
  onSaved,
}: {
  products: LearningProduct[];
  papers: Paper[];
  questions: Question[];
  assets: RecordingAsset[];
  onSaved: (product: LearningProduct) => void;
}) {
  const [editing, setEditing] = useState<LearningProduct | null>(null);
  const published = products.filter(
    (product) => product.status === "published",
  );
  const revenue = published.reduce(
    (total, product) => total + product.price * product.sales,
    0,
  );
  const createProduct = () =>
    setEditing({
      id: crypto.randomUUID(),
      teacherName: "王老师",
      title: "",
      subtitle: "",
      subject: "数学",
      grade: "高三",
      productType: "整卷讲解",
      paperId: papers[0]?.id,
      questionIds: questions.map((question) => question.id),
      recordingAssetIds: assets
        .filter((asset) => asset.status === "ready")
        .map((asset) => asset.id),
      previewMode: "first",
      freeQuestionCount: Math.min(3, questions.length),
      previewQuestionIds: [],
      price: 39,
      status: "draft",
      coverStyle: "indigo",
      lessonCount: assets.length,
      duration: "待计算",
      sales: 0,
      rating: 0,
      description: "",
      highlights: ["tldraw 白板时序回放", "按题自由跳转", "永久有效"],
    });
  return (
    <main className="page-content">
      <PageHeader
        title="内容商品"
        description="将审核通过的试卷或单题时序录制包装为学习商品，设置价格后发布到学习 Web。"
        actions={
          <button className="button primary" onClick={createProduct}>
            <Plus size={17} />
            创建内容商品
          </button>
        }
      />
      <section className="metric-grid">
        <MetricCard
          label="已发布商品"
          value={String(published.length)}
          note={`${products.filter((product) => product.status === "draft").length} 个草稿待完善`}
          icon={<ShoppingBag size={19} />}
        />
        <MetricCard
          label="累计购买"
          value={String(
            published.reduce((total, product) => total + product.sales, 0),
          )}
          note="购买后永久进入学生内容库"
          icon={<Users size={19} />}
          tone="success"
        />
        <MetricCard
          label="内容销售额"
          value={`¥${revenue.toLocaleString("zh-CN")}`}
          note="未扣除平台技术服务费"
          icon={<ShoppingCart size={19} />}
          tone="warning"
        />
      </section>
      <section className="content-card">
        <div className="card-toolbar">
          <div>
            <h2>商品列表</h2>
            <span>整卷、专题和单题均可独立定价</span>
          </div>
          <div className="toolbar-controls">
            <label className="search-field">
              <Search size={17} />
              <input placeholder="搜索商品名称" />
            </label>
            <button className="button secondary">
              全部状态
              <ChevronDown size={15} />
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table product-table">
            <thead>
              <tr>
                <th>商品</th>
                <th>内容类型</th>
                <th>售价</th>
                <th>销量</th>
                <th>评分</th>
                <th>状态</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {!products.length ? <EmptyTableRow columns={7} message="暂无内容商品，请先创建商品" /> : null}
              {products.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="product-name-cell">
                      <div
                        className={`mini-product-cover ${product.coverStyle}`}
                      >
                        <BookOpenCheck size={18} />
                      </div>
                      <div>
                        <strong>{product.title}</strong>
                        <small>
                          {product.lessonCount} 讲 · {product.duration}
                        </small>
                      </div>
                    </div>
                  </td>
                  <td>{product.productType}</td>
                  <td>
                    <strong className="price-text">¥{product.price}</strong>
                  </td>
                  <td>{product.sales}</td>
                  <td>{product.rating ? `${product.rating} ★` : "—"}</td>
                  <td>
                    {product.status === "published" ? (
                      <StatusBadge status="success">销售中</StatusBadge>
                    ) : product.status === "reviewing" ? (
                      <StatusBadge status="warning">审核中</StatusBadge>
                    ) : (
                      <StatusBadge status="neutral">草稿</StatusBadge>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="text-button"
                        onClick={() => setEditing(product)}
                      >
                        编辑定价
                      </button>
                      <button className="icon-button">
                        <MoreHorizontal size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing ? (
        <ProductEditorDialog
          product={editing}
          papers={papers}
          questions={questions}
          assets={assets}
          onClose={() => setEditing(null)}
          onSaved={(product) => {
            onSaved(product);
            setEditing(null);
          }}
        />
      ) : null}
    </main>
  );
}

function ProductEditorDialog({
  product,
  papers,
  questions,
  assets,
  onClose,
  onSaved,
}: {
  product: LearningProduct;
  papers: Paper[];
  questions: Question[];
  assets: RecordingAsset[];
  onClose: () => void;
  onSaved: (product: LearningProduct) => void;
}) {
  const [draft, setDraft] = useState({
    ...product,
    previewMode: product.previewMode ?? "first",
    freeQuestionCount: product.freeQuestionCount ?? 3,
    previewQuestionIds: product.previewQuestionIds ?? [],
  });
  const [saving, setSaving] = useState(false);
  const save = async (publish: boolean) => {
    setSaving(true);
    try {
      onSaved(
        await teachingRepository.saveLearningProduct({
          ...draft,
          status: publish ? "published" : "draft",
          publishedAt: publish
            ? new Date().toISOString().slice(0, 10)
            : draft.publishedAt,
        }),
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-label="编辑内容商品"
    >
      <button className="modal-scrim" onClick={onClose} />
      <section className="modal product-editor">
        <div className="modal-header">
          <div>
            <span className="eyebrow">内容商品</span>
            <h2>{product.title || "创建新商品"}</h2>
            <p>只有审核通过的 tldraw 时序录制可以作为付费内容发布。</p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div className="product-editor-layout">
          <div className="product-form">
            <label className="field-label">
              商品名称
              <input
                className="text-input"
                value={draft.title}
                onChange={(event) =>
                  setDraft({ ...draft, title: event.target.value })
                }
                placeholder="例如：高三数学月考逐题精讲"
              />
            </label>
            <label className="field-label">
              一句话介绍
              <input
                className="text-input"
                value={draft.subtitle}
                onChange={(event) =>
                  setDraft({ ...draft, subtitle: event.target.value })
                }
              />
            </label>
            <div className="two-fields">
              <label className="field-label">
                商品类型
                <select
                  className="text-input"
                  value={draft.productType}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      productType: event.target
                        .value as LearningProduct["productType"],
                    })
                  }
                >
                  <option>整卷讲解</option>
                  <option>专题合集</option>
                  <option>单题精讲</option>
                </select>
              </label>
              <label className="field-label">
                关联试卷
                <select
                  className="text-input"
                  value={draft.paperId}
                  onChange={(event) =>
                    setDraft({ ...draft, paperId: event.target.value })
                  }
                >
                  {papers.map((paper) => (
                    <option key={paper.id} value={paper.id}>
                      {paper.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field-label">
              商品介绍
              <textarea
                className="text-input textarea"
                value={draft.description}
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
            </label>
            <div className="asset-selector">
              <div>
                <strong>已关联录制资产</strong>
                <span>{draft.recordingAssetIds.length} 个 tldraw 时序包</span>
              </div>
              {assets.map((asset) => (
                <label key={asset.id}>
                  <input
                    type="checkbox"
                    checked={draft.recordingAssetIds.includes(asset.id)}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        recordingAssetIds: event.target.checked
                          ? [...draft.recordingAssetIds, asset.id]
                          : draft.recordingAssetIds.filter(
                              (id) => id !== asset.id,
                            ),
                      })
                    }
                  />
                  <span>
                    <strong>{asset.title}</strong>
                    <small>
                      {asset.duration} ·{" "}
                      {asset.status === "ready" ? "可发布" : "处理中"}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <aside className="pricing-panel">
            <div className={`product-cover-preview ${draft.coverStyle}`}>
              <span>
                {draft.grade} · {draft.subject}
              </span>
              <strong>{draft.title || "商品名称"}</strong>
              <small>{draft.productType} · tldraw 时序精讲</small>
            </div>
            <label className="field-label">
              销售价格
              <div className="money-input">
                <span>¥</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={draft.price}
                  onChange={(event) =>
                    setDraft({ ...draft, price: Number(event.target.value) })
                  }
                />
              </div>
            </label>
            <p>
              平台支持按商品永久购买。正式结算时将根据平台协议扣除技术服务费。
            </p>
            <section className="preview-policy">
              <div>
                <strong>免费试看设置</strong>
                <span>降低购买决策门槛</span>
              </div>
              <div className="preview-mode">
                <button
                  className={draft.previewMode === "first" ? "active" : ""}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      previewMode: "first",
                      previewQuestionIds: [],
                    })
                  }
                >
                  前几题免费
                </button>
                <button
                  className={draft.previewMode === "selected" ? "active" : ""}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      previewMode: "selected",
                      freeQuestionCount: 0,
                    })
                  }
                >
                  指定题目免费
                </button>
              </div>
              {draft.previewMode === "first" ? (
                <label>
                  前
                  <input
                    type="number"
                    min="0"
                    max={questions.length}
                    value={draft.freeQuestionCount}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        freeQuestionCount: Math.max(
                          0,
                          Math.min(
                            questions.length,
                            Number(event.target.value),
                          ),
                        ),
                      })
                    }
                  />
                  题可完整试看
                </label>
              ) : (
                <div className="preview-question-picker">
                  {questions.map((question) => (
                    <label key={question.id}>
                      <input
                        type="checkbox"
                        checked={draft.previewQuestionIds.includes(question.id)}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            previewQuestionIds: event.target.checked
                              ? [...draft.previewQuestionIds, question.id]
                              : draft.previewQuestionIds.filter(
                                  (id) => id !== question.id,
                                ),
                          })
                        }
                      />
                      <span>第 {question.number} 题</span>
                      <small>{question.type}</small>
                    </label>
                  ))}
                </div>
              )}
              <small>
                当前共有{" "}
                {draft.previewMode === "first"
                  ? draft.freeQuestionCount
                  : draft.previewQuestionIds.length}{" "}
                题可免费试看
              </small>
            </section>
            <div className="publish-check">
              <Check size={15} />
              <span>已关联 {draft.recordingAssetIds.length} 个录制资产</span>
            </div>
          </aside>
        </div>
        <div className="modal-actions">
          <button
            className="button secondary"
            disabled={saving}
            onClick={() => void save(false)}
          >
            保存草稿
          </button>
          <button
            className="button primary"
            disabled={
              saving || !draft.title || draft.recordingAssetIds.length === 0
            }
            onClick={() => void save(true)}
          >
            {saving ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <FileCheck2 size={17} />
            )}
            定价并发布
          </button>
        </div>
      </section>
    </div>
  );
}

function TeacherSyncRoomsPage() {
  const [rooms,setRooms]=useState<SyncRoom[]>([]);
  const [status,setStatus]=useState<"ALL"|SyncRoom["status"]>("ALL");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{setLoading(true);setError(null);try{setRooms(await teachingRepository.listTeacherSyncRooms())}catch(cause){setError(cause instanceof Error?cause.message:"加载同步课堂记录失败")}finally{setLoading(false)}},[]);
  useEffect(()=>{void load()},[load]);
  const filtered=status==="ALL"?rooms:rooms.filter(room=>room.status===status);
  return <main className="page-content"><PageHeader title="同步课堂" description="集中管理进行中、未开始和已结束的同步课堂。" actions={<button className="button secondary" onClick={()=>void load()}><RotateCcw size={16}/>刷新</button>}/>{error?<ErrorBanner message={error} onRetry={()=>void load()}/>:null}<div className="class-content-tabs teacher-room-tabs"><button className={status==="ALL"?"active":""} onClick={()=>setStatus("ALL")}>全部 {rooms.length}</button><button className={status==="ACTIVE"?"active":""} onClick={()=>setStatus("ACTIVE")}>进行中 {rooms.filter(room=>room.status==="ACTIVE").length}</button><button className={status==="NOT_STARTED"?"active":""} onClick={()=>setStatus("NOT_STARTED")}>未开始 {rooms.filter(room=>room.status==="NOT_STARTED").length}</button><button className={status==="ENDED"?"active":""} onClick={()=>setStatus("ENDED")}>已结束 {rooms.filter(room=>room.status==="ENDED").length}</button></div><section className="content-card teacher-sync-history">{loading?<LoadingState/>:<div className="simple-list">{filtered.length?filtered.map(room=><div key={room.id}><div><strong>{room.title}</strong><span>{room.groupName} · {room.createdAt.replace("T"," ")} {room.currentQuestion?`· 当前第 ${room.currentQuestion.number} 题`:""}</span></div><StatusBadge status={room.status==="ACTIVE"?"success":room.status==="NOT_STARTED"?"warning":"neutral"}>{room.status==="ACTIVE"?"进行中":room.status==="NOT_STARTED"?"未开始":"已结束"}</StatusBadge></div>):<p className="muted">当前分类没有课堂记录</p>}</div>}</section></main>;
}

function ClassGroupManager({ papers, onStartBoardSync }: { papers: Paper[]; onStartBoardSync: (groupId: string, studentIds: string[]) => Promise<void> }) {
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [invite, setInvite] = useState<ClassInvite | null>(null);
  const [creating, setCreating] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("高三");
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState<"paper" | "question">("paper");
  const [contentId, setContentId] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<"now" | "scheduled">("now");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selected = groups.find((group) => group.id === selectedId);

  const loadGroups = useCallback(async () => {
    const items = await teachingRepository.listClassGroups();
    setGroups(items);
    setSelectedId((current) => current || items[0]?.id || "");
  }, []);
  useEffect(() => { void loadGroups().catch((cause) => setError(cause instanceof Error ? cause.message : "加载班级失败")); }, [loadGroups]);
  useEffect(() => { void teachingRepository.listAllQuestions().then(setQuestions).catch(() => setQuestions([])); }, []);
  useEffect(() => {
    if (!selectedId) { setMembers([]); setAssignments([]); return; }
    setInvite(null); setSelectedStudentIds([]);
    void Promise.all([teachingRepository.listClassMembers(selectedId), teachingRepository.listClassAssignments(selectedId)])
      .then(([memberItems, assignmentItems]) => { setMembers(memberItems); setAssignments(assignmentItems); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "加载班级详情失败"));
  }, [selectedId]);
  const options = contentType === "paper" ? papers.map((paper) => ({ id: paper.id, label: paper.title })) : questions.map((question) => ({ id: question.id, label: `第 ${question.number} 题 · ${question.stem.slice(0, 45)}` }));
  useEffect(() => { setContentId(options[0]?.id ?? ""); setSelectedQuestionIds([]); }, [contentType, papers.length, questions.length]);

  return (
    <main className="page-content">
      <PageHeader title="班级组" description="管理自己的学生，并向整个班级下发试题或批次。" actions={<button className="button primary" onClick={() => setCreating(true)}><Plus size={17}/>新建班级</button>} />
      {error ? <ErrorBanner message={error} onRetry={() => void loadGroups()} /> : null}
      {!groups.length ? <EmptyCollection message="还没有班级组，先创建一个班级并邀请学生加入" /> : (
        <div className="class-group-layout">
          <aside className="content-card class-group-list">
            {groups.map((group) => <button key={group.id} className={group.id === selectedId ? "active" : ""} onClick={() => setSelectedId(group.id)}><strong>{group.name}</strong><span>{group.grade} · {group.memberCount} 名学生</span></button>)}
          </aside>
          <section className="content-card class-group-students">
            <div className="card-toolbar class-group-students-head">
              <div>
                <h2>学生列表</h2>
                <span>{selected?.name} · 共 {members.length} 名学生</span>
              </div>
              <div className="row-actions">
                <button className="button secondary" onClick={() => selectedId && void teachingRepository.createClassInvite(selectedId).then(setInvite).catch((cause) => setError(cause.message))}>邀请码</button>
                <button className="button secondary" disabled={!selectedStudentIds.length} onClick={() => selectedId && void onStartBoardSync(selectedId,selectedStudentIds).catch((cause)=>setError(cause instanceof Error?cause.message:"创建同步房间失败"))}>发起看板同步</button>
                <button className="button primary" disabled={!selectedStudentIds.length} onClick={() => setDistributing(true)}>分发{selectedStudentIds.length ? `（${selectedStudentIds.length}）` : ""}</button>
              </div>
            </div>
            {invite ? <div className="invite-code"><span>学生邀请码（7 天有效）</span><strong>{invite.inviteCode}</strong><button className="button secondary" onClick={() => void navigator.clipboard.writeText(invite.inviteCode)}>复制</button></div> : null}
            {members.length ? <label className="class-member-select-all"><input type="checkbox" checked={selectedStudentIds.length === members.length} onChange={() => setSelectedStudentIds(selectedStudentIds.length === members.length ? [] : members.map((member) => member.studentId))} />全选<span>已选择 {selectedStudentIds.length} 人</span></label> : null}
            <div className="simple-list class-member-list">{members.length ? members.map((member) => { const checked=selectedStudentIds.includes(member.studentId); return <label className={checked ? "selected" : ""} key={member.studentId}><input type="checkbox" checked={checked} onChange={() => setSelectedStudentIds((ids) => checked ? ids.filter((id) => id !== member.studentId) : [...ids, member.studentId])} /><div><strong>{member.studentName}</strong><span>{member.mobile} · 加入于 {member.joinedAt.replace("T", " ")}</span></div></label>; }) : <p className="muted">暂无学生，请点击“邀请码”邀请学生加入</p>}</div>
          </section>
        </div>
      )}
      {creating ? (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="新建班级组">
          <button className="modal-scrim" aria-label="关闭" onClick={() => setCreating(false)} />
          <section className="modal class-group-modal">
            <div className="modal-header">
              <div>
                <h2>新建班级组</h2>
                <p>创建后可生成邀请码，邀请学生加入。</p>
              </div>
              <button type="button" className="icon-button" aria-label="关闭" onClick={() => setCreating(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="form-field-row">
              <label className="field-label">
                班级名称
                <input className="text-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：高三数学一班" autoFocus />
              </label>
              <label className="field-label">
                年级
                <input className="text-input" value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="例如：高三" />
              </label>
            </div>
            <label className="field-label">
              班级说明
              <textarea className="text-input textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="可填写班级、科目或教学安排" />
            </label>
            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setCreating(false)}>取消</button>
              <button type="button" className="button primary" disabled={!name.trim()} onClick={() => void teachingRepository.createClassGroup({ name, grade, description }).then((group) => { setGroups((items) => [group, ...items]); setSelectedId(group.id); setCreating(false); setName(""); }).catch((cause) => setError(cause.message))}>创建班级</button>
            </div>
          </section>
        </div>
      ) : null}
      {distributing ? (
        <div className="modal-layer" role="dialog" aria-modal="true" aria-label="分发内容">
          <button className="modal-scrim" aria-label="关闭" onClick={() => setDistributing(false)} />
          <section className="modal class-distribute-modal">
            <div className="modal-header">
              <div><h2>向 {selected?.name} 分发内容</h2><p>学生加入班级后可立即收到下发内容。</p></div>
              <button type="button" className="icon-button" aria-label="关闭" onClick={() => setDistributing(false)}><X size={18} /></button>
            </div>
            <div className="class-distribute-form">
              <div className="class-content-tabs"><button type="button" className={contentType === "paper" ? "active" : ""} onClick={() => setContentType("paper")}>批次</button><button type="button" className={contentType === "question" ? "active" : ""} onClick={() => setContentType("question")}>试题</button></div>
              {contentType === "paper" ? <label className="field-label class-distribute-content">选择批次<select className="text-input" value={contentId} onChange={(event) => setContentId(event.target.value)}>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label> : <fieldset className="class-question-picker"><legend>选择试题（可多选）</legend><div>{questions.map((question) => { const checked = selectedQuestionIds.includes(question.id); return <label key={question.id}><input type="checkbox" checked={checked} onChange={() => setSelectedQuestionIds((ids) => checked ? ids.filter((id) => id !== question.id) : [...ids, question.id])} /><span><strong>第 {question.number} 题</strong>{question.stem}</span></label>; })}</div></fieldset>}
              <div className="class-delivery-mode"><button type="button" className={deliveryMode === "now" ? "active" : ""} onClick={() => setDeliveryMode("now")}>立即分发</button><button type="button" className={deliveryMode === "scheduled" ? "active" : ""} onClick={() => setDeliveryMode("scheduled")}>定时分发</button></div>
              {deliveryMode === "scheduled" ? <label className="field-label class-distribute-content">分发时间<input className="text-input" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label> : null}
            </div>
            {assignments.length ? <div className="class-distribute-history"><strong>最近分发</strong><div className="simple-list">{assignments.slice(0, 3).map((item) => <div key={item.id}><div><strong>{item.title}</strong><span>{item.contentType === "paper" ? "批次" : "试题"} · {item.recipientCount ?? 0} 人 · {item.scheduledAt ? `${item.status === "scheduled" ? "定时" : "已于"} ${item.scheduledAt.replace("T", " ")}` : "立即分发"}</span></div><StatusBadge status={item.status === "scheduled" ? "warning" : "success"}>{item.status === "scheduled" ? "待分发" : "已分发"}</StatusBadge></div>)}</div></div> : null}
            <div className="modal-actions"><button type="button" className="button secondary" onClick={() => setDistributing(false)}>取消</button><button type="button" className="button primary" disabled={(contentType === "paper" ? !contentId : !selectedQuestionIds.length) || (deliveryMode === "scheduled" && !dueAt)} onClick={() => selectedId && void teachingRepository.createClassAssignment(selectedId, { contentType, contentId: contentType === "paper" ? contentId : undefined, contentIds: contentType === "question" ? selectedQuestionIds : undefined, studentIds: selectedStudentIds, scheduledAt: deliveryMode === "scheduled" ? dueAt : undefined }).then((items) => { setAssignments((current) => [...items, ...current]); setDistributing(false); setSelectedQuestionIds([]); }).catch((cause) => setError(cause.message))}>{deliveryMode === "scheduled" ? "确认定时分发" : "立即分发"}{contentType === "question" && selectedQuestionIds.length ? `（${selectedQuestionIds.length} 题）` : ""}</button></div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function TeacherTaskMarketplace({
  tasks,
  onAccept,
}: {
  tasks: TeachingTask[];
  onAccept: (task: TeachingTask) => void;
}) {
  const [selected, setSelected] = useState<TeachingTask | null>(null);
  const openTasks = tasks.filter((task) => task.status === "open");
  return (
    <main className="page-content">
      <PageHeader
        title="任务大厅"
        description="学生发布真实讲题需求，老师根据专业方向、时间和服务价格自主接单。"
        actions={
          <button className="button secondary">
            <CalendarDays size={17} />
            我的履约日程
          </button>
        }
      />
      <section className="teacher-market-summary">
        <div>
          <span>今日可接任务</span>
          <strong>{openTasks.length}</strong>
          <small>
            其中 {openTasks.filter((task) => task.subject === "数学").length}{" "}
            个匹配你的教学方向
          </small>
        </div>
        <div>
          <span>本月已完成</span>
          <strong>18</strong>
          <small>按时交付率 100%</small>
        </div>
        <div>
          <span>预计收入</span>
          <strong>¥2,680</strong>
          <small>待结算 ¥438</small>
        </div>
        <div className="teacher-score">
          <span>服务评分</span>
          <strong>
            4.9 <Star size={16} fill="currentColor" />
          </strong>
          <small>来自 126 次学生评价</small>
        </div>
      </section>
      <div className="market-layout">
        <section className="task-feed">
          <div className="market-filter">
            <div>
              <button className="active">智能推荐</button>
              <button>最新发布</button>
              <button>价格优先</button>
            </div>
            <div>
              <button className="button secondary">
                高中数学
                <ChevronDown size={15} />
              </button>
              <button className="button secondary">
                可直播
                <ChevronDown size={15} />
              </button>
            </div>
          </div>
          {!openTasks.length ? <EmptyCollection message="暂无可接的讲题任务" /> : null}
          {openTasks.map((task) => (
            <article className="teacher-task-card" key={task.id}>
              <div className="task-card-top">
                <div>
                  <StatusBadge
                    status={
                      task.serviceType === "直播讲解" ? "danger" : "neutral"
                    }
                  >
                    {task.serviceType}
                  </StatusBadge>
                  <span>{task.publishedAt}</span>
                </div>
                <strong>¥{task.budget}</strong>
              </div>
              <h2>{task.title}</h2>
              <p>{task.description}</p>
              <div className="task-tags">
                {task.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="task-meta">
                <span>
                  <Users size={15} />
                  {task.studentGrade} · {task.studentName}
                </span>
                <span>
                  <ListChecks size={15} />
                  {task.questionCount} 道题
                </span>
                <span>
                  <Clock3 size={15} />
                  {task.expectedAt}
                </span>
                <span>{task.applicants} 位老师正在申请</span>
              </div>
              <div className="task-actions">
                <button
                  className="button secondary"
                  onClick={() => setSelected(task)}
                >
                  查看需求
                </button>
                <button
                  className="button primary"
                  onClick={() => setSelected(task)}
                >
                  申请接单
                </button>
              </div>
            </article>
          ))}
        </section>
        <aside className="market-side">
          <section>
            <h3>接单规则</h3>
            <ol>
              <li>
                <span>1</span>
                <p>
                  <strong>确认能力与时间</strong>
                  <small>接单后需在约定时间内完成履约</small>
                </p>
              </li>
              <li>
                <span>2</span>
                <p>
                  <strong>学生选择老师</strong>
                  <small>申请后由学生查看履历并确认</small>
                </p>
              </li>
              <li>
                <span>3</span>
                <p>
                  <strong>平台担保交易</strong>
                  <small>完成交付并确认后结算服务费</small>
                </p>
              </li>
            </ol>
          </section>
          <section className="teacher-profile-card">
            <div className="avatar">王</div>
            <strong>完善老师服务档案</strong>
            <p>补充擅长领域和可服务时间，提高推荐匹配率。</p>
            <div>
              <i style={{ width: "76%" }} />
            </div>
            <span>完整度 76%</span>
            <button className="button secondary full">继续完善</button>
          </section>
        </aside>
      </div>
      {selected ? (
        <TaskAcceptDialog
          task={selected}
          onClose={() => setSelected(null)}
          onConfirm={() => {
            const task = selected;
            setSelected(null);
            onAccept(task);
          }}
        />
      ) : null}
    </main>
  );
}

function TaskAcceptDialog({
  task,
  onClose,
  onConfirm,
}: {
  task: TeachingTask;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-label="申请接单"
    >
      <button className="modal-scrim" onClick={onClose} />
      <section className="modal task-dialog">
        <div className="modal-header">
          <div>
            <span className="eyebrow">申请接单</span>
            <h2>{task.title}</h2>
            <p>
              {task.studentGrade} · {task.questionCount} 道题 ·{" "}
              {task.serviceType}
            </p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div className="task-detail-price">
          <div>
            <span>学生预算</span>
            <strong>¥{task.budget}</strong>
          </div>
          <div>
            <span>期望完成</span>
            <strong>{task.expectedAt}</strong>
          </div>
          <div>
            <span>平台服务保障</span>
            <strong>担保交易</strong>
          </div>
        </div>
        <div className="task-requirement">
          <strong>需求说明</strong>
          <p>{task.description}</p>
        </div>
        <label className="field-label">
          给学生的申请说明
          <textarea
            className="text-input textarea"
            defaultValue="你好，我擅长高中数学对应专题，可以按时完成讲解。直播中会先梳理解题方法，再逐题互动答疑。"
          />
        </label>
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            暂不申请
          </button>
          <button className="button primary" onClick={onConfirm}>
            <Check size={17} />
            确认申请
          </button>
        </div>
      </section>
    </div>
  );
}

function StudentLearningPortal({ loading, studentName, onLogout, onSwitchPortal }: { loading: boolean; studentName: string; onLogout: () => void; onSwitchPortal: () => void }) {
  const [groups,setGroups]=useState<ClassGroup[]>([]);const [assignments,setAssignments]=useState<ClassAssignment[]>([]);const [rooms,setRooms]=useState<SyncRoom[]>([]);const [code,setCode]=useState("");const [message,setMessage]=useState("");const [teacherFilter,setTeacherFilter]=useState("");const [activeAssignment,setActiveAssignment]=useState<ClassAssignment|null>(null);const [activeRoom,setActiveRoom]=useState<SyncRoom|null>(null);const [view,setView]=useState<"board"|"tasks"|"rooms"|"classes"|"solve"|"sync">("board");
  const load=useCallback(async()=>{const [groupItems,assignmentItems,roomItems]=await Promise.all([teachingRepository.listStudentClassGroups(),teachingRepository.listStudentClassAssignments(),teachingRepository.listStudentSyncRooms()]);setGroups(groupItems);setAssignments(assignmentItems);setRooms(roomItems);},[]);useEffect(()=>{void load().catch((cause)=>setMessage(cause instanceof Error?cause.message:"加载学习数据失败"));},[load]);
  if(loading)return <div className="student-portal"><LoadingState/></div>;if(view==="sync"&&activeRoom)return <StudentLiveRoom roomId={activeRoom.id} title={activeRoom.title} teacherName={activeRoom.teacherName} questions={[]} onExit={()=>{setActiveRoom(null);setView("rooms");}}/>;if(view==="solve"&&activeAssignment)return <StudentSolveBoard assignment={activeAssignment} onExit={()=>setView("tasks")} onSubmitted={()=>{setMessage("作答已提交给老师");setView("tasks");}}/>;
  const teachers=Array.from(new Map(assignments.map((item)=>[item.teacherName||item.groupName,item.teacherName||item.groupName])).values());const [firstTeacher]=teachers;const selectedTeacher=teachers.includes(message)?message:firstTeacher;const visibleAssignments=selectedTeacher?assignments.filter((item)=>(item.teacherName||item.groupName)===selectedTeacher):assignments;
  return <div className="student-portal student-learning-portal"><header className="student-topbar"><div className="student-brand"><span><Sparkles size={18}/></span><strong>知问课堂</strong></div><nav><button className={view==="board"?"active":""} onClick={()=>setView("board")}>学习首页</button><button className={view==="tasks"?"active":""} onClick={()=>setView("tasks")}>学习任务</button><button className={view==="rooms"?"active":""} onClick={()=>{setView("rooms");void load();}}>同步房间{rooms.length?`（${rooms.length}）`:""}</button><button className={view==="classes"?"active":""} onClick={()=>setView("classes")}>我的班级</button></nav><div><button className="portal-switch" onClick={onSwitchPortal}>返回老师端</button><button className="portal-switch" onClick={onLogout}>退出</button><div className="avatar">{studentName.slice(0,1)}</div></div></header>
    {view==="board"?<main className="student-content student-stats-dashboard"><div className="student-dashboard-title"><div><span>学习概览</span><h1>{studentName}，你好</h1><p>查看班级任务和同步课堂的最新情况。</p></div><button className="student-primary" onClick={()=>setView(rooms.length?"rooms":"tasks")}>{rooms.length?<><Radio size={17}/>进入同步房间</>:<><ListChecks size={17}/>查看学习任务</>}</button></div><section className="student-stat-cards"><article><span><Users size={18}/></span><div><small>我的班级</small><strong>{groups.length}</strong><p>已加入班级</p></div></article><article><span><ListChecks size={18}/></span><div><small>学习任务</small><strong>{assignments.length}</strong><p>老师下发内容</p></div></article><article><span><Radio size={18}/></span><div><small>同步房间</small><strong>{rooms.length}</strong><p>{rooms.length?"有课堂正在进行":"暂无开放房间"}</p></div></article><article><span><FileCheck2 size={18}/></span><div><small>学习老师</small><strong>{teachers.length}</strong><p>来自不同班级</p></div></article></section><section className="student-dashboard-grid"><article className="student-dashboard-panel"><div className="student-panel-heading"><div><h2>近期任务</h2><p>老师最近下发的学习内容</p></div><button onClick={()=>setView("tasks")}>查看全部<ChevronRight size={15}/></button></div><div className="student-recent-tasks">{assignments.slice(0,5).map((item)=><button key={item.id} onClick={()=>{setActiveAssignment(item);setView("solve");}}><span className="student-assignment-icon"><FileText size={17}/></span><div><strong>{item.title}</strong><small>{item.teacherName||item.groupName} · {item.contentType==="paper"?"批次":"试题"}</small></div><ChevronRight size={16}/></button>)}{!assignments.length?<div className="student-empty"><FileText size={24}/><strong>暂无学习任务</strong></div>:null}</div></article><article className="student-dashboard-panel"><div className="student-panel-heading"><div><h2>学习分布</h2><p>当前收到的内容类型</p></div></div><div className="student-progress-list"><div><span>单道试题</span><strong>{assignments.filter((item)=>item.contentType==="question").length}</strong><i><b style={{width:`${assignments.length?assignments.filter((item)=>item.contentType==="question").length/assignments.length*100:0}%`}}/></i></div><div><span>试卷批次</span><strong>{assignments.filter((item)=>item.contentType==="paper").length}</strong><i><b style={{width:`${assignments.length?assignments.filter((item)=>item.contentType==="paper").length/assignments.length*100:0}%`}}/></i></div></div><div className="student-dashboard-room"><span className={rooms.length?"live-dot":"idle-dot"}/><div><strong>{rooms.length?`${rooms.length} 个同步房间开放中`:"当前没有同步课堂"}</strong><small>{rooms.length?"点击进入房间实时查看老师看板":"老师发起后会自动出现在同步房间"}</small></div></div></article></section></main>:null}
    {view==="tasks"?<main className="student-page student-task-page"><aside><h2>老师</h2>{teachers.length?teachers.map((teacher)=><button key={teacher} className={selectedTeacher===teacher?"active":""} onClick={()=>setMessage(teacher)}><span>{teacher.slice(0,1)}</span><div><strong>{teacher}</strong><small>{assignments.filter((item)=>(item.teacherName||item.groupName)===teacher).length} 个任务</small></div></button>):<div className="student-empty">暂无老师任务</div>}</aside><section><div className="student-page-title"><div><h1>下发的试题</h1><p>{selectedTeacher?`${selectedTeacher}下发的学习内容`:"老师下发的内容会显示在这里"}</p></div><span>{visibleAssignments.length} 个任务</span></div><div className="student-assignment-list">{visibleAssignments.length?visibleAssignments.map((item)=><article key={item.id}><div className="student-assignment-icon"><FileText size={20}/></div><div><span>{item.groupName} · {item.contentType==="paper"?"批次":"试题"}</span><strong>{item.title}</strong><small>{item.createdAt.replace("T"," ")}</small></div><button className="student-primary" onClick={()=>{setActiveAssignment(item);setView("solve");}}>进入解题</button></article>):<div className="student-empty student-task-empty"><FileText size={26}/><strong>暂无学习任务</strong></div>}</div></section></main>:null}
    {view==="rooms"?<main className="student-content student-rooms-page"><div className="student-page-title"><div><h1>同步房间</h1><p>老师邀请后房间会出现在这里，进入后实时查看老师看板。</p></div><button className="student-ghost" onClick={()=>void load()}>刷新房间</button></div><div className="student-room-cards">{rooms.length?rooms.map((room)=><article key={room.id}><div className="student-room-status"><span className="live-dot"/>进行中</div><h2>{room.title}</h2><p>{room.teacherName} · {room.groupName}</p><small>创建于 {room.createdAt.replace("T"," ")}</small><button className="student-primary" onClick={()=>{setActiveRoom(room);setView("sync");}}>进入房间</button></article>):<div className="student-empty"><Radio size={28}/><strong>当前没有同步房间</strong><span>老师发起后会自动显示</span></div>}</div></main>:null}
    {view==="classes"?<main className="student-content student-classes-page"><div className="student-page-title"><div><h1>我的班级</h1><p>使用老师提供的邀请码加入班级</p></div></div><section className="student-class-management"><div className="student-my-groups"><div className="student-group-cards">{groups.length?groups.map((group)=><article key={group.id}><span>{group.grade||"班级"}</span><strong>{group.name}</strong><small>{group.memberCount} 名同学</small></article>):<div className="student-empty"><Users size={25}/><strong>还没有加入班级</strong></div>}</div></div><div className="student-join-panel"><div><span className="student-panel-icon"><Plus size={20}/></span><h2>加入班级</h2><p>输入 8 位邀请码</p></div><div className="student-join-class"><input value={code} onChange={(event)=>setCode(event.target.value.toUpperCase())} placeholder="输入邀请码" maxLength={8}/><button className="student-primary" disabled={code.length<8} onClick={()=>void teachingRepository.joinClassGroup(code).then(()=>{setCode("");return load();})}>加入</button></div></div></section></main>:null}
  </div>;
}

function StudentSolveBoard({assignment,onExit,onSubmitted}:{assignment:ClassAssignment;onExit:()=>void;onSubmitted:()=>void}){
  const editorRef=useRef<Editor|null>(null);const [answerText,setAnswerText]=useState("");const [submitting,setSubmitting]=useState(false);const [error,setError]=useState("");
  const submit=async()=>{if(!editorRef.current)return;setSubmitting(true);setError("");try{await teachingRepository.submitStudentAssignment(assignment.id,{answerText,boardSnapshot:editorRef.current.getSnapshot()});onSubmitted();}catch(cause){setError(cause instanceof Error?cause.message:"提交失败");}finally{setSubmitting(false);}};
  return <div className="student-solve-shell"><header><button className="icon-button" onClick={onExit}><ArrowLeft size={19}/></button><div><strong>{assignment.title}</strong><span>{assignment.groupName} · 个人解题看板</span></div><button className="button primary" disabled={submitting} onClick={()=>void submit()}>{submitting?<LoaderCircle className="spin" size={17}/>:<Check size={17}/>}提交给老师</button></header><div className="student-solve-layout"><main><Tldraw onMount={(editor)=>{editorRef.current=editor;}}/></main><aside><h3>作答说明</h3><p>可以在左侧看板书写、画图和推导，提交时会将完整看板快照交给老师。</p><label className="field-label">文字答案<textarea className="text-input textarea" value={answerText} onChange={(event)=>setAnswerText(event.target.value)} placeholder="可补充最终答案或解题说明"/></label>{error?<p className="form-error">{error}</p>:null}</aside></div></div>;
}

function StudentPortal({
  papers,
  questions,
  assets,
  tasks,
  loading,
  onTaskCreated,
  onSwitchPortal,
}: {
  papers: Paper[];
  questions: Question[];
  assets: RecordingAsset[];
  tasks: TeachingTask[];
  loading: boolean;
  onTaskCreated: (task: TeachingTask) => void;
  onSwitchPortal: () => void;
}) {
  const [view, setView] = useState<"home" | "live" | "replay" | "tasks">(
    "home",
  );
  const [publishOpen, setPublishOpen] = useState(false);
  const [activeQuestionId, setActiveQuestionId] = useState(
    questions[0]?.id ?? "q-001",
  );
  if (loading)
    return (
      <div className="student-portal">
        <LoadingState />
      </div>
    );
  if (view === "live")
    return (
      <StudentLiveRoom questions={questions} onExit={() => setView("home")} />
    );
  if (view === "replay")
    return (
      <StudentReplay
        questions={questions}
        assets={assets}
        activeQuestionId={activeQuestionId}
        onSelect={setActiveQuestionId}
        onExit={() => setView("home")}
      />
    );
  if (view === "tasks")
    return (
      <StudentTaskCenter
        tasks={tasks.filter((task) => task.studentName === "陈同学")}
        onBack={() => setView("home")}
        onPublish={() => setPublishOpen(true)}
        publishOpen={publishOpen}
        onClosePublish={() => setPublishOpen(false)}
        onTaskCreated={onTaskCreated}
      />
    );
  const publishedAssets = assets.filter(
    (asset) => asset.published || asset.status === "ready",
  );
  return (
    <div className="student-portal">
      <StudentHeader
        active="home"
        onNavigate={(target) =>
          target === "tasks" ? setView("tasks") : setView("home")
        }
        onSwitchPortal={onSwitchPortal}
      />
      <main className="student-content">
        <section className="student-demand-hero">
          <div>
            <span className="eyebrow">一对一讲题服务</span>
            <h1>不会的题，找专业老师讲明白</h1>
            <p>
              上传试卷或错题，说明你的需求和时间。平台匹配专业老师，支持直播互动和录制讲解。
            </p>
            <div>
              <button
                className="student-primary"
                onClick={() => setPublishOpen(true)}
              >
                <Plus size={18} />
                发布讲题任务
              </button>
              <button
                className="student-ghost"
                onClick={() => setView("tasks")}
              >
                查看我的任务
              </button>
            </div>
            <div className="trust-row">
              <span>
                <Check size={14} />
                老师实名认证
              </span>
              <span>
                <Check size={14} />
                平台担保交易
              </span>
              <span>
                <Check size={14} />
                不满意可申诉
              </span>
            </div>
          </div>
          <div className="student-order-preview">
            <div>
              <span>进行中的任务</span>
              <StatusBadge status="warning">等待直播</StatusBadge>
            </div>
            <h2>高三数学第一次月考讲评</h2>
            <p>王老师已接单 · 今天 19:30</p>
            <div className="order-steps">
              <span className="done">
                <Check size={13} />
                已发布
              </span>
              <i />
              <span className="done">
                <Check size={13} />
                已接单
              </span>
              <i />
              <span className="active">待讲解</span>
              <i />
              <span>确认完成</span>
            </div>
            <button onClick={() => setView("live")}>
              进入订单详情
              <ChevronRight size={16} />
            </button>
          </div>
        </section>
        <section className="student-section student-service-section">
          <div className="section-heading">
            <div>
              <h2>选择你需要的服务</h2>
              <p>从一道难题到整张试卷，都能找到合适的老师</p>
            </div>
          </div>
          <div className="service-grid">
            <button onClick={() => setPublishOpen(true)}>
              <span>
                <Radio size={22} />
              </span>
              <div>
                <strong>直播互动讲题</strong>
                <p>与老师实时沟通，当场解决疑问</p>
              </div>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setPublishOpen(true)}>
              <span>
                <Video size={22} />
              </span>
              <div>
                <strong>录制讲解交付</strong>
                <p>老师按题录制，可随时反复观看</p>
              </div>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => setPublishOpen(true)}>
              <span>
                <FileText size={22} />
              </span>
              <div>
                <strong>整卷系统讲评</strong>
                <p>上传试卷，按薄弱点定制讲解</p>
              </div>
              <ChevronRight size={18} />
            </button>
          </div>
        </section>
        <StudentClassArea />
        <section className="student-section">
          <div className="section-heading">
            <div>
              <h2>最近学习</h2>
              <p>你的讲题订单会沉淀为长期学习内容</p>
            </div>
            <button>
              查看全部
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="lesson-grid">
            {publishedAssets.slice(0, 3).map((asset, index) => (
              <button
                className="lesson-card"
                key={asset.id}
                onClick={() => {
                  setActiveQuestionId(asset.questionIds[0]);
                  setView("replay");
                }}
              >
                <div className={`lesson-cover cover-${index + 1}`}>
                  <span>
                    <Play size={20} />
                  </span>
                  <small>{asset.duration}</small>
                </div>
                <div>
                  <span className="lesson-tag">{asset.source}</span>
                  <h3>{asset.title}</h3>
                  <p>高三数学第一次月考</p>
                  <div className="lesson-progress">
                    <div>
                      <i style={{ width: index === 0 ? "68%" : "0%" }} />
                    </div>
                    <span>{index === 0 ? "已学习 68%" : "未开始"}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
      {publishOpen ? (
        <PublishTaskDialog
          onClose={() => setPublishOpen(false)}
          onCreated={(task) => {
            onTaskCreated(task);
            setPublishOpen(false);
            setView("tasks");
          }}
        />
      ) : null}
    </div>
  );
}

function StudentClassArea() {
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const [groupItems, assignmentItems] = await Promise.all([
      teachingRepository.listStudentClassGroups(),
      teachingRepository.listStudentClassAssignments(),
    ]);
    setGroups(groupItems); setAssignments(assignmentItems);
  }, []);
  useEffect(() => { void load().catch(() => undefined); }, [load]);
  return <section className="student-section student-class-area">
    <div className="section-heading"><div><h2>我的班级</h2><p>输入老师发来的邀请码，接收老师下发的试题和批次</p></div><div className="student-join-class"><input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="输入 8 位邀请码" maxLength={8}/><button className="student-primary" disabled={code.length < 8} onClick={() => void teachingRepository.joinClassGroup(code).then(() => { setCode(""); setMessage("加入成功"); return load(); }).catch((cause) => setMessage(cause.message))}>加入班级</button></div></div>
    {message ? <p className="muted">{message}</p> : null}
    <div className="student-class-grid">
      <div className="content-card"><h3>已加入班级</h3>{groups.length ? groups.map((group) => <div className="student-class-row" key={group.id}><div><strong>{group.name}</strong><span>{group.grade} · {group.memberCount} 名同学</span></div></div>) : <p className="muted">还没有加入班级</p>}</div>
      <div className="content-card"><h3>老师下发</h3>{assignments.length ? assignments.slice(0,6).map((item) => <div className="student-class-row" key={item.id}><div><strong>{item.title}</strong><span>{item.groupName} · {item.contentType === "paper" ? "批次" : "试题"}{item.scheduledAt ? ` · ${item.scheduledAt.replace("T", " ")} 分发` : ""}</span></div><button className="student-ghost">查看</button></div>) : <p className="muted">暂无下发内容</p>}</div>
    </div>
  </section>;
}

function StudentHeader({
  active,
  onNavigate,
  onSwitchPortal,
}: {
  active: "home" | "tasks";
  onNavigate: (target: "home" | "tasks") => void;
  onSwitchPortal?: () => void;
}) {
  return (
    <header className="student-topbar">
      <div className="student-brand">
        <span>
          <Sparkles size={18} />
        </span>
        <strong>笔尖云堂</strong>
      </div>
      <nav>
        <button
          className={active === "home" ? "active" : ""}
          onClick={() => onNavigate("home")}
        >
          学习首页
        </button>
        <button
          className={active === "tasks" ? "active" : ""}
          onClick={() => onNavigate("tasks")}
        >
          我的任务
        </button>
        <button>我的课程</button>
        <button>学习记录</button>
      </nav>
      <div>
        {onSwitchPortal ? (
          <button className="portal-switch" onClick={onSwitchPortal}>
            返回老师端
          </button>
        ) : null}
        <div className="avatar">陈</div>
      </div>
    </header>
  );
}

function StudentTaskCenter({
  tasks,
  onBack,
  onPublish,
  publishOpen,
  onClosePublish,
  onTaskCreated,
}: {
  tasks: TeachingTask[];
  onBack: () => void;
  onPublish: () => void;
  publishOpen: boolean;
  onClosePublish: () => void;
  onTaskCreated: (task: TeachingTask) => void;
}) {
  return (
    <div className="student-portal">
      <StudentHeader
        active="tasks"
        onNavigate={(target) => target === "home" && onBack()}
      />
      <main className="student-task-page">
        <PageHeader
          title="我的讲题任务"
          description="查看老师申请、履约进度、交付内容和售后状态。"
          actions={
            <button className="button primary" onClick={onPublish}>
              <Plus size={17} />
              发布新任务
            </button>
          }
        />
        <div className="student-task-tabs">
          <button className="active">
            全部任务 <span>{tasks.length}</span>
          </button>
          <button>待选老师</button>
          <button>待讲解</button>
          <button>待确认</button>
          <button>已完成</button>
        </div>
        <section className="student-orders">
          {tasks.map((task) => (
            <article key={task.id}>
              <div className="student-order-head">
                <div>
                  <span>订单 {task.id.toUpperCase()}</span>
                  <small>{task.publishedAt}</small>
                </div>
                <TaskStatusLabel status={task.status} />
              </div>
              <div className="student-order-body">
                <div className="order-subject">
                  <span>
                    <FileText size={20} />
                  </span>
                  <div>
                    <strong>{task.title}</strong>
                    <p>
                      {task.studentGrade} · {task.subject} ·{" "}
                      {task.questionCount} 道题 · {task.serviceType}
                    </p>
                    <div className="task-tags">
                      {task.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="order-teacher">
                  {task.teacherName ? (
                    <>
                      <div className="avatar">
                        {task.teacherName.slice(0, 1)}
                      </div>
                      <div>
                        <span>服务老师</span>
                        <strong>{task.teacherName}</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="applicant-stack">
                        <span>王</span>
                        <span>李</span>
                        <span>周</span>
                      </div>
                      <div>
                        <span>老师申请</span>
                        <strong>{task.applicants} 位</strong>
                      </div>
                    </>
                  )}
                </div>
                <div className="order-time">
                  <span>期望时间</span>
                  <strong>{task.expectedAt}</strong>
                </div>
                <div className="order-price">
                  <span>订单金额</span>
                  <strong>¥{task.budget}</strong>
                </div>
              </div>
              <div className="student-order-actions">
                {task.status === "open" ? (
                  <>
                    <span>已有老师申请，选择后进入平台担保</span>
                    <button className="button primary">选择老师</button>
                  </>
                ) : task.status === "scheduled" ? (
                  <>
                    <span>老师将在约定时间开始直播</span>
                    <button className="button primary">查看订单</button>
                  </>
                ) : (
                  <>
                    <span>讲解内容已交付，请及时确认</span>
                    <button className="button secondary">查看回放</button>
                    <button className="button primary">确认完成</button>
                  </>
                )}
              </div>
            </article>
          ))}
        </section>
      </main>
      {publishOpen ? (
        <PublishTaskDialog onClose={onClosePublish} onCreated={onTaskCreated} />
      ) : null}
    </div>
  );
}

function PublishTaskDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (task: TeachingTask) => void;
}) {
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] =
    useState<TeachingTask["serviceType"]>("直播讲解");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState(89);
  const [submitting, setSubmitting] = useState(false);
  const publish = async () => {
    setSubmitting(true);
    try {
      onCreated(
        await teachingRepository.publishTeachingTask({
          studentName: "陈同学",
          studentGrade: "高三",
          subject: "数学",
          title: title || "数学错题一对一讲解",
          description:
            description || "希望老师梳理解题思路，并对重点步骤进行详细讲解。",
          questionCount: 3,
          serviceType,
          expectedAt: "明天 20:00 前",
          budget,
          tags: ["高中数学", "错题讲解"],
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-label="发布讲题任务"
    >
      <button className="modal-scrim" onClick={onClose} />
      <section className="modal publish-task-modal">
        <div className="modal-header">
          <div>
            <span className="eyebrow">发布讲题任务</span>
            <h2>
              {step === 1
                ? "上传题目与试卷"
                : step === 2
                  ? "说明讲题需求"
                  : "确认预算与时间"}
            </h2>
            <p>第 {step} 步，共 3 步</p>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <div className="publish-progress">
          <i className={step >= 1 ? "active" : ""} />
          <i className={step >= 2 ? "active" : ""} />
          <i className={step >= 3 ? "active" : ""} />
        </div>
        {step === 1 ? (
          <>
            <label className="dropzone task-upload">
              <FileUp size={28} />
              <strong>上传试卷 PDF 或题目图片</strong>
              <span>支持 PDF、JPG、PNG，AI 将自动识别题目</span>
              <input type="file" accept="application/pdf,image/*" />
            </label>
            <div className="upload-security">
              <Check size={15} />
              <span>文件仅用于本次讲题服务，老师接单后才可查看</span>
            </div>
          </>
        ) : step === 2 ? (
          <>
            <label className="field-label">
              任务标题
              <input
                className="text-input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如：月考函数与导数错题讲解"
              />
            </label>
            <label className="field-label">
              期望讲解方式
              <div className="service-select">
                {(["直播讲解", "录制讲解", "均可"] as const).map((type) => (
                  <button
                    className={serviceType === type ? "active" : ""}
                    key={type}
                    onClick={() => setServiceType(type)}
                  >
                    {type === "直播讲解" ? (
                      <Radio size={18} />
                    ) : type === "录制讲解" ? (
                      <Video size={18} />
                    ) : (
                      <BookOpenCheck size={18} />
                    )}
                    <span>{type}</span>
                  </button>
                ))}
              </div>
            </label>
            <label className="field-label">
              补充要求
              <textarea
                className="text-input textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="告诉老师你的薄弱点、希望重点讲解的题目和讲解方式"
              />
            </label>
          </>
        ) : (
          <>
            <div className="publish-price">
              <label className="field-label">
                任务预算
                <div className="money-input">
                  <span>¥</span>
                  <input
                    type="number"
                    value={budget}
                    onChange={(event) => setBudget(Number(event.target.value))}
                  />
                </div>
              </label>
              <div className="price-guide">
                <span>同类任务参考价</span>
                <strong>¥69–129</strong>
                <small>最终价格由服务内容、题目数量和老师资历决定</small>
              </div>
            </div>
            <label className="field-label">
              期望完成时间
              <select className="text-input">
                <option>明天 20:00 前</option>
                <option>后天 18:00 前</option>
                <option>本周内</option>
              </select>
            </label>
            <div className="escrow-note">
              <Check size={17} />
              <div>
                <strong>平台担保交易</strong>
                <span>
                  确认老师后再付款，讲解完成并由你确认后才会结算给老师。
                </span>
              </div>
            </div>
          </>
        )}
        <div className="modal-actions">
          <button
            className="button secondary"
            onClick={() =>
              step === 1 ? onClose() : setStep((value) => value - 1)
            }
          >
            {step === 1 ? "取消" : "上一步"}
          </button>
          {step < 3 ? (
            <button
              className="button primary"
              onClick={() => setStep((value) => value + 1)}
            >
              下一步
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              className="button primary"
              disabled={submitting}
              onClick={() => void publish()}
            >
              {submitting ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Check size={17} />
              )}
              确认发布
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function TaskStatusLabel({ status }: { status: TeachingTask["status"] }) {
  if (status === "open")
    return <StatusBadge status="warning">等待选择老师</StatusBadge>;
  if (status === "scheduled")
    return <StatusBadge status="neutral">待讲解</StatusBadge>;
  if (status === "delivered")
    return <StatusBadge status="success">待确认</StatusBadge>;
  return <StatusBadge status="neutral">进行中</StatusBadge>;
}

function StudentLiveRoom({
  roomId = defaultSyncRoomId,
  title = "老师同步看板",
  teacherName = "老师",
  questions,
  onExit,
}: {
  roomId?: string;
  title?: string;
  teacherName?: string;
  questions: Question[];
  onExit: () => void;
}) {
  const store = useSync({
    uri: createSyncUri(roomId, "viewer"),
    assets: syncAssetStore,
  });
  const current = questions[1] ?? questions[0];
  return (
    <div className="student-room">
      <header>
        <div>
          <button className="icon-button" onClick={onExit}>
            <ArrowLeft size={19} />
          </button>
          <div>
            <strong>{title}</strong>
            <span>{teacherName} · 课堂内容实时同步中</span>
          </div>
        </div>
        <div className="student-live-status">
          <span className="live-dot" />
          同步中
        </div>
        <button className="button secondary">课堂反馈</button>
      </header>
      <main>
        <section className="viewer-board">
          <div className="question-overlay student">
            <span>
              第 {current?.number} 题 · {current?.type}
            </span>
            <strong><QuestionContent value={current?.stem} /></strong>
          </div>
          <Tldraw
            store={store}
            components={{
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
            }}
            onMount={(editor) => {
              editor.updateInstanceState({ isReadonly: true });
              configureClassroomViewport(editor);
            }}
          />
        </section>
        <aside className="student-room-panel">
          <div className="teacher-profile">
            <div className="avatar">王</div>
            <div>
              <strong>王老师</strong>
              <span>高中数学 · 12 年教龄</span>
            </div>
          </div>
          <section>
            <h3>本场试题</h3>
            {questions.slice(0, 5).map((question) => (
              <div
                className={question.id === current?.id ? "active" : ""}
                key={question.id}
              >
                <span>{question.number}</span>
                <div>
                  <strong>第 {question.number} 题</strong>
                  <small>{question.type}</small>
                </div>
                {question.id === current?.id ? <span>讲解中</span> : null}
              </div>
            ))}
          </section>
          <div className="student-question-box">
            <strong>有疑问？</strong>
            <p>举手后老师可以在同步讲题时看到。</p>
            <button className="button secondary full">举手提问</button>
          </div>
        </aside>
      </main>
    </div>
  );
}

function StudentReplayLegacy({
  questions,
  activeQuestionId,
  onSelect,
  onExit,
}: {
  questions: Question[];
  activeQuestionId: string;
  onSelect: (id: string) => void;
  onExit: () => void;
}) {
  const question =
    questions.find((item) => item.id === activeQuestionId) ?? questions[0];
  return (
    <div className="replay-page">
      <header className="student-topbar">
        <div className="student-brand">
          <span>
            <Sparkles size={18} />
          </span>
          <strong>笔尖云堂</strong>
        </div>
        <button className="back-link" onClick={onExit}>
          <ArrowLeft size={16} />
          返回学习首页
        </button>
        <div className="avatar">陈</div>
      </header>
      <main>
        <div className="replay-heading">
          <div>
            <span>高三数学第一次月考</span>
            <h1>逐题讲解</h1>
          </div>
          <div>
            <strong>
              {
                questions.filter((item) => item.teachingStatus !== "unrecorded")
                  .length
              }
            </strong>{" "}
            / {questions.length} 题已学习
          </div>
        </div>
        <div className="replay-layout">
          <aside className="replay-list">
            <div>
              <strong>试卷题目</strong>
              <span>{questions.length} 题</span>
            </div>
            {questions.map((item) => (
              <button
                className={item.id === question?.id ? "active" : ""}
                key={item.id}
                onClick={() => onSelect(item.id)}
              >
                <span>{item.number}</span>
                <div>
                  <strong>第 {item.number} 题</strong>
                  <small>
                    {item.type} · {item.points} 分
                  </small>
                </div>
                {item.teachingStatus === "recorded" ? (
                  <Check size={15} />
                ) : null}
              </button>
            ))}
          </aside>
          <section className="replay-player">
            <div className="video-placeholder">
              <div>
                <Play size={30} />
              </div>
              <span>白板事件回放 + 教师音频</span>
            </div>
            <div className="fake-timeline">
              <button>
                <Play size={16} />
              </button>
              <span>01:48</span>
              <div>
                <i style={{ width: "41%" }} />
              </div>
              <span>04:26</span>
            </div>
            <article>
              <span className="eyebrow">
                第 {question?.number} 题 · {question?.type}
              </span>
              <h2><QuestionContent value={question?.stem} /></h2>
              <div className="answer-panel">
                <strong>答案：{question?.answer}</strong>
                <p>{question?.analysis}</p>
              </div>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}

function StudentReplay({
  questions,
  assets,
  activeQuestionId,
  onSelect,
  onExit,
}: {
  questions: Question[];
  assets: RecordingAsset[];
  activeQuestionId: string;
  onSelect: (id: string) => void;
  onExit: () => void;
}) {
  const question =
    questions.find((item) => item.id === activeQuestionId) ?? questions[0];
  const asset = assets.find((item) =>
    item.questionIds.includes(question?.id ?? ""),
  );
  return (
    <div className="replay-page">
      <header className="student-topbar">
        <div className="student-brand">
          <span>
            <Sparkles size={18} />
          </span>
          <strong>笔尖云堂</strong>
        </div>
        <button className="back-link" onClick={onExit}>
          <ArrowLeft size={16} />
          返回学习首页
        </button>
        <div className="avatar">陈</div>
      </header>
      <main>
        <div className="replay-heading">
          <div>
            <span>高三数学第一次月考</span>
            <h1>tldraw 逐题时序回放</h1>
          </div>
          <div>
            <strong>
              {
                questions.filter((item) => item.teachingStatus !== "unrecorded")
                  .length
              }
            </strong>{" "}
            / {questions.length} 题已学习
          </div>
        </div>
        <div className="replay-layout">
          <aside className="replay-list">
            <div>
              <strong>试卷题目</strong>
              <span>{questions.length} 题</span>
            </div>
            {questions.map((item) => (
              <button
                className={item.id === question?.id ? "active" : ""}
                key={item.id}
                onClick={() => onSelect(item.id)}
              >
                <span>{item.number}</span>
                <div>
                  <strong>第 {item.number} 题</strong>
                  <small>
                    {item.type} · {item.points} 分
                  </small>
                </div>
                {item.teachingStatus === "recorded" ? (
                  <Check size={15} />
                ) : null}
              </button>
            ))}
          </aside>
          <section className="sequence-learning">
            <TldrawSequencePlayer
              sessionId={asset?.id}
              title={asset?.title ?? `第 ${question?.number} 题讲解`}
              compact
            />
            <article>
              <span className="eyebrow">
                第 {question?.number} 题 · {question?.type}
              </span>
              <h2><QuestionContent value={question?.stem} /></h2>
              <div className="answer-panel">
                <strong>答案：{question?.answer}</strong>
                <p>{question?.analysis}</p>
              </div>
            </article>
          </section>
        </div>
      </main>
    </div>
  );
}

function TldrawSequencePlayer({
  sessionId,
  title,
  compact = false,
}: {
  sessionId?: string;
  title: string;
  compact?: boolean;
}) {
  const editorRef = useRef<Editor | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cursorRef = useRef(0);
  const fallbackClockRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [recording, setRecording] = useState<RecordingPackage | null>(null);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [time, setTime] = useState(0);
  const events = useMemo(
    () => (recording ? flattenRecordingEvents(recording) : []),
    [recording],
  );
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
    audioRef.current?.pause();
  }, []);
  const mountRecording = useCallback((pack: RecordingPackage) => {
    audioRef.current?.pause();
    audioRef.current = pack.audio?.url ? new Audio(pack.audio.url) : null;
    if (audioRef.current) audioRef.current.preload = "metadata";
    cursorRef.current = 0;
    setRecording(pack);
    setCursor(0);
    setTime(0);
    setError(null);
    window.setTimeout(() => {
      if (editorRef.current) {
        loadRecordingBaseline(editorRef.current, pack);
        editorRef.current.updateInstanceState({ isReadonly: true });
      }
    }, 0);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    recordingStorage
      .load(sessionId)
      .then((pack) => {
        if (!cancelled) mountRecording(pack);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "该开发数据尚未绑定真实录制包；正式环境将按 sessionId 加载基线快照和事件分片。",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mountRecording, sessionId]);

  const playFrom = useCallback(
    (index: number) => {
      if (!recording || !editorRef.current) return;
      cursorRef.current = index;
      fallbackClockRef.current = performance.now() - time;
      const audio = audioRef.current;
      if (audio && recording.audio) {
        audio.currentTime = Math.max(
          0,
          (time - recording.audio.startOffsetMs) / 1000,
        );
        void audio
          .play()
          .catch(() =>
            setError("音频无法播放，请检查音频地址或浏览器自动播放策略。"),
          );
      }
      setPlaying(true);
      const tick = () => {
        const timelineTime =
          audio && recording.audio
            ? Math.min(
                recording.duration,
                audio.currentTime * 1000 + recording.audio.startOffsetMs,
              )
            : Math.min(
                recording.duration,
                performance.now() - fallbackClockRef.current,
              );
        let nextCursor = cursorRef.current;
        while (
          nextCursor < events.length &&
          events[nextCursor].timestamp <= timelineTime
        ) {
          applyRecordedEvent(editorRef.current!, events[nextCursor]);
          nextCursor += 1;
        }
        cursorRef.current = nextCursor;
        setCursor(nextCursor);
        setTime(timelineTime);
        if (timelineTime >= recording.duration || (audio?.ended ?? false)) {
          setPlaying(false);
          timerRef.current = null;
          return;
        }
        timerRef.current = window.requestAnimationFrame(tick);
      };
      timerRef.current = window.requestAnimationFrame(tick);
    },
    [events, recording, time],
  );
  const seek = useCallback(
    (target: number) => {
      if (!recording || !editorRef.current) return;
      clearTimer();
      setPlaying(false);
      const result = seekRecording(editorRef.current, recording, target);
      cursorRef.current = result.cursor;
      if (audioRef.current && recording.audio)
        audioRef.current.currentTime = Math.max(
          0,
          (target - recording.audio.startOffsetMs) / 1000,
        );
      setCursor(result.cursor);
      setTime(result.time);
    },
    [clearTimer, recording],
  );
  const reset = useCallback(() => {
    if (!recording || !editorRef.current) return;
    clearTimer();
    loadRecordingBaseline(editorRef.current, recording);
    if (audioRef.current) audioRef.current.currentTime = 0;
    cursorRef.current = 0;
    setCursor(0);
    setTime(0);
    setPlaying(false);
  }, [clearTimer, recording]);
  useEffect(() => clearTimer, [clearTimer]);

  return (
    <section className={`sequence-player ${compact ? "compact" : ""}`}>
      <div className="sequence-stage">
        <Tldraw
          onMount={(editor) => {
            editorRef.current = editor;
            editor.updateInstanceState({ isReadonly: true });
            if (recording) loadRecordingBaseline(editor, recording);
          }}
          components={{
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
          }}
        />
        {loading ? (
          <div className="sequence-message">
            <LoaderCircle className="spin" size={22} />
            <strong>正在加载 tldraw 时序包</strong>
          </div>
        ) : error || !recording ? (
          <div className="sequence-message">
            <BookOpenCheck size={23} />
            <strong>{title}</strong>
            <span>
              {compact
                ? "老师正在整理白板事件和音频时间轴，完成后即可回放。"
                : (error ?? "尚未生成录制时序包")}
            </span>
            {!compact ? (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept="application/json"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file)
                      void recordingStorage.load(file).then(mountRecording);
                  }}
                />
                <button
                  className="button secondary"
                  onClick={() => inputRef.current?.click()}
                >
                  导入本地录制包验证
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="sequence-controls">
        <button
          className="icon-button"
          disabled={!recording}
          onClick={() =>
            playing ? (clearTimer(), setPlaying(false)) : playFrom(cursor)
          }
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
        </button>
        <button className="icon-button" disabled={!recording} onClick={reset}>
          <RotateCcw size={16} />
        </button>
        <span>{formatMs(time)}</span>
        <input
          type="range"
          min={0}
          max={recording?.duration ?? 0}
          step={50}
          value={time}
          disabled={!recording}
          onChange={(event) => seek(Number(event.target.value))}
        />
        <span>{formatMs(recording?.duration ?? 0)}</span>
        <div className="sequence-meta">
          <span>{events.length} 个事件</span>
          <span>{recording?.keyframes?.length ?? 0} 个关键帧</span>
        </div>
      </div>
    </section>
  );
}

function SpotlightCard({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const ref = useRef<HTMLElement | null>(null);
  return (
    <article
      ref={ref}
      className={`rb-spotlight-card ${className}`}
      onClick={onClick}
      onMouseMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty(
          "--spot-x",
          `${event.clientX - bounds.left}px`,
        );
        event.currentTarget.style.setProperty(
          "--spot-y",
          `${event.clientY - bounds.top}px`,
        );
      }}
    >
      {children}
    </article>
  );
}

function isFreePreview(
  product: LearningProduct,
  question: Question | undefined,
  index: number,
) {
  if (product.previewMode === "selected")
    return Boolean(
      question && product.previewQuestionIds?.includes(question.id),
    );
  return index < (product.freeQuestionCount ?? 0);
}

function previewCount(product: LearningProduct, lessonQuestions: Question[]) {
  return product.previewMode === "selected"
    ? lessonQuestions.filter((question) =>
        product.previewQuestionIds?.includes(question.id),
      ).length
    : Math.min(product.freeQuestionCount ?? 0, lessonQuestions.length);
}

function previewLabel(product: LearningProduct, lessonQuestions: Question[]) {
  const count = previewCount(product, lessonQuestions);
  return product.previewMode === "selected"
    ? `任选 ${count} 题免费试看`
    : `前 ${count} 题免费试看`;
}

function TeacherAgentStore({
  products,
  questions,
  assets,
  onSwitchPortal,
}: {
  products: LearningProduct[];
  questions: Question[];
  assets: RecordingAsset[];
  onSwitchPortal: () => void;
}) {
  const [view, setView] = useState<"home" | "detail" | "library">("home");
  const [selectedId, setSelectedId] = useState(products[0]?.id);
  const [activeLesson, setActiveLesson] = useState(0);
  const [purchasedIds, setPurchasedIds] = useState<string[]>(
    products.slice(0, 1).map((product) => product.id),
  );
  const selected =
    products.find((product) => product.id === selectedId) ?? products[0];
  const openProduct = (id: string) => {
    setSelectedId(id);
    setActiveLesson(0);
    setView("detail");
  };
  const header = (
    <header className="ta-header">
      <button className="ta-brand" onClick={() => setView("home")}>
        <span>
          <Sparkles size={17} />
        </span>
        <strong>笔尖云堂</strong>
        <small>把题真正讲明白</small>
      </button>
      <nav>
        <button
          className={view === "home" ? "active" : ""}
          onClick={() => setView("home")}
        >
          发现
        </button>
        <button
          onClick={() =>
            document
              .getElementById("teacher-content")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        >
          老师精讲
        </button>
        <button
          className={view === "library" ? "active" : ""}
          onClick={() => setView("library")}
        >
          我的学习
        </button>
      </nav>
      <label className="ta-search">
        <Search size={16} />
        <input placeholder="搜索试卷、题目、知识点" />
      </label>
      <div className="ta-user">
        <button onClick={onSwitchPortal}>老师工作台</button>
        <span>陈</span>
      </div>
    </header>
  );

  if (view === "detail" && selected) {
    const purchased = purchasedIds.includes(selected.id);
    const lessonQuestions = questions.slice(0, selected.lessonCount);
    const freeCount = previewCount(selected, lessonQuestions);
    const unlocked =
      purchased ||
      isFreePreview(selected, lessonQuestions[activeLesson], activeLesson);
    const asset = assets.find((item) =>
      selected.recordingAssetIds.includes(item.id),
    );
    return (
      <div className="ta-store">
        {header}
        <main className="ta-detail">
          <button className="ta-back" onClick={() => setView("home")}>
            <ArrowLeft size={16} />
            返回内容广场
          </button>
          <section className="ta-detail-head">
            <div>
              <span className="ta-kicker">
                {selected.grade} · {selected.subject} · {selected.productType}
              </span>
              <h1>{selected.title}</h1>
              <p>{selected.subtitle}</p>
              <div className="ta-proof">
                <span>
                  <Star size={15} fill="currentColor" />
                  {selected.rating}
                </span>
                <span>{selected.sales} 人已学习</span>
                <span>
                  {selected.lessonCount} 题 · {selected.duration}
                </span>
                <span>{previewLabel(selected, lessonQuestions)}</span>
              </div>
            </div>
            <aside>
              <small>整套解锁</small>
              <strong>¥{selected.price}</strong>
              {selected.originalPrice ? (
                <del>¥{selected.originalPrice}</del>
              ) : null}
              {purchased ? (
                <button onClick={() => setView("library")}>
                  <Check size={17} />
                  已购买，进入学习
                </button>
              ) : (
                <button
                  onClick={() =>
                    setPurchasedIds((ids) => [...ids, selected.id])
                  }
                >
                  <ShoppingCart size={17} />
                  解锁全部讲解
                </button>
              )}
              <p>购买后永久回放 · 支持按题学习</p>
            </aside>
          </section>
          <section className="ta-learning-layout">
            <aside className="ta-lesson-list">
              <div>
                <strong>题目目录</strong>
                <span>{freeCount} 题可免费试看</span>
              </div>
              {lessonQuestions.map((question, index) => {
                const isFree = isFreePreview(selected, question, index);
                const canPlay = purchased || isFree;
                return (
                  <button
                    className={activeLesson === index ? "active" : ""}
                    key={question.id}
                    onClick={() => setActiveLesson(index)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>
                        第 {question.number} 题 · {question.type}
                      </strong>
                      <small><QuestionContent value={question.stem} /></small>
                    </div>
                    <i>
                      {canPlay ? (
                        isFree && !purchased ? (
                          "免费"
                        ) : (
                          <Play size={14} />
                        )
                      ) : (
                        "锁定"
                      )}
                    </i>
                  </button>
                );
              })}
            </aside>
            <section className="ta-lesson-stage">
              {unlocked ? (
                <>
                  <div className="ta-player-label">
                    <span>
                      <i />
                      板书时序 + 老师原声
                    </span>
                    <small>可暂停、拖动与反复回放</small>
                  </div>
                  <TldrawSequencePlayer
                    compact
                    sessionId={asset?.id}
                    title={`第 ${lessonQuestions[activeLesson]?.number ?? activeLesson + 1} 题讲解`}
                  />
                  <article>
                    <span>本题解析</span>
                    <h2><QuestionContent value={lessonQuestions[activeLesson]?.stem} /></h2>
                    <p>{lessonQuestions[activeLesson]?.analysis}</p>
                  </article>
                </>
              ) : (
                <div className="ta-paywall">
                  <span>
                    <BookOpenCheck size={28} />
                  </span>
                  <h2>这道题属于付费内容</h2>
                  <p>
                    本商品开放 {freeCount} 道完整试看题。解锁后可学习全部{" "}
                    {selected.lessonCount}{" "}
                    道题，并永久回放老师的真实板书与讲解音频。
                  </p>
                  <button
                    onClick={() =>
                      setPurchasedIds((ids) => [...ids, selected.id])
                    }
                  >
                    ¥{selected.price} 解锁全部
                  </button>
                  <small>平台担保支付 · 内容问题支持申诉</small>
                </div>
              )}
            </section>
          </section>
        </main>
      </div>
    );
  }

  if (view === "library") {
    const purchased = products.filter((product) =>
      purchasedIds.includes(product.id),
    );
    return (
      <div className="ta-store">
        {header}
        <main className="ta-library">
          <span className="ta-kicker">MY LEARNING</span>
          <h1>我的学习</h1>
          <p>已解锁内容会永久保留，继续上一次的学习进度。</p>
          <div>
            {purchased.length ? (
              purchased.map((product) => (
                <SpotlightCard
                  key={product.id}
                  className="ta-library-card"
                  onClick={() => openProduct(product.id)}
                >
                  <span className={`ta-cover ${product.coverStyle}`}>
                    <BookOpenCheck size={24} />
                  </span>
                  <div>
                    <strong>{product.title}</strong>
                    <p>{product.lessonCount} 题 · 已学习 32%</p>
                    <i>
                      <b style={{ width: "32%" }} />
                    </i>
                  </div>
                  <ChevronRight size={18} />
                </SpotlightCard>
              ))
            ) : (
              <EmptyState
                title="还没有已购内容"
                description="你可以先试看老师讲解，再决定是否解锁。"
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="ta-store">
      {header}
      <main className="ta-home">
        <section className="ta-hero">
          <div className="ta-hero-copy">
            <span className="ta-kicker">
              <i />
              AI 解题，也能像老师一样一步步写给你看
            </span>
            <h1>
              不只给答案，
              <br />
              <em>把解题过程演给你看。</em>
            </h1>
            <p>
              上传题目，笔尖云堂 AI
              会生成可暂停、可拖动、可反复观看的板书时序；遇到难题，也可以选择真实老师的付费精讲。
            </p>
            <div className="ta-solve-box">
              <button>
                <FileUp size={19} />
                <span>
                  <strong>上传一道题</strong>
                  <small>支持图片或 PDF</small>
                </span>
              </button>
              <i>或</i>
              <label>
                <input placeholder="输入题目或粘贴题目内容…" />
                <button>
                  <Sparkles size={16} />
                  开始解题
                </button>
              </label>
            </div>
            <div className="ta-hero-notes">
              <span>
                <Check size={14} />
                逐步板书回放
              </span>
              <span>
                <Check size={14} />
                关键步骤讲解
              </span>
              <span>
                <Check size={14} />
                免费生成基础解析
              </span>
            </div>
          </div>
          <div className="ta-demo">
            <div className="ta-demo-head">
              <span>笔尖云堂 AI 正在解题</span>
              <small>函数与导数 · 第 3 步 / 5</small>
            </div>
            <div className="ta-demo-paper">
              <span>已知 f(x)=x³−3x，求函数的单调区间</span>
              <div className="draw-line l1" />
              <div className="draw-line l2" />
              <div className="draw-line l3" />
              <strong>f′(x)=3x²−3=3(x−1)(x+1)</strong>
              <i>令 f′(x) &gt; 0，得到 x &lt; −1 或 x &gt; 1</i>
            </div>
            <div className="ta-demo-controls">
              <button>
                <Play size={15} fill="currentColor" />
              </button>
              <span>00:18</span>
              <div>
                <i />
              </div>
              <span>00:46</span>
              <small>1×</small>
            </div>
          </div>
        </section>
        <section className="ta-value-strip">
          <div>
            <strong>过程可回放</strong>
            <span>不是一次性答案，每一步都能重新看</span>
          </div>
          <div>
            <strong>人机双路径</strong>
            <span>AI 快速解题，老师提供深度精讲</span>
          </div>
          <div>
            <strong>按题购买</strong>
            <span>先免费试看，确认适合再付费</span>
          </div>
        </section>
        <section className="ta-products" id="teacher-content">
          <div className="ta-section-head">
            <div>
              <span className="ta-kicker">TEACHER PICKS</span>
              <h2>老师上传的精选讲题</h2>
              <p>真实板书时序与老师原声同步，前几题免费试看。</p>
            </div>
            <button>
              查看全部
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="ta-product-grid">
            {products.map((product, productIndex) => {
              const lessonQuestions = questions.slice(0, product.lessonCount);
              return (
                <SpotlightCard
                  key={product.id}
                  className="ta-product-card"
                  onClick={() => openProduct(product.id)}
                >
                  <div className={`ta-product-cover ${product.coverStyle}`}>
                    <span>
                      {product.grade} · {product.subject}
                    </span>
                    <strong>{product.title}</strong>
                    <div className="ta-board-preview">
                      <i />
                      <i />
                      <i />
                    </div>
                    <small>
                      <Play size={13} />
                      时序板书回放
                    </small>
                  </div>
                  <div className="ta-product-body">
                    <div>
                      <span>{product.productType}</span>
                      <b>{previewLabel(product, lessonQuestions)}</b>
                    </div>
                    <h3>{product.title}</h3>
                    <p>{product.subtitle}</p>
                    <div className="ta-teacher">
                      <span>{product.teacherName.slice(0, 1)}</span>
                      <strong>{product.teacherName}</strong>
                      <small>
                        <Star size={13} fill="currentColor" />
                        {product.rating} · {product.sales} 人学习
                      </small>
                    </div>
                    <footer>
                      <div>
                        <strong>
                          {productIndex === 0 ? "已购买" : `¥${product.price}`}
                        </strong>
                        {product.originalPrice ? (
                          <del>¥{product.originalPrice}</del>
                        ) : null}
                      </div>
                      <span>
                        {product.lessonCount} 题 · {product.duration}
                      </span>
                    </footer>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function LearningStore({
  products,
  questions,
  assets,
  onSwitchPortal,
}: {
  products: LearningProduct[];
  questions: Question[];
  assets: RecordingAsset[];
  onSwitchPortal: () => void;
}) {
  const [view, setView] = useState<"home" | "detail" | "library">("home");
  const [selectedId, setSelectedId] = useState(products[0]?.id);
  const [purchasedIds, setPurchasedIds] = useState<string[]>(
    products.slice(0, 1).map((product) => product.id),
  );
  const selected =
    products.find((product) => product.id === selectedId) ?? products[0];
  const header = (
    <header className="store-header">
      <div className="store-brand">
        <span>
          <Sparkles size={18} />
        </span>
        <div>
          <strong>笔尖云堂</strong>
          <small>让每一道题都有好老师讲明白</small>
        </div>
      </div>
      <nav>
        <button
          className={view === "home" ? "active" : ""}
          onClick={() => setView("home")}
        >
          发现好课
        </button>
        <button
          className={view === "library" ? "active" : ""}
          onClick={() => setView("library")}
        >
          我的内容库
        </button>
        <button>分类</button>
      </nav>
      <label className="store-search">
        <Search size={17} />
        <input placeholder="搜索试卷、题目或老师" />
      </label>
      <div>
        <button className="portal-switch" onClick={onSwitchPortal}>
          返回老师端
        </button>
        <div className="avatar">陈</div>
      </div>
    </header>
  );
  if (view === "detail" && selected) {
    const purchased = purchasedIds.includes(selected.id);
    const firstAsset = assets.find((asset) =>
      selected.recordingAssetIds.includes(asset.id),
    );
    return (
      <div className="learning-store">
        {header}
        <main className="store-detail">
          <button className="back-link" onClick={() => setView("home")}>
            <ArrowLeft size={16} />
            返回课程列表
          </button>
          <section className="product-detail-hero">
            <div className={`store-detail-cover ${selected.coverStyle}`}>
              <span>
                {selected.grade} · {selected.subject}
              </span>
              <strong>{selected.productType}</strong>
              <small>tldraw 白板时序精讲</small>
            </div>
            <div className="product-detail-info">
              <span className="eyebrow">{selected.productType}</span>
              <h1>{selected.title}</h1>
              <p>{selected.subtitle}</p>
              <div className="product-rating">
                <strong>{selected.rating} ★</strong>
                <span>{selected.sales} 人已购买</span>
                <span>
                  {selected.lessonCount} 讲 · {selected.duration}
                </span>
              </div>
              <div className="product-highlights">
                {selected.highlights.map((highlight) => (
                  <span key={highlight}>
                    <Check size={14} />
                    {highlight}
                  </span>
                ))}
              </div>
              <div className="buy-box">
                <div>
                  <span>限时价格</span>
                  <strong>¥{selected.price}</strong>
                  {selected.originalPrice ? (
                    <del>¥{selected.originalPrice}</del>
                  ) : null}
                </div>
                {purchased ? (
                  <button
                    className="store-buy purchased"
                    onClick={() => setView("library")}
                  >
                    <BookOpenCheck size={18} />
                    已购买，开始学习
                  </button>
                ) : (
                  <button
                    className="store-buy"
                    onClick={() =>
                      setPurchasedIds((items) => [...items, selected.id])
                    }
                  >
                    <ShoppingCart size={18} />
                    立即购买
                  </button>
                )}
              </div>
              <div className="store-guarantees">
                <span>
                  <Check size={14} />
                  平台安全支付
                </span>
                <span>
                  <Check size={14} />
                  购买后永久有效
                </span>
                <span>
                  <Check size={14} />
                  支持内容申诉
                </span>
              </div>
            </div>
          </section>
          <section className="product-detail-body">
            <div>
              <h2>内容介绍</h2>
              <p>{selected.description}</p>
              <h2>课程目录</h2>
              <div className="store-catalog">
                {questions
                  .slice(0, Math.min(5, selected.lessonCount))
                  .map((question, index) => (
                    <div key={question.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>
                          第 {question.number} 题 · {question.type}
                        </strong>
                        <small><QuestionContent value={question.stem} /></small>
                      </div>
                      <span>{purchased ? "可回放" : "购买后解锁"}</span>
                    </div>
                  ))}
              </div>
            </div>
            <aside>
              <div className="teacher-intro">
                <div className="avatar">王</div>
                <div>
                  <strong>{selected.teacherName}</strong>
                  <span>高中数学认证老师</span>
                </div>
                <p>
                  专注高中数学方法教学，擅长将复杂问题拆解成可复用的解题步骤。
                </p>
                <div>
                  <span>
                    <strong>4.9</strong>老师评分
                  </span>
                  <span>
                    <strong>1,286</strong>学习人数
                  </span>
                </div>
              </div>
            </aside>
          </section>
        </main>
      </div>
    );
  }
  if (view === "library") {
    const purchased = products.filter((product) =>
      purchasedIds.includes(product.id),
    );
    const activeProduct = purchased[0];
    const firstAsset = assets.find((asset) =>
      activeProduct?.recordingAssetIds.includes(asset.id),
    );
    return (
      <div className="learning-store">
        {header}
        <main className="store-library">
          <PageHeader
            title="我的内容库"
            description="购买的整卷、专题和单题讲解会永久保存在这里。"
          />
          <div className="library-layout">
            <aside>
              {purchased.map((product) => (
                <button
                  className={product.id === activeProduct?.id ? "active" : ""}
                  key={product.id}
                >
                  <div className={`mini-product-cover ${product.coverStyle}`}>
                    <BookOpenCheck size={17} />
                  </div>
                  <div>
                    <strong>{product.title}</strong>
                    <small>{product.lessonCount} 讲 · 已学习 32%</small>
                  </div>
                </button>
              ))}
            </aside>
            <section>
              <div className="library-heading">
                <div>
                  <span>正在学习</span>
                  <h2>{activeProduct?.title}</h2>
                </div>
                <span>购买后永久有效</span>
              </div>
              <TldrawSequencePlayer
                compact
                sessionId={firstAsset?.id}
                title={firstAsset?.title ?? activeProduct?.title ?? "学习内容"}
              />
            </section>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="learning-store">
      {header}
      <main className="store-home">
        <section className="store-hero">
          <div>
            <span className="eyebrow">专业老师 · 真实板书 · 按题回放</span>
            <h1>
              找到适合你的
              <br />
              试卷与题目精讲
            </h1>
            <p>
              不是录屏视频。每一笔板书都按真实讲解时序重现，支持按题跳转和反复回放。
            </p>
            <button
              onClick={() => {
                setSelectedId(products[0]?.id);
                setView("detail");
              }}
            >
              查看精选内容
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="store-hero-visual">
            <div className="floating-sheet sheet-back" />
            <div className="floating-sheet">
              <span>高三数学</span>
              <strong>
                月考试卷
                <br />
                逐题精讲
              </strong>
              <small>22 道题 · tldraw 时序回放</small>
              <div>
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="floating-player">
              <Play size={18} />
              <span>正在回放第 8 题</span>
            </div>
          </div>
        </section>
        <section className="store-category">
          <button className="active">精选推荐</button>
          <button>整卷讲解</button>
          <button>专题合集</button>
          <button>单题精讲</button>
          <button>免费内容</button>
        </section>
        <section className="store-products">
          <div className="section-heading">
            <div>
              <h2>本周精选</h2>
              <p>来自平台认证老师的高质量时序讲解</p>
            </div>
          </div>
          <div className="store-product-grid">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => {
                  setSelectedId(product.id);
                  setView("detail");
                }}
              >
                <div className={`store-product-cover ${product.coverStyle}`}>
                  <span>
                    {product.grade} · {product.subject}
                  </span>
                  <strong>{product.title}</strong>
                  <small>{product.productType}</small>
                  <div>
                    <BookOpenCheck size={15} />
                    {product.lessonCount} 讲
                  </div>
                </div>
                <div>
                  <span className="product-type">{product.productType}</span>
                  <h3>{product.title}</h3>
                  <p>{product.subtitle}</p>
                  <div className="product-teacher">
                    <span className="avatar">王</span>
                    <span>{product.teacherName}</span>
                    <span>{product.rating} ★</span>
                  </div>
                  <div className="product-price">
                    <strong>¥{product.price}</strong>
                    {product.originalPrice ? (
                      <del>¥{product.originalPrice}</del>
                    ) : null}
                    <span>{product.sales} 人购买</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone?: "default" | "warning" | "success";
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
      <i>{icon}</i>
    </article>
  );
}
function PaperStatusBadge({
  paper,
  processing,
}: {
  paper: Paper;
  processing?: PaperProcessingStatus;
}) {
  const progress = processing?.progress ?? paper.progress;
  const stageLabels: Record<string, string> = {
    queued: "等待解析",
    normalizing: "页面标准化",
    mineru_running: "OCR 与公式识别",
    deepseek_pending: "AI 切题与结构化",
    review_required: "等待老师校对",
  };
  if (paper.status === "failed" || processing?.status === "failed")
    return <StatusBadge status="danger">解析失败</StatusBadge>;
  if (paper.status === "processing")
    return (
      <div className="processing-status">
        <span>
          <LoaderCircle className="spin" size={15} />
          {stageLabels[processing?.stage ?? ""] ?? "AI 解析中"}
        </span>
        <div>
          <i style={{ width: `${progress}%` }} />
        </div>
        <small>{progress}%</small>
      </div>
    );
  if (paper.status === "review")
    return <StatusBadge status="warning">待校对</StatusBadge>;
  return <StatusBadge status="success">处理完成</StatusBadge>;
}
function StatusBadge({
  status,
  children,
}: {
  status: "success" | "warning" | "neutral" | "danger";
  children: React.ReactNode;
}) {
  return <span className={`status-badge ${status}`}>{children}</span>;
}
function Confidence({ value }: { value: number }) {
  return (
    <div className={`confidence ${value < 90 ? "low" : ""}`}>
      <div>
        <i style={{ width: `${value}%` }} />
      </div>
      <span>{value}%</span>
    </div>
  );
}

function DifficultyBadge({ value }: { value?: Question["difficulty"] }) {
  const difficulty = value ?? "中";
  return <span className={`difficulty-badge difficulty-${difficulty === "高" ? "high" : difficulty === "低" ? "low" : "medium"}`}>{difficulty}</span>;
}
function EmptyTableRow({ columns, message }: { columns: number; message: string }) {
  return <tr className="empty-table-row"><td colSpan={columns}><FileText size={22} /><strong>{message}</strong></td></tr>;
}

function Pagination({
  current,
  total,
  totalItems,
  onChange,
}: {
  current: number;
  total: number;
  totalItems: number;
  onChange: (page: number) => void;
}) {
  if (totalItems === 0) return null;
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  const pages = Array.from({ length: end - start + 1 }, (_, index) => start + index);
  return (
    <div className="table-pagination">
      <span>共 {totalItems} 条</span>
      <div>
        <button disabled={current <= 1} onClick={() => onChange(current - 1)} aria-label="上一页"><ChevronLeft size={16} /></button>
        {pages.map((page) => <button key={page} className={page === current ? "active" : ""} onClick={() => onChange(page)}>{page}</button>)}
        <button disabled={current >= total} onClick={() => onChange(current + 1)} aria-label="下一页"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}
function EmptyCollection({ message }: { message: string }) {
  return <div className="empty-collection"><FileText size={26} /><strong>{message}</strong><span>当前没有可展示的数据</span></div>;
}
function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="error-banner">
      <span>{message}</span>
      <button onClick={onRetry}>重新加载</button>
    </div>
  );
}
function LoadingState() {
  return (
    <div className="loading-state">
      <LoaderCircle className="spin" size={26} />
      <strong>正在加载教学内容</strong>
      <span>请稍候…</span>
    </div>
  );
}
function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <FileText size={28} />
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
function formatMs(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
