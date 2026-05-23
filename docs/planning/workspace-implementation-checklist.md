# wiseSpace Workspace Implementation Checklist

> This document turns the workspace audit into an execution-oriented checklist.
> It is intentionally concrete: schema, repo, command, frontend, and migration
> impacts are called out so the work can be delivered in small safe steps.
>
> Related docs:
> - `docs/planning/workspace-scope-audit.md`
> - `docs/research/COMPETITOR_DECISION_ROADMAP.md`
> - `docs/agent/local-agent-first-roadmap.md`

---

## 1. Outcome We Want

After this track, wiseSpace should behave as if:

- a workspace is the main container for ongoing work
- one or more conversations can belong to the same workspace
- agent profiles, runs, sessions, and tasks are grouped by workspace
- MCP, knowledge, memory, and later extensions are attached through workspace
  bindings instead of only through conversation fields

This track is complete only when workspace is no longer "just a path".

---

## 2. Implementation Strategy

Use a staged migration approach:

1. add workspace identity without breaking current behavior
2. backfill workspace ids from existing conversation and agent data
3. add workspace-aware reads and writes
4. move reusable bindings out of the conversation row
5. replace the stub workspace snapshot API with a real projection

Do not try to finish all workspace cleanup in one schema migration.

---

## 3. Phase 1: Introduce Workspace Identity

### 3.1 Database Migration

Add a new migration after the current latest migration set.

New table:

- `workspaces`

Suggested columns:

- `id: string primary key`
- `slug: string unique`
- `name: string`
- `root_path: string`
- `source: string`
- `created_at: string or i64`
- `updated_at: string or i64`

Add nullable `workspace_id` columns to:

- `conversations`
- `agent_profiles`
- `agent_runs`
- `agent_sessions`
- `agent_tasks`
- optional `stored_files`

Add indexes for:

- `idx_conversations_workspace`
- `idx_agent_profiles_workspace`
- `idx_agent_runs_workspace`
- `idx_agent_sessions_workspace`
- `idx_agent_tasks_workspace`
- optional `idx_stored_files_workspace`

### 3.2 Backfill Rules

Backfill existing data conservatively.

Rules:

- create one workspace row per existing conversation by default
- derive `root_path` from the existing conversation workspace directory
- set `conversations.workspace_id` to the new row
- set `agent_profiles.workspace_id` using `conversation_id`
- set `agent_runs.workspace_id` using `conversation_id`
- set `agent_sessions.workspace_id` using `conversation_id`
- set `agent_tasks.workspace_id` only when `conversation_id` is available

Important:

- do not delete `workspace_root` or `cwd` yet
- do not remove existing conversation-level enabled binding fields yet

### 3.3 Core Entity Updates

Add a new entity:

- `src-tauri/crates/core/src/entity/workspaces.rs`

Update existing entities:

- `conversations.rs`
- `agent_profiles.rs`
- `agent_runs.rs`
- `agent_sessions.rs`
- `agent_tasks.rs`
- optional `stored_files.rs`

Add new relations where useful, but avoid over-modeling if the repos do not use
 relation traversal yet.

---

## 4. Phase 2: Repo Layer Support

### 4.1 New Repo Module

Add:

- `src-tauri/crates/core/src/repo/workspace.rs`

Initial responsibilities:

- create workspace
- get workspace by id
- get workspace by conversation id
- list workspaces
- ensure canonical workspace for conversation

### 4.2 Conversation Repo

Update:

- `src-tauri/crates/core/src/repo/conversation.rs`

Tasks:

- include `workspace_id` in the `Conversation` type
- set `workspace_id` during conversation creation
- expose workspace-aware list / fetch behavior as needed

Important note:

- existing fields like `enabled_mcp_server_ids` stay for compatibility in this
  phase

### 4.3 Agent Repos

Update:

- `agent_profile.rs`
- `agent_run.rs`
- `agent_session.rs`

Tasks:

- pass through `workspace_id`
- ensure profile and run creation use canonical workspace identity
- keep `workspace_root` and `cwd` as runtime convenience fields for now

### 4.4 Stored File Repo

Update:

- `stored_file.rs`

Tasks:

- optionally add `workspace_id` assignment for files created from workspace
  flows
- preserve conversation attachment behavior

---

## 5. Phase 3: Type and Command Surface

### 5.1 Core Shared Types

Update:

- `src-tauri/crates/core/src/types.rs`

Add:

- `Workspace`
- `WorkspaceBindingSnapshot` or equivalent projection type
- `workspace_id` on:
  - `Conversation`
  - `AgentProfile`
  - `AgentRun`
  - `AgentSession`
  - `AgentTask`
  - optional file types

### 5.2 New Commands

Add a new commands file:

- `src-tauri/src/commands/workspaces.rs`

Suggested first commands:

