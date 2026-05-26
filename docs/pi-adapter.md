# wiseSpace Pi Adapter

wiseSpace can use **pi** as an external coding agent through the deep adapter.  
The adapter runs as a managed Node.js sidecar (auto-started by Tauri), using the  
pi SDK (`@earendil-works/pi-coding-agent`) instead of subprocess RPC.

---

## Architecture

```
wiseSpace (Tauri Rust)
  ┌─────────────────────────────────────────────────────┐
  │  external_agents/pi_manager.rs                       │
  │    ├─ spawn node scripts/pi-adapter-server.mjs       │
  │    ├─ health-check GET /health (poll until ok)       │
  │    └─ kill on app exit                               │
  │                                                      │
  │  commands/external_agents.rs                         │
  │    dispatch/retry/sync → ensure_running() first      │
  └─────────────────────┬───────────────────────────────┘
                        │ HTTP (127.0.0.1:8789)
  ┌─────────────────────┴───────────────────────────────┐
  │  scripts/pi-adapter-server.mjs (Node.js)             │
  │    ├─ AuthStorage.create() — pi own auth             │
  │    ├─ ModelRegistry — pi models.json                 │
  │    ├─ createAgentSession() — per-task fresh session  │
  │    └─ session.subscribe() — real-time events         │
  └──────────────────────────────────────────────────────┘
```

**Key design decisions:**

| Decision | Detail |
|----------|--------|
| Engine | pi SDK (`createAgentSession`), not subprocess RPC |
| Auth | pi's own auth storage (`~/.pi/agent/auth.json`) |
| Session | Fresh `SessionManager.inMemory()` per task |
| Tools | Dynamic per permission mode (default/accept_edits/full_access) |
| Lifecycle | Auto-started by Tauri, killed on app exit |
| Model | Env vars `WISESPACE_PI_PROVIDER` / `WISESPACE_PI_MODEL`, or pi settings default |

---

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

This installs `@earendil-works/pi-coding-agent` as a devDependency.

### 2. Configure pi authentication

The adapter uses pi's own auth system. Set up at least one API key:

```bash
pi /login        # OAuth login (Anthropic/OpenAI/GitHub Copilot)
# OR set environment variables:
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```

### 3. Create an external agent in wiseSpace

Settings → External Agents → New:

- **Name**: `Pi Adapter`
- **Type**: `Pi Adapter` (select from dropdown — fills default URL)
- **Base URL**: `http://127.0.0.1:8789`
- **Auth**: `None` (pi manages its own)

Click **Save** → Click **Test** to verify the connection.

