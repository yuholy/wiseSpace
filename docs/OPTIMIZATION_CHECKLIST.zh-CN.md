# wiseSpace 优化清单

> 最后更新：2026-05-24
>
> 这是 wiseSpace 的顶层优化跟踪文档。
>
> 使用规则：
> - 后续架构优化、产品优化默认先读取这份清单
> - 这份文档是优化 backlog 和进度状态的单一入口
> - 中文版是主维护版本，状态更新以本文档为准
> - 英文版是同步镜像，内容应尽量保持一致
> - 每完成一项优化，都要在这里更新状态
> - 如果一项工作只完成一部分，要补充当前进展和后续拆分
>
> 状态说明：
> - `pending`：未开始
> - `in_progress`：进行中
> - `done`：已完成
> - `deferred`：有意延后

关联文档：

- [project/ARCHITECTURE.md](./project/ARCHITECTURE.md)
- [planning/workspace-scope-audit.md](./planning/workspace-scope-audit.md)
- [planning/workspace-implementation-checklist.md](./planning/workspace-implementation-checklist.md)
- [planning/workspace-schema-draft.md](./planning/workspace-schema-draft.md)
- [planning/workspace-code-change-map.md](./planning/workspace-code-change-map.md)
- [planning/extension-model-audit.md](./planning/extension-model-audit.md)
- [planning/extension-model-schema-draft.md](./planning/extension-model-schema-draft.md)
- [research/COMPETITOR_DECISION_ROADMAP.md](./research/COMPETITOR_DECISION_ROADMAP.md)

---

## P0：先把主骨架立稳

### 1. Workspace First

- 状态：`done`
- 目标：让 `workspace` 成为长期上下文主容器，而不是继续把过多职责压在 `conversation` 上。
- 范围：
  - 新增 `workspaces` 实体
  - 给 `conversation` 和 `agent` 相关记录增加 `workspace_id`
  - 在 `repo` 和 `command` 层建立规范的 workspace 身份链路
- 当前进展：
  - 已完成关系模型梳理、scope audit、implementation checklist、schema 草案、代码改动地图
  - 已落地 workspace identity foundation migration
  - 已新增 `workspaces` entity，并给相关 entity 补齐 `workspace_id`
  - 已在 `repo / command` 层打通 `conversation / agent / stored file` 的 `workspace_id` 主链路
  - 已为历史 conversation 增加 canonical workspace identity 自愈/回填能力，并把 `workspace_id` 传播到相关 `agent / task / file`
  - 已补齐 workspace 最小命令面：list、按 conversation 查询、rename、attach conversation
  - 已保护共享 workspace 和手动重命名的 workspace，避免被单个 conversation 标题覆盖元数据
- 来源：
  - `docs/project/ARCHITECTURE.md`
  - `docs/planning/workspace-scope-audit.md`

### 2. 明确 Chat 与 Agent 的边界

- 状态：`done`
- 目标：保留轻量聊天体验，同时让执行型流程边界清晰。
- 范围：
  - 明确 chat 是 `workspace` 内的对话线程
  - 明确 agent run 是 `workspace` 内的执行记录
  - 降低 UI 和状态流转里的语义混淆
- 当前进展：
  - `InputArea` 已明确展示 Chat / Agent 模式边界提示
  - `ChatSidebar` 已给 Agent 会话增加可见标记
  - `ChatInspector` 已汇总 mode、boundary、workspace、run 信息
- 来源：
  - `docs/project/ARCHITECTURE.md`

### 3. 让 Workspace Snapshot 真正落地

- 状态：`done`
- 目标：把当前 placeholder / stub 的 snapshot 逻辑替换成真实的 workspace 投影数据。
- 范围：
  - 替换 stub snapshot commands
  - 明确 workspace 默认值和 conversation 局部覆盖之间的 source of truth
  - 暴露稳定的前端 `types` 和 `store` 行为
- 当前进展：
  - `get_workspace_snapshot` 现已从真实 conversation 状态投影 snapshot
  - `update_workspace_snapshot` 现已回写 conversation 偏好字段和 `workspace_snapshot_json`
  - 前端 store 调用和 browser mock 已对齐真实结构
- 来源：
  - `docs/planning/workspace-implementation-checklist.md`

### 4. 把可复用上下文绑定提升到 Workspace 级

- 状态：`done`
- 目标：不再只把 `MCP / knowledge / memory` 的启用关系存放在 conversation 行上。
- 范围：
  - 新增 workspace 绑定表
  - 迁移期间支持兼容读取
  - 把前端上下文行为迁成 workspace-aware
