export type PaperStatus = "ready" | "review" | "processing" | "failed";
export type QuestionStatus = "confirmed" | "review";
export type TeachingStatus = "recorded" | "draft" | "unrecorded";
export type ClassGroup = { id: string; teacherId: string; name: string; grade: string; description: string; memberCount: number; createdAt: string };
export type ClassMember = { studentId: string; studentName: string; mobile: string; joinedAt: string };
export type ClassAssignment = { id: string; groupId: string; groupName: string; teacherName?: string; contentType: "paper" | "question"; contentId: string; title: string; recipientType?: "group" | "student"; studentId?: string; recipientCount?: number; status?: "published" | "scheduled"; scheduledAt?: string; createdAt: string };
export type SyncRoomQuestion = { id: string; number: number; type: string; stem: string; optionsJson?: string };
export type SyncRoom = { id: string; groupId: string; groupName: string; teacherId: string; teacherName: string; title: string; status: "NOT_STARTED" | "ACTIVE" | "ENDED"; createdAt: string; currentQuestion?: SyncRoomQuestion | null };
export type ClassInvite = { groupId: string; inviteCode: string; expiresAt: string };
export type QuestionDifficulty = "高" | "中" | "低";

export type Paper = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  source: string;
  uploadedAt: string;
  pageCount: number;
  questionCount: number;
  reviewedCount: number;
  taughtCount: number;
  progress: number;
  status: PaperStatus;
};

export type Question = {
  id: string;
  paperId: string;
  number: number;
  type: "选择题" | "填空题" | "解答题";
  stem: string;
  options?: string[];
  answer: string;
  analysis: string;
  points: number;
  confidence: number;
  difficulty?: QuestionDifficulty;
  status: QuestionStatus;
  teachingStatus: TeachingStatus;
  sourceRegions?: Array<{
    pageNumber: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }>;
  cropUrls?: string[];
  figureUrls?: string[];
  version?: number;
  reprocessJobId?: string;
  sourceTitle?: string;
  sourceSubject?: string;
  sourceGrade?: string;
  sourceType?: string;
  presentationLayout?: {
    width: number;
    height: number;
    blocks: Array<{
      id: string;
      kind: "stem" | "options" | "figure";
      figureIndex?: number;
      x: number;
      y: number;
      width: number;
    }>;
  };
};

export type RecordingAsset = {
  id: string;
  questionIds: string[];
  title: string;
  source: "直播切片" | "整场直播" | "单题录制";
  duration: string;
  status: "ready" | "processing" | "failed";
  published: boolean;
  createdAt: string;
};

export type TeachingTaskStatus =
  "open" | "matched" | "scheduled" | "teaching" | "delivered" | "completed";

export type TeachingTask = {
  id: string;
  studentName: string;
  studentGrade: string;
  subject: string;
  title: string;
  description: string;
  questionCount: number;
  serviceType: "直播讲解" | "录制讲解" | "均可";
  expectedAt: string;
  budget: number;
  status: TeachingTaskStatus;
  publishedAt: string;
  applicants: number;
  teacherName?: string;
  tags: string[];
};

export type LearningProduct = {
  id: string;
  teacherName: string;
  title: string;
  subtitle: string;
  subject: string;
  grade: string;
  productType: "整卷讲解" | "单题精讲" | "专题合集";
  paperId?: string;
  questionIds: string[];
  recordingAssetIds: string[];
  previewMode: "first" | "selected";
  freeQuestionCount: number;
  previewQuestionIds: string[];
  price: number;
  originalPrice?: number;
  status: "draft" | "reviewing" | "published" | "offline";
  coverStyle: "indigo" | "teal" | "orange";
  lessonCount: number;
  duration: string;
  sales: number;
  rating: number;
  publishedAt?: string;
  description: string;
  highlights: string[];
};

export const demoPapers: Paper[] = [
  {
    id: "paper-001",
    title: "高三数学第一次月考",
    subject: "数学",
    grade: "高三",
    source: "校内月考",
    uploadedAt: "2026-08-10 09:32",
    pageCount: 8,
    questionCount: 22,
    reviewedCount: 22,
    taughtCount: 8,
    progress: 100,
    status: "ready",
  },
  {
    id: "paper-002",
    title: "2026 届函数专题训练（二）",
    subject: "数学",
    grade: "高三",
    source: "专题训练",
    uploadedAt: "2026-08-09 16:18",
    pageCount: 6,
    questionCount: 18,
    reviewedCount: 14,
    taughtCount: 3,
    progress: 100,
    status: "review",
  },
  {
    id: "paper-003",
    title: "2026 高考模拟卷 A",
    subject: "数学",
    grade: "高三",
    source: "模拟考试",
    uploadedAt: "2026-08-10 15:42",
    pageCount: 12,
    questionCount: 0,
    reviewedCount: 0,
    taughtCount: 0,
    progress: 72,
    status: "processing",
  },
];

