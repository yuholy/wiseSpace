# 竞品分析与优化建�?
> 基于 similar-projects/ �?OpenAkita、Proma、OpenHanako 三个项目深度分析，结�?wiseSpace 现状提出可借鉴的优化方向�?> 分析日期�?026-05-23

---

## 1. 三个项目概览

### 1.1 OpenAkita

| 维度 | 详情 |
|---|---|
| 定位 | 开源多 Agent AI 助手—�?不只会聊天，能帮你干活的 AI 团队" |
| 技术栈 | Python 3.11+ (FastAPI) + React 18/TypeScript + Tauri 2.x |
| 许可 | Apache 2.0 |
| 用户�?| 面向普通用户，GUI 零命令行配置 |
| 核心差异 | �?Agent 协作、组织编排、插件系统、IM 扫码绑定 |

**核心亮点�?*

- **�?Agent 协作 + 组织编排**：不只是�?Agent 并行，而是构建完整"AI 公司"——CEO、CTO、CFO、市场总监等角色自治运行，有黑板共享、消息路由、死锁检测、心跳检查、自动扩缩容
- **6 层纵深防御安�?*：路径分�?�?确认闸门 �?命令拦截 �?文件快照 �?自保�?�?OS 级沙盒（Linux bwrap / macOS seatbelt / Windows MIC�?- **插件系统**�? 种类型（工具/频道/RAG/记忆/LLM/钩子/技�?MCP），3 级权限模型，10 个生命周期钩子，自动故障隔离
- **IM 扫码绑定**：微�?飞书/企业微信/钉钉/Telegram/QQ 六大平台，扫�?30 秒绑定，无需开发者账�?- **双模记忆系统**：碎片记�?+ MDRM 关系图谱（因果链/时间�?实体图，3D 可视化），自动智能切�?- **自进�?*：每日自检修复、失败根因分析、自动技能生�?- **89+ 内置工具**：覆�?Shell/文件/浏览�?桌面/搜索/调度/MCP �?16 个类�?- **8 种人格模�?* + 主动引擎（问候、任务跟进、晚安）

**可借鉴的设计模式：**

1. **Plugin manifest 机制** (`plugin.json`)：声明式插件定义，统一注册-发现-生命周期
2. **6 层安全模�?*：层级递进的防御体系，安全边界清晰
3. **智能记忆路由**：根据查询特征（因果/时间�?偏好/事实）自动选择检索模�?4. **Agent 实例�?*：LRU 淘汰 + 池化复用，降�?Agent 创建成本

### 1.2 Proma

| 维度 | 详情 |
|---|---|
| 定位 | 本地优先�?AI 桌面应用—�?Chat 回答，Agent 行动" |
| 技术栈 | Bun + Electron 39 + React 18 + TypeScript + Jotai |
| 许可 | Apache 2.0 |
| 用户�?| 开发�?+ 深度用户 |
| 核心差异 | Chat/Agent 模式分离、工作区隔离、Claude Agent SDK、飞书机器人桥接 |

**核心亮点�?*

