import { CalendarClock, ChevronDown, FileText, ListFilter, Search, Shapes } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudentApi } from '../api'
import StatusBadge from '../components/StatusBadge'

export default function Tasks() {
  const { tasks } = useStudentApi()
  const [tab, setTab] = useState('全部')
  const navigate = useNavigate()
  const tabs = ['全部','待完成','已提交','已批改']
  const filtered = useMemo(() => {
    if (tab === '全部') return tasks
    if (tab === '待完成') return tasks.filter(t => ['未开始','进行中','已逾期'].includes(t.status))
    return tasks.filter(t => t.status === tab)
  }, [tab])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">我的任务</h1>
        <p className="mt-1 text-sm text-slate-500">集中查看老师下发的单题和整份试卷</p>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-4 py-2 text-sm font-medium ${tab===t ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{t}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {['全部老师','全部班级','全部类型','截止时间'].map((label, i) => (
              <button key={label} className="btn-secondary !py-2"><span>{label}</span>{i===3 ? <CalendarClock size={15}/> : <ChevronDown size={15}/>}</button>
            ))}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input className="h-10 rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-300" placeholder="搜索任务"/>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <div className="text-sm font-medium text-slate-700">共 {filtered.length} 个任务</div>
          <button className="flex items-center gap-2 text-sm text-slate-500"><ListFilter size={16}/> 默认排序</button>
        </div>
        <div className="divide-y divide-slate-100">
          {filtered.map(t => (
            <div key={t.id} className="grid gap-4 px-5 py-4 hover:bg-slate-50/60 lg:grid-cols-[auto_1.4fr_1fr_1fr_auto] lg:items-center">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${t.type==='试卷'?'bg-blue-50 text-blue-600':'bg-violet-50 text-violet-600'}`}>
                {t.type==='试卷'?<FileText size={20}/>:<Shapes size={20}/>}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`chip ${t.type==='试卷'?'bg-blue-50 text-blue-700':'bg-violet-50 text-violet-700'}`}>{t.type}</span>
                  <span className="font-medium text-slate-800">{t.title}</span>
                </div>
                <div className="mt-1.5 text-xs text-slate-400">{t.teacher} · {t.clazz} · {t.questions} 题</div>
              </div>
              <div className="text-sm text-slate-500">
                <div>发布：{t.publish}</div>
                <div className="mt-1">截止：{t.deadline}</div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between text-xs"><span className="text-slate-400">完成进度</span><span className="font-medium text-slate-600">{t.progress}%</span></div>
                <div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{width:`${t.progress}%`}}/></div>
              </div>
              <div className="flex items-center gap-3 lg:justify-end">
                <StatusBadge status={t.status}/>
              <button onClick={() => navigate(`/workbench?assignment=${encodeURIComponent(t.id)}`)} className="btn-secondary !py-2">{t.status==='未开始'?'开始作答':'查看任务'}</button>
              </div>
            </div>
          ))}
          {filtered.length===0 && (
            <div className="py-20 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-300"><FileText/></div>
              <div className="mt-4 font-medium text-slate-600">这里暂时没有任务</div>
              <div className="mt-1 text-sm text-slate-400">切换其他筛选条件试试看</div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          {[1,2,3].map(n=><button key={n} className={`h-9 w-9 rounded-lg text-sm ${n===1?'bg-blue-600 text-white':'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{n}</button>)}
        </div>
      </div>
    </div>
  )
}