The adapter auto-starts on the first task dispatch — no manual `pnpm external-agent:pi-adapter` needed.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WISESPACE_PI_ADAPTER_PORT` | `8789` | Adapter HTTP port |
| `WISESPACE_PI_ADAPTER_HOST` | `127.0.0.1` | Adapter bind address |
| `WISESPACE_PI_ADAPTER_TIMEOUT_MS` | `600000` | Task timeout (10 min) |
| `WISESPACE_PI_ADAPTER_CWD` | `process.cwd()` | Fallback working directory |
| `WISESPACE_PI_PROVIDER` | (pi default) | Provider override (e.g. `anthropic`) |
| `WISESPACE_PI_MODEL` | (pi default) | Model override (e.g. `claude-sonnet-4-6-20250514`) |
| `WISESPACE_PI_THINKING_LEVEL` | (pi default) | Thinking level (`off`/`low`/`medium`/`high`) |

---

## HTTP API (unchanged from RPC adapter)

### `GET /health`

```json
{
  "ok": true,
  "service": "wisespace-pi-adapter",
  "engine": "sdk",
  "configuredProvider": null,
  "configuredModel": null,
  "taskCount": 0
}
```

### `POST /tasks`

Request:
```json
{
  "task": {
    "task": {
      "title": "Review the latest change",
      "input": { "text": "Check the current workspace..." },
      "context": { "workspaceRoot": "/path/to/project", "permissionMode": "default" }
    }
  }
}
```

Response (202):
```json
{
  "externalTaskId": "uuid",
  "status": "queued",
  "summary": "Pi task accepted for Review the latest change",
  "cwd": "/path/to/project"
}
```

### `GET /tasks/:id`

```json
{
  "externalTaskId": "uuid",
  "status": "completed",
  "summary": "Pi task completed: Review the latest change",
  "content": "The latest change looks good...",
  "result": {
    "taskId": "uuid",
    "cwd": "/path/to/project",
    "provider": "anthropic",
    "model": "claude-sonnet-4-6-20250514",
    "permissionMode": "default",
    "events": [...]
  }
}
```

---

## Permission Modes & Tools

| Mode | Tools Allowed |
|------|--------------|
| `default` | `read`, `grep`, `find`, `ls` |
| `accept_edits` | `read`, `grep`, `find`, `ls`, `edit`, `write` |
| `full_access` | `read`, `grep`, `find`, `ls`, `edit`, `write`, `bash` |

The permission mode is read from task context and mapped to pi's `--tools` allowlist.

---

## SDK Events

The adapter maps pi SDK events to task state:

| SDK Event | Task Effect |
|-----------|-------------|
| `agent_start` | `status = "running"` |
| `message_update` / `text_delta` | Accumulate `assistantContent` |
| `message_update` / `thinking_delta` | Record in `events[]` |
| `tool_execution_start` | Record tool name in `events[]` |
| `tool_execution_end` | Record tool name + error status |
| `agent_end` | `status = "completed"`, final text extraction |

---

## Troubleshooting

**Adapter fails to start:**
- Ensure Node.js is in PATH (Tauri inherits the system PATH)
- Check that `@earendil-works/pi-coding-agent` is installed: `ls node_modules/@earendil-works/pi-coding-agent`

**Tasks fail immediately:**
- Verify pi auth: `pi /login` or set API key env vars
- The adapter log goes to the Node process stderr (visible in Tauri dev console)

**Connection test fails:**
- The adapter auto-starts on the first dispatch/test. If it doesn't respond within 15s, check Tauri logs for the error message.

---

## Upgrading pi SDK

The adapter pins `@earendil-works/pi-coding-agent` in `package.json`.  
To upgrade:

```bash
pnpm update @earendil-works/pi-coding-agent
# Test the adapter:
node scripts/pi-adapter-server.mjs
# Press Ctrl+C, then test in wiseSpace
```

If a pi SDK upgrade breaks the adapter, only `scripts/pi-adapter-server.mjs` needs changes —  
no Rust code, no wiseSpace core, no frontend changes needed.

---

## 修改记录

### 2026-05-26 — Pi Adapter 生命周期管理与前端乐观 UI

**修改内容：**

- 新增 `src-tauri/src/external_agents/pi_manager.rs`：PiAdapterManager 结构体，负责任务适配器的生命周期管理（自动启动、健康检查、进程清理）
- 修改 `src-tauri/src/external_agents/mod.rs`：注册 `pi_manager` 模块
- 修改 `src-tauri/src/lib.rs`：在 AppState 中新增 `pi_adapter` 字段，初始化 PiAdapterManager
- 修改 `src-tauri/src/commands/external_agents.rs`：在 `test_external_agent_connection` 和 `dispatch_external_agent_task` 中添加 Pi adapter 自动启动逻辑
- 修改 `src/components/chat/InputArea.tsx`：为 Pi adapter 外部代理路径添加乐观 UI 消息更新（用户消息和助手占位符即时显示）

**修改目的：**

- 将 Pi adapter 从手动启动（`pnpm external-agent:pi-adapter`）升级为 Tauri 自动管理生命周期
- 解决外部代理路径消息发送后页面空白无反馈的问题（添加乐观 UI）
- 健康检查增加 `.no_proxy()` 避免 localhost 请求被系统代理拦截
- 端口占用冲突时自动检测已有适配器进程，避免重复启动

**影响范围：**

- Rust 后端：新增 pi_manager 模块，修改 lib.rs / external_agents.rs
- 前端：InputArea.tsx 中外部代理发送流程
- 不影响 chat 模式和内置 agent 模式

**风险与兼容性：**

- Pi adapter 依赖 `@earendil-works/pi-coding-agent` SDK 和用户 ~/.pi/agent/auth.json 认证配置
- 适配器最大启动等待 15 秒，超时返回明确错误
- Windows 下通过 `resolve_node_bin()` 自动查找 node.exe

**验证方式：**

- `cargo check` 编译通过
- 适配器 HTTP API (curl) 直接调用正常：`POST /tasks` 返回 202，`GET /tasks/:id` 返回结果
- 健康检查 `GET /health` 返回 `{"ok": true}`
- 内置 chat 模式和 agent 模式（wiseSpace Local 执行器）功能正常