- **Chat vs Agent 明确分界**�?只需要回答时�?Chat，需要行动和交付结果时用 Agent"
- **工作区隔�?*：每个工作区独立配置 Skills、MCP Server 和工作区文件
- **SubAgent/Tasks**：复杂任务通过 Claude Agent SDK �?Agent 工具自动拆分为子 Agent
- **远程机器�?*：飞�?Lark 机器人桥接，用手机或群聊触发本机 Agent 工作流；也支持钉�?微信桥接
- **本地文件存储**：不使用数据库，JSON/JSONL 文件组织，方便备�?迁移/排查
- **全局语音输入**：Ctrl+` 触发识别，支持应用内外输�?- **Proma Coach 内置 Skill**：引导用户和 Agent 存储文档、沉淀流程、优化工作流
- **主动系统设计思路（Proactive�?*：三层行为模型——用户信息源 �?Agent 偏好推理 �?定时/心跳触发消费

**可借鉴的设计模式：**

1. **Chat/Agent 模式分离**：根据任务复杂度自动或手动选择执行路径
2. **工作�?= 独立上下�?*：Skills、MCP、文件、记忆全部按工作区隔�?3. **JSON/JSONL 文件存储**：对某些场景可能�?SQLite 更轻量和可迁�?4. **Proma Coach 模式**：内置技能引导用户最佳实践，降低学习曲线
5. **Mailbox/Todo/Kanban 模型**：Agent 间通过队列协调，人类通过看板监督

**Proma 的思考对 wiseSpace 的启示（Erlich Q2-Q3 2026 观点）：**

- 解决"真实问题"而非追求性感叙事——个人注意力管理、团队协作才是真正值得攻克的难�?- Agent 主动性的关键是低摩擦：简�?User Profile（几百字�? 模型自身推理 > 复杂记忆系统
- 团队协作的核心：上下文同步、Skills 分发、Todo 协同、工作区文件共享、Agent 互访
- 当前市场（Claude/Codex/OpenAI）的产品"德不配位"，真正的机会在应用端

### 1.3 OpenHanako

| 维度 | 详情 |
|---|---|
| 定位 | 有记忆、有灵魂的私�?AI 助理——面向普通用�?|
| 技术栈 | Electron 38 + React 19 + Zustand 5 + Hono + Pi SDK + better-sqlite3 |
| 许可 | Apache 2.0 |
| 用户�?| 非开发者普通用户（文员、办公人群） |
| 核心差异 | 人格系统、书桌工作区、角色卡与技能包、强大的插件系统 |

**核心亮点�?*

- **人格系统**：通过人格模板和自定义人格文件塑造独�?Agent 性格，Agent 之间分离很好
- **书桌 (Desk)**：每�?Agent 有自己的书桌——放文件、写笺（便签），Agent 主动读取并执行，支持拖拽
- **角色卡与技能包**：Agent 可导�?导入�?zip（人格、头像、可选记忆和 Skills）；Skill Bundle 是独立技能包基础设施
- **插件系统**：拖拽安装，插件可贡献工�?技�?命令/Agent 模板/HTTP 路由/事件钩子/LLM Provider/页面/侧栏 Widget/配置 schema/后台任务
- **PluginContext 注入**：插件通过 Session Bus �?Agent 对话、获取历史、管�?session
- **多平台接�?*：同一 Agent 可同时接�?Telegram/飞书/QQ/微信
- **移动�?PWA** + LAN 前端访问
- **全屏媒体查看�?*：滚轮缩放、拖拽平移、键盘快捷键、相邻媒体切�?
**可借鉴的设计模式：**

1. **Agent 即文件夹**：人�?记忆/Skills 打包为文件夹，天然隔离和可迁�?2. **PluginContext 注入**：插件通过统一上下文访问核心服务，安全且可扩展
3. **书桌设计**：Agent 与用户的异步协作空间，比单纯聊天窗口更灵�?4. **拖拽式插件安�?*：降低扩展门�?
---

## 2. wiseSpace 现状 vs 竞品能力矩阵

| 能力�?| wiseSpace (v0.1.2) | OpenAkita | Proma | OpenHanako |
|---|---|---|---|---|
| **多供应商模型** | �?完整 (16�? | �?(30+�? | �?(10�? | �?(多类) |
| **Agent 模式** | �?�?Agent | �?�?Agent 编排 | �?Chat/Agent 分离 | �?�?Agent 协作 |
| **�?Agent 协作** | �?| �?组织编排 | ⚠️ SubAgent | �?群聊协作 |
| **插件系统** | �?(�?Skills) | �?8 类型 | �?| �?拖拽安装 |
| **安全沙盒** | ⚠️ 工作目录限制 | �?6 层纵深防�?| ⚠️ 基础 | �?双层隔离 |
| **IM 集成** | �?| �?6 平台扫码绑定 | �?飞书/钉钉/微信 | �?Telegram/飞书/QQ/微信 |
| **记忆系统** | �?基础命名空间 | �?双模+关系图谱 | �?基础 | �?基础 |
| **知识�?RAG** | �?完整 | �?| �?| �?|
| **定时任务** | �?| �?Cron+心跳 | �?| �?Cron+心跳 |
| **主动引擎** | �?| �?主动问�?跟进 | ⚠️ 设计阶段 | �?|
| **人格/角色** | ⚠️ role_prompts | �?8 种人�?| �?| �?人格系统 |
| **工作区隔�?* | ⚠️ Agent 工作目录 | �?| �?每工作区独立配置 | �?书桌设计 |
| **API 网关** | �?完整 | �?| �?| �?|
| **语音输入** | �?(计划�? | �?| �?全局语音 | �?|
| **移动�?* | �?| �?PWA+原生 | �?| �?PWA |
| **计划模式** | �?| �?自动分解+跟踪 | ⚠️ Agent SDK 内建 | �?|
| **资源预算** | �?| �?Token/费用/时长限制 | �?| �?|
| **对话分支** | �?| �?| �?| �?|
| **消息版本** | �?| �?| �?| �?|
| **数据加密** | �?AES-256 | ⚠️ | �?safeStorage | ⚠️ |
| **MCP 协议** | �?stdio+HTTP | �?3 种传�?| �?| �?|
| **绘图/图片生成** | �?DALL·E | �?20+媒体插件 | �?| �?|
| **国际�?* | �?11 语言 | �?双语 | �?| �?5 语言 |

**wiseSpace 的独特优势（竞品不具备）�?*

- **完整 API 网关**：作�?CLI 工具统一后端，竞品无此能�?- **对话分支 + 消息版本**：独有的对话回溯能力
- **AES-256 加密**：最完备的本地数据安�?- **知识�?RAG**：Proma/OpenHanako 无此能力
- **Mermaid/D2 图表渲染**：开发者友好的内容呈现

---

## 3. 优化建议（按优先级排列）

### 3.1 P0 �?高价值、高可行�?
#### 3.1.1 �?Agent 协作框架

**借鉴来源**：OpenAkita 组织编排 + Proma SubAgent + OpenHanako �?Agent 群聊

**wiseSpace 现状**：单 Agent 模式，无法并行处理复杂任�?
**建议方案**�?- 第一阶段：实�?**SubAgent 委托**——Agent 可将子任务委托给其他 Agent（类�?Proma 通过 Claude Agent SDK�?- 第二阶段：引�?**Agent 面板**——在 UI 中可视化多个 Agent 的运行状�?- 第三阶段�?*角色�?Agent**——允许用户定义预设角�?Agent（架构师/测试/文档），按需调度

**关键设计�?*�?```
AgentOrchestrator (src-tauri/crates/agent/)
├── task_decomposer    # 任务自动分解
├── agent_pool         # Agent 实例池（LRU 淘汰�?├── dispatcher         # 按能力匹�?Agent �?任务
├── result_merger      # 子任务结果合�?└── resource_tracker   # Token/时间/费用预算
```

**与现有架构的契合�?*：高。wiseSpace 已有 `agent_profiles`、`agent_runs`、`agent_tasks` 等数据库实体，多 Agent 框架是对现有基础设施的自然扩展�?
---

#### 3.1.2 插件系统

**借鉴来源**：OpenAkita 8 类型插件 + 生命周期钩子 + OpenHanako 拖拽安装 + PluginContext

**wiseSpace 现状**：仅�?Skills 系统，无通用扩展机制

**建议方案**�?- �?Skills 系统基础上扩展为 **通用插件架构**
- 插件类型：Tool / Channel / RAG Source / Memory Backend / LLM Provider / Hook
- 采用 OpenAkita �?`plugin.json` manifest 声明式规�?- 三级权限模型：Basic（自动授予）/ Advanced（安装时确认�? System（逐项手动授权�?- 自动故障隔离：单插件错误数超阈值自动禁�?
**关键设计�?*�?```
plugins/
├── manifest.json        # 插件声明（类�?权限/钩子/版本�?├── index.ts             # 插件入口
└── src/
```

**与现有架构的契合�?*：高。现有的 Skills 系统可视为插件的一种——Skill 类型。引�?plugin manifest 后，Skills/MCP/Tools 都可以统一为插件�?
---

#### 3.1.3 安全沙盒增强

**借鉴来源**：OpenAkita 6 层纵深防�?+ OpenHanako 双层隔离

**wiseSpace 现状**：仅工作目录限制 + 路径安全检查（`agent/security.rs`�?
**建议方案**�?```
L1 路径分区    �?已有（可增强�?workspace / controlled / protected / forbidden 四级�?L2 确认闸门    �?已有（三级权�?UI�?L3 命令拦截    🆕 新增危险命令黑名单（regedit, format, rm -rf 等）
L4 文件快照    🆕 写入前自�?checkpoint，支持回�?L5 自保�?     🆕 核心目录锁定（~/.wisespace/, src-tauri/ 等）
L6 OS 级沙�?  🆕 Linux bwrap / macOS seatbelt / Windows MIC
```

**实施路线**�?- L3 命令拦截：风险最低，通过正则黑名单匹配，可直接在 `agent/security.rs` 中实�?- L4 文件快照：写入前复制原文件到临时目录，利用现�?`tempfile` 依赖
- L5 自保护：利用 Tauri �?`fs` 插件权限限制
- L6 OS 沙盒：利�?Rust �?`std::process::Command` 配合平台特定沙盒工具

---

### 3.2 P1 �?中高价�?
#### 3.2.1 IM 与远程桥�?
**借鉴来源**：OpenAkita 扫码绑定 + Proma 飞书桥接 + OpenHanako 多平�?
**wiseSpace 现状**：无外部 IM 集成

**建议方案**�?- 第一阶段�?*飞书/Lark 桥接**（Proma 已验证的方案，开发者最常用�?- 第二阶段：微�?钉钉机器�?- 核心价值：用户可在手机上通过 IM 触发本机 Agent、接收运行结果通知

**实施要点**�?- 利用 wiseSpace 已有�?Gateway HTTP 服务器作�?Webhook 接收�?- 新增 `crates/gateway/src/bridge/` 模块处理桥接逻辑
- 借鉴 Proma �?`feishu-bridge.ts` 设计

---

#### 3.2.2 工作区隔离增�?
**借鉴来源**：Proma 工作区模�?+ OpenHanako 书桌设计

**wiseSpace 现状**：Agent 有工作目录概念，�?Skills/MCP/文件不按工作区隔�?
**建议方案**�?```
workspaces/
└── {workspace-slug}/
    ├── workspace-files/   # 工作区文件（Agent 可读写）
    ├── mcp.json           # 本工作区 MCP 配置
    ├── skills/            # 本工作区专属 Skills
    └── desk/              # 异步协作区（借鉴 OpenHanako 书桌�?        ├── notes/         # 笺（便签，Agent 主动读取并执行）
        └── inbox/         # 待处理条�?```

