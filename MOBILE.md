# 笔尖云堂移动端构建

老师端与学生端分别是独立 Capacitor 应用，继续复用现有 React、后端 API、TRTC 与 tldraw 同步能力。

| 应用 | 目录 | App ID |
| --- | --- | --- |
| 老师端 | `teacher-app` | `com.bijianyuntang.teacher` |
| 学生端 | `student-app` | `com.bijianyuntang.student` |

## 环境配置

真机中的 `127.0.0.1` 指向手机或 iPad 自己，不能访问电脑上的后端。复制对应的 `.env.mobile.example` 为 `.env.production.local`，填写可由设备访问的 HTTPS/WSS 地址。生产环境不要启用明文 HTTP 或 WS。

## 构建命令

在 `teacher-app` 或 `student-app` 目录执行：

```bash
npm run mobile:sync
npm run mobile:android
npm run mobile:ios
```

- `mobile:sync`：构建 Web 资源并同步到 Android/iOS 工程。
- `mobile:android`：同步后用 Android Studio 打开工程。
- `mobile:ios`：同步后用 Xcode 打开工程；必须在 macOS 上完成签名、真机运行和 App Store 打包。
- 真机调试可使用 `npm run mobile:run:android` 或在 macOS 使用 `npm run mobile:run:ios`。

## 发布检查

1. 配置生产 HTTPS API、WSS 白板与课堂事件地址。
2. 在腾讯云配置正式域名、TRTC SDKAppId 与 UserSig 服务端签发。
3. 替换 Android/iOS 启动图、应用图标和签名证书。
4. 在实体 Android 平板、Android 手机和 iPad 上验证录音、连麦、横竖屏、文件上传及后台恢复。
5. iOS 在 Xcode 设置 Team、Bundle ID 与版本号；Android 在 Gradle 设置 release keystore。
