import { Clock3, PlayCircle, Radio, Search, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useStudentApi } from '../api'
import StatusBadge from '../components/StatusBadge'

export default function Live() {
  const navigate = useNavigate()
  const { rooms, classes } = useStudentApi()
  const [status,setStatus]=useState('全部')
  const [className,setClassName]=useState('全部班级')
  const [teacher,setTeacher]=useState('全部老师')
  const [keyword,setKeyword]=useState('')
  const filtered=useMemo(()=>rooms.filter(room=>(status==='全部'||room.status===status)&&(className==='全部班级'||room.clazz===className)&&(teacher==='全部老师'||room.teacher===teacher)&&(!keyword.trim()||`${room.name} ${room.teacher} ${room.clazz}`.toLowerCase().includes(keyword.trim().toLowerCase()))),[rooms,status,className,teacher,keyword])
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">同步课堂</h1>
        <p className="mt-1 text-sm text-slate-500">实时观看老师电子白板，不包含摄像头或视频直播</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="card h-fit p-4">
          <div className="text-sm font-semibold text-slate-700">筛选课堂</div>
          <div className="mt-4 space-y-5">
            <div>
              <div className="mb-2 text-xs font-medium text-slate-400">按班级</div>
              {['全部班级',...classes.map(item=>item.name)].map(x=><button key={x} onClick={()=>setClassName(x)} className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm ${className===x?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50'}`}>{x}</button>)}
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-slate-400">按老师</div>
              {['全部老师',...new Set(rooms.map(item=>item.teacher))].map(x=><button key={x} onClick={()=>setTeacher(x)} className={`mb-1 w-full rounded-xl px-3 py-2 text-left text-sm ${teacher===x?'bg-blue-50 text-blue-700':'text-slate-600 hover:bg-slate-50'}`}>{x}</button>)}
            </div>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-1.5">
              {['全部','进行中','未开始','已结束'].map(x=><button key={x} onClick={()=>setStatus(x)} className={`rounded-xl px-4 py-2 text-sm font-medium ${status===x?'bg-blue-600 text-white':'text-slate-600 hover:bg-slate-50'}`}>{x}</button>)}
            </div>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={keyword} onChange={event=>setKeyword(event.target.value)} className="h-10 rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-300" placeholder="搜索房间"/>
            </div>
          </div>

          {filtered.map(room => (
            <div key={room.id} className="card p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={room.status}/>
                    <span className="text-lg font-semibold text-slate-900">{room.name}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                    <span>{room.teacher}</span>
                    <span>{room.clazz}</span>
                    <span className="flex items-center gap-1.5"><Clock3 size={15}/>{room.time}</span>
                    <span className="flex items-center gap-1.5"><Users size={15}/>{room.status==='进行中'?`${room.online} 人在线`:'—'}</span>
                  </div>
                </div>
                <div>
                  {room.status==='进行中' && <button onClick={()=>navigate(`/live/room/${room.id}`)} className="btn-primary"><Radio size={16}/>进入房间</button>}
                  {room.status==='未开始' && <button className="btn-secondary" disabled>等待开始</button>}
                  {room.status==='已结束' && <button onClick={()=>navigate('/records')} className="btn-secondary"><PlayCircle size={16}/>查看课堂记录</button>}
                </div>
              </div>
            </div>
          ))}
          {!filtered.length?<div className="card p-10 text-center text-sm text-slate-400">没有符合当前筛选条件的同步课堂</div>:null}
        </section>
      </div>
    </div>
  )
}
