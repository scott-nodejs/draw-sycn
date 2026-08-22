import { useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, BookOpen, Check, ChevronRight, Clock3, History, LockKeyhole, LogIn, Play, ShoppingBag, Sparkles, Star, UserRound, WandSparkles } from 'lucide-react'
import { Tldraw, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import { TeacherAgentPanel } from './agent/TeacherAgentPanel'

type View = 'home' | 'products' | 'course' | 'records' | 'login' | 'solve'
type Product = { id: number; subject: string; grade: string; title: string; teacher: string; credential: string; lessons: number; price: number; rating: string; color: string }

const products: Product[] = [
  { id: 1, subject: '几何专题', grade: '初二', title: '全等三角形高频模型精讲', teacher: '周老师', credential: '重点中学 · 12年教龄', lessons: 28, price: 39, rating: '4.9', color: 'linear-gradient(135deg,#176bf0,#35b9f6)' },
  { id: 2, subject: '函数突破', grade: '初三', title: '二次函数压轴题拆解', teacher: '陈老师', credential: '中考数学教研员', lessons: 36, price: 59, rating: '5.0', color: 'linear-gradient(135deg,#6758e8,#32a4ff)' },
  { id: 3, subject: '高中数学', grade: '高一', title: '函数与导数思维训练', teacher: '林老师', credential: '省级骨干教师', lessons: 42, price: 69, rating: '4.9', color: 'linear-gradient(135deg,#087fc1,#20c9c4)' },
]

const replayCanvasComponents = { Toolbar: null, StylePanel: null }

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? 'brand-compact' : ''}`}><span className="logo-shell"><img src="/bijian-logo-original.png" alt="笔尖云堂" /></span><div><strong>笔尖云堂</strong>{compact ? null : <small>BIJIAN YUNTANG</small>}</div></div>
}

function ProductCard({ item, onOpen }: { item: Product; onOpen: () => void }) {
  return <article className="product-card" onClick={onOpen}>
    <div className="product-cover" style={{ background: item.color }}><span>{item.grade}</span><BookOpen size={37}/><strong>{item.subject}</strong><small>真人老师精选题单</small></div>
    <div className="product-body"><div className="product-tags"><span>{item.subject}</span><span>{item.lessons} 道题</span></div><h3>{item.title}</h3><div className="teacher-row"><span className="teacher-avatar">{item.teacher[0]}</span><div><strong>{item.teacher}</strong><small>{item.credential}</small></div></div><footer><span><Star size={13} fill="currentColor"/>{item.rating}</span><strong>¥{item.price}</strong></footer></div>
  </article>
}

export function App() {
  const [view, setView] = useState<View>('home')
  const [pendingView, setPendingView] = useState<View>('home')
  const [input, setInput] = useState('')
  const [problem, setProblem] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product>(products[0])
  const [selectedQuestion, setSelectedQuestion] = useState(0)
  const [user, setUser] = useState(() => localStorage.getItem('teacher-agent-user') || '')
  const editorRef = useRef<Editor | null>(null)
  const roomId = useMemo(() => `agent-web-${crypto.randomUUID()}`, [])

  const requireLogin = (target: View) => { if (!user) { setPendingView(target); setView('login'); return false } setView(target); return true }
  const start = () => { const value = input.trim(); if (!value) return; setProblem(value); if (requireLogin('solve')) setView('solve') }
  const goHome = () => { window.speechSynthesis?.cancel(); setView('home'); setProblem('') }
  const login = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const name = String(form.get('phone') || '同学').slice(-4); localStorage.setItem('teacher-agent-user', name); setUser(name); setView(pendingView === 'login' ? 'home' : pendingView) }
  const logout = () => { localStorage.removeItem('teacher-agent-user'); setUser(''); setView('home') }
  const openProduct = (item: Product) => { setSelectedProduct(item); setSelectedQuestion(0); if (!user) { setPendingView('course'); setView('login'); return }; setView('course') }

  if (view === 'solve') return <div className="agent-app solver-page"><header className="app-header compact"><button className="brand-button" onClick={goHome}><Brand compact/></button><div className="solver-title"><small>AI TEACHING CANVAS</small><strong>{problem}</strong></div><button className="ghost-button" onClick={goHome}><ArrowLeft size={16}/>换一道题</button></header><main className="solver-workspace"><section className="solver-canvas"><Tldraw onMount={editor => { editorRef.current = editor; editor.deleteShapes([...editor.getCurrentPageShapeIds()]); editor.clearHistory() }}/></section><aside className="agent-sidebar"><TeacherAgentPanel problem={problem} roomId={roomId} editorRef={editorRef}/></aside></main></div>

  if (view === 'course') {
    const questions = ['等腰三角形中的角度计算','全等三角形判定与证明','角平分线模型综合题','中点辅助线构造','几何动点压轴题']
    return <div className="agent-app course-page"><main className="course-workspace"><aside className="question-sidebar"><div className="course-brand"><Brand compact/></div><div className="course-meta"><span>{selectedProduct.grade} · {selectedProduct.subject}</span><strong>{selectedProduct.title}</strong><small>{selectedProduct.lessons} 道题 · 已学习 3 道</small></div><div className="question-list">{questions.map((title,index) => <button className={selectedQuestion===index?'active':''} key={title} onClick={() => setSelectedQuestion(index)}><b>{String(index+1).padStart(2,'0')}</b><span><strong>{title}</strong><small>{index<2?'已学习':'未开始'}</small></span><ChevronRight size={15}/></button>)}</div></aside><section className="replay-stage"><div className="replay-canvas"><Tldraw key={selectedQuestion} components={replayCanvasComponents} onMount={editor => { editor.deleteShapes([...editor.getCurrentPageShapeIds()]); editor.clearHistory(); editor.updateInstanceState({ isReadonly: true }); editor.setCurrentTool('hand') }}/><button className="course-back" onClick={() => setView('products')}><ArrowLeft size={16}/>返回题库</button><div className="replay-watermark"><span>真人老师时序板书</span><strong>{questions[selectedQuestion]}</strong><small>选择播放后，将按老师原始书写顺序还原语音与板书</small></div></div><footer className="replay-controls"><button className="replay-primary"><Play size={17} fill="currentColor"/>播放讲解</button><div className="replay-progress"><i style={{width:selectedQuestion<2?'100%':'0%'}}/><span/></div><time>00:00 / 08:32</time><button className="replay-ai" onClick={() => { setInput(questions[selectedQuestion]); setProblem(questions[selectedQuestion]); setView('solve') }}><Sparkles size={15}/>交给 AI 重讲</button></footer></section></main></div>
  }

  return <div className="agent-app home-page"><div className="aurora aurora-one"/><div className="aurora aurora-two"/><div className="dot-grid"/>
    <header className="app-header site-header"><button className="brand-button" onClick={goHome}><Brand/></button><nav className="main-nav"><button className={view==='home'?'active':''} onClick={goHome}>首页</button><button className={view==='products'?'active':''} onClick={() => requireLogin('products')}>真人题库</button>{user && <button className={view==='records'?'active':''} onClick={() => setView('records')}>解题记录</button>}</nav><div className="account-area">{user ? <><button className="user-chip" onClick={() => setView('records')}><UserRound size={15}/>{user}</button><button className="text-button" onClick={logout}>退出</button></> : <button className="login-button" onClick={() => { setPendingView('home'); setView('login') }}><LogIn size={15}/>登录</button>}</div></header>

    {view === 'login' && <main className="login-page"><section className="login-card"><div className="login-brand"><img src="/bijian-logo-original.png"/><span><strong>欢迎来到笔尖云堂</strong><small>登录后继续你的学习旅程</small></span></div><form onSubmit={login}><label>手机号<input name="phone" inputMode="numeric" required placeholder="请输入手机号"/></label><label>密码<input name="password" type="password" required placeholder="请输入密码"/></label><button type="submit">登录并继续<ChevronRight size={17}/></button></form><p><LockKeyhole size={13}/>演示版本不会向服务器提交账号信息</p></section></main>}

    {view === 'products' && <main className="content-page"><div className="page-heading"><span>REAL TEACHER CONTENT</span><h1>真人老师精选题库</h1><p>每套题单都由一线教师上传、讲解与审核，AI 负责把老师的思路动态演示出来。</p></div><div className="filter-row"><button className="active">全部</button><button>初中数学</button><button>高中数学</button><button>几何</button><button>函数</button></div><section className="product-grid">{products.map(item => <ProductCard key={item.id} item={item} onOpen={() => openProduct(item)}/>)}</section></main>}

    {view === 'records' && <main className="content-page"><div className="page-heading"><span>LEARNING HISTORY</span><h1>我的解题记录</h1><p>继续上次的推导，或重新播放 AI 老师的完整板书。</p></div><section className="record-list">{[['在△ABC中，AB=AC，∠A=40°，求∠B','几何 · 等腰三角形','今天 16:42'],['已知抛物线 y=ax²-2a²x，求顶点坐标','函数 · 二次函数','昨天 20:18'],['解方程 x²-5x+6=0','代数 · 一元二次方程','8月19日']].map(([title,tag,time],index) => <article key={title}><span className="record-icon"><History size={19}/></span><div><strong>{title}</strong><small>{tag} · {time}</small></div><em>{index===0?'已完成':'学习中'}</em><button onClick={() => { setInput(title); setProblem(title); setView('solve') }}><Play size={14}/>继续</button></article>)}</section></main>}

    {view === 'home' && <><main className="hero"><section className="hero-copy"><div className="eyebrow"><Sparkles size={15}/>AI 解题，也像真人老师一样边讲边写</div><h1>不只给答案，<br/><em>把思路演给你看。</em></h1><p>AI 完整求解并校验，真人老师提供精选题目与教学方法。每一个公式、图形和关键条件，都有清楚的板书位置。</p><div className="solve-box"><WandSparkles className="input-icon" size={20}/><input autoFocus value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if(event.key==='Enter') start() }} placeholder="输入数学题目，例如：在△ABC中，AB=AC，∠A=40°，求∠B"/><button disabled={!input.trim()} onClick={start}>开始解题<ArrowLeft className="go-arrow" size={17}/></button></div><div className="feature-list"><span><Check size={14}/>完整求解校验</span><span><Check size={14}/>真人老师精选题</span><span><Check size={14}/>可编辑动态板书</span></div></section><section className="plan-preview"><div className="preview-glow"/><header><span><i/>AI 老师正在备课</span><small>完整规划 · 分步执行</small></header><div className="problem-line">已知 AB=AC，∠A=40°，求 ∠B</div>{[['01','建立准确的几何图'],['02','识别等腰三角形性质'],['03','利用三角形内角和'],['04','计算并验证结论']].map(([number,label],index) => <div className={`preview-step ${index===1?'active':''}`} key={number}><b>{number}</b><span>{label}</span>{index===1?<i/>:null}</div>)}<footer><button><span/>播放</button><div><i/></div><small>第 2 / 4 步</small></footer></section></main><section className="home-products"><div className="section-heading"><div><span>TEACHER PICKS</span><h2>一线老师上传的精品题单</h2></div><button onClick={() => requireLogin('products')}>查看全部<ChevronRight size={16}/></button></div><div className="product-grid">{products.map(item => <ProductCard key={item.id} item={item} onOpen={() => openProduct(item)}/>)}</div></section><section className="trust-strip"><div><strong>120+</strong><span>认证教师</span></div><div><strong>8,600+</strong><span>精品题目</span></div><div><strong>98%</strong><span>讲解满意度</span></div><div><ShoppingBag size={25}/><span>老师原创 · 平台审核</span></div></section></>}
  </div>
}
