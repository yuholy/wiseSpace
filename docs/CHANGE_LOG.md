# Change Log

## 2026-05-18

### feat(agent): ship DeepSeek-TUI, multimodal fallback, backup cleanup, and chat rendering fixes
- Scope: integrated DeepSeek-TUI as a local coding executor, added multimodal fallback routing for non-vision chat models, reduced backup bloat, and tightened chat/task rendering behavior.
- Agent runtime:
  - Added a dedicated `deepseek_tui` runner with runtime HTTP API support, thread continuity, resume/replay capability mapping, and workspace-aware execution.
  - Wired DeepSeek runtime approval and interrupt events back into wiseSpace permission and interrupted-run flows.
  - Completed local agent attachment passthrough so uploaded files reach runtime context instead of stopping at optimistic UI state.
- Chat and settings:
  - Added multimodal fallback settings under Default Models and surfaced a lightweight “vision fallback used” display tag in chat output.
  - Normalized malformed/repeated `<think>` content in assistant rendering and delayed heavy markdown re-rendering when returning to chat, reducing visible stalls and repeated “thinking complete” blocks.
  - Simplified chat sidebar and input labels, removed stale Claude skill and Beta surface copy, and cleaned up workspace display to show concise folder names with full-path tooltips.
- Backup and storage:
  - Fixed ZIP backups to avoid double-packing `documents/workspace` and standalone `workspace` content.
  - Made workspace backup respect project `.gitignore` rules and added default excludes for heavy directories such as `node_modules`, `venv`, `dist`, `build`, and `.git`.
  - Added cleanup for leaked `_webdav_temp_*.db` files and serialized backup manifest sync with duplicate-manifest pruning so Backup Center stays responsive.
- Docs:
  - Added `docs/deepseek-tui-integration-plan.md` and `docs/s3-backup-sync-plan.md`.
  - Extended `docs/optimization-backlog.md` with S3-compatible backup/sync planning.
- Verification:
  - `pnpm typecheck`
  - `pnpm test:run src/components/chat/__tests__/toolCallDisplay.test.tsx src/components/chat/__tests__/chatStreaming.test.ts src/lib/__tests__/chatMarkdown.test.ts`
  - `pnpm test:run src/components/settings/__tests__/ConversationSettings.test.tsx src/components/settings/__tests__/DefaultModelSettings.test.tsx`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `cargo test --manifest-path src-tauri/Cargo.toml -p wisespace-core --lib create_backup_zip_ -- --nocapture`

## 2026-05-17

### feat(workspace): improve task-center workspace actions and agent workspace visibility
- Scope: better local workspace visibility across task center and chat input, plus clearer interrupted-run workspace handling.
- Frontend:
  - Rebuilt the tasks page copy and detail layout to remove corrupted Chinese text.
  - Added workspace visibility to task center list items and task detail panels.
  - Added direct task-center actions to open the workspace folder and copy the workspace path.
  - Added interrupted-run summaries that explain whether a task is resumable or replay-only.
  - Improved the chat input agent-workspace label and tooltip so the default workspace behavior is easier to understand.
- Backend:
  - Extended task-center list payloads with `resumeCapability` and `interruptedReason` so workspace and recovery actions can be decided without opening task detail first.
- Verification:
  - `pnpm typecheck`

### chore(release): prepare v0.1.1
- Scope: version bump and release packaging for the latest local agent runtime, recovery, and task-center fixes.
- Release:
  - Bumped app and Rust crate versions from `0.1.0` to `0.1.1`.
  - Built desktop release artifacts: `wiseSpace_0.1.1_x64_en-US.msi` and `wiseSpace_0.1.1_x64-setup.exe`.
  - Updater signing remains blocked until `TAURI_SIGNING_PRIVATE_KEY` is provided in the release environment.
- Verification:
  - `pnpm typecheck`
  - `pnpm tauri build`

### feat(agent): unify local runtime state and recovery semantics
- Scope: normalized local agent run states, interrupted run recovery, task center state consistency, and task page Chinese copy fixes.
- Backend:
  - Centralized local agent run state transitions under `src-tauri/src/agent_runtime/` and removed duplicate status-writing paths from command handlers.
  - Added interrupted run recovery capability projection with `resumable` and `replay_only` semantics based on persisted SDK context.
  - Updated run and session repositories to persist resume context and keep session runtime status as a projection of the latest run.
- Frontend:
  - Added shared local agent run status helpers and aligned task center, chat view, and store projections to the same canonical state mapping.
  - Split interrupted and cancelled task handling from waiting and failed buckets in the task center.
  - Restored visible Chinese labels on the tasks page and removed corrupted copy introduced by prior encoding issues.
- Docs:
  - Added local agent issue templates under `docs/local-agent-issue-templates.md`.
  - Refreshed `docs/agent-strengthening-plan.md` with the latest local-agent roadmap context.
- Verification:
  - `pnpm typecheck`
  - `pnpm test:run src/lib/__tests__/agentRunStatus.test.ts src/stores/__tests__/agentStore.test.ts src/stores/__tests__/conversationStore.agent.test.ts`
  - `cargo check --manifest-path src-tauri\Cargo.toml`
  - `cargo test --manifest-path src-tauri\Cargo.toml agent_runtime::runtime -- --nocapture`
  - `cargo test --manifest-path src-tauri\Cargo.toml -p wisespace-core --lib mark_incomplete_runs_interrupted_marks_sdk_runs_resumable_when_context_exists -- --nocapture`
  - `cargo test --manifest-path src-tauri\Cargo.toml -p wisespace-core --lib mark_incomplete_runs_interrupted_marks_sdk_runs_replay_only_without_context -- --nocapture`
