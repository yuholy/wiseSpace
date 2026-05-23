# wiseSpace Workspace Code Change Map

> 日期：2026-05-23
>
> 这份文档把 `Workspace First` 的 schema 草案继续往代码层推进，目标是明确：
> 哪些文件要改、每个文件承担什么职责、建议按什么顺序实施。
>
> 关联文档：
> - `docs/planning/workspace-schema-draft.md`
> - `docs/planning/workspace-implementation-checklist.md`
> - `docs/planning/workspace-scope-audit.md`
> - `docs/project/ARCHITECTURE.md`

---

## 1. 目标

这一轮不直接写业务实现，而是先把改动面梳理清楚，避免后续进入
`workspace` 实施时出现：

- schema 改了，但 repo 没接上
- Rust types 改了，但 Tauri command 没暴露
- backend 有了 `workspace_id`，前端仍只认 `conversation_id`
- snapshot 逻辑和真实 workspace 身份继续脱节

核心目标：

- 给 `Workspace First` 建立一份可执行的代码改动地图
- 让后续实现可以按批次推进，而不是全仓乱改

---

## 2. 当前代码信号

从现有代码可以确认：

- `conversations` 已经有 `workspace_snapshot_json`
- `conversations` 仍直接存 `enabled_mcp_server_ids / enabled_knowledge_base_ids / enabled_memory_namespace_ids`
- `agent_profiles / agent_runs` 仍通过 `workspace_root` 表达 workspace
- `agent_sessions` 仍通过 `cwd` 表达 workspace
- `agent_tasks` 还只有 `conversation_id`
- `stored_files` 也只有 `conversation_id`
- `branches.rs` 里的 `get_workspace_snapshot / update_workspace_snapshot` 仍是 stub
- 前端 `chatWorkspaceStore.ts` 目前只是 artifact compare 的 UI store，还不是 workspace 领域 store

这说明：

- 数据层已经有 workspace 倾向
- 运行时已经有 workspace path
- 但“真实 workspace 主实体”还没接入主链路

---

## 3. 代码改动总图

建议按 6 个层次实施：

1. migration 层
2. entity 层
3. repo 层
4. Tauri command 层
5. core shared types 层
6. 前端 types / store / invoke 层

---

## 4. 必改文件清单

### 4.1 Migration 层

必须新增：

- `src-tauri/crates/migration/src/m20260523_000001_workspace_identity_foundation.rs`
- `src-tauri/crates/migration/src/m20260523_000002_workspace_identity_backfill.rs`

必须更新：

- `src-tauri/crates/migration/src/lib.rs`

职责：

- 新建 `workspaces`
- 给相关表补 `workspace_id`
- 建索引
- 注册 migration 顺序
- 执行最保守回填

### 4.2 Entity 层

必须新增：

- `src-tauri/crates/core/src/entity/workspaces.rs`

必须更新：

- `src-tauri/crates/core/src/entity/mod.rs`
- `src-tauri/crates/core/src/entity/conversations.rs`
- `src-tauri/crates/core/src/entity/agent_profiles.rs`
- `src-tauri/crates/core/src/entity/agent_runs.rs`
- `src-tauri/crates/core/src/entity/agent_sessions.rs`
- `src-tauri/crates/core/src/entity/agent_tasks.rs`
- `src-tauri/crates/core/src/entity/stored_files.rs`

职责：

- 新增 `Workspace` entity
- 为相关模型增加 `workspace_id`
- 逐步补关系定义

建议：

- 第一阶段 relation 不必一次建满
- 优先保证字段和基础查询可用

### 4.3 Repo 层

必须新增：

- `src-tauri/crates/core/src/repo/workspace.rs`

必须更新：

- `src-tauri/crates/core/src/repo.rs`
- `src-tauri/crates/core/src/repo/conversation.rs`
- `src-tauri/crates/core/src/repo/agent_profile.rs`
- `src-tauri/crates/core/src/repo/agent_run.rs`
- `src-tauri/crates/core/src/repo/agent_session.rs`
- `src-tauri/crates/core/src/repo/external_agent.rs`
- `src-tauri/crates/core/src/repo/stored_file.rs`

职责：

- 建立 workspace 的基本 CRUD / 查询
- 对 conversation 创建流程补 canonical workspace
- 对 agent profile / run / session / task 写入补 `workspace_id`
- 对 stored file 新流量写入补 `workspace_id`

重点关注：

- `agent_profile::get_or_create_profile`
- `agent_run::get_latest_run_for_conversation`
- `agent_run::list_runs_for_conversation`
- `agent_session::set_sdk_context_by_conversation_id`
- `external_agent::list_agent_tasks`
- `stored_file::list_stored_files_by_conversation`

这些都是后续 workspace 化时最容易漏掉的主路径。

### 4.4 Core Shared Types 层

必须更新：

- `src-tauri/crates/core/src/types.rs`

建议新增或扩展：

- `Workspace`
- `workspace_id` on:
  - `Conversation`
  - `AgentProfile`
  - `AgentRun`
  - `AgentSession`
  - `AgentTask`
  - `StoredFile` if exposed

职责：

- 让 Rust 后端、Tauri command 和前端 IPC 结构对齐

### 4.5 Tauri Command 层

建议新增：

- `src-tauri/src/commands/workspaces.rs`

必须更新：

- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/commands/conversations.rs`
- `src-tauri/src/commands/agent.rs`
- `src-tauri/src/commands/external_agents.rs`
- `src-tauri/src/commands/files.rs`
- `src-tauri/src/commands/branches.rs`

职责：

- 暴露 workspace 相关 commands
- conversation 返回 `workspace_id`
- agent 相关命令开始走 canonical workspace
- `branches.rs` 里的 snapshot stub 最终迁成真实 workspace-backed projection

建议的首批 commands：

- `list_workspaces`
- `get_workspace`
- `get_workspace_by_conversation`
- `rename_workspace`

### 4.6 前端 Types 与 Store 层

必须更新：

- `src/types/index.ts`
- `src/types/agent.ts`
- `src/types/workspace.ts`
- `src/stores/conversationStore.ts`
- `src/stores/agentStore.ts`
- `src/stores/externalAgentStore.ts`
- `src/stores/chatWorkspaceStore.ts`

后续高概率要更新：

- `src/stores/fileStore.ts`
- `src/stores/knowledgeStore.ts`
- `src/stores/memoryStore.ts`
- `src/stores/mcpStore.ts`

职责：

- 加入 `workspaceId`
- 让会话和 agent 数据在前端能按 workspace 聚合
- 让 `chatWorkspaceStore` 从“局部 UI 状态”向真实 workspace 视图收敛

---

## 5. 分批实施建议

### 批次 A：打地基

目标：

- schema 可升级
- 后端类型可编译
- 还不改变产品行为

包含：

- migration A
- `workspaces` entity
- 相关 entity 加 `workspace_id`
- Rust shared types 补字段

对应文件：

- migration
- `entity/*`
- `types.rs`

### 批次 B：建立 canonical workspace 主链路

目标：

- conversation 创建时一定绑定 workspace
- agent 主链路开始写入 `workspace_id`

包含：

- `repo/workspace.rs`
- `repo/conversation.rs`
- `repo/agent_profile.rs`
- `repo/agent_run.rs`
- `repo/agent_session.rs`
- `commands/conversations.rs`
- `commands/agent.rs`

这是 `Workspace First` 真正开始生效的阶段。

### 批次 C：任务与文件接入 workspace

目标：

- 外部 agent task 和文件体系开始有 workspace 归属

包含：

- `repo/external_agent.rs`
- `repo/stored_file.rs`
- `commands/external_agents.rs`
- `commands/files.rs`
- 相关前端 store/types

### 批次 D：Snapshot 与前端体验收口

目标：

- 用真实 workspace 身份接管 snapshot 逻辑
- 前端视图从 conversation-only 过渡到 workspace-aware

包含：

- `commands/branches.rs`
- `src/types/workspace.ts`
- `src/stores/conversationStore.ts`
- `src/stores/chatWorkspaceStore.ts`

---

## 6. 具体文件职责说明

### `src-tauri/crates/core/src/entity/conversations.rs`

要做：

- 增加 `workspace_id: Option<String>`

暂时不要做：

- 删除 `workspace_snapshot_json`
- 删除 `enabled_*` 字段

原因：

- 第一阶段先保兼容

### `src-tauri/crates/core/src/entity/agent_profiles.rs`

要做：

- 增加 `workspace_id: Option<String>`

保留：

- `workspace_root`

原因：

- 它现在仍是运行时路径来源

### `src-tauri/crates/core/src/entity/agent_runs.rs`

要做：

- 增加 `workspace_id: Option<String>`

保留：

- `workspace_root`

### `src-tauri/crates/core/src/entity/agent_sessions.rs`

要做：

- 增加 `workspace_id: Option<String>`

保留：

- `cwd`

### `src-tauri/crates/core/src/entity/agent_tasks.rs`

要做：

- 增加 `workspace_id: Option<String>`

原因：

- 它将来需要支持弱 conversation 关联的 workspace 任务中心

### `src-tauri/crates/core/src/entity/stored_files.rs`

要做：

- 增加 `workspace_id: Option<String>`

原因：

- 给 Files 演进成 workspace 资产中心预留归属

---

## 7. 最容易漏改的地方

### 7.1 `types.rs`

如果只改 entity 而不改 `types.rs`，前端会继续拿不到 `workspaceId`。

### 7.2 `commands/agent.rs`

这是当前 `conversation_id + workspace_root + cwd` 三套概念混用最明显的地方。

如果这里只补 schema 不补 command 逻辑，workspace 化会停在“数据库有字段但运行链路没接上”。

### 7.3 `commands/branches.rs`

现在的 snapshot API 是 stub。

如果后面不尽快替换，它会继续误导前端认为自己已经有了“workspace 视图”。

### 7.4 `chatWorkspaceStore.ts`

名字像 workspace store，但目前只是 artifact compare 的 UI 状态。

这个命名如果不收敛，后面会严重混淆真实 workspace 领域状态。

---

## 8. 推荐下一次真正开工的顺序

如果下一轮开始写代码，建议严格按这个顺序：

1. 新增 migration 文件并注册
2. 新增 `workspaces` entity，给相关 entity 补 `workspace_id`
3. 更新 `types.rs`
4. 新增 `repo/workspace.rs`
5. 接 conversation / agent repo 主链路
6. 再补 commands
7. 最后接前端 types 和 store

这样能最大程度避免“前端先改、后端还没稳定”。

---

## 9. 结论

`Workspace First` 的真正难点，不是加一张表，而是把：

- schema
- repo
- command
- types
- frontend state

这五层同时收口到同一个主身份上。

从当前代码结构看，最值得先做的不是 UI，而是：

- migration
- entity
- repo
- shared types

只要这四层打稳，后面的 snapshot、Files、context bindings 才能接得顺。
