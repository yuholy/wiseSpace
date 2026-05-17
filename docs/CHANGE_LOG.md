# Change Log

## 2026-05-17

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
