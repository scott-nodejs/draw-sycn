# 中学生在线学习平台 · 学生端 UI

## 启动
```bash
npm install
npm run dev            # 学生端 Web
npm run desktop:dev    # 学生端 Electron（5174 端口）
npm run build
npm run desktop:build
```

## 已实现页面
- 学习首页统计看板
- 我的任务列表
- 学生解题工作台
- 同步课堂列表
- 同步课堂房间
- 我的班级 / 8 位邀请码加入班级
- 学习记录占位页

技术栈：React + TypeScript + Tailwind CSS + Lucide React + Recharts。

这是与老师端独立构建、独立运行的项目。登录、班级、任务和同步课堂使用 `/api/student/**` 接口；后端地址通过 `VITE_API_BASE_URL` 配置。