- 当前进展：
  - 已引入 `MCP / knowledge / memory` 的 workspace 绑定表
  - conversation repo 已把旧 conversation 启用字段同步到 workspace 绑定
  - snapshot 投影优先读取 workspace 绑定，同时兼容旧 conversation 字段
  - 聊天运行时链路已优先使用 workspace 绑定做 RAG 和 MCP 工具解析，同时保留显式会话覆盖
  - 前端绑定控件已改为通过 workspace snapshot 读写，浏览器 mock 也支持按会话持久化 snapshot
  - search 偏好的 hydration 和写回已并入 `workspaceSnapshot.searchPolicy`
  - 已抽出共享的 workspace context 派生层，保证 `InputArea` 和 `ChatInspector` 在 snapshot 未加载时也能一致回退
  - `researchMode` 和 `tool approval` 已并入共享 workspace context 视图
  - 回归测试已覆盖 snapshot hydration、workspace 绑定写入、失败回滚和 InputArea 相关 store mock
- 来源：
  - `docs/planning/workspace-scope-audit.md`
  - `docs/planning/workspace-implementation-checklist.md`

### 5. 把安全模型产品化

- 状态：`done`
- 目标：让权限、路径、执行边界变成用户可理解、可感知的产品能力。
- 范围：
  - 在 UI 中展示执行边界
  - 强化命令和文件操作的安全提示
  - 提升恢复、审计和可追踪性
- 当前进展：
  - `InputArea` 已展示 workspace execution boundary 和 tool approval 提示
  - `ChatInspector` 已汇总 permission mode、tool approval、research mode、workspace 信息
  - 运行时 approval card 继续承担细粒度反馈，执行前的策略边界现在也已可见
- 来源：
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

---

## P1：让能力组织起来

### 6. 统一扩展模型

- 状态：`done`
- 目标：把 `skills`、`MCP`、`tools`、`external connectors`、未来的 UI contribution 收口到统一模型。
- 范围：
  - 定义 contribution / manifest 结构
  - 定义生命周期和权限模型
  - 避免多套扩展体系并行生长
- 当前进展：
  - 已完成对 Skills、MCP、External Agents 现有体系的第一轮审视
  - 已在 `docs/planning/extension-model-audit.md` 里整理共享维度、现状缺口、目标模型和分阶段推进建议
  - 已在 `docs/planning/extension-model-schema-draft.md` 里补出第一版共享 schema 草案，包括 `ExtensionSummary`、contribution 类型、权限模型和三套现有体系的映射建议
  - 前端共享类型已落地到 `src/types/extension.ts`，并接入 `src/types/index.ts` 导出面
  - Rust 侧已补统一扩展 DTO，并新增 `list_extensions` 聚合命令，能够把 Skills、MCP、External Agents 汇总成统一列表
  - 前端已新增 `extensionStore` 和设置页 `Extensions` 统一视图，支持按扩展类型查看健康状态、权限边界和来源入口
- 来源：
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### 7. 把 Files 升级成 Workspace 资产中心

- 状态：`done`
- 目标：让 Files 成为 workspace 的持久资产中心，而不是单纯附件列表。
- 范围：
  - workspace 级文件
  - 提升后的 artifacts 和生成产物
  - 更清晰的资产浏览和复用路径
- 当前进展：
  - Files 页数据已补齐 `workspaceId / workspaceName`
  - 文件表格已增加工作空间列，并支持按工作空间筛选
  - 文件搜索现在会同时匹配文件名和工作空间名
- 来源：
  - `docs/planning/workspace-implementation-checklist.md`

### 8. 围绕 Workspace 收敛 Store 结构

- 状态：`done`
- 目标：减少按页面切分的零散状态，增强 workspace 视角下的状态组织。
- 范围：
  - 梳理 conversation、agent、file、knowledge、memory、workspace stores
  - 减少重复上下文状态
  - 修正当前“workspace”仅代表局部 UI 状态的命名问题
- 当前进展：
  - 已新增 `extensionStore` 作为统一扩展能力状态入口，减少技能页、MCP、外部 Agent 视图继续各自复制列表状态
  - `fileStore` 已吸收工作空间筛选和可见资产派生逻辑，减少 Files 页面组件内部的局部状态分叉
  - `workspace-aware` 的上下文主链路延续到资产视图，当前阶段的高价值收敛点已经落地
