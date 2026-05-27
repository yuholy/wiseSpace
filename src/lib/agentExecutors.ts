export type AgentExecutorId = string;

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
    description: 'wiseSpace built-in local agent runtime with subagent delegation (reviewer, researcher)',
    kind: 'local',
    supportsCwd: true,
    supportsPermissionMode: true,
    supportsAutoMode: false,
  },
];

const AGENT_EXECUTOR_MAP = new Map(AGENT_EXECUTORS.map((executor) => [executor.id, executor]));

export function getAgentExecutorMeta(id?: string | null): AgentExecutorMeta {
  const normalizedId = id ?? DEFAULT_AGENT_EXECUTOR_ID;
  return AGENT_EXECUTOR_MAP.get(normalizedId) ?? AGENT_EXECUTORS[0]!;
}

export function normalizeAgentExecutorId(id?: string | null): AgentExecutorId {
  return id ?? DEFAULT_AGENT_EXECUTOR_ID;
}

export function getAgentExecutorStorageKey(conversationId: string): string {
  return `wisespace:agent-executor:${conversationId}`;
}

export function getAgentExecutorModelStorageKey(conversationId: string, executorId: AgentExecutorId): string {
  return `wisespace:agent-executor-model:${conversationId}:${executorId}`;
}
