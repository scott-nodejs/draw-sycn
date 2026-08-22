# 笔尖云堂老师端

老师端包含试卷与题目管理、同步课堂、TRTC 音频、tldraw 白板直播与时序录制回放，并同时支持 Web、Electron、Android 和 iOS/iPadOS。

```bash
npm install
npm run dev
```

常用命令：

- `npm run desktop:dev`：Electron 开发模式。
- `npm run desktop:build`：Electron 安装包。
- `npm run mobile:sync`：同步 Web 资源到 Android/iOS。
- `npm run mobile:android`：使用 Android Studio 打开。
- `npm run mobile:ios`：使用 Xcode 打开（需要 macOS）。
- `npm run dev:java`：启动兄弟目录中的统一后端。
