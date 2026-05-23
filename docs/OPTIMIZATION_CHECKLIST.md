# wiseSpace Optimization Checklist

> Last updated: 2026-05-24
>
> This is the top-level optimization tracker for wiseSpace.
>
> Usage rules:
> - treat this file as the default optimization backlog and progress tracker
> - read this file before starting major architecture or product optimization work
> - the Chinese version is the primary maintained tracker
> - this English file is a synchronized mirror and should stay aligned when practical
> - when an item is completed, update its status here
> - when an item is partially delivered, update the notes and split follow-up work
>
> Status legend:
> - `pending`: not started
> - `in_progress`: currently being implemented
> - `done`: completed
> - `deferred`: intentionally postponed

Related docs:

- [project/ARCHITECTURE.md](./project/ARCHITECTURE.md)
- [planning/workspace-scope-audit.md](./planning/workspace-scope-audit.md)
- [planning/workspace-implementation-checklist.md](./planning/workspace-implementation-checklist.md)
- [planning/workspace-schema-draft.md](./planning/workspace-schema-draft.md)
- [planning/workspace-code-change-map.md](./planning/workspace-code-change-map.md)
- [research/COMPETITOR_DECISION_ROADMAP.md](./research/COMPETITOR_DECISION_ROADMAP.md)

---

## P0. Core Backbone

### 1. Workspace First

- Status: `done`
- Goal: make `workspace` the main long-lived container instead of overloading
  `conversation`
- Scope:
  - add `workspaces` entity
  - add `workspace_id` to conversation and agent records
  - establish canonical workspace identity in repo and command layers
- Current progress:
  - relationship model documented
  - scope audit and implementation checklist completed
  - schema draft and migration guidance completed
  - code change map completed; next step can move into migration / entity implementation
  - workspace identity foundation migration completed
  - `workspaces` entity added and related entities now include `workspace_id`
  - repo / command workspace identity chain connected for conversation, agent,
    and stored file main flows
  - canonical workspace identity now self-heals for existing conversations,
    and propagates `workspace_id` into related agent/task/file records
  - workspace command surface now supports listing, lookup by conversation,
    rename, and attaching a conversation to an existing workspace
  - shared or manually renamed workspaces are protected from accidental
    conversation-title-driven metadata overwrites
- Source:
  - `docs/project/ARCHITECTURE.md`
  - `docs/planning/workspace-scope-audit.md`

### 2. Clarify Chat vs. Agent

- Status: `done`
- Goal: keep ordinary chat lightweight while making execution flows explicit
- Scope:
  - position chat as a workspace thread
  - position agent run as workspace execution history
  - reduce ambiguity in UI and state transitions
- Current progress:
  - InputArea now exposes an explicit mode boundary summary for chat vs. agent
  - agent conversations are visibly tagged in the sidebar instead of blending
    into ordinary chat threads
  - ChatInspector now shows mode, execution boundary, workspace, and runtime
    details in one place
- Source:
  - `docs/project/ARCHITECTURE.md`

### 3. Make Workspace Snapshot Real

- Status: `done`
- Goal: replace snapshot placeholder behavior with real workspace-backed
  projection data
- Scope:
  - replace stub snapshot commands
  - define source of truth between workspace defaults and conversation overrides
  - expose stable frontend types and store behavior
- Current progress:
  - `get_workspace_snapshot` now returns a real projection from persisted
    conversation state
  - `update_workspace_snapshot` now writes back to conversation preference
    fields and `workspace_snapshot_json`
  - frontend store invocation and browser mock were aligned with the real shape
- Source:
  - `docs/planning/workspace-implementation-checklist.md`

### 4. Move Reusable Context Bindings to Workspace Scope

- Status: `done`
- Goal: stop storing reusable MCP / knowledge / memory enablement only on the
  conversation row
- Scope:
  - add workspace binding tables
  - support compatibility reads during migration
  - migrate frontend context behavior to workspace-aware reads
- Current progress:
  - workspace binding tables for MCP / knowledge / memory are being introduced
  - conversation repo now syncs workspace bindings from conversation-owned
    compatibility fields
  - snapshot projection prefers workspace bindings when available, while
    remaining compatible with legacy conversation rows
  - chat runtime paths now prefer workspace bindings for RAG and MCP tool
    resolution, while still honoring explicit conversation-level overrides
  - frontend binding controls now read and write through workspace snapshot
    state, and browser-mode mocks now persist per-conversation snapshots
  - search preference hydration and writes now also flow through
    `workspaceSnapshot.searchPolicy`, reducing one more legacy
    conversation-only context path
  - shared frontend context derivation helpers now keep InputArea and
    ChatInspector aligned, including fallback behavior before a snapshot load
  - research mode and tool approval state are now part of the shared
    workspace-derived context view used by inspector and input surfaces
  - regression coverage now includes workspace snapshot hydration, workspace
    binding writes, rollback behavior, and updated InputArea store mocks
- Source:
  - `docs/planning/workspace-scope-audit.md`
  - `docs/planning/workspace-implementation-checklist.md`

### 5. Productize the Safety Model

