import { useEffect, useRef, useState, type RefObject } from 'react'
import { Bot, Check, Circle, LoaderCircle, Pause, Play, RotateCcw, Sparkles, Square, StepForward } from 'lucide-react'
import type { Editor } from 'tldraw'
import { clearAgentElements, executeCanvasAction } from './canvasActionExecutor'
import { renderTeachingScene } from './tldrawSceneRenderer'
import { connectTeacherAgent, teacherAgentApi, type PlanBundle, type TeachingEvent, type TeachingSession } from '../services/teacherAgentApi'

export function TeacherAgentPanel({ problem, roomId, editorRef }: { problem: string; roomId: string; editorRef: RefObject<Editor|null> }) {
  const [plan,setPlan]=useState<PlanBundle|null>(null);const [session,setSession]=useState<TeachingSession|null>(null)
  const [busy,setBusy]=useState(false);const [error,setError]=useState<string|null>(null);const [activeStep,setActiveStep]=useState(0)
  const actionCount=useRef(new Map<number,number>());const socketClose=useRef<null|(()=>void)>(null);const lastSequence=useRef(0)
  useEffect(()=>()=>socketClose.current?.(),[])
  const onEvent=(event:TeachingEvent)=>{
    if(event.sequence&&event.sequence<=lastSequence.current)return;if(event.sequence)lastSequence.current=event.sequence
    const stepId=Number(event.payload?.stepId||0)
    if(event.type==='STEP_STARTED')setActiveStep(stepId)
    if(event.type==='STEP_COMPLETED'||event.type==='SESSION_STATUS')void teacherAgentApi.session(event.sessionId).then(setSession).catch(()=>undefined)
    if(event.type==='SPEECH'){const text=String(event.payload?.text||'');if(text&&'speechSynthesis'in window){window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='zh-CN';utterance.rate=.92;window.speechSynthesis.speak(utterance)}}
    if(event.type==='CANVAS_ACTION'&&editorRef.current){const action=event.payload?.action as Parameters<typeof executeCanvasAction>[1];const index=actionCount.current.get(stepId)||0;executeCanvasAction(editorRef.current,action,{sessionId:event.sessionId,stepId,actionIndex:index});actionCount.current.set(stepId,index+1)}
  }
  const prepare=async()=>{if(!problem.trim())return;if(!editorRef.current){setError('画布仍在初始化，请稍后再试');return}setBusy(true);setError(null);try{const nextPlan=await teacherAgentApi.createPlan(problem);const nextSession=await teacherAgentApi.createSession(nextPlan.id,roomId);renderTeachingScene(editorRef.current,nextSession.id,nextPlan.teachingPlan);setPlan(nextPlan);setSession(nextSession);setActiveStep(0);actionCount.current.clear();socketClose.current?.();const connection=connectTeacherAgent(nextSession.id,onEvent);socketClose.current=connection.close;await new Promise<void>((resolve,reject)=>{connection.socket.onopen=()=>resolve();connection.socket.onerror=()=>reject(new Error('无法连接 Teacher Agent WebSocket'))})}catch(cause){setError(cause instanceof Error?cause.message:'生成教学计划失败')}finally{setBusy(false)}}
  const command=async(cmd:'start'|'pause'|'resume'|'next'|'stop')=>{if(!session)return;setError(null);try{setSession(await teacherAgentApi.command(session.id,cmd))}catch(cause){setError(cause instanceof Error?cause.message:'会话控制失败')}}
  const reset=()=>{if(session){void teacherAgentApi.command(session.id,'stop').catch(()=>undefined);clearAgentElements(session.id)}socketClose.current?.();window.speechSynthesis?.cancel();setPlan(null);setSession(null);setActiveStep(0);setError(null)}
  return <section className="agent-panel">
    <div className="agent-panel-title"><span><Bot size={17}/>AI 老师</span>{session?<em className={`agent-state ${session.status.toLowerCase()}`}>{session.status}</em>:null}</div>
    {!plan?<><p className="control-note">AI 会先完整求解并校验，再逐步讲解和板书，计划不会直接展示给学生。</p><button className="button primary full" disabled={busy||!problem.trim()} onClick={()=>void prepare()}>{busy?<LoaderCircle className="spin" size={16}/>:<Sparkles size={16}/>}生成完整讲解</button></>:
    <><div className="agent-strategy"><small>教学策略</small><strong>{plan.teachingPlan.strategy}</strong></div><div className="agent-steps">{plan.teachingPlan.steps.map(step=>{const done=(session?.currentStepIndex||0)>=step.id;const active=activeStep===step.id&&session?.status!=='COMPLETED';return <button key={step.id} className={`${active?'active ':''}${done?'done':''}`} onClick={()=>setActiveStep(step.id)}><span>{done?<Check size={14}/>:active?<span className="agent-pulse"/>:<Circle size={11}/>}</span><div><strong>步骤 {step.id}</strong><small>{step.goal}</small></div></button>})}</div><div className="agent-controls">
      {session?.status==='READY'?<button className="button primary" onClick={()=>void command('start')}><Play size={15}/>开始</button>:null}
      {session?.status==='RUNNING'?<button className="button secondary" onClick={()=>void command('pause')}><Pause size={15}/>暂停</button>:null}
      {session?.status==='PAUSED'?<button className="button primary" onClick={()=>void command('resume')}><Play size={15}/>继续</button>:null}
      {session&&['READY','PAUSED'].includes(session.status)?<button className="button secondary" onClick={()=>void command('next')}><StepForward size={15}/>单步</button>:null}
      {session&&!['COMPLETED','STOPPED'].includes(session.status)?<button className="button secondary" onClick={()=>void command('stop')}><Square size={14}/>停止</button>:null}
      <button className="button secondary" onClick={reset}><RotateCcw size={14}/>重置</button>
    </div></>}
    {error?<p className="agent-error">{error}</p>:null}
  </section>
}
