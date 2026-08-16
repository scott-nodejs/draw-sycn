import { ArrowRight, BookOpenCheck, Copy, KeyRound, School, Users } from 'lucide-react'
import { useState } from 'react'
import { useStudentApi } from '../api'

export default function Classes() {
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [feedback, setFeedback] = useState<{type:'success'|'error';text:string}|null>(null)
  const { classes, joinClass } = useStudentApi()
  const submitInvite = async () => {
    if (code.length !== 8 || joining) return
    setJoining(true)
    setFeedback(null)
    try {
      await joinClass(code)
      setCode('')
      setFeedback({type:'success',text:'加入班级成功'})
    } catch (cause) {
      setFeedback({type:'error',text:cause instanceof Error ? cause.message : '加入班级失败，请检查邀请码'})
    } finally {
      setJoining(false)
    }
  }
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">我的班级</h1>
        <p className="mt-1 text-sm text-slate-500">通过老师提供的邀请码加入班级，并查看班级任务与同步课堂</p>
      </div>

      <section className="card p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-800"><KeyRound size={18} className="text-blue-600"/> 加入新班级</div>
            <p className="mt-1 text-sm text-slate-400">请输入老师提供的 8 位邀请码</p>
          </div>
          <div className="flex w-full max-w-xl flex-col gap-2">
            <div className="flex gap-2">
            <input
              value={code}
              onChange={e=>{setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8));setFeedback(null)}}
              onKeyDown={e=>{if(e.key==='Enter')void submitInvite()}}
              maxLength={8}
              autoComplete="off"
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-4 text-center text-lg font-semibold tracking-[.35em] outline-none placeholder:tracking-normal focus:border-blue-300"
              placeholder="输入 8 位邀请码"
            />
            <button disabled={code.length!==8||joining} onClick={()=>void submitInvite()} className="btn-primary min-w-[112px]">{joining?'加入中...':'加入班级'}</button>
            </div>
            {feedback?<p className={`m-0 text-xs ${feedback.type==='success'?'text-emerald-600':'text-red-500'}`}>{feedback.text}</p>:null}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">已加入班级</h2>
            <div className="mt-1 text-xs text-slate-400">共 {classes.length} 个班级</div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {classes.map((c,i)=>(
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${i===0?'bg-blue-50 text-blue-600':i===1?'bg-cyan-50 text-cyan-600':'bg-violet-50 text-violet-600'}`}><School size={21}/></div>
                <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><ArrowRight size={18}/></button>
              </div>
              <div className="mt-4 text-lg font-semibold text-slate-900">{c.name}</div>
              <div className="mt-1 text-sm text-slate-500">{c.subject} · {c.grade}</div>
              <div className="mt-4 flex gap-4 text-xs text-slate-400">
                <span>{c.teacher}</span>
                <span className="flex items-center gap-1"><Users size={14}/>{c.students} 名学生</span>
              </div>
              <div className="mt-5 rounded-xl bg-slate-50 p-3.5">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400"><BookOpenCheck size={14}/> 最近任务</div>
                <div className="mt-2 truncate text-sm font-medium text-slate-700">{c.recent}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-slate-800">邀请码使用说明</div>
            <div className="mt-1 text-sm text-slate-400">邀请码仅用于加入班级，不用于登录账号。</div>
          </div>
          <button className="btn-secondary"><Copy size={16}/>示例：A1B2C3D4</button>
        </div>
      </section>
    </div>
  )
}
