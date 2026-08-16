import { ArrowRight, BookOpenCheck, CheckCircle2, Clock3, Radio, School, Sparkles } from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { trendData } from '../mock'
import { useStudentApi } from '../api'
import StatusBadge from '../components/StatusBadge'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, classes, tasks, rooms } = useStudentApi()
  const stats = [
    { label: '已加入班级', value: classes.length, unit: '个', icon: School, note: '当前加入的学习班级' },
    { label: '学习任务', value: tasks.length, unit: '项', icon: Clock3, note: '老师下发的内容' },
    { label: '已完成任务', value: tasks.filter(item=>['已提交','已批改'].includes(item.status)).length, unit: '项', icon: CheckCircle2, note: '已提交给老师' },
    { label: '同步课堂', value: rooms.length, unit: '场', icon: Radio, note: rooms.length?'课堂正在进行':'暂无开放课堂' },
  ]

  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div className="grid gap-6 px-7 py-6 lg:grid-cols-[1.5fr_.8fr]">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-700">
              <Sparkles size={16} /> 8 月 14 日 · 星期五
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">你好，{user?.displayName}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">当前有 {tasks.length} 项学习任务，及时完成老师下发的内容。</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="btn-primary" onClick={() => navigate('/workbench')}>继续学习 <ArrowRight size={16} /></button>
              {rooms.length?<button className="btn-secondary" onClick={() => navigate(`/live/room/${rooms[0].id}`)}><Radio size={16} /> 进入同步课堂</button>:null}
            </div>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-blue-900">正在进行</div>
              <span className="flex items-center gap-1.5 text-xs text-blue-700"><span className="h-2 w-2 rounded-full bg-blue-500" /> 已开课 18 分钟</span>
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-900">{rooms[0]?.name||'暂无同步课堂'}</div>
            <div className="mt-1 text-sm text-slate-500">{rooms[0]?`${rooms[0].teacher} · ${rooms[0].clazz}`:'老师发起后会显示在这里'}</div>
            {rooms[0]?<button className="mt-5 w-full rounded-xl bg-white py-2.5 text-sm font-medium text-blue-700 shadow-sm ring-1 ring-blue-100 hover:bg-blue-50" onClick={() => navigate(`/live/room/${rooms[0].id}`)}>立即进入</button>:null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, unit, icon: Icon, note }) => (
          <div key={label} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-sm text-slate-500">{label}</div>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-3xl font-semibold text-slate-900">{value}</span>
                  <span className="pb-1 text-sm text-slate-400">{unit}</span>
                </div>
              </div>
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600"><Icon size={20} /></div>
            </div>
            <div className="mt-4 text-xs text-slate-400">{note}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">今日待办</h2>
              <p className="mt-1 text-xs text-slate-400">优先处理即将截止的任务</p>
            </div>
            <button className="text-sm font-medium text-blue-600" onClick={() => navigate('/tasks')}>查看全部</button>
          </div>
          <div className="space-y-2.5">
            {tasks.slice(0, 3).map((task) => (
              <div key={task.id} className="flex items-center gap-4 rounded-xl border border-slate-100 px-4 py-3.5 hover:border-blue-100 hover:bg-blue-50/30">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
                  <BookOpenCheck size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-slate-800">{task.title}</div>
                  <div className="mt-1 text-xs text-slate-400">{task.teacher} · {task.clazz} · 截止 {task.deadline}</div>
                </div>
                <StatusBadge status={task.status} />
                <button className="btn-secondary !px-3 !py-2" onClick={() => navigate('/workbench')}>去作答</button>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-slate-900">最近 7 天学习趋势</h2>
            <p className="mt-1 text-xs text-slate-400">完成任务数量</p>
          </div>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="tasks" fill="#3b82f6" radius={[6,6,0,0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">最近任务</h2>
            <button className="text-sm font-medium text-blue-600" onClick={() => navigate('/tasks')}>全部任务</button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {tasks.slice(0,4).map(t => (
              <button key={t.id} onClick={() => navigate('/workbench')} className="rounded-xl border border-slate-100 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/30">
                <div className="flex items-center justify-between gap-2">
                  <span className={`chip ${t.type === '试卷' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>{t.type}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="mt-3 line-clamp-1 text-sm font-medium text-slate-800">{t.title}</div>
                <div className="mt-2 text-xs text-slate-400">{t.teacher} · {t.clazz}</div>
                <div className="mt-3 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${t.progress}%` }}/></div>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">同步课堂</h2>
            <button className="text-sm font-medium text-blue-600" onClick={() => navigate('/live')}>查看全部</button>
          </div>
          <div className="space-y-3">
            {rooms.slice(0,2).map(room => (
              <div key={room.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <StatusBadge status={room.status} />
                  <span className="text-xs text-slate-400">{room.online ? `${room.online} 人在线` : room.time}</span>
                </div>
                <div className="mt-3 text-sm font-medium text-slate-800">{room.name}</div>
                <div className="mt-1 text-xs text-slate-400">{room.teacher} · {room.clazz}</div>
                <button disabled={room.status !== '进行中'} onClick={() => navigate(`/live/room/${room.id}`)} className="mt-4 w-full rounded-xl border border-blue-100 py-2 text-sm font-medium text-blue-700 enabled:hover:bg-blue-50 disabled:border-slate-100 disabled:text-slate-300">
                  {room.status === '进行中' ? '进入房间' : '等待开课'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
