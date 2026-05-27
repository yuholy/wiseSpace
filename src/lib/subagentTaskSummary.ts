import type { AgentTask } from '@/types';

export function getAgentTaskTypeLabel(taskType: string): string {
  switch (taskType) {
    case 'review':
      return 'Code Review';
    case 'research':
      return 'Research';
    default:
      return taskType;
  }
}

export function getSubagentTaskSummary(task: AgentTask): string {
  const typeLabel = getAgentTaskTypeLabel(task.taskType);
  const status = task.status;
  if (task.error_message) {
    return `[${typeLabel}] ${status}: ${task.error_message}`;
  }
  if (task.result_payload_json) {
    try {
      const result = JSON.parse(task.result_payload_json);
      if (result.content) {
        const preview = result.content.slice(0, 120);
        return `[${typeLabel}] ${preview}${result.content.length > 120 ? '...' : ''}`;
      }
    } catch {
      // ignore
    }
  }
  return `[${typeLabel}] ${status}`;
}
