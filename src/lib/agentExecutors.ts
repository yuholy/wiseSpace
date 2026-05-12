export type AgentExecutorId = 'wisespace-local' | 'claude-code' | 'deepseek-tui';

export interface AgentExecutorMeta {
  id: AgentExecutorId;
  name: string;
  shortName: string;
  description: string;
  kind: 'local';
  supportsCwd: boolean;
  supportsPermissionMode: boolean;
  supportsAutoMode: boolean;
  supportsModelSelection?: boolean;
  modelOptions?: string[];
  modelHint?: string;
}

export const DEFAULT_AGENT_EXECUTOR_ID: AgentExecutorId = 'wisespace-local';

export const AGENT_EXECUTORS: AgentExecutorMeta[] = [
  {
    id: 'wisespace-local',
    name: 'wiseSpace Local',
    shortName: 'wiseSpace',
    description: 'wiseSpace built-in local agent runtime',
    kind: 'local',
    supportsCwd: true,
    supportsPermissionMode: true,
    supportsAutoMode: false,
  },
];

const AGENT_EXECUTOR_MAP = new Map(AGENT_EXECUTORS.map((executor) => [executor.id, executor]));

export function getAgentExecutorMeta(id?: string | null): AgentExecutorMeta {
  return AGENT_EXECUTOR_MAP.get(normalizeAgentExecutorId(id)) ?? AGENT_EXECUTORS[0]!;
}

export function normalizeAgentExecutorId(id?: string | null): AgentExecutorId {
  void id;
  return DEFAULT_AGENT_EXECUTOR_ID;
}

export function getAgentExecutorStorageKey(conversationId: string): string {
  return `wisespace:agent-executor:${conversationId}`;
}

export function getAgentExecutorModelStorageKey(conversationId: string, executorId: AgentExecutorId): string {
  return `wisespace:agent-executor-model:${conversationId}:${executorId}`;
}
