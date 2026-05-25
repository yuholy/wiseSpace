import { describe, expect, it } from 'vitest';
import { getAgentTaskTypeLabel, getExternalTaskSummary } from '../externalTaskSummary';
import type { AgentTask } from '@/types';

function baseTask(overrides: Partial<AgentTask> = {}): AgentTask {
  return {
    id: 'task-1',
    conversationId: 'conv-1',
    workspaceId: null,
    parentRunId: 'run-1',
    parentTaskId: null,
    sourceMessageId: null,
    externalAgentId: 'builtin-subagent:code-reviewer',
    externalTaskId: null,
    assigneeKind: 'internal_subagent',
    assigneeLabel: 'Code Reviewer',
    delegationDepth: 1,
    kind: 'review',
    taskType: 'review',
    presetKey: 'code-reviewer',
    delegationReason: '主 Agent 识别为审查类任务',
    inputText: '请审查最近一次改动',
    status: 'planned',
    title: 'Review latest run',
    requestPayloadJson: '{}',
    resultPayloadJson: null,
    errorMessage: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('externalTaskSummary', () => {
  it('returns human task type labels', () => {
    expect(getAgentTaskTypeLabel('review')).toBe('Review');
    expect(getAgentTaskTypeLabel('scan_files')).toBe('Scan Files');
  });

  it('falls back to input text when there is no result payload', () => {
    expect(getExternalTaskSummary(baseTask())).toBe('请审查最近一次改动');
  });

  it('prefers parsed result content when present', () => {
    const summary = getExternalTaskSummary(
      baseTask({
        status: 'completed',
        resultPayloadJson: JSON.stringify({
          taskType: 'review',
          content: '## Findings\n- Something looks wrong.',
        }),
      }),
    );

    expect(summary).toContain('## Findings');
  });
});
