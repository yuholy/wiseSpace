# SubAgent Delegation Foundation

## Goal

Establish a durable delegation data model before building full multi-agent
orchestration.

This step started as pure persistence, and now includes a first executable
delegated subtask path. It still stops short of full autonomous multi-agent
orchestration, but it now provides the minimum persistence and execution
surface needed to represent:

- a parent agent run
- a delegated child task
- the task type / preset mapping
- the assignee label and kind
- delegation depth and parent-child linkage

## Why This First

wiseSpace already has:

- `agent_runs` for local agent execution history
- `agent_tasks` for external agent dispatch
- workspace-scoped identity for conversations, runs, and tasks

The missing piece was a shared delegation layer. Without that, future subagent
work would have to bolt relationships onto task payload JSON or UI-only state.

## Scope Added In This Step

- add delegation columns to `agent_tasks`
  - `parent_run_id`
  - `parent_task_id`
  - `assignee_kind`
  - `assignee_label`
  - `delegation_depth`
- allow external-agent dispatch to persist parent delegation metadata
- allow task queries to filter by parent run or parent task
- expose delegated task rows from task-center run detail
- add builtin preset definitions that can back internal subtasks
  - `code-reviewer` for `review`
  - `researcher` for `research`
  - `file-scanner` for `scan_files`
- add a `create_delegated_subagent_task` command for first-class internal
  delegation records
- add a first executable builtin path via `run_delegated_subagent_task`
  - `review` is now the first executable delegated task type
  - `research` is now the second executable delegated task type
  - `code-reviewer` remains as the builtin preset behind that `review` task
    type for compatibility and prompt templating
  - `researcher` remains as the builtin preset behind that `research` task
    type for prompt templating
  - task status and task events are updated through the execution lifecycle
  - completed delegated output is ingested back into the conversation as an
    assistant message
  - the primary agent can now auto-delegate a single controlled `review`
    or `research` subtask when the request clearly looks like a matching
    review / risk-check / research intent
- extend the run inspector into a delegated-task observation surface
  - task type, delegation reason, input summary, result summary
  - event inspection
  - rerun / retry actions

## What This Enables Next

- show delegated tasks under a parent agent run in the task center
- add internal delegated task presets without inventing a second task graph
- support richer delegation events, approvals, and recovery
- distinguish between direct external execution and nested subagent handoff

## Follow-on Work Beyond P2.1

- no open-ended planner autonomy yet; first auto-delegation is rule-driven
- no UI orchestration builder yet
- `scan_files` is not an executable task type yet
- no plugin/runtime isolation work yet
