import type { AgentRunStatus, AgentRuntimeStatus, TaskCenterItem } from '@/types/agent';

export const AGENT_ACTIVE_RUN_STATUSES = new Set<AgentRunStatus>([
  'queued',
  'starting',
  'running',
  'waiting_approval',
  'waiting_input',
  'cancelling',
]);

export const AGENT_WAITING_RUN_STATUSES = new Set<AgentRunStatus>([
  'waiting_approval',
  'waiting_input',
]);

export const AGENT_RUNNING_RUN_STATUSES = new Set<AgentRunStatus>([
  'queued',
  'starting',
  'running',
  'cancelling',
]);

export const AGENT_TERMINAL_RUN_STATUSES = new Set<AgentRunStatus>([
  'completed',
  'failed',
  'interrupted',
  'cancelled',
]);

export function isAgentRunStatus(status: string): status is AgentRunStatus {
  return (
    AGENT_ACTIVE_RUN_STATUSES.has(status as AgentRunStatus)
    || AGENT_TERMINAL_RUN_STATUSES.has(status as AgentRunStatus)
  );
}

export function toAgentSessionRuntimeStatus(
  runStatus?: string | null,
): AgentRuntimeStatus {
  if (!runStatus) return 'idle';
  return isAgentRunStatus(runStatus) ? runStatus : 'idle';
}

export function getAgentRunStatusLabel(status?: string | null): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'starting':
      return 'Starting';
    case 'running':
      return 'Working';
    case 'waiting_approval':
      return 'Needs permission';
    case 'waiting_input':
      return 'Needs input';
    case 'cancelling':
      return 'Stopping';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'interrupted':
      return 'Interrupted';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Idle';
  }
}

export function getAgentRunStatusColor(status?: string | null): string {
  switch (status) {
    case 'waiting_approval':
    case 'waiting_input':
      return 'gold';
    case 'queued':
    case 'starting':
    case 'running':
    case 'cancelling':
      return 'blue';
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    case 'interrupted':
      return 'orange';
    case 'cancelled':
      return 'default';
    default:
      return 'default';
  }
}

export function groupTaskCenterItemsByStatus(items: TaskCenterItem[]) {
  return {
    waiting: items.filter((item) => AGENT_WAITING_RUN_STATUSES.has(item.status as AgentRunStatus)),
    running: items.filter((item) => AGENT_RUNNING_RUN_STATUSES.has(item.status as AgentRunStatus)),
    interrupted: items.filter((item) => item.status === 'interrupted'),
    failed: items.filter((item) => item.status === 'failed'),
    completed: items.filter((item) => item.status === 'completed'),
    cancelled: items.filter((item) => item.status === 'cancelled'),
  };
}
