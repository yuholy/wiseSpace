# wiseSpace Optimization Checklist

> Last updated: 2026-05-25
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
- [planning/extension-model-audit.md](./planning/extension-model-audit.md)
- [planning/extension-model-schema-draft.md](./planning/extension-model-schema-draft.md)
- [planning/subagent-delegation-foundation.md](./planning/subagent-delegation-foundation.md)
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

- Status: `done`
- Goal: organize `skills`, `MCP`, `tools`, `external connectors`, and future UI
  contributions under a shared model
- Scope:
  - define contribution / manifest shape
  - define lifecycle and permissions
  - avoid parallel extension systems growing independently
- Current progress:
  - completed a first audit of the existing Skills, MCP, and External Agent
    systems
  - documented the shared dimensions, current gaps, target contribution model,
    and phased rollout in `docs/planning/extension-model-audit.md`
  - drafted a first-pass shared schema for `ExtensionSummary`,
    contribution types, permission profiles, and adapter mappings in
    `docs/planning/extension-model-schema-draft.md`
  - added the shared frontend extension host types in `src/types/extension.ts`
    and wired them into the main `src/types/index.ts` export surface
  - added Rust-side unified extension DTOs plus a `list_extensions`
    aggregation command across Skills, MCP servers, and External Agents
  - added a unified `extensionStore` and an `Extensions` settings surface for
    shared health, permission, and source visibility
- Source:
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### 7. Evolve Files into a Workspace Asset Center

- Status: `done`
- Goal: make Files the durable asset hub for a workspace, not just an
  attachment list
- Scope:
  - workspace-scoped files
  - promoted artifacts and generated outputs
  - cleaner asset browsing and reuse
- Current progress:
  - Files page entries now include `workspaceId` and `workspaceName`
  - Files table now exposes a workspace column and workspace filter
  - file search now matches both asset names and workspace names
- Source:
  - `docs/planning/workspace-implementation-checklist.md`

### 8. Converge Store Structure Around Workspace

- Status: `done`
- Goal: reduce fragmented page-first state and improve workspace-centric state
  composition
- Scope:
  - review conversation, agent, file, knowledge, memory, and workspace stores
  - reduce duplicated context state
  - improve naming where "workspace" currently means only partial UI state
- Current progress:
  - introduced `extensionStore` as a shared capability-state entry point
  - moved workspace asset filter and visible-row derivation into `fileStore`,
    reducing component-local state duplication in Files
  - continued the workspace-aware state composition pattern beyond chat context
    and into capability/asset views
- Source:
  - `docs/project/ARCHITECTURE.md`
  - `docs/planning/workspace-implementation-checklist.md`

### 9. Improve Onboarding and Diagnostics

- Status: `done`
- Goal: make advanced capabilities easier to understand and safer to troubleshoot
- Scope:
  - first-run guidance
  - context explanation
  - diagnostics and recovery entry points
- Current progress:
  - added a unified `Extensions` settings entry point that explains the
    capability model in product language
  - added summary cards, health states, filters, and source-setting jump-offs
    so users can move from discovery to diagnosis quickly
- Source:
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### 10. Add Boundary and Contract Tests

- Status: `done`
- Goal: protect workspace scope, snapshot, policy, and binding behavior from
  regressions
- Scope:
  - workspace scope tests
  - snapshot projection tests
  - sandbox / policy tests
  - binding compatibility tests
- Current progress:
  - added frontend regression coverage for `extensionStore`,
    `ExtensionsSettings`, and workspace-aware `fileStore` behavior
  - added Rust-side tests for unified extension summaries and workspace-name
    file search behavior
- Source:
  - `docs/planning/workspace-implementation-checklist.md`

---

## P2. Advanced Capability Track

### 11. SubAgent and Multi-Agent Collaboration

- Status: `done`
- Goal: add richer multi-agent execution only after workspace and binding
  foundations are stable
- Scope:
  - subagent orchestration
  - richer execution delegation
  - shared run context and recovery
