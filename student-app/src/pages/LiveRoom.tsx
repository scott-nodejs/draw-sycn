import { ArrowLeft, CheckCircle2, Hand, Mic, MicOff, Radio, RefreshCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Tldraw } from 'tldraw'
import { useSync } from '@tldraw/sync'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'tldraw/tldraw.css'
import 'katex/dist/katex.min.css'
import { fetchStudentAsset, heartbeatClassroomRoom, joinClassroomRoom, leaveClassroomRoom, studentClassroomApi, useStudentApi, type StudentRoomQuestion } from '../api'
import { createViewerSyncUri, syncAssetStore } from '../sync'
import {RtcRoomManager} from '../services/rtc/RtcRoomManager'
import type{RtcConnectionState}from'../services/rtc/RtcProvider'
import type{Editor}from'tldraw'
import{connectClassroomSocket}from'../classroomSocket'

export default function LiveRoom() {
  const navigate = useNavigate()
  const { id = '' } = useParams()
  const { rooms,user,refresh } = useStudentApi()
  const room = rooms.find(item => item.id === id)
  const [figureSources,setFigureSources]=useState<string[]>([])
  const rtcRef=useRef<RtcRoomManager|null>(null);const editorRef=useRef<Editor|null>(null);const cursorRef=useRef(0)
  const [rtcState,setRtcState]=useState<RtcConnectionState>('DISCONNECTED');const [raised,setRaised]=useState(false);const [invited,setInvited]=useState(false);const [connected,setConnected]=useState(false);const [muted,setMuted]=useState(false);const [canWrite,setCanWrite]=useState(false);const [error,setError]=useState('')

  useEffect(()=>{
    if(!id||!room)return
    let disposed=false
    void joinClassroomRoom(id).catch(()=>undefined)
    const timer=window.setInterval(()=>{if(!disposed)void heartbeatClassroomRoom(id).catch(()=>undefined)},15000)
    return()=>{
      disposed=true
      window.clearInterval(timer)
      void leaveClassroomRoom(id).catch(()=>undefined)
    }
  },[id,room?.status])

  useEffect(()=>{
    if(!id||!room)return
    let disposed=false;const rtc=new RtcRoomManager();rtcRef.current=rtc;rtc.onStateChange(setRtcState)
    void studentClassroomApi.rtcToken(id).then(token=>rtc.connect(token)).catch(cause=>{if(!disposed)setError(cause instanceof Error?cause.message:'课堂音频连接失败')})
    const poll=async()=>{try{const events=await studentClassroomApi.events(id,cursorRef.current);for(const event of events){cursorRef.current=Math.max(cursorRef.current,event.id);if(event.targetUserId&&event.targetUserId!==user?.id)continue;if(event.event==='QUESTION_CHANGED')void refresh().catch(()=>undefined);if(event.event==='RTC_INVITE')setInvited(true);if(event.event==='RTC_KICK'||event.event==='ROOM_ENDED'){await rtc.stopMicrophone().catch(()=>undefined);setConnected(false);setInvited(false)}if(event.event==='CANVAS_PERMISSION_GRANTED')setCanWrite(true);if(event.event==='CANVAS_PERMISSION_REVOKED')setCanWrite(false)}}catch{/* transient failure; the next poll retries */}}
    void poll();const timer=window.setInterval(()=>void poll(),1000)
    return()=>{disposed=true;window.clearInterval(timer);void rtc.disconnect().catch(()=>undefined);void studentClassroomApi.rtcLeave(id).catch(()=>undefined);rtcRef.current=null}
  },[id,room?.id,user?.id,refresh])

  useEffect(()=>{editorRef.current?.updateInstanceState({isReadonly:!canWrite})},[canWrite])
  useEffect(()=>{if(!id)return;return connectClassroomSocket(id,event=>{if(event.targetUserId&&event.targetUserId!==user?.id)return;if(event.event==='QUESTION_CHANGED')void refresh().catch(()=>undefined);if(event.event==='RTC_INVITE')setInvited(true);if(event.event==='RTC_KICK'||event.event==='ROOM_ENDED'){void rtcRef.current?.stopMicrophone().catch(()=>undefined);setConnected(false);setInvited(false)}if(event.event==='RTC_MUTED'){void rtcRef.current?.mute().catch(()=>undefined);setMuted(true)}if(event.event==='RTC_UNMUTED'){void rtcRef.current?.unmute().catch(()=>undefined);setMuted(false)}if(event.event==='CANVAS_PERMISSION_GRANTED')setCanWrite(true);if(event.event==='CANVAS_PERMISSION_REVOKED')setCanWrite(false)})},[id,user?.id,refresh])
  const toggleHand=async()=>{setError('');try{if(raised){await studentClassroomApi.cancelHand(id);setRaised(false)}else{await studentClassroomApi.raiseHand(id);setRaised(true)}}catch(cause){setError(cause instanceof Error?cause.message:'举手操作失败')}}
  const acceptInvite=async()=>{setError('');try{await studentClassroomApi.acceptInvite(id);await rtcRef.current?.startMicrophone();await studentClassroomApi.connected(id);setInvited(false);setRaised(false);setConnected(true)}catch(cause){setError(cause instanceof Error?cause.message:'无法开启麦克风')}}
  const endQuestion=async()=>{await rtcRef.current?.stopMicrophone();await studentClassroomApi.rtcLeave(id);setConnected(false);setMuted(false)}

  useEffect(()=>{
    let disposed=false;const created:string[]=[]
    Promise.all((room?.currentQuestion?.figureUrls||[]).map(async path=>{const url=URL.createObjectURL(await fetchStudentAsset(path));created.push(url);return url}))
      .then(urls=>{if(!disposed)setFigureSources(urls)})
      .catch(()=>{if(!disposed)setFigureSources([])})
    return()=>{disposed=true;created.forEach(url=>URL.revokeObjectURL(url))}
  },[room?.currentQuestion?.id,room?.currentQuestion?.figureUrls?.join('|')])

  return <div className="h-screen overflow-hidden bg-[#f5f8fc]">
    <header className="flex h-16 items-center border-b border-slate-200 bg-white px-5">
      <button onClick={()=>navigate('/live')} className="mr-3 rounded-lg p-2 text-slate-500 hover:bg-slate-50"><ArrowLeft size={20}/></button>
      <div><div className="flex items-center gap-2 text-sm font-semibold text-slate-800">{room?.name||'同步课堂'}<span className="chip bg-blue-50 text-blue-700"><Radio size={12} className="mr-1"/>进行中</span></div><div className="mt-0.5 text-xs text-slate-400">{room?`${room.teacher} · ${room.clazz}`:'正在读取房间信息'} · 老师看板实时同步</div></div>
      <div className="ml-auto flex items-center gap-3"><span className="hidden items-center gap-1.5 text-xs text-emerald-600 md:flex"><CheckCircle2 size={14}/>{rtcState==='CONNECTED'?'音频已连接':'正在连接课堂'}</span><button className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={()=>navigate('/live')}>离开房间</button></div>
    </header>
    <main className="grid h-[calc(100vh-64px)] xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-h-0 p-4"><div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-100 px-5"><strong className="text-sm text-slate-700">老师电子白板</strong><span className="flex items-center gap-1.5 text-xs text-slate-400"><RefreshCcw size={14}/>实时同步</span></div>{room?.currentQuestion?<SyncedQuestionPresentation question={room.currentQuestion} figureSources={figureSources}/>:<div className="shrink-0 border-b border-slate-100 bg-slate-50 px-6 py-4 text-sm text-slate-500">等待老师选择当前题目…</div>}<div className="relative min-h-0 flex-1"><StudentSyncedCanvas key={String(canWrite)} roomId={id} canWrite={canWrite} onMount={editor=>{editorRef.current=editor}}/></div></div></section>
      <aside className="border-l border-slate-200 bg-white p-5"><h2 className="text-sm font-semibold text-slate-800">课堂互动</h2><div className="mt-4 rounded-xl bg-blue-50 p-4"><div className="text-xs font-medium text-blue-700">课堂音频</div><div className="mt-2 text-sm font-semibold text-slate-800">{rtcState==='CONNECTED'?`${room?.teacher||'老师'}正在讲解`:'正在连接音频'}</div><div className="mt-1 text-xs text-slate-500">{canWrite?'已获得白板书写权限':'白板只读'}</div></div>{invited?<div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4"><strong className="text-sm text-slate-800">老师邀请你语音提问</strong><p className="mt-1 text-xs text-slate-500">确认后才会请求麦克风权限。</p><div className="mt-3 flex gap-2"><button className="rounded-lg border px-3 py-2 text-xs" onClick={()=>void studentClassroomApi.rejectInvite(id).then(()=>setInvited(false))}>暂不连麦</button><button className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white" onClick={()=>void acceptInvite()}>开始提问</button></div></div>:connected?<div className="mt-4 rounded-xl border border-emerald-200 p-4"><strong className="flex items-center gap-2 text-sm"><Mic size={16}/>正在提问</strong><div className="mt-3 flex gap-2"><button className="rounded-lg border px-3 py-2 text-xs" onClick={async()=>{const next=!muted;if(next)await rtcRef.current?.mute();else await rtcRef.current?.unmute();await studentClassroomApi.mute(id,next);setMuted(next)}}>{muted?<Mic size={14}/>:<MicOff size={14}/>} {muted?'取消静音':'静音'}</button><button className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600" onClick={()=>void endQuestion()}>结束提问</button></div></div>:<button onClick={()=>void toggleHand()} className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${raised?'bg-orange-100 text-orange-700':'bg-blue-600 text-white'}`}><Hand size={17}/>{raised?'取消举手':'举手提问'}</button>}{error?<p className="mt-3 text-xs text-red-500">{error}</p>:null}</aside>
    </main>
  </div>
}

function StudentSyncedCanvas({roomId,canWrite,onMount}:{roomId:string;canWrite:boolean;onMount:(editor:Editor)=>void}){
  const store=useSync({uri:createViewerSyncUri(roomId),assets:syncAssetStore})
  return <Tldraw store={store} components={{Toolbar:canWrite?undefined:null,StylePanel:null,MainMenu:null,PageMenu:null,ActionsMenu:null,ContextMenu:null,NavigationPanel:null,HelperButtons:null,DebugPanel:null,Minimap:null,QuickActions:null,SharePanel:null,ZoomMenu:null}} onMount={editor=>{onMount(editor);editor.updateInstanceState({isReadonly:!canWrite})}}/>
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
