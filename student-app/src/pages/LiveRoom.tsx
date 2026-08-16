import { ArrowLeft, CheckCircle2, Radio, RefreshCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Tldraw } from 'tldraw'
import { useSync } from '@tldraw/sync'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'tldraw/tldraw.css'
import 'katex/dist/katex.min.css'
import { fetchStudentAsset, useStudentApi, type StudentRoomQuestion } from '../api'
import { createViewerSyncUri, syncAssetStore } from '../sync'

export default function LiveRoom() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const { rooms } = useStudentApi()
  const room = rooms.find(item => item.id === id)
  const store = useSync({ uri: createViewerSyncUri(id), assets: syncAssetStore })
  const [figureSources,setFigureSources]=useState<string[]>([])

  useEffect(()=>{
    let disposed=false;const created:string[]=[]
    Promise.all((room?.currentQuestion?.figureUrls||[]).map(async path=>{const url=URL.createObjectURL(await fetchStudentAsset(path));created.push(url);return url}))
      .then(urls=>{if(!disposed)setFigureSources(urls)})
      .catch(()=>{if(!disposed)setFigureSources([])})
    return()=>{disposed=true;created.forEach(url=>URL.revokeObjectURL(url))}
  },[room?.currentQuestion?.id,room?.currentQuestion?.figureUrls?.join('|')])

  return <div className="-mx-6 -my-6 min-h-[calc(100vh-64px)] bg-[#f5f8fc] 2xl:-mx-8">
    <header className="flex h-16 items-center border-b border-slate-200 bg-white px-5">
      <button onClick={()=>navigate('/live')} className="mr-3 rounded-lg p-2 text-slate-500 hover:bg-slate-50"><ArrowLeft size={20}/></button>
      <div><div className="flex items-center gap-2 text-sm font-semibold text-slate-800">{room?.name||'同步课堂'}<span className="chip bg-blue-50 text-blue-700"><Radio size={12} className="mr-1"/>进行中</span></div><div className="mt-0.5 text-xs text-slate-400">{room?`${room.teacher} · ${room.clazz}`:'正在读取房间信息'} · 老师看板实时同步</div></div>
      <div className="ml-auto flex items-center gap-3"><span className="hidden items-center gap-1.5 text-xs text-emerald-600 md:flex"><CheckCircle2 size={14}/>已连接同步房间</span><button className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={()=>navigate('/live')}>离开房间</button></div>
    </header>
    <main className="grid min-h-[calc(100vh-128px)] xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-h-[720px] p-5"><div className="flex h-full min-h-[700px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-100 px-5"><strong className="text-sm text-slate-700">老师电子白板</strong><span className="flex items-center gap-1.5 text-xs text-slate-400"><RefreshCcw size={14}/>实时同步</span></div>{room?.currentQuestion?<SyncedQuestionPresentation question={room.currentQuestion} figureSources={figureSources}/>:<div className="shrink-0 border-b border-slate-100 bg-slate-50 px-6 py-4 text-sm text-slate-500">等待老师选择当前题目…</div>}<div className="relative min-h-[560px] flex-1"><Tldraw store={store} components={{Toolbar:null,StylePanel:null,MainMenu:null,PageMenu:null,ActionsMenu:null,ContextMenu:null,NavigationPanel:null,HelperButtons:null,DebugPanel:null,Minimap:null,QuickActions:null,SharePanel:null,ZoomMenu:null}} onMount={editor=>{editor.updateInstanceState({isReadonly:true})}}/></div></div></section>
      <aside className="border-l border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-800">课堂信息</h2><div className="mt-4 rounded-xl bg-blue-50 p-4"><div className="text-xs font-medium text-blue-700">当前同步房间</div><div className="mt-2 text-sm font-semibold text-slate-800">{room?.name||'正在加载'}</div><div className="mt-1 text-xs text-slate-500">{room?`${room.teacher} · ${room.clazz}`:'—'}</div></div><div className="mt-5 rounded-xl border border-dashed border-slate-200 p-4 text-center"><div className="text-sm font-medium text-slate-600">当前为观看模式</div><div className="mt-1 text-xs leading-5 text-slate-400">老师切换题目、书写和翻页后会自动同步到这里。</div></div></aside>
    </main>
  </div>
}

function MarkdownMath({children}:{children:string}){
  return <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{children}</ReactMarkdown>
}

function SyncedQuestionPresentation({question,figureSources}:{question:StudentRoomQuestion;figureSources:string[]}){
  const layout=question.presentationLayout
  if(!layout)return <div className="shrink-0 border-b border-blue-100 bg-blue-50/70 px-6 py-4"><div className="text-xs font-semibold text-blue-600">第 {question.number} 题 · {question.type}</div><div className="mt-2 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_auto]"><div><div className="question-markdown text-base font-semibold leading-7 text-slate-800"><MarkdownMath>{question.stem}</MarkdownMath></div>{question.options.length?<div className="question-options mt-2 flex flex-wrap gap-x-8 gap-y-1 text-sm text-slate-600">{question.options.map((option,index)=><div key={`${index}-${option}`}>{String.fromCharCode(65+index)}. <MarkdownMath>{option}</MarkdownMath></div>)}</div>:null}</div>{figureSources.length?<div className="flex max-w-[420px] flex-wrap justify-end gap-3">{figureSources.map((src,index)=><img key={src} src={src} alt={`题目配图 ${index+1}`} className="max-h-48 max-w-full object-contain"/>)}</div>:null}</div></div>
  const coordinateHeight=Math.max(110,Math.min(620,layout.height>100?layout.height:220))
  return <div className="shrink-0 border-b border-blue-100 bg-blue-50/70 px-6 py-3"><div className="text-xs font-semibold text-blue-600">第 {question.number} 题 · {question.type}</div><div className="student-presentation-canvas mt-2" style={{height:coordinateHeight}}>{layout.blocks.map(block=><div key={block.id} className={`student-presentation-block ${block.kind}`} style={{left:`${block.x}%`,top:`${block.y}%`,width:`${block.width}%`}}>{block.kind==='stem'?<strong><MarkdownMath>{question.stem}</MarkdownMath></strong>:block.kind==='options'?<div className="student-presentation-options">{question.options.map((option,index)=><span key={`${index}-${option}`}>{String.fromCharCode(65+index)}. <MarkdownMath>{option}</MarkdownMath></span>)}</div>:figureSources[block.figureIndex??-1]?<img src={figureSources[block.figureIndex??-1]} alt={`题目图片 ${(block.figureIndex??0)+1}`}/>:null}</div>)}</div></div>
}
