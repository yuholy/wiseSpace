# wiseSpace Docs

This folder is organized by purpose so architecture references, execution
plans, research notes, and archives stay separate.

## Top-Level Tracker

- [OPTIMIZATION_CHECKLIST.md](./OPTIMIZATION_CHECKLIST.md): default optimization
  backlog and status tracker
- [OPTIMIZATION_CHECKLIST.zh-CN.md](./OPTIMIZATION_CHECKLIST.zh-CN.md): 中文优化清单与状态跟踪

Default maintenance rule:

- 优先维护 [OPTIMIZATION_CHECKLIST.zh-CN.md](./OPTIMIZATION_CHECKLIST.zh-CN.md)
- [OPTIMIZATION_CHECKLIST.md](./OPTIMIZATION_CHECKLIST.md) 作为同步英文镜像

## Structure

### `project/`

Core project-level reference docs.

- [ARCHITECTURE.md](./project/ARCHITECTURE.md): current architecture map
- [CHANGE_LOG.md](./project/CHANGE_LOG.md): structured change history

### `agent/`

Local agent, external connector, and runtime design docs.

- [agent-connector-standard.md](./agent/agent-connector-standard.md)
- [agent-executor-selector-design.md](./agent/agent-executor-selector-design.md)
- [agent-platform-modular-design.md](./agent/agent-platform-modular-design.md)
- [agent-strengthening-plan.md](./agent/agent-strengthening-plan.md)
- [deepseek-tui-integration-plan.md](./agent/deepseek-tui-integration-plan.md)
- [external-agent-mock-quickstart.md](./agent/external-agent-mock-quickstart.md)
- [local-agent-first-roadmap.md](./agent/local-agent-first-roadmap.md)
- [local-agent-issue-templates.md](./agent/local-agent-issue-templates.md)
- [openclaw-remote-bridge.md](./agent/openclaw-remote-bridge.md)

### `planning/`

Feature plans, implementation tracks, and backlog items.

- [conversation-summary-mvp.md](./planning/conversation-summary-mvp.md)
- [independent-evolution.md](./planning/independent-evolution.md)
- [optimization-backlog.md](./planning/optimization-backlog.md)
- [role-system-mvp.md](./planning/role-system-mvp.md)
- [role-system-optimization-plan.md](./planning/role-system-optimization-plan.md)
- [s3-backup-sync-plan.md](./planning/s3-backup-sync-plan.md)
- [extension-model-audit.md](./planning/extension-model-audit.md)
- [extension-model-schema-draft.md](./planning/extension-model-schema-draft.md)
- [subagent-delegation-foundation.md](./planning/subagent-delegation-foundation.md)
- [workspace-scope-audit.md](./planning/workspace-scope-audit.md)
- [workspace-implementation-checklist.md](./planning/workspace-implementation-checklist.md)
- [workspace-schema-draft.md](./planning/workspace-schema-draft.md)
- [workspace-code-change-map.md](./planning/workspace-code-change-map.md)

### `research/`

External comparison and decision documents.

- [COMPETITOR_ANALYSIS.md](./research/COMPETITOR_ANALYSIS.md)
- [COMPETITOR_DECISION_ROADMAP.md](./research/COMPETITOR_DECISION_ROADMAP.md)

### `archive/`

Historical notes kept for reference only.

- [legacy-brand-scan-v0.1.0.md](./archive/legacy-brand-scan-v0.1.0.md)

## Reading Order

If you are new to the codebase, start here:

1. [project/ARCHITECTURE.md](./project/ARCHITECTURE.md)
2. [agent/local-agent-first-roadmap.md](./agent/local-agent-first-roadmap.md)
3. [planning/optimization-backlog.md](./planning/optimization-backlog.md)
4. [research/COMPETITOR_DECISION_ROADMAP.md](./research/COMPETITOR_DECISION_ROADMAP.md)
