# wiseSpace Local Agent Issue Templates

This document turns the current local-agent roadmap into directly executable
issue templates. It is intended to be used together with:

- [wiseSpace Agent Strengthening Plan](./agent-strengthening-plan.md)
- [wiseSpace Local-Agent-First Roadmap](./local-agent-first-roadmap.md)
- [wiseSpace Optimization Backlog](../planning/optimization-backlog.md)

Unless otherwise noted, all issues here assume the current phase keeps
`wiseSpace Local` as the primary execution path and does not expand external
agent integrations.

## Issue 1

### Title

`docs(agent): rebuild local agent strengthening plan`

### Goal

Maintain [agent-strengthening-plan.md](./agent-strengthening-plan.md) as the
main execution document for the current local-agent track.

### Modules

- `docs/agent/agent-strengthening-plan.md`
- `docs/project/CHANGE_LOG.md`
- Optional: `docs/local-agent-status.md`

### Tasks

- Ensure the document stays valid UTF-8 and renders correctly.
- Keep the current chapter structure, but add clear status markers:
  - done
  - in progress
  - not started
  - deferred
- Mark which items are already covered by the local agent runtime and readiness
  work completed on 2026-05-17.
- Clarify the role split among roadmap, backlog, strengthening plan, and change
  log documents.

### Acceptance Criteria

- The document is fully readable with no encoding issues.
- A teammate can understand the current local-agent mainline from this document
  alone.
- The responsibilities of related `docs/` files are clear and non-overlapping.

### Risks

- Useful structure from the existing document may get lost during cleanup.
- Terminology can drift from other docs if not normalized.

### Test Points

- Manual Markdown rendering check.
- Manual encoding check on Windows.
- Terminology consistency review against:
  - `docs/agent/local-agent-first-roadmap.md`
  - `docs/planning/optimization-backlog.md`

## Issue 2

### Title

`feat(agent-runtime): unify local agent state machine and status writes`

### Goal

Make `run / session / event / step` state fully consistent across chat, task
center, and detail views.

### Modules

- `src-tauri/src/agent_runtime/`
- `src-tauri/src/commands/agent.rs`
- task center stores and UI
- chat-side agent status consumers

### Tasks

- Define a single runtime status model:
  - `queued`
  - `starting`
  - `running`
  - `waiting_approval`
  - `waiting_input`
  - `cancelling`
  - `completed`
  - `failed`
  - `interrupted`
- Audit every backend write path that changes run/session status.
- Remove or reduce frontend-only inferred status branches where possible.
- Map event types to final run state transitions explicitly.
- Add fallback handling for abnormal termination paths.

### Acceptance Criteria

- The same task shows the same effective state in all relevant surfaces.
- No more split states such as one view showing `running` and another showing
  `completed`.
- Failure, cancellation, and interruption all converge to stable final states.

### Risks

- Existing UI may depend on old implicit state assumptions.
- Historic task records may not fully satisfy the new state rules.

### Test Points

- Successful task completion.
- Permission wait flow.
- Ask-user wait flow.
- Cancellation flow.
- Failure flow.
- Interrupted task flow after forced shutdown.

## Issue 3

### Title

`feat(agent-runtime): add local agent recovery and rerun semantics`

### Goal

Give unfinished tasks a clear recovery path after restart, close, or
conversation switching.

### Modules

- `src-tauri/src/agent_runtime/`
- `src-tauri/src/commands/agent.rs`
- task center UI
- chat-side agent recovery state

### Tasks

- Define what qualifies as `interrupted`.
- Scan and classify unfinished runs at startup.
- Split post-interruption handling into:
  - recoverable
  - rerunnable only
  - history only
- Add UI entry points for:
  - recover
  - rerun
  - inspect context
- Ensure recovery does not silently reuse incompatible context.

### Acceptance Criteria

- Unfinished tasks are never silently lost after restart.
- Users can tell whether a task can be resumed or only rerun.
- Recovery and rerun have clearly separated semantics.

### Risks

- Reusing stale context can produce inconsistent follow-up behavior.
- Half-finished tool calls may need special cleanup semantics.

### Test Points

- Restart during active execution.
- Restart while waiting for approval.
- Restart while waiting for user input.
- Rerun a failed task.
- Verify completed tasks are not incorrectly marked recoverable.

## Issue 4

### Title

`perf(chat): improve conversation switching during local agent runs`

### Goal

Reduce blank states, dropped status, and streaming message mismatch while
switching conversations.

### Modules

- `src/stores/conversationStore.ts`
- `src/components/chat/ChatView.tsx`
- recent conversation cache and streaming state logic

### Tasks

- Stabilize recent-conversation snapshot caching.
- Show cached content first, then refresh in the background.
- Preserve partial assistant messages during active runs.
- Preserve pending permission and ask-user cards after returning.
- Refresh final run/message state automatically when the run completes.

### Acceptance Criteria

- Switching among recent conversations avoids visible blank states.
- Switching away and back during a run preserves message and approval state.
- Final completion state lands on the correct message.

### Risks

- Caching can introduce stale-content flashes.
- Concurrent streaming events may reintroduce message-id race conditions.

### Test Points

- Switch across two active conversations during a run.
- Switch back after `agent-message-id`.
- Switch around `agent-done`.
- Switch around `agent-error`.

## Issue 5

### Title

`feat(chat): tighten the main local-agent chat loop`

### Goal

Make the main chat feel like "wiseSpace is working" rather than an event
console.

### Modules

- `src/components/chat/ChatView.tsx`
- `src/components/chat/InputArea.tsx`
- agent event presentation components
- permission and ask-user cards

### Tasks

- Add clearer phase summaries:
  - analyzing
  - using tools
  - waiting for approval
  - waiting for user input
  - completed
  - failed