- 来源：
  - `docs/project/ARCHITECTURE.md`
  - `docs/planning/workspace-implementation-checklist.md`

### 9. 强化引导与诊断体验

- 状态：`done`
- 目标：让高级能力更容易理解，也更容易排障。
- 范围：
  - 首次使用引导
  - 上下文解释能力
  - 诊断和恢复入口
- 当前进展：
  - 设置页已新增 `Extensions` 统一入口，用统一语言解释扩展能力结构
  - 页面内置健康统计、类型筛选和来源设置跳转，形成“发现问题 -> 打开对应来源设置”的最小诊断闭环
- 来源：
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### 10. 补齐边界与契约测试

- 状态：`done`
- 目标：保护 `workspace scope`、`snapshot`、`policy`、`binding` 这类边界能力不被回归破坏。
- 范围：
  - workspace scope tests
  - snapshot projection tests
  - sandbox / policy tests
  - binding compatibility tests
- 当前进展：
  - 已补 `extensionStore`、`ExtensionsSettings`、`fileStore` 工作空间筛选相关前端回归测试
  - 已补 Rust 侧扩展聚合摘要测试和 Files 按工作空间名搜索测试
- 来源：
  - `docs/planning/workspace-implementation-checklist.md`

---

## P2：高级能力阶段

### 11. SubAgent 与多 Agent 协作

- 状态：`deferred`
- 目标：等 workspace 和 binding 基础稳定后，再做更强的多 Agent 执行体系。
- 范围：
  - subagent orchestration
  - 更丰富的执行委派
  - 共享运行上下文与恢复能力
- 来源：
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### 12. 完整插件运行时与隔离

- 状态：`deferred`
- 目标：在统一扩展模型成型后，再建设更完整的插件运行时。
- 范围：
  - 运行时隔离
  - plugin UI host
  - 插件健康度与兼容性管理
- 来源：
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### 13. 更强的自动化与主动执行

- 状态：`deferred`
- 目标：等执行边界更清晰后，再增强助手主动性。
- 范围：
  - 主动任务建议
  - 可计划、可恢复的执行
  - 更完整的 task center 行为

### 14. 更深的记忆与跨任务复用

- 状态：`deferred`
- 目标：等 workspace 级 memory 绑定稳定后，再增强长期复用能力。
- 范围：
  - 更智能的 memory retrieval
  - 可复用的 workspace context packs
  - 跨 conversation 的连续性

### 15. 扩展外部桥接能力

- 状态：`deferred`
- 目标：等内部宿主模型稳定后，再扩大外部 bridge 范围。
- 范围：
  - 更多 bridge 类型
  - 更丰富的 connector 管理
  - 更清晰的 bridge 权限体系

---

## 已完成

### A. docs 结构整理

- 状态：`done`
- 结果：
  - 按用途重组了 `docs/`
  - 新增 `docs/README.md` 作为总入口

### B. 竞品结论收敛

- 状态：`done`
- 结果：
  - 产出 `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### C. Workspace 范围审视

- 状态：`done`
- 结果：
  - 产出 `docs/planning/workspace-scope-audit.md`

### D. Workspace 实施清单

- 状态：`done`
- 结果：
  - 产出 `docs/planning/workspace-implementation-checklist.md`

### E. 架构关系图补全

- 状态：`done`
- 结果：
  - 在 `docs/project/ARCHITECTURE.md` 中补全了 `workspace / chat / agent` 关系模型

### F. 优化清单主版本规则固化

- 状态：`done`
- 结果：
  - 明确中文版优化清单为主维护版本
  - 英文版作为同步镜像保留

### G. Workspace Schema 草案

- 状态：`done`
- 结果：
  - 产出 `docs/planning/workspace-schema-draft.md`

### H. Workspace 代码改动地图

- 状态：`done`
- 结果：
  - 产出 `docs/planning/workspace-code-change-map.md`

### I. 自动工作空间名称可读性优化

- 状态：`done`
- 结果：
  - 自动生成的 agent workspace 在输入区不再直接显示 `conv-*` 这类技术目录名
  - 当路径看起来像系统生成目录时，优先显示会话标题

### J. 默认工作空间目录可读化

- 状态：`done`
- 结果：
  - 新创建的受管默认 workspace 目录现在统一使用 ASCII 安全的 `workspace-YYYYMMDDHHMMSS` 风格命名
  - 历史受管默认目录会在安全前提下迁移到新的时间戳命名规则
  - 当路径仍然看起来像系统生成目录时，UI 会继续优先显示可读的会话标题
