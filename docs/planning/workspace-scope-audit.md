# wiseSpace Workspace Scope Audit

> This audit translates the current architecture into a concrete list of what
> is already workspace-aware, what is only conversation-scoped, and what should
> become truly workspace-scoped next.
>
> Audit date: 2026-05-23
>
> Related docs:
> - `docs/project/ARCHITECTURE.md`
> - `docs/agent/local-agent-first-roadmap.md`
> - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

---

## 1. Executive Summary

wiseSpace already has a real filesystem-level workspace concept, but not yet a
full product-level workspace model.

Today, the dominant pattern is:

- conversation owns the working context
- agent profile and agent run inherit a `workspace_root` path
- knowledge, memory, MCP, and skills are mostly global records that get enabled
  per conversation

That means `workspace` exists mostly as:

- a directory under `Documents/wisespace/workspace/`
- a conversation snapshot concept
- an agent cwd concept

It does **not** yet exist as a first-class domain entity that consistently
organizes:

- conversations
- runs
- files
- context bindings
- reusable tools / skills / MCP configuration

---

## 2. What Already Exists

### 2.1 Filesystem-Level Workspace

The storage layer already has a durable workspace root:

- `storage_paths::workspace_root()`
- `storage_paths::conversation_workspace_dir(conversation_id)`

This means the documents root already supports a stable user-visible workspace
tree. That is a strong base and should be preserved.

### 2.2 Agent Workspace Paths

The agent system already carries workspace paths in several places:

- `agent_profiles.workspace_root`
- `agent_runs.workspace_root`
- `agent_sessions.cwd`

The current runtime also ensures workspace directories exist before local or
DeepSeek-TUI runs.

This is useful, but the model is still path-centric rather than entity-centric.

### 2.3 Conversation Snapshot Intent

The frontend already has a `ConversationWorkspaceSnapshot` shape covering:

- search policy
- tool binding
- knowledge binding
- memory policy
- pinned artifacts
- research mode

This is evidence that the product already wants a richer workspace abstraction.

---

## 3. Current Gaps

### 3.1 Workspace Is Not a First-Class Database Entity

There is no `workspaces` table today.

Instead, workspace-like state is spread across:

- `conversations.workspace_snapshot_json`
- `conversations.enabled_mcp_server_ids`
- `conversations.enabled_knowledge_base_ids`
- `conversations.enabled_memory_namespace_ids`
- `agent_profiles.workspace_root`
- `agent_runs.workspace_root`

This makes workspace behavior harder to reuse across multiple conversations or
multiple runs.

### 3.2 Conversation Still Owns Too Much Context

The `conversations` table currently acts as:

- chat container
- search policy container
- MCP binding container
- knowledge binding container
- memory binding container
- branch / artifact container

That is too much responsibility for one entity if workspace is supposed to
become the main organizing model.

### 3.3 Workspace Snapshot APIs Are Not Yet the Real Source of Truth

Frontend store code loads and updates workspace snapshots, but the Tauri
commands in `src-tauri/src/commands/branches.rs` currently return stub data.

So the workspace snapshot layer is only partially productized today.

### 3.4 Global Resources and Workspace Resources Are Mixed

These records are global today:

- `mcp_servers`
- `knowledge_bases`
- `memory_namespaces`
- `skill_states`

That is acceptable for the base definitions, but the product still needs a
workspace-level binding model on top of them.

---

## 4. Entity Audit

### 4.1 Should Become Workspace-Owned

These entities should gain direct workspace ownership or explicit workspace
identity.

#### `workspaces` (new)

This table does not exist yet and should become the root entity.

Suggested baseline fields:

- `id`
- `slug`
- `name`
- `root_path`
- `created_at`
- `updated_at`
- `source`

#### `conversations`

Current state:

- primary chat entity
- stores enabled knowledge/MCP/memory ids directly
- stores `workspace_snapshot_json`

Recommended change:

- add `workspace_id`
- move reusable workspace bindings out of the conversation row
- keep conversation-specific UI state on the conversation

#### `agent_profiles`

Current state:

- bound to `conversation_id`
- stores `workspace_root`

Recommended change:

- add `workspace_id`
- keep `workspace_root` only as a denormalized runtime convenience if needed