- Status: `done`
- Goal: make permission, path, and execution boundaries visible and
  understandable to users
- Scope:
  - surface execution boundaries in UI
  - improve command/file safety affordances
  - make recovery and auditability easier
- Current progress:
  - InputArea now surfaces workspace execution boundaries and workspace-level
    tool approval policy beside agent permission controls
  - ChatInspector now summarizes permission mode, tool approval mode,
    research mode, and workspace path/binding context
  - existing approval cards remain the detailed runtime layer, while the
    surrounding UI now makes the policy model visible before execution starts
- Source:
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

---

## P1. Capability Organization

### 6. Unify the Extension Model

- Status: `pending`
- Goal: organize `skills`, `MCP`, `tools`, `external connectors`, and future UI
  contributions under a shared model
- Scope:
  - define contribution / manifest shape
  - define lifecycle and permissions
  - avoid parallel extension systems growing independently
- Source:
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### 7. Evolve Files into a Workspace Asset Center

- Status: `pending`
- Goal: make Files the durable asset hub for a workspace, not just an
  attachment list
- Scope:
  - workspace-scoped files
  - promoted artifacts and generated outputs
  - cleaner asset browsing and reuse
- Source:
  - `docs/planning/workspace-implementation-checklist.md`

### 8. Converge Store Structure Around Workspace

- Status: `pending`
- Goal: reduce fragmented page-first state and improve workspace-centric state
  composition
- Scope:
  - review conversation, agent, file, knowledge, memory, and workspace stores
  - reduce duplicated context state
  - improve naming where "workspace" currently means only partial UI state
- Source:
  - `docs/project/ARCHITECTURE.md`
  - `docs/planning/workspace-implementation-checklist.md`

### 9. Improve Onboarding and Diagnostics

- Status: `pending`
- Goal: make advanced capabilities easier to understand and safer to troubleshoot
- Scope:
  - first-run guidance
  - context explanation
  - diagnostics and recovery entry points
- Source:
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### 10. Add Boundary and Contract Tests

- Status: `pending`
- Goal: protect workspace scope, snapshot, policy, and binding behavior from
  regressions
- Scope:
  - workspace scope tests
  - snapshot projection tests
  - sandbox / policy tests
  - binding compatibility tests
- Source:
  - `docs/planning/workspace-implementation-checklist.md`

---

## P2. Advanced Capability Track

### 11. SubAgent and Multi-Agent Collaboration

- Status: `deferred`
- Goal: add richer multi-agent execution only after workspace and binding
  foundations are stable
- Scope:
  - subagent orchestration
  - richer execution delegation
  - shared run context and recovery
- Source:
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### 12. Full Plugin Runtime and Isolation

- Status: `deferred`
- Goal: build a more complete plugin runtime after the unified extension model
  is defined
- Scope:
  - runtime isolation
  - plugin UI hosting
  - plugin health and compatibility management
- Source:
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### 13. Stronger Automation and Proactive Execution

- Status: `deferred`
- Goal: deepen assistant initiative after execution boundaries are clearer
- Scope:
  - proactive task suggestions
  - scheduled and resumable execution
  - richer task center behavior

### 14. Deeper Memory and Cross-Task Reuse

- Status: `deferred`
- Goal: improve long-range reuse only after workspace-level memory bindings are
  stable
- Scope:
  - smarter memory retrieval
  - reusable workspace context packs
  - cross-conversation continuity

### 15. Expand External Bridge Breadth

- Status: `deferred`
- Goal: broaden external integration after the internal host model is more
  stable
- Scope:
  - additional bridges
  - richer connector management
  - clearer bridge permissions

---

## Done So Far

### A. Docs Structure Cleanup

- Status: `done`
- Result:
  - reorganized `docs/` by purpose
  - added `docs/README.md` as the main docs index

### B. Competitor Decision Consolidation

- Status: `done`
- Result:
  - created `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### C. Workspace Scope Audit

- Status: `done`
- Result:
  - created `docs/planning/workspace-scope-audit.md`

### D. Workspace Implementation Checklist

- Status: `done`
- Result:
  - created `docs/planning/workspace-implementation-checklist.md`

### E. Architecture Relationship Diagram

- Status: `done`
- Result:
  - added workspace / chat / agent relationship model to
    `docs/project/ARCHITECTURE.md`

### F. Optimization Tracker Language Policy

- Status: `done`
- Result:
  - marked the Chinese optimization checklist as the primary maintained tracker
  - kept this English file as a synchronized mirror

### G. Workspace Schema Draft

- Status: `done`
- Result:
  - created `docs/planning/workspace-schema-draft.md`

### H. Workspace Code Change Map

- Status: `done`
- Result:
  - created `docs/planning/workspace-code-change-map.md`

### I. Auto Workspace Label Readability

- Status: `done`
- Result:
  - agent workspace display no longer exposes raw `conv-*` style generated folder names in the input bar
  - when a path looks system-generated, the UI now prefers the conversation title

### J. Readable Default Workspace Directories

- Status: `done`
- Result:
  - newly created default agent workspace directories now prefer a readable title-derived name
  - after the first title is generated, legacy `conv-*` default directories are migrated when safe
