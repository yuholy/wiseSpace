# Change Log

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