- Current progress:
  - introduced a first delegation foundation doc in
    `docs/planning/subagent-delegation-foundation.md`
  - upgraded `agent_tasks` to persist parent run / parent task linkage,
    assignee metadata, and delegation depth
  - external agent dispatch now accepts delegation metadata so a parent agent
    run can formally own child tasks
  - task center run detail now returns delegated task rows for the parent run,
    preparing the read side for future multi-agent UI
  - added builtin internal preset definitions plus a stub task creation
    command, so parent runs can now create first-class internal delegation
    records without depending on user-configured external agents
  - upgraded delegated subtasks to a generic `taskType + presetKey +
    delegationReason + inputText` model; legacy `code-reviewer` payloads are
    mapped into `taskType = review`
  - added `run_delegated_subagent_task`, and the first executable `review`
    task type now runs a real one-shot review through the current conversation
    model, persists task results, appends task events, and ingests the review
    back into the conversation as an assistant message
  - the primary agent can now auto-delegate a single controlled `review`
    subtask when the request clearly looks like a review / risk-check intent
  - Chat Inspector now focuses on delegated task observation, showing task
    type, delegation reason, input summary, result summary, event inspection,
    and rerun actions; the manual review action remains as a secondary
    debugging entrypoint
- Source:
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### 12. Full Plugin Runtime and Isolation

- Status: `done`
- Goal: build a more complete plugin runtime after the unified extension model
  is defined
- Scope:
  - runtime isolation
  - plugin UI hosting
  - plugin health and compatibility management
- Current progress:
  - unified extension summaries now expose runtime host, isolation level, and
    connection-test capabilities so runtime placement is no longer hidden
    behind separate feature pages
  - added `get_extension_detail` to return runtime diagnostics,
    compatibility notes, and kind-specific detail through one command surface
  - the Extensions overview page can now open runtime detail and run
    connection tests for `MCP` and `External Agent` entries, forming the first
    shared runtime diagnostics workflow
  - added a unified `set_extension_enabled` path, so the Extensions overview
    can now enable or disable `Skill / MCP / External Agent` entries without
    bouncing back to their separate settings pages
  - added unified runtime refresh so the overview and detail surfaces can
    actively refresh health state, compatibility notes, and kind-specific
    runtime detail without leaving the shared extension console
- Source:
  - `docs/research/COMPETITOR_DECISION_ROADMAP.md`

### 13. Stronger Automation and Proactive Execution

- Status: `done`
- Goal: deepen assistant initiative after execution boundaries are clearer
- Scope:
  - proactive task suggestions
  - scheduled and resumable execution
  - richer task center behavior
- Current progress:
  - Chat Inspector now surfaces proactive suggestions based on the current run
    state and latest user intent, including resume, review-subtask, and
    research-subtask actions
  - the primary agent can now auto-delegate one controlled internal subtask
    for review or research intents, then write task events, summaries, and
    conversation messages back into the parent flow
  - builtin `review` and `research` task types now have executable delegated
    paths, while remaining capped at a single controlled delegation layer
  - the delegated-task observation surface now covers status, inputs, result
    summaries, events, and retry actions instead of leaving proactive
    execution hidden in backend-only records

### 14. Deeper Memory and Cross-Task Reuse

- Status: `done`
- Goal: improve long-range reuse only after workspace-level memory bindings are
  stable
- Scope:
  - smarter memory retrieval
  - reusable workspace context packs
  - cross-conversation continuity
- Current progress:
  - added reusable workspace context packs that can be saved, applied, and
    deleted locally from the current workspace / conversation context
  - Chat Inspector Sources now derives pack keys, summaries, and descriptions
    from the active workspace snapshot
  - applying a context pack now flows back through `workspaceSnapshot`
    updates, creating a concrete cross-conversation context reuse layer

### 15. Expand External Bridge Breadth

- Status: `done`
- Goal: broaden external integration after the internal host model is more
  stable
- Scope:
  - additional bridges
  - richer connector management
  - clearer bridge permissions
- Current progress:
  - added a shared bridge profile model for External Agents that captures
    bridge family, network scope, auth state, risk level, and permission
    summary
  - the Extensions overview and detail views now surface external bridge
    exposure, auth gaps, and privilege boundaries directly inside the unified
    extension console
  - public or unauthenticated external bridges now contribute warning health
    signals instead of staying hidden inside isolated connector settings

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
  - newly created managed default workspace directories now use ASCII-safe
    `workspace-YYYYMMDDHHMMSS` style names
  - legacy managed default directories are migrated to the timestamp format
    when safe
  - when a path still looks system-generated, the UI continues to prefer a
    readable conversation title as the displayed label