- Surface "current action" and "last action".
- Add failure follow-up actions:
  - retry
  - recover
  - inspect details
- Normalize permission-request and ask-user interaction language.
- Continue reducing raw event noise in the main chat surface.

### Acceptance Criteria

- Users can understand what the agent is doing without reading logs.
- Failed tasks expose an obvious next step.
- Main chat no longer feels like a task console.

### Risks

- Over-simplification can make debugging harder.
- Diagnostics must remain accessible without polluting the default view.

### Test Points

- Normal agent execution.
- Multi-tool runs.
- Permission-blocked flow.
- Ask-user-blocked flow.
- Failure presentation.

## Issue 6

### Title

`feat(files): evolve Files into the local-agent asset center`

### Goal

Turn Files into the unified file-context entry point for the local agent rather
than a passive attachment list.

### Modules

- `src/components/files/FileList.tsx`
- `src/components/files/FilesContent.tsx`
- `src/stores/fileStore.ts`
- related backend file commands and repositories

### Tasks

- Add `attach to chat`.
- Add `add to knowledge base`.
- Add explicit `upload/import`.
- Add orphan cleanup view.
- Make origins clearer:
  - conversation
  - knowledge
  - generated
  - backup
  - import
- Keep `open` and `reveal` actions clearly separated.

### Acceptance Criteria

- Users can feed files directly into chat or knowledge workflows from Files.
- File origin is clear and actionable.
- Missing and orphan files have explicit cleanup flows.

### Risks

- Origin mapping may require backend enrichment.
- Import flows must still respect the dual-root storage policy.

### Test Points

- Import file.
- Attach to chat.
- Add to knowledge base.
- Open file.
- Reveal file location.
- Clean missing file.
- Clean orphan file.

## Issue 7

### Title

`feat(embedding): upgrade readiness into a full setup checklist`

### Goal

Move embedding UX from "users know what is missing" to "users can finish setup
smoothly".

### Modules

- `src/lib/embeddingReadiness.ts`
- `src/components/shared/EmbeddingReadinessAlert.tsx`
- `src/stores/knowledgeStore.ts`
- `src/stores/memoryStore.ts`
- knowledge and memory settings pages
- provider detail UI

### Tasks

- Extend readiness checks to cover:
  - provider ready
  - API key ready
  - embedding model ready
  - model enabled
  - index built
  - chat context attached
- Use the checklist consistently in knowledge and memory create/attach flows.
- Add an "Add Embedding Model" shortcut in provider detail.
- Add direct guidance for providers that have no embedding-capable models.

### Acceptance Criteria

- Users can immediately tell why knowledge or memory is unavailable.
- Every missing prerequisite maps to a concrete next step.
- Empty vector-model dropdowns are fully replaced by actionable guidance.

### Risks

- `index built` and `chat context attached` may require new read-only backend
  aggregation APIs.
- Too much detail can overload settings UI.

### Test Points

- No provider.
- Provider exists but no API key.
- API key exists but no embedding model.
- Embedding model exists but is disabled.
- Index not built.
- Fully ready configuration.

## Issue 8

### Title

`feat(provider): expose custom OpenAI-compatible provider creation`

### Goal

Fill the remaining UI gap for custom providers and lower the barrier for local
and private model integration.

### Modules

- provider settings UI
- provider create/edit form
- related type and validation logic

### Tasks

- Add `custom` to the provider type selector.
- Support:
  - API host
  - optional API path
  - custom headers
- Provide OpenAI-compatible examples.
- Add validation and user-facing error messages.
- Make model capability usage clearer for chat, embedding, and image models.

### Acceptance Criteria

- Users can create a custom compatible provider without editing hidden config.
- The custom provider works through create, save, test, and usage flows.

### Risks

- Custom header/path behavior introduces more compatibility edge cases.
- Validation must not conflict with existing provider types.

### Test Points

- Create custom provider.
- Save host/path/headers.
- Add chat model.
- Add embedding model.
- Use it from knowledge and memory flows.

## Issue 9

### Title

`feat(embedding): add local embedding preset flow`

### Goal

Make local embedding setup feel like a guided flow instead of a fully manual
configuration path.

### Modules

- provider UI
- readiness UI
- related docs or setup guidance surfaces

### Tasks

- Add preset flows for common local OpenAI-compatible embedding services.
- Pre-fill:
  - host
  - path
  - model type
- Allow users to jump into preset creation from knowledge and memory empty
  states.
- Keep the explanation minimal but actionable.

### Acceptance Criteria

- Users can create a local embedding provider quickly from empty states.
- First-time local embedding setup is meaningfully shorter than today.

### Risks

- Presets can become costly to maintain if too specific.
- Manual configuration still needs to stay available.

### Test Points

- Enter preset flow from knowledge empty state.
- Enter preset flow from memory empty state.
- Finish setup and return to the original workflow successfully.

## Issue 10

### Title

`feat(retrieval): add a no-embedding fallback mode`

### Goal

Keep knowledge and memory minimally usable even when no embedding model is
available.

### Modules

- knowledge retrieval backend
- memory retrieval backend
- related UI hinting

### Tasks

- Add keyword-search fallback for knowledge.
- Add exact or substring fallback for memory.
- Make the UI distinguish clearly between:
  - basic retrieval
  - vector retrieval
- Keep the fallback path isolated from the normal vector path.

### Acceptance Criteria

- The system remains minimally usable without embeddings.
- Users are clearly told they are in a degraded retrieval mode.

### Risks

- Fallback logic can complicate the normal path if mixed too deeply.
- Users may misread "usable" as "equivalent".

### Test Points

- Knowledge retrieval without embeddings.
- Memory retrieval without embeddings.
- Auto-return to normal retrieval once embeddings are configured.
- UI state switches correctly.

