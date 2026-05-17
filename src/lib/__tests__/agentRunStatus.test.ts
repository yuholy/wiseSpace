import { describe, expect, it } from 'vitest';
import {
  AGENT_ACTIVE_RUN_STATUSES,
  AGENT_WAITING_RUN_STATUSES,
  getAgentRunStatusColor,
  getAgentRunStatusLabel,
  groupTaskCenterItemsByStatus,
  toAgentSessionRuntimeStatus,
} from '../agentRunStatus';

describe('agentRunStatus', () => {
  it('maps canonical run statuses into compatibility runtime statuses', () => {
    expect(toAgentSessionRuntimeStatus(undefined)).toBe('idle');
    expect(toAgentSessionRuntimeStatus('waiting_input')).toBe('waiting_input');
    expect(toAgentSessionRuntimeStatus('interrupted')).toBe('interrupted');
    expect(toAgentSessionRuntimeStatus('cancelled')).toBe('cancelled');
    expect(toAgentSessionRuntimeStatus('unknown')).toBe('idle');
  });

  it('keeps active and waiting status sets aligned with the canonical lifecycle', () => {
    expect(AGENT_ACTIVE_RUN_STATUSES.has('queued')).toBe(true);
    expect(AGENT_ACTIVE_RUN_STATUSES.has('cancelling')).toBe(true);
    expect(AGENT_ACTIVE_RUN_STATUSES.has('interrupted')).toBe(false);
    expect(AGENT_WAITING_RUN_STATUSES.has('waiting_approval')).toBe(true);
    expect(AGENT_WAITING_RUN_STATUSES.has('waiting_input')).toBe(true);
    expect(AGENT_WAITING_RUN_STATUSES.has('interrupted')).toBe(false);
  });

  it('groups task items without lumping interrupted into waiting or cancelled into failed', () => {
    const grouped = groupTaskCenterItemsByStatus([
      { runId: '1', status: 'waiting_approval' },
      { runId: '2', status: 'interrupted' },
      { runId: '3', status: 'failed' },
      { runId: '4', status: 'cancelled' },
      { runId: '5', status: 'completed' },
      { runId: '6', status: 'running' },
    ] as never[]);

    expect(grouped.waiting.map((item) => item.runId)).toEqual(['1']);
    expect(grouped.interrupted.map((item) => item.runId)).toEqual(['2']);
    expect(grouped.failed.map((item) => item.runId)).toEqual(['3']);
    expect(grouped.cancelled.map((item) => item.runId)).toEqual(['4']);
    expect(grouped.completed.map((item) => item.runId)).toEqual(['5']);
    expect(grouped.running.map((item) => item.runId)).toEqual(['6']);
  });

  it('returns consistent labels and colors for terminal states', () => {
    expect(getAgentRunStatusLabel('failed')).toBe('Failed');
    expect(getAgentRunStatusLabel('interrupted')).toBe('Interrupted');
    expect(getAgentRunStatusLabel('cancelled')).toBe('Cancelled');
    expect(getAgentRunStatusColor('failed')).toBe('red');
    expect(getAgentRunStatusColor('interrupted')).toBe('orange');
    expect(getAgentRunStatusColor('cancelled')).toBe('default');
  });
});
