import { ArrowLeft, Check, Circle, Eraser, Highlighter, Image as ImageIcon, MousePointer2, Palette, PenTool, Redo2, Save, Send, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Workbench() {
  const navigate = useNavigate()
  const [active, setActive] = useState(3)
  const [submitted, setSubmitted] = useState(false)
  const questions = [
    {n:1,s:'done'},{n:2,s:'done'},{n:3,s:'active'},{n:4,s:'todo'},{n:5,s:'todo'},{n:6,s:'todo'},
    {n:7,s:'todo'},{n:8,s:'todo'},{n:9,s:'todo'},{n:10,s:'todo'},{n:11,s:'todo'},{n:12,s:'todo'},
  ]

  return (
    <div className="-mx-6 -my-6 min-h-[calc(100vh-64px)] bg-white">
      <div className="flex h-16 items-center border-b border-slate-200 bg-white px-5">
        <button onClick={() => navigate('/tasks')} className="mr-3 rounded-lg p-2 text-slate-500 hover:bg-slate-50"><ArrowLeft size={20}/></button>
        <div>
          <div className="text-sm font-semibold text-slate-800">一次函数单元测评</div>
          <div className="text-xs text-slate-400">八年级 3 班 · 王老师</div>
        </div>
        <div className="ml-6 hidden items-center gap-2 text-xs text-emerald-600 md:flex"><Check size={14}/> 草稿已自动保存</div>
        <div className="ml-auto flex gap-2">
          <button className="btn-secondary !py-2"><Save size={16}/> 保存草稿</button>
          <button onClick={()=>setSubmitted(true)} className="btn-primary !py-2"><Send size={16}/> 提交试卷</button>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-128px)] grid-cols-1 xl:grid-cols-[220px_1fr_360px]">
        <aside className="hidden border-r border-slate-200 bg-slate-50/60 p-4 xl:block">
          <div className="text-sm font-semibold text-slate-700">题目导航</div>
          <div className="mt-1 text-xs text-slate-400">已完成 2 / 12</div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {questions.map(q => (
              <button key={q.n} onClick={()=>setActive(q.n)} className={`h-10 rounded-xl text-sm font-medium ${
                active===q.n ? 'bg-blue-600 text-white' : q.s==='done' ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-600 ring-1 ring-slate-200'
              }`}>{q.n}</button>
            ))}
          </div>
          <div className="mt-6 space-y-2 text-xs text-slate-500">
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400"/> 已完成</div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-blue-500"/> 当前题目</div>
            <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-200"/> 未完成</div>
          </div>
        </aside>

        <section className="relative flex min-h-[720px] flex-col bg-[#f7f9fc]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-2.5">
            <div className="text-sm text-slate-500">电子答题画布</div>
            <div className="flex items-center gap-1">
              <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-50"><ZoomOut size={17}/></button>
              <span className="w-12 text-center text-xs text-slate-400">100%</span>
              <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-50"><ZoomIn size={17}/></button>
            </div>
          </div>

          <div className="flex-1 p-5">
            <div className="mx-auto h-full max-w-[980px] rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-full min-h-[620px] overflow-hidden rounded-2xl bg-white">
                <div className="absolute inset-0 opacity-[0.45]" style={{backgroundImage:'linear-gradient(#e9eef5 1px, transparent 1px), linear-gradient(90deg, #e9eef5 1px, transparent 1px)',backgroundSize:'24px 24px'}} />
                <svg className="absolute left-[14%] top-[22%] h-[320px] w-[520px]" viewBox="0 0 520 320">
                  <line x1="60" y1="250" x2="460" y2="250" stroke="#64748b" strokeWidth="2"/>
                  <line x1="110" y1="285" x2="110" y2="40" stroke="#64748b" strokeWidth="2"/>
                  <line x1="70" y1="250" x2="410" y2="80" stroke="#2563eb" strokeWidth="3"/>
                  <line x1="110" y1="250" x2="360" y2="125" stroke="#0f766e" strokeWidth="3"/>
                  <text x="418" y="78" fontSize="15" fill="#2563eb">y = 2x + 1</text>
                  <text x="368" y="122" fontSize="15" fill="#0f766e">y = x + 1</text>
                  <text x="455" y="270" fontSize="14" fill="#64748b">x</text>
                  <text x="92" y="48" fontSize="14" fill="#64748b">y</text>
                </svg>
                <div className="absolute bottom-[18%] left-[18%] rotate-[-4deg] text-[26px] text-blue-600" style={{fontFamily:'KaiTi, serif'}}>两条直线斜率分别为 2 和 1</div>
                <div className="absolute bottom-[10%] left-[24%] rotate-[2deg] text-[24px] text-slate-700" style={{fontFamily:'KaiTi, serif'}}>∴ k₁ ＞ k₂，蓝线更陡</div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
            {[
              [MousePointer2,'选择'],[PenTool,'画笔'],[Highlighter,'荧光笔'],[Eraser,'橡皮'],[Palette,'颜色'],[Undo2,'撤销'],[Redo2,'重做']
            ].map(([Icon,label],i)=>{
              const I = Icon as any
              return <button key={label as string} className={`flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-medium ${i===1?'bg-blue-50 text-blue-700':'text-slate-500 hover:bg-slate-50'}`}><I size={17}/><span className="hidden 2xl:inline">{label as string}</span></button>
            })}
          </div>
        </section>

        <aside className="border-l border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="font-semibold text-slate-800">第 {active} 题</div>
            <span className="text-xs text-slate-400">6 分</span>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="text-sm leading-7 text-slate-700">
              已知一次函数 <span className="font-serif italic">y = 2x + 1</span> 与 <span className="font-serif italic">y = x + 1</span>，请在同一直角坐标系中画出两函数图像，并比较它们的变化快慢。
            </div>
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><ImageIcon size={15}/> 几何图示参考</div>
              <svg className="mt-3 h-[170px] w-full" viewBox="0 0 260 170">
                <line x1="25" y1="135" x2="235" y2="135" stroke="#94a3b8" strokeWidth="1.5"/>
                <line x1="65" y1="155" x2="65" y2="20" stroke="#94a3b8" strokeWidth="1.5"/>
                <line x1="35" y1="135" x2="205" y2="50" stroke="#2563eb" strokeWidth="2.5"/>
                <line x1="65" y1="135" x2="190" y2="73" stroke="#0f766e" strokeWidth="2.5"/>
              </svg>
            </div>
          </div>
          <div className="mt-5">
            <div className="text-sm font-medium text-slate-700">答题要求</div>
            <div className="mt-3 space-y-2.5 text-sm text-slate-500">
              <div className="flex gap-2"><Circle size={8} className="mt-1.5 fill-current"/> 在画布中完成作图</div>
              <div className="flex gap-2"><Circle size={8} className="mt-1.5 fill-current"/> 标注关键点或函数表达式</div>
              <div className="flex gap-2"><Circle size={8} className="mt-1.5 fill-current"/> 写出比较结论</div>
            </div>
          </div>
          <button className="mt-6 w-full btn-primary">提交本题</button>
        </aside>
      </div>

      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="text-lg font-semibold text-slate-900">确认提交整份试卷？</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">提交后老师将收到你的答案。当前仍有 10 道题未完成，建议检查后再提交。</div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={()=>setSubmitted(false)} className="btn-secondary">继续检查</button>
              <button onClick={()=>setSubmitted(false)} className="btn-primary">确认提交</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
