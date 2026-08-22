import { Bell, BookOpenCheck, LogOut, Radio, School, History, LayoutDashboard } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStudentApi } from '../api'

const nav = [
  { to: '/', label: '学习首页', icon: LayoutDashboard },
  { to: '/tasks', label: '我的任务', icon: BookOpenCheck },
  { to: '/live', label: '同步课堂', icon: Radio },
  { to: '/classes', label: '我的班级', icon: School },
  { to: '/records', label: '学习记录', icon: History },
]

export default function Layout() {
  const { user, logout, newRoom, dismissNewRoom } = useStudentApi()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#f5f8fc]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="flex h-16 w-full items-center gap-8 px-6 2xl:px-8">
          <div className="flex items-center gap-2.5 font-semibold text-slate-900">
            <img className="h-10 w-10 rounded-xl object-cover" src="/brand/bijian-logo.png" alt="笔尖云堂 Logo" />
            <span className="text-[17px]">笔尖云堂</span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">学生端</span>
          </div>

          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <button className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-50">
              <Bell size={20} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-orange-500" />
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">{user?.displayName.slice(0,1)}</div>
              <div className="hidden xl:block">
                <div className="text-sm font-medium text-slate-800">{user?.displayName}</div>
                <div className="text-xs text-slate-400">学生账号</div>
              </div>
            </div>
            <button onClick={logout} className="rounded-xl p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700" title="退出登录">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>
      {newRoom?<div className="fixed right-6 top-20 z-50 w-[360px] rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl shadow-blue-200/40"><div className="flex items-start gap-3"><span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><Radio size={19}/></span><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-900">老师发起了同步课堂</div><div className="mt-1 truncate text-sm text-slate-500">{newRoom.name}</div><div className="mt-1 text-xs text-slate-400">{newRoom.teacher} · {newRoom.clazz}</div><div className="mt-3 flex gap-2"><button onClick={()=>{dismissNewRoom();navigate(`/live/room/${newRoom.id}`)}} className="btn-primary !px-3 !py-2">立即进入</button><button onClick={dismissNewRoom} className="btn-secondary !px-3 !py-2">稍后</button></div></div></div></div>:null}
      <main className="w-full px-6 py-6 2xl:px-8">
        <Outlet />
      </main>
    </div>
  )
}