**与现有架构的契合�?*：中。需要在 `conversations` �?`agent_sessions` 表增�?`workspace_id` 外键�?
---

#### 3.2.3 主动引擎（Proactive Engine�?
**借鉴来源**：Proma Erlich �?Proactive 思路 + OpenAkita 主动问�?跟进

**wiseSpace 现状**：纯被动响应模式

**建议方案**�?- 采用 Proma �?**极简 Proactive 模型**——三层行为：
  1. **User Profile**：极短用户画像（职业、当前工作、偏好，<500 字），随每次对话自动更新
  2. **偏好推理**：Agent 基于 Profile + 当前上下文判断是否需要主动行�?  3. **定时/心跳触发**：Cron 定时巡检，发现可执行任务时通过通知推送给用户

**关键原则**（来�?Erlich 的洞察）�?- 不做过度复杂的记忆推理——让模型自己推理比硬编码规则效果�?- 主动性的关键是低摩擦：用户一眼就能判断是否让 Agent 执行
- 把可流程化的内容引导�?Skills，而非依赖模糊记忆

---

#### 3.2.4 定时任务系统

**借鉴来源**：OpenAkita Cron 调度 + OpenHanako 定时任务+心跳

**wiseSpace 现状**：无

**建议方案**�?- 基于 Tokio Cron 实现轻量调度�?- 预设模板：每日代码审查、依赖更新检查、服务器状态巡检
- 与主动引擎联动：定时任务触发 �?Agent 执行 �?结果推送到通知/IM

