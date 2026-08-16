import { CheckCircle2 } from 'lucide-react'
export default function Records(){
  return <div className="space-y-5">
    <div><h1 className="text-2xl font-semibold text-slate-900">学习记录</h1><p className="mt-1 text-sm text-slate-500">查看已完成任务、批改结果与老师评语</p></div>
    <div className="card p-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2/></div>
      <div className="mt-4 font-medium text-slate-700">学习记录页已预留</div>
      <div className="mt-1 text-sm text-slate-400">当前首版重点为首页、任务、解题工作台、同步课堂与班级页面。</div>
    </div>
  </div>
}
