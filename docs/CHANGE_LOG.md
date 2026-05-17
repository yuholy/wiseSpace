# Change Log

## 2026-05-17

### Pending Commit: Local agent runtime and UX convergence
- Scope: local agent runtime pipeline refactor, stream/result handling cleanup, embedding readiness guidance, and files page source/open improvements.
- Backend:
  - Added planner, execution context, and result renderer modules under `src-tauri/src/agent_runtime/`.
  - Refactored `sdk_runner.rs` to consume the new runtime pipeline while keeping the existing `agent_start_run` entry stable.
- Frontend:
  - Simplified Agent mode input/header display around `wiseSpace Local`.
  - Improved agent streaming message id replacement and final overwrite behavior in conversation state.
  - Added shared embedding readiness evaluation and alert UI for knowledge and memory settings.
  - Extended files page rows with source labels and explicit open/reveal actions.
- Verification:
  - `pnpm typecheck`
  - `pnpm test:run src/stores/__tests__/conversationStore.agent.test.ts src/stores/__tests__/fileStore.test.ts src/components/shared/__tests__/EmbeddingModelSelect.test.tsx`
  - `cargo test --manifest-path src-tauri\Cargo.toml --no-run`