#### `agent_runs`

Current state:

- bound to `conversation_id`
- stores `workspace_root`

Recommended change:

- add `workspace_id`
- use it for task center grouping, recovery, and future subagent delegation

#### `agent_sessions`

Current state:

- bound to `conversation_id`
- stores `cwd`

Recommended change:

- add `workspace_id`
- treat `cwd` as runtime state, not the main identity

#### `agent_tasks`

Current state:

- optional `conversation_id`
- external-agent task oriented

Recommended change:

- add `workspace_id`
- allow workspace-scoped external execution history even when conversation
  linkage is weak or absent

### 4.2 Should Stay Conversation-Owned for Now

These entities are still best modeled under conversation, but should become
workspace-queryable through joins.

#### `messages`

- keep conversation-owned
- derive workspace through `conversation -> workspace`

#### `context_sources`

- keep message / conversation affinity
- derive workspace through the parent conversation

#### `artifacts`

- keep conversation-owned initially
- later allow optional promotion into workspace assets if needed

#### `tool_executions`

- keep conversation-owned initially
- expose workspace views through joins

### 4.3 Should Remain Global Definitions with Workspace Bindings

These should not be copied into per-workspace duplicate records by default.

#### `mcp_servers`

- keep as global server definitions
- add a workspace binding table such as `workspace_mcp_servers`

#### `knowledge_bases`

- keep as global base definitions
- add a workspace binding table such as `workspace_knowledge_bases`

#### `memory_namespaces`

- keep as namespace definitions
- add workspace binding / default-selection behavior on top

#### `skill_states`

- current table is too global for future workspace behavior
- likely evolve toward a workspace binding table or a broader extension state
  table

### 4.4 Needs Clarification Before Schema Changes

#### `stored_files`

Current state:

- optional `conversation_id`
- no explicit workspace identity

Recommended direction:

- add optional `workspace_id`
- allow files to exist at:
  - conversation scope
  - workspace scope
  - shared/global imported scope if needed later

This table is an important bridge for making Files become the workspace asset
center.

---

## 5. Product-Level Model to Aim For

The target model should look more like this:

```text
workspace
├── conversations
├── agent profiles
├── agent runs / sessions / tasks
├── workspace files and promoted artifacts
├── MCP bindings
├── knowledge bindings
├── memory bindings
└── future extension bindings
```

That keeps the product coherent while still allowing conversation-level detail.

---

## 6. Recommended Schema Direction

### Phase 1: Introduce Workspace Identity

Add:

- `workspaces`
- `conversations.workspace_id`
- `agent_profiles.workspace_id`
- `agent_runs.workspace_id`
- `agent_sessions.workspace_id`
- `agent_tasks.workspace_id`
- optional `stored_files.workspace_id`

### Phase 2: Move Bindings Out of Conversation

Introduce binding tables such as:

- `workspace_mcp_bindings`
- `workspace_knowledge_bindings`
- `workspace_memory_bindings`
- later `workspace_extension_bindings`

At that point, `conversations.enabled_*` fields can become compatibility fields
or eventually be retired.

### Phase 3: Make Snapshot Real

Replace the current stub workspace snapshot commands with a real read/write
projection built from:

- workspace bindings
- conversation-local overrides
- pinned artifact state
- research mode / search mode state

---

## 7. Highest-Value Implementation Order

If we want the smallest useful path first, the recommended order is:

1. add a `workspaces` table and `workspace_id` to conversations
2. wire conversation creation and agent profile creation to a canonical
   workspace row
3. add `workspace_id` to runs, sessions, and tasks
4. define workspace binding tables for MCP / knowledge / memory
5. replace stub snapshot APIs with a real workspace projection
6. extend `stored_files` and Files UI into a workspace asset center

This gives wiseSpace a real workspace backbone before adding bigger features
like subagents or a general extension marketplace.

---

## 8. Main Findings

- wiseSpace is already filesystem-ready for workspace-first design.
- wiseSpace is not yet database-modeled around workspace.
- conversation currently owns too much reusable context.
- agent workspace support exists, but mostly as path state.
- the next architecture move should be `workspace entity + workspace bindings`,
  not multi-agent orchestration first.