export const demoQuestions: Question[] = [
  {
    id: "q-001",
    paperId: "paper-001",
    number: 1,
    type: "选择题",
    stem: "已知集合 A={x | x²−1<0}，B={−1, 0, 1}，则 A∩B 等于",
    options: ["{−1, 0}", "{0}", "{0, 1}", "{−1, 0, 1}"],
    answer: "B",
    analysis: "由 x²−1<0 得 −1<x<1，与集合 B 取交集得到 {0}。",
    points: 5,
    confidence: 98,
    status: "confirmed",
    teachingStatus: "recorded",
  },
  {
    id: "q-002",
    paperId: "paper-001",
    number: 2,
    type: "选择题",
    stem: "若复数 z 满足 z(1−i)=2，则 |z| 等于",
    options: ["1", "√2", "2", "2√2"],
    answer: "B",
    analysis: "z=2/(1−i)=1+i，所以 |z|=√2。",
    points: 5,
    confidence: 96,
    status: "confirmed",
    teachingStatus: "unrecorded",
  },
  {
    id: "q-003",
    paperId: "paper-001",
    number: 3,
    type: "选择题",
    stem: "已知向量 a=(1,2)，b=(m,−1)，若 a⊥b，则 m 等于",
    options: ["−2", "−1/2", "1/2", "2"],
    answer: "D",
    analysis: "a·b=m−2=0，因此 m=2。",
    points: 5,
    confidence: 94,
    status: "confirmed",
    teachingStatus: "draft",
  },
  {
    id: "q-004",
    paperId: "paper-001",
    number: 4,
    type: "填空题",
    stem: "函数 f(x)=ln x−x 在区间 (0,+∞) 上的最大值为____。",
    answer: "−1",
    analysis: "f'(x)=1/x−1，x=1 时取得最大值 f(1)=−1。",
    points: 5,
    confidence: 91,
    status: "review",
    teachingStatus: "unrecorded",
  },
  {
    id: "q-005",
    paperId: "paper-001",
    number: 5,
    type: "解答题",
    stem: "在△ABC中，角 A、B、C 的对边分别为 a、b、c，已知 a=2，b=√3，A=60°，求角 B。",
    answer: "B=60° 或 120°（结合三角形条件判断）",
    analysis: "利用正弦定理建立边角关系，并检验三角形内角和。",
    points: 12,
    confidence: 87,
    status: "review",
    teachingStatus: "unrecorded",
  },
];

export const demoAssets: RecordingAsset[] = [
  {
    id: "asset-001",
    questionIds: ["q-001"],
    title: "第 1 题｜集合的交集",
    source: "直播切片",
    duration: "04:26",
    status: "ready",
    published: true,
    createdAt: "2026-08-10 11:28",
  },
  {
    id: "asset-002",
    questionIds: ["q-002", "q-003", "q-004"],
    title: "月考选择题直播回放",
    source: "整场直播",
    duration: "18:36",
    status: "processing",
    published: false,
    createdAt: "2026-08-10 14:05",
  },
  {
    id: "asset-003",
    questionIds: ["q-003"],
    title: "第 3 题｜向量垂直",
    source: "单题录制",
    duration: "07:12",
    status: "ready",
    published: false,
    createdAt: "2026-08-09 19:42",
  },
];

