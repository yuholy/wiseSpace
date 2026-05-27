# 移除所有外接 Agent，聚焦本地 Agent + Subagent 协作

**日期**：2026-05-27  
**类型**：架构重构

---

## 修改内容

### 删除（21 个文件）

**Rust 后端 — 外接 Agent 连接器（10 文件）**
```
src-tauri/src/external_agents/context.rs
src-tauri/src/external_agents/custom_http.rs
src-tauri/src/external_agents/mod.rs
src-tauri/src/external_agents/nanoclaw.rs
src-tauri/src/external_agents/openclaw.rs
src-tauri/src/external_agents/pi_manager.rs
src-tauri/src/external_agents/registry.rs
src-tauri/src/external_agents/result_ingest.rs
src-tauri/src/commands/external_agents.rs
```

**前端 — 类型、Store、UI 组件（7 文件）**
```
src/types/externalAgent.ts
src/stores/externalAgentStore.ts
src/components/settings/ExternalAgentSettings.tsx
src/lib/externalTaskSummary.ts
src/lib/__tests__/externalTaskSummary.test.ts
src/lib/externalBridgeProfile.ts
src/lib/__tests__/externalBridgeProfile.test.ts
```

### 新增（4 文件）

```
src-tauri/src/commands/subagents.rs         # 内置 Subagent 系统
src/types/agentTask.ts                      # AgentTask/Subagent 类型定义
src/stores/subagentStore.ts                 # 前端 Subagent Store
src/lib/subagentTaskSummary.ts              # 任务摘要工具
```

### 修改（14 文件）

**Rust 后端**
| 文件 | 变更 |
|------|------|
| `src-tauri/src/lib.rs` | 移除 PiAdapterManager、外部 agent 命令注册；注册 subagent 命令 |
| `src-tauri/src/commands/mod.rs` | `external_agents` → `subagents` |
| `src-tauri/src/commands/extensions.rs` | 移除外部 agent 扩展支持（summarize_external_agent、bridge profile 等） |
| `src-tauri/src/agent_runtime/sdk_runner.rs` | 自动委托调用改为 `commands::subagents` |

**前端**
| 文件 | 变更 |
|------|------|
| `src/types/index.ts` | 移除 `externalAgent` 导出；新增 `agentTask` 导出；移除 `agentExecutors` 设置项 |
| `src/stores/index.ts` | 移除 `useExternalAgentStore`；新增 `useSubagentStore` |
| `src/lib/agentExecutors.ts` | 移除外部 agent executor 函数（`getExternalAgentExecutorId` 等） |
| `src/lib/browserMock.ts` | 移除外部 agent 模拟数据 |
| `src/components/settings/index.ts` | 移除 `AgentExecutorSettings` 导出 |
| `src/components/settings/SettingsSidebar.tsx` | 移除 `agentExecutors` 菜单项 |
| `src/components/settings/ExtensionsSettings.tsx` | 移除外部 agent 筛选、bridge profile 渲染 |
| `src/pages/SettingsPage.tsx` | 移除 `AgentExecutorSettings` 和 `ExternalAgentSettings` |
| `src/components/chat/InputArea.tsx` | 移除外部 agent 分发逻辑和执行器切换下拉；改为静态标签 |
| `src/components/chat/ChatInspector.tsx` | 改用 `useSubagentStore` + `getSubagentTaskSummary` |

---

## 修改目的

wiseSpace 是个人桌面 AI 工具，不需要连接外部 agent 运行时。将所有功能集中在本地 agent 上，通过 subagent 委托实现内部协作，降低复杂度并提升可维护性。

| 原架构 | 新架构 |
|--------|--------|
| 本地 Agent + 外部 pi_adapter/openclaw/nanoclaw/custom_http 连接器 | 仅本地 Agent |
| 外部 agent 通过 HTTP 桥接分发任务 | 内置 Subagent（reviewer/researcher）通过同一 LLM provider 执行子任务 |
| Settings 中有独立的 agentExecutors 和 externalAgents 页面 | 无 agent 相关设置（只有一个本地 agent） |
| 对话页支持切换不同 agent 执行器 | 无切换 UI，始终使用本地 agent |

---

## 影响范围

- **后端**：所有外部 agent 连接和生命周期管理代码完全移除；subagent 委托保留并独立为 `subagents.rs`
- **前端**：设置页不再有 agent 执行器/外部 agent 配置；对话页不再有执行器切换
- **数据库**：`external_agents` 和 `agent_tasks` 表保留，但仅 `agent_tasks` 用于 subagent 委托记录
- **API**：移除 `list_external_agents`/`create_external_agent`/`dispatch_external_agent_task` 等外部 agent 命令

---

## 风险与兼容性

- **风险**：低。移除的是独立功能模块，不影响核心对话和 agent 执行链路。
- **兼容性**：已有 conversation 中存储的 `externalAgentId` 引用会失效（subagent 的 `external_agent_id` 字段改用内置 ID）。老数据不影响正常使用。
- **回滚**：可通过 git revert 完全恢复。

---

## 验证方式

- `pnpm tauri dev` 编译通过，无错误无警告（仅预存的 unused import warnings）
- 设置页不再显示 agent 执行器和外部 agent 相关配置
- 对话页 agent 模式下显示静态 "wiseSpace" 标签，无切换 UI
- 内置 Subagent（reviewer/researcher）委托逻辑保留在 `subagents.rs` 中可正常调用
