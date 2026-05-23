# DeepSeek-TUI Integration Task List

This document defines the implementation plan for integrating
[`DeepSeek-TUI`](https://github.com/Hmbown/DeepSeek-TUI) into wiseSpace as a
single local code-task runner.

Current direction:

- Only integrate `DeepSeek-TUI`
- Do not productize a broader executor platform first
- Do not embed the raw TUI into the main chat UI
- Prefer `deepseek exec --auto --output-format stream-json`
- Support conversation continuity through `deepseek exec --resume <SESSION_ID>`

## Goals

- Let users invoke DeepSeek-TUI directly inside wiseSpace
- Keep code-task conversations continuous across multiple turns
- Reuse existing task center, chat, workspace, and interrupted/resume semantics
- Keep wiseSpace as the source of truth for messages, tasks, and files

## Architecture Summary

wiseSpace remains the primary product surface.

DeepSeek-TUI is treated as:

- a local runner
- a process that emits streamable execution output
- a provider of runner-specific session continuity

wiseSpace remains responsible for:

- conversations
- run lifecycle
- task center
- message persistence
- workspace selection
- interrupted/resume/replay behavior

## Issue 1

Title: `spike(deepseek-tui): validate command mode, stream output, and session continuity`

Goal:
Verify that DeepSeek-TUI can be used as a stable local runner in the current
Windows environment.

Scope:

- No product UI changes
- Local command and output validation only

Tasks:

- Verify `deepseek exec --auto --output-format stream-json "..."`
- Verify `deepseek exec --resume <SESSION_ID> "..."`
- Capture stdout/stderr samples
- Confirm where session ids appear in output
- Verify behavior after manual interruption
- Verify cwd/workspace behavior for file operations
- Record env/config prerequisites

Deliverables:

- Validation notes
- Sample output logs
- A conclusion on whether `exec/resume` should be the main integration path

Acceptance Criteria:

- One code task can run successfully
- A second follow-up task can continue with the same session
- Session id extraction strategy is clear

Risks:

- Output format instability
- Windows encoding issues

Test Points:

- New task
- Resumed task
- File-edit task
- Forced stop and retry

## Issue 2

Title: `feat(agent-runtime): add deepseek_tui runner skeleton`

Goal:
Add DeepSeek-TUI as a first-class local runner in wiseSpace.

Modules:

- `src-tauri/src/agent_runtime/runner.rs`
- `src-tauri/src/agent_runtime/deepseek_tui_runner.rs`
- `src-tauri/src/commands/agent.rs`

Tasks:

- Add `AgentRunnerKind::DeepseekTui`
- Implement runner bootstrap logic
- Support initial command construction
- Support resume command construction
- Integrate with current cancel token and run lifecycle
- Pass current workspace as cwd

Acceptance Criteria:

- Backend can start a DeepSeek-TUI run
- Run enters `starting -> running`
- Failures land in `failed`

Risks:

- Process management complexity
- Existing runtime assumptions biased toward SDK runner

Test Points:

- Start run
- Missing binary
- Invalid env/config
- Cancel before completion

## Issue 3

Title: `feat(agent-runtime): parse deepseek-tui stream-json and map run events`

Goal:
Map DeepSeek-TUI output into wiseSpace's existing event model.

Modules:

- `src-tauri/src/agent_runtime/deepseek_tui_runner.rs`
- `src-tauri/src/agent_runtime/runtime.rs`
- optionally `src-tauri/crates/core/src/repo/agent_run.rs`

Tasks:

- Implement stdout parser for NDJSON / stream-json
- Extract:
  - text delta
  - tool start
  - tool result
  - error
  - completed
  - session id
- Map to:
  - `status`
  - `tool_use`
  - `tool_start`
  - `tool_result`
  - `run_finished`
  - `run_failed`
- Preserve raw payload for diagnostics

Acceptance Criteria:

- Chat page can show streamed progress
- Task center timeline is readable
- Final result lands as assistant content

Risks:

- Event naming may change upstream
- Tool/result boundaries may not map 1:1

Test Points:

- Text-only task
- File-edit task
- Tool failure
- Long output

## Issue 4

Title: `feat(data): persist runner session continuity fields`

Goal:
Add explicit storage for DeepSeek-TUI continuity data.

Modules:

- `src-tauri/crates/migration/src/`
- `src-tauri/crates/core/src/entity/agent_runs.rs`
- `src-tauri/crates/core/src/types.rs`
- `src-tauri/crates/core/src/repo/agent_run.rs`

Tasks:

- Add migration
- Update entity/type/repo mappings
- Support create/update/query flows
- Add repo tests

Acceptance Criteria:

- Runs can store and load runner session fields
- Existing historical runs remain valid
- SDK runner is unaffected

Test Points:

- Migration up
- Create run with null session id
- Update session id later
- Detail/list responses expose new fields

## Issue 5

Title: `feat(agent-runtime): add deepseek-tui resume and replay semantics`

Goal:
Align DeepSeek-TUI with the current interrupted/resume task model.

Modules:

- `src-tauri/src/agent_runtime/runner.rs`
- `src-tauri/src/agent_runtime/runtime.rs`
- `src-tauri/src/commands/agent.rs`
- `src-tauri/crates/core/src/repo/agent_run.rs`

Tasks:

- Define resume capability rules:
  - `runner_session_id` present => `resumable`
  - no `runner_session_id` => `replay_only`
- Support `deepseek_tui` inside `agent_resume_run`
- Mark unfinished runs as `interrupted` after restart
- Recompute capability at restart time

Acceptance Criteria:

- Interrupted DeepSeek-TUI tasks show resume or replay accurately
- Resume truly uses `deepseek exec --resume`
- Replay starts a fresh run

Risks:

- Resume may fail if upstream session is invalid
- Replay fallback policy must stay clear

Test Points:

- Interrupted + resumable
- Interrupted + replay_only
- Resume failure
- Restart after active run

## Issue 6

Title: `feat(commands): expose deepseek-tui through existing task and chat commands`

Goal:
Make DeepSeek-TUI invokable from current task center and chat flows.

Modules:

- `src-tauri/src/commands/agent.rs`
- `src/stores/taskCenterStore.ts`
- `src/stores/conversationStore.ts`
- `src/types/agent.ts`

Tasks:

- Allow `runnerKind: deepseek_tui` in start-run flows
- Preserve runner kind in rerun flows
- Pass runner kind through `sendAgentMessage(...)`
- Return runner-related info from detail/list responses

Acceptance Criteria:

- Frontend can start DeepSeek-TUI runs
- Rerun does not silently fall back to SDK
- Task detail identifies the current runner

Risks:

- Existing code paths may still assume `sdk`
- Rerun is easy to overlook

Test Points:

- Task center create
- Task center rerun
- Chat send
- Task detail fetch

## Issue 7

Title: `feat(ui): add a minimal DeepSeek-TUI runner entry point`

Goal:
Expose DeepSeek-TUI in wiseSpace without building a large executor platform first.

Recommended options:

- A settings-level default local code runner
- Or a lightweight Agent-mode runner switcher with:
  - `wiseSpace Local`
  - `DeepSeek-TUI`

Modules:

- `src/components/chat/InputArea.tsx`
- related settings/conversation stores
- optionally settings UI

Tasks:

- Show the current runner in Agent mode
- Show whether the conversation is bound to a DeepSeek-TUI session
- Pass runner kind on send
- Avoid exposing raw engineering controls

Acceptance Criteria:

- User can tell when DeepSeek-TUI is active
- No diagnostics page is required for basic usage
- UI remains product-oriented

Risks:

- Need a decision between global default and per-conversation override

Test Points:

- Switch runner
- New conversation default
- Existing conversation consistency
- Send task and verify runner choice

## Issue 8

Title: `feat(chat): render deepseek-tui streaming results and lifecycle states`

Goal:
Reuse the existing chat experience for DeepSeek-TUI runs.

Modules:

- `src/stores/agentStore.ts`
- `src/components/chat/ChatView.tsx`
- possibly `src/stores/conversationStore.ts`

Tasks:

- Consume DeepSeek-TUI run events
- Render streamed text
- Render tool execution states
- Render interrupted/failed/completed states
- Keep raw event noise out of the main conversation

Acceptance Criteria:

- User can read results naturally in chat
- Interrupted/resume status is understandable
- Main conversation stays clean

Risks:

- Too much simplification may hide useful debugging detail

Test Points:

- Success flow
- Failure flow
- Tool flow
- Interrupted flow

## Issue 9

Title: `feat(tasks): show deepseek-tui continuity and workspace in task center`

Goal:
Make task center useful for managing DeepSeek-TUI code tasks.

Modules:

- `src/pages/TasksPage.tsx`
- `src/types/agent.ts`
- optionally `src/components/layout/Sidebar.tsx`

Tasks:

- Show runner kind
- Show session continuity state
- Show resumable vs replay-only for interrupted runs
- Keep workspace open/copy actions
- Keep resume/rerun behavior runner-aware

Acceptance Criteria:

- User can see:
  - whether a task used DeepSeek-TUI
  - whether it can resume
  - which workspace it belongs to

Test Points:

- DeepSeek-TUI completed task
- DeepSeek-TUI interrupted task
- Replay-only task
- SDK task regression

## Issue 10

Title: `feat(workspace): bind deepseek-tui session continuity to workspace continuity`

Goal:
Ensure continuity means both prompt continuity and code-directory continuity.

Modules:

- `src-tauri/src/agent_runtime/context.rs`
- `src/components/chat/InputArea.tsx`
- `src/pages/TasksPage.tsx`

Tasks:

- Require DeepSeek-TUI tasks to run with a workspace
- Reuse the same workspace on resume
- Show current code workspace in UI
- Decide behavior when workspace changes

Recommended rule:

- Do not silently reuse a DeepSeek-TUI session across different workspaces

Suggested behavior:

- If workspace changes:
  - clear continuity
  - or ask user to confirm starting a new runner session

Acceptance Criteria:

- Same conversation + same workspace remains continuous
- Workspace changes do not silently reuse stale code context

Risks:

- Workspace changes can conflict with session continuity expectations

Test Points:

- Same session same workspace
- Same session changed workspace
- Restart then resume in same workspace

## Issue 11

Title: `feat(process): harden deepseek-tui process management, cancel, and timeout behavior`

Goal:
Keep DeepSeek-TUI process handling safe and predictable.

Modules:

- `src-tauri/src/agent_runtime/deepseek_tui_runner.rs`
- `src-tauri/src/commands/agent.rs`

Tasks:

- Track child process handles
- Ensure cancel reliably terminates the process
- Limit stdout/stderr growth
- Handle timeouts
- Handle non-zero exit codes
- Avoid duplicate active runs per conversation

Acceptance Criteria:

- Cancel is reliable
- No zombie processes are left behind
- Errors map cleanly to `failed` or `interrupted`

Test Points:

- Manual cancel
- Forced kill
- Invalid command
- Huge output
- Timeout

## Issue 12

Title: `docs(agent): document DeepSeek-TUI integration and operations`

Goal:
Make the integration understandable for future maintainers.

Modules:

- `docs/agent/agent-strengthening-plan.md`
- `docs/agent/deepseek-tui-integration-plan.md`
- `docs/project/CHANGE_LOG.md`

Tasks:

- Document runner data flow
- Document session continuity strategy
- Document workspace binding rules
- Document installation and environment requirements
- Document why ACP is not the primary path for this phase

Acceptance Criteria:

- Maintainers can understand the integration from docs alone
- Debugging and upgrade paths are clear

## Data Model Recommendations

Recommended `agent_runs` additions:

1. `runner_session_id TEXT NULL`

Purpose:

- Stores the DeepSeek-TUI session id
- Used for `deepseek exec --resume <SESSION_ID>`

2. `runner_metadata_json TEXT NULL`

Purpose:

- Stores runner-specific metadata
- Example:
  - binary path
  - command mode
  - output mode
  - parsed runner version

Optional:

3. `workspace_fingerprint TEXT NULL`

Purpose:

- Helps validate whether a resumed runner session still matches the current
  workspace

This is optional for the first implementation wave. Using `workspace_root`
directly may be enough at the start.

## Migration Recommendation

Suggested migration file:

- `m20260517_000001_agent_run_runner_session_id.rs`

Suggested changes:

- `ALTER TABLE agent_runs ADD COLUMN runner_session_id TEXT NULL`
- `ALTER TABLE agent_runs ADD COLUMN runner_metadata_json TEXT NULL`

Compatibility strategy:

- Keep historical runs as `NULL`
- Do not backfill old rows
- Compute capability dynamically based on runner kind and new fields

## Explicit Non-Goals For This Phase

- Do not build a general multi-executor platform first
- Do not embed the raw DeepSeek-TUI terminal UI into the chat page
- Do not use ACP as the primary execution path
- Do not redesign the broader task center interaction model

## Recommended Implementation Order

1. Issue 1 validation spike
2. Issue 4 persistence fields
3. Issue 2 runner skeleton
4. Issue 3 stream-json parsing
5. Issue 5 resume/replay semantics
6. Issue 6 command/store plumbing
7. Issue 8 chat integration
8. Issue 9 task-center integration
9. Issue 10 workspace continuity
10. Issue 11 process hardening
11. Issue 12 documentation cleanup

## Minimal Deliverable

The smallest version worth shipping should include:

- DeepSeek-TUI runner registration
- `deepseek exec --auto --output-format stream-json`
- session id persistence
- `deepseek exec --resume <SESSION_ID>`
- task center integration
- chat integration
- cancel / interrupted / resume / replay behavior

At that point, wiseSpace will already support continuous code-task sessions
through DeepSeek-TUI without embedding the raw TUI.

