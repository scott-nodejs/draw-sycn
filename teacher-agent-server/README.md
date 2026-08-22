# Teacher Agent Server

独立的“先完整规划，再按步讲画”后端。它不依赖仓库中的通用 `server`，第一版计划和会话存于内存，重启后清空。

## 运行

PowerShell（需要本机 Maven）：

```powershell
$env:DEEPSEEK_API_KEY='your-key'
mvn -s ..\server\maven-central-settings.xml spring-boot:run
```

## 调用顺序

1. `POST /api/teacher-agent/plans`，body 为 `{"problem":"...","studentLevel":"NORMAL"}`。
2. `POST /api/teacher-agent/sessions`，body 为 `{"planId":"...","roomId":"...","autoStart":false}`。
3. 先连接 `ws://127.0.0.1:8791/ws/teaching/{sessionId}`，再调用 `POST /api/teacher-agent/sessions/{sessionId}/start`。
4. 前端处理 `SPEECH` 和 `CANVAS_ACTION`；也可用 `pause`、`resume`、`next`、`stop` 控制。

`SPEECH` 当前承载 TTS 输入文本和服务端估算时长，后续接入具体 TTS 厂商时可保持事件协议不变。`CANVAS_ACTION.payload.action` 是语义画布动作，由 tldraw 适配层转换成实际 shape 操作。
