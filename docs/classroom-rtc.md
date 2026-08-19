# 同步课堂与 TRTC 部署说明

## 服务职责

- Java `8788`：房间生命周期、在线成员、举手队列、RTC 席位、权限、UserSig、业务 WebSocket 和事件日志。
- tldraw sync `8790`：只同步白板。每次连接都会携带登录令牌并向 Java 校验书写权限。
- TRTC：只传输实时音频，不承载课堂业务状态或白板数据。

## 必需环境变量

```text
TRTC_SDK_APP_ID=你的 SDKAppID
TRTC_SECRET_KEY=仅保存在服务端密钥管理系统中的 SecretKey
TRTC_USER_SIG_TTL_SECONDS=7200
CLASSROOM_API_BASE_URL=http://127.0.0.1:8788/api
SYNC_REQUIRE_AUTH=true
```

禁止把 `TRTC_SECRET_KEY` 写入前端环境变量、Electron 包、数据库或 Git。生产环境应通过容器 Secret、云密钥管理服务或进程环境注入，并定期轮换。

## 启动

```text
cd server
mvn spring-boot:run

cd ..
npm run dev:sync
npm run desktop:dev

cd student-app
npm run dev
```

## 端口与反向代理

- `/api/**` 和 `/ws/classroom/**` 转发至 Java 服务。
- `/sync/**` 转发至 tldraw sync，并启用 WebSocket Upgrade。
- HTTPS 页面必须使用 `wss://`，不能连接 `ws://`。

## 课堂状态机

房间：`NOT_STARTED -> ACTIVE -> ENDED`。

举手：`WAITING -> INVITED -> CONNECTING -> CONNECTED`，可转入 `REJECTED` 或 `CANCELLED`。

结束课堂会原子地回收学生音频发布权、白板书写权、举手状态和 RTC 会话；客户端收到 `ROOM_ENDED` 后停止麦克风并退出。

## 上线前验收

1. 老师、至少四个学生账号加入同一班级。
2. 老师创建课堂并开始授课，所有学生能听见老师声音且默认不请求麦克风。
3. 四个学生同时举手，老师端按举手时间显示完整队列。
4. 邀请人数达到席位上限后，下一次邀请返回 409。
5. 学生拒绝邀请不会请求麦克风；接受后才请求并发布音频。
6. 老师静音、结束连麦后，学生端立即执行相应动作并释放席位。
7. 单独授予白板权限后学生可写；收回后连接重建为只读。伪造 URL 的 `role=teacher` 不得写入。
8. 断开网络再恢复，业务 WebSocket 指数退避重连，TRTC 显示 `RECONNECTING` 后恢复。
9. 结束课堂需要二次确认，所有学生停止音频且事件日志完整。
