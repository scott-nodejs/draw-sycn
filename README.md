# 笔尖云堂

笔尖云堂采用五个一级项目的单仓库结构，各应用可以独立安装、启动与发布。

| 项目 | 技术栈 | 说明 |
| --- | --- | --- |
| `teacher-app` | React + Vite + Electron + Capacitor | 老师工作台、试卷管理、直播/录制、tldraw 白板 |
| `student-app` | React + Vite + Electron + Capacitor | 学习平台、同步课堂、任务与回放 |
| `organizer-app` | Vue + Vite | 试卷上传、AI 解析、人工校对与试题集发行 |
| `teacher-agent-web` | React + Vite | 面向学习用户的官网、内容商城、付费解锁和时序回放 |
| `server` | Spring Boot + MySQL | 统一认证、试卷识别、课堂、录制、商品和整理端 API |

## 本地启动

后端：

```bash
cd server
mvn -q -s maven-central-settings.xml spring-boot:run
```

老师端：

```bash
cd teacher-app
npm install
npm run dev
```

学生端：

```bash
cd student-app
npm install
npm run dev
```

试题整理端：

```bash
cd organizer-app
npm install
npm run dev
```

Teacher Agent Web：

```bash
cd teacher-agent-web
npm install
npm run dev
```

Android/iPad 打包见 [MOBILE.md](MOBILE.md)。架构和协议文档统一放在 `docs`。