---

### 3.3 P2 �?值得关注、可延后

#### 3.3.1 记忆系统增强

**借鉴来源**：OpenAkita 双模记忆 + MDRM 关系图谱

**wiseSpace 现状**：基础命名空间记忆

**建议方向**�?- 增加内存类型标签（事�?偏好/技�?错误/规则/人格特征/经验�?- 多路径检索：语义 + 全文 + 时间 + 附件搜索
- 3D 可视化记忆图谱（长期目标�?
#### 3.3.2 内置引导技能（Proma Coach 模式�?
**借鉴来源**：Proma �?Proma Coach

�?wiseSpace 创建一个内�?`@wisespace/coach` Skill，帮助用户：
- 根据最近工作上下文推荐最佳实�?- 识别可流程化的重复工作，引导创建 Skills
- �?Agent 执行失败时提供改进建�?
#### 3.3.3 全局语音输入

**借鉴来源**：Proma 的全局语音（Ctrl+` 快捷键，应用内外均可输入�?
利用现有�?WebRTC 实时语音计划基础设施（README 中提�?即将推出"），扩展为全局快捷键语音输入�?
#### 3.3.4 资源预算与用量追�?
**借鉴来源**：OpenAkita 的资源预算系�?
在现有成本追踪基础上增加硬限制：单次任�?Token 上限、时长上限、工具调用次数上限、每日总费用上限�?
#### 3.3.5 Chat/Agent 模式显式分界

**借鉴来源**：Proma �?Chat vs Agent 模式设计

当前 wiseSpace 通过"Agent 模式"开关切换，可借鉴 Proma 使其更明确：
- Chat 模式：纯对话，轻量快�?- Agent 模式：文�?命令/工具访问，需要审批流�?- �?UI 中明确展示当前模式及可用能力

---

## 4. 架构层面可借鉴的设计模�?
### 4.1 PluginContext 注入模式（OpenHanako�?
插件通过统一 `PluginContext` 访问核心服务，避免直接依赖：

```rust
// 可参考在 wisespace-agent 中实�?pub struct PluginContext {
    pub agent_session: AgentSessionHandle,
    pub file_system: SandboxedFileSystem,
    pub event_bus: EventBus,
    pub permissions: PermissionSet,
}
```

### 4.2 Session Bus 通信模式（OpenHanako�?
插件�?Agent 会话通过事件总线通信，而非直接调用�?
```
Plugin �?SessionBus.emit('tool:request', payload)
SessionBus �?Agent �?SessionBus.emit('tool:result', payload)
SessionBus �?Plugin.onToolResult(payload)
```

### 4.3 Agent 实例池（OpenAkita�?
```
AgentPool {
    instances: LRU Cache<AgentId, AgentInstance>,
    max_size: 10,
    idle_timeout: 300s,
}
```

�?wiseSpace 而言，当前单 Agent 模式下实例池意义不大，但在引入多 Agent 协作用后将是关键组件�?
### 4.4 文件快照回滚（OpenAkita�?
�?Agent 写入文件前自动创建快照，出错时可回滚�?
```rust
// 可加�?agent/security.rs
fn write_with_snapshot(path: &Path, content: &[u8]) -> Result<()> {
    let snapshot = create_snapshot(path)?;
    match fs::write(path, content) {
        Ok(_) => Ok(()),
        Err(e) => {
            restore_snapshot(&snapshot, path)?;
            Err(e)
        }
    }
}
```

---

## 5. 实施路线图建�?
```
Q3 2026 (短期):
├── P0: �?Agent 协作框架（SubAgent 委托�?├── P0: 安全沙盒增强（L3 命令拦截 + L4 文件快照�?├── P1: 内置引导技�?@wisespace/coach
└── P1: 定时任务系统（基础 Cron 调度�?
Q4 2026 (中期):
├── P0: 插件系统（从 Skills 扩展为通用插件架构�?├── P1: IM 桥接（飞书优先）
├── P1: 工作区隔离增�?└── P1: 主动引擎（极简 Proactive 模型�?
2027 Q1 (长期):
├── P0: OS 级沙盒（L6�?├── P2: 记忆系统增强
├── P2: 全局语音输入
└── P2: Chat/Agent 模式显式分界
```

---

## 6. 根本差异�?wiseSpace 的定位思�?
三个竞品虽然在具体功能上各有特色，但 wiseSpace 有几点根本性的差异使其在生态位上独树一帜：

1. **API 网关**�?wiseSpace 的护城河——竞品专注于"消费 AI"，wiseSpace 同时�?AI 能力的分发�?。在其他 CLI 工具（Claude Code、Codex、Gemini CLI）需要各自配�?API Key 时，wiseSpace �?Gateway 统一管理所有密钥和用量�?
2. **Rust 后端**提供了竞品不具备的系统级能力——文件加密、向量存储、安全沙盒、高性能并发——这些在 Electron/Node.js 生态中实现成本极高�?
3. **对话分支与消息版�?*是开发者友好的差异化能力，竞品均不具备�?
4. 竞品分析揭示了一个关键趋势：**Agent 正在�?单兵作战"转向"团队协作"**。wiseSpace 当前架构�?Agent 基础设施已经为此做好了准备——`agent_profiles`、`agent_runs`、`agent_tasks` 等数据库实体就是�?Agent 编排的土壤�?
**核心建议**：wiseSpace 不应追逐竞品的每项功能，而应**�?API 网关 + Rust 系统能力为底盘，向上构建�?Agent 协作和插件生�?*。竞品的 IM 集成、主动引擎和人格系统可以作为增强层逐步引入�?