export const demoTasks: TeachingTask[] = [
  {
    id: "task-001",
    studentName: "陈同学",
    studentGrade: "高三",
    subject: "数学",
    title: "月考函数与导数错题讲解",
    description:
      "希望重点讲清楚第 16、20、21 题的解题思路，需要直播互动，可以约今晚。",
    questionCount: 3,
    serviceType: "直播讲解",
    expectedAt: "今天 19:30",
    budget: 89,
    status: "open",
    publishedAt: "12 分钟前",
    applicants: 2,
    tags: ["函数", "导数", "高考数学"],
  },
  {
    id: "task-002",
    studentName: "李同学",
    studentGrade: "高二",
    subject: "数学",
    title: "圆锥曲线专题题目讲解",
    description: "共 5 道题，录制讲解即可，希望每一步推导写清楚。",
    questionCount: 5,
    serviceType: "录制讲解",
    expectedAt: "明天 18:00 前",
    budget: 129,
    status: "open",
    publishedAt: "28 分钟前",
    applicants: 4,
    tags: ["圆锥曲线", "解析几何"],
  },
  {
    id: "task-003",
    studentName: "周同学",
    studentGrade: "初三",
    subject: "物理",
    title: "电路故障分析错题答疑",
    description: "电表示数变化一直不会，希望老师用图示讲解。",
    questionCount: 4,
    serviceType: "均可",
    expectedAt: "周六 14:00",
    budget: 79,
    status: "open",
    publishedAt: "1 小时前",
    applicants: 1,
    tags: ["电路", "中考物理"],
  },
  {
    id: "task-004",
    studentName: "陈同学",
    studentGrade: "高三",
    subject: "数学",
    title: "高三数学第一次月考讲评",
    description: "王老师已接单，等待今晚直播。",
    questionCount: 8,
    serviceType: "直播讲解",
    expectedAt: "今天 19:30",
    budget: 159,
    status: "scheduled",
    publishedAt: "昨天 16:20",
    applicants: 5,
    teacherName: "王老师",
    tags: ["月考讲评"],
  },
  {
    id: "task-005",
    studentName: "陈同学",
    studentGrade: "高三",
    subject: "数学",
    title: "集合与复数错题讲解",
    description: "讲解内容已交付，可以查看按题回放。",
    questionCount: 2,
    serviceType: "录制讲解",
    expectedAt: "已交付",
    budget: 59,
    status: "delivered",
    publishedAt: "2026-08-08",
    applicants: 3,
    teacherName: "王老师",
    tags: ["集合", "复数"],
  },
];

export const demoProducts: LearningProduct[] = [
  {
    id: "product-001",
    teacherName: "王老师",
    title: "高三数学第一次月考逐题精讲",
    subtitle: "从错因分析到规范解答，覆盖 22 道典型题",
    subject: "数学",
    grade: "高三",
    productType: "整卷讲解",
    paperId: "paper-001",
    questionIds: ["q-001", "q-002", "q-003", "q-004", "q-005"],
    recordingAssetIds: ["asset-001", "asset-002", "asset-003"],
    previewMode: "first",
    freeQuestionCount: 3,
    previewQuestionIds: [],
    price: 49,
    originalPrice: 69,
    status: "published",
    coverStyle: "indigo",
    lessonCount: 22,
    duration: "2 小时 36 分",
    sales: 286,
    rating: 4.9,
    publishedAt: "2026-08-08",
    description: "完整讲解月考试卷中的知识点、常见错误和规范答题方法。",
    highlights: ["按题自由跳转", "白板笔迹时序回放", "永久有效"],
  },
  {
    id: "product-002",
    teacherName: "王老师",
    title: "函数与导数压轴题方法课",
    subtitle: "精选 12 道高频压轴题，拆解五类核心模型",
    subject: "数学",
    grade: "高三",
    productType: "专题合集",
    questionIds: ["q-004", "q-005"],
    recordingAssetIds: ["asset-003"],
    previewMode: "selected",
    freeQuestionCount: 0,
    previewQuestionIds: ["q-001", "q-003"],
    price: 79,
    originalPrice: 99,
    status: "published",
    coverStyle: "teal",
    lessonCount: 12,
    duration: "3 小时 10 分",
    sales: 168,
    rating: 4.8,
    publishedAt: "2026-08-06",
    description: "围绕函数与导数压轴题建立稳定的分析框架。",
    highlights: ["专题方法总结", "关键步骤可重复回放", "配套练习"],
  },
  {
    id: "product-003",
    teacherName: "王老师",
    title: "复数运算单题精讲",
    subtitle: "一道题掌握复数除法与模长计算",
    subject: "数学",
    grade: "高三",
    productType: "单题精讲",
    questionIds: ["q-002"],
    recordingAssetIds: ["asset-001"],
    previewMode: "first",
    freeQuestionCount: 0,
    previewQuestionIds: [],
    price: 6.9,
    status: "draft",
    coverStyle: "orange",
    lessonCount: 1,
    duration: "8 分钟",
    sales: 0,
    rating: 0,
    description: "适合需要快速补齐复数基础的学生。",
    highlights: ["单题购买", "8 分钟讲透", "白板推导"],
  },
];