- `list_workspaces`
- `get_workspace`
- `get_workspace_by_conversation`
- `rename_workspace`
- `attach_conversation_to_workspace`

Register these in:

- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`

### 5.3 Existing Command Updates

Update:

- `conversations.rs`
- `agent.rs`
- `branches.rs`
- possibly `files.rs`

Tasks:

- ensure conversation creation returns workspace identity
- ensure agent profile / ensure-workspace flows operate on canonical workspace
- replace the stub snapshot commands in `branches.rs` with real workspace-backed
  reads

---

## 6. Phase 4: Workspace Binding Tables

Do this only after workspace identity is stable.

### 6.1 New Binding Tables

Suggested tables:

- `workspace_mcp_bindings`
- `workspace_knowledge_bindings`
- `workspace_memory_bindings`

Suggested columns:

- `id`
- `workspace_id`
- referenced target id
- `enabled`
- optional `sort_order`
- timestamps if useful

This preserves:

- global definitions in `mcp_servers`, `knowledge_bases`, `memory_namespaces`
- workspace-level enablement and defaults

### 6.2 Compatibility Policy

During transition:

- keep reading conversation-level `enabled_*` fields
- prefer workspace bindings when they exist
- write both only if needed for temporary compatibility

Add an explicit cleanup milestone later to retire the old conversation-owned
binding fields.

---

## 7. Phase 5: Real Workspace Snapshot

### 7.1 Replace Stub API

Current issue:

- `src-tauri/src/commands/branches.rs`
  - `get_workspace_snapshot`
  - `update_workspace_snapshot`

These are currently placeholders.

Replace them with a real projection built from:

- workspace bindings
- conversation-local overrides
- pinned artifact ids
- search / research state

### 7.2 Define Source of Truth

Recommended split:

- workspace owns reusable bindings and defaults
- conversation owns local overrides and transient UI state

This prevents the workspace system from becoming just another duplicate of
conversation preferences.

---

## 8. Frontend Implementation Checklist

### 8.1 Types

Update:

- `src/types/index.ts`
- `src/types/agent.ts`
- `src/types/workspace.ts`

Add:

- `Workspace`
- `workspaceId` fields where needed
- workspace binding snapshot types if the backend exposes them directly

### 8.2 Stores

Priority stores to update:

- `conversationStore.ts`
- `agentStore.ts`
- `fileStore.ts`
- `knowledgeStore.ts`
- `memoryStore.ts`
- `mcpStore.ts`
- `chatWorkspaceStore.ts`

Recommended change:

- `chatWorkspaceStore.ts` should evolve from UI-only artifact comparison state
  into a real workspace view/store, or be replaced by a more clearly named
  workspace domain store

### 8.3 Chat UI

Priority components:

- `InputArea.tsx`
- `ChatInspector.tsx`
- `ChatSidebar.tsx`
- `ContextBar.tsx`

Tasks:

- show workspace identity, not only cwd path
- clarify when a conversation is reusing an existing workspace
- expose workspace-scoped context sources more coherently

### 8.4 Files UI

Priority:

- evolve Files toward a workspace asset center

This should eventually show:

- files attached to the workspace
- promoted artifacts
- generated outputs
- possibly a future desk / inbox concept

---

## 9. Proposed Commit Sequence

Keep the rollout small and reviewable.

### Commit 1

`feat(workspace): add workspace entity and foreign keys`

Scope:

- migration
- new entity
- type additions

### Commit 2

`feat(workspace): backfill canonical workspace identity into conversation and agent repos`

Scope:

- repo updates
- workspace creation / ensure logic

### Commit 3

`feat(workspace): expose workspace commands and frontend types`

Scope:

- commands
- TS types
- basic store support

### Commit 4

`feat(workspace): replace stub snapshot reads with real workspace projection`

Scope:

- snapshot commands
- conversation + workspace projection logic

### Commit 5

`feat(workspace): add workspace binding tables for MCP, knowledge, and memory`

Scope:

- migrations
- binding repos
- compatibility reads

### Commit 6

`feat(files): evolve files into workspace asset center`

Scope:

- stored files
- file UI
- artifact promotion hooks

---

## 10. Risks to Watch

- silently duplicating workspace identity between path fields and ids
- mixing workspace defaults with conversation-local overrides
- over-eagerly migrating binding logic and breaking current chat behavior
- making Files more complicated before workspace identity is stable
- renaming frontend stores too early and causing noisy churn

---

## 11. Acceptance Criteria

This track is in good shape when:

- every conversation has a canonical workspace identity
- agent profile / run / session / task records can be grouped by workspace
- workspace snapshot APIs are backed by real data
- MCP / knowledge / memory can be attached at workspace scope
- the UI can present workspace as more than a raw path string

That is the minimum bar before starting serious subagent or multi-agent work.
