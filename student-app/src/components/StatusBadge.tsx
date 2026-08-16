export default function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    '未开始': 'bg-slate-100 text-slate-600',
    '进行中': 'bg-blue-50 text-blue-700',
    '已提交': 'bg-emerald-50 text-emerald-700',
    '已批改': 'bg-emerald-50 text-emerald-700',
    '已逾期': 'bg-red-50 text-red-600',
    '已结束': 'bg-slate-100 text-slate-500',
  }
  return <span className={`chip ${map[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>
}
