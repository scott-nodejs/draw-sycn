export const trendData = [
  { day: '周一', tasks: 2 },
  { day: '周二', tasks: 3 },
  { day: '周三', tasks: 2 },
  { day: '周四', tasks: 4 },
  { day: '周五', tasks: 3 },
  { day: '周六', tasks: 1 },
  { day: '周日', tasks: 3 },
]

export const tasks = [
  { id: 1, type: '试卷', title: '八年级数学 · 一次函数单元测评', teacher: '王老师', clazz: '八年级 3 班', publish: '08-14 10:20', deadline: '今天 22:00', status: '进行中', progress: 45, questions: 18 },
  { id: 2, type: '单题', title: '几何专项：等腰三角形证明', teacher: '李老师', clazz: '八年级 3 班', publish: '08-14 09:00', deadline: '明天 18:00', status: '未开始', progress: 0, questions: 1 },
  { id: 3, type: '试卷', title: '英语 Unit 4 周测', teacher: '陈老师', clazz: '八年级 3 班', publish: '08-13 16:00', deadline: '08-16 20:00', status: '已提交', progress: 100, questions: 24 },
  { id: 4, type: '单题', title: '物理：光的反射作图题', teacher: '周老师', clazz: '八年级 5 班', publish: '08-12 14:30', deadline: '08-14 18:00', status: '已批改', progress: 100, questions: 1 },
  { id: 5, type: '试卷', title: '语文现代文阅读训练（二）', teacher: '赵老师', clazz: '八年级 3 班', publish: '08-11 19:00', deadline: '08-13 21:00', status: '已逾期', progress: 30, questions: 12 },
]

export const rooms = [
  { id: 1, name: '一次函数图像专题讲解', teacher: '王老师', clazz: '八年级 3 班', time: '20:00', status: '进行中', online: 38 },
  { id: 2, name: '英语阅读理解答疑', teacher: '陈老师', clazz: '八年级 3 班', time: '21:10', status: '未开始', online: 0 },
  { id: 3, name: '物理月考错题讲评', teacher: '周老师', clazz: '八年级 5 班', time: '昨天 19:30', status: '已结束', online: 42 },
]

export const classes = [
  { id: 1, name: '八年级 3 班', grade: '八年级', teacher: '王老师', students: 42, recent: '一次函数单元测评', subject: '数学' },
  { id: 2, name: '八年级 5 班', grade: '八年级', teacher: '周老师', students: 39, recent: '光的反射作图题', subject: '物理' },
  { id: 3, name: '英语提升 A 组', grade: '八年级', teacher: '陈老师', students: 28, recent: 'Unit 4 周测', subject: '英语' },
]
