import type { ExternalAgent } from '@/types';

export type AgentExecutorId = string;

export interface AgentExecutorMeta {
  id: AgentExecutorId;
  name: string;
  shortName: string;
  description: string;
  kind: 'local' | 'external';
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

export function getExternalAgentExecutorId(agentId: string): AgentExecutorId {
  return `external:${agentId}`;
}

export function isExternalAgentExecutorId(id?: string | null): boolean {
  return typeof id === 'string' && id.startsWith('external:');
}

export function getExternalAgentIdFromExecutorId(id?: string | null): string | null {
  if (!isExternalAgentExecutorId(id)) return null;
  const externalAgentId = String(id).slice('external:'.length).trim();
  return externalAgentId || null;
}

export function getExternalAgentExecutorMeta(agent: ExternalAgent): AgentExecutorMeta {
  const supportsPermissionMode = agent.kind === 'pi_adapter';
  return {
    id: getExternalAgentExecutorId(agent.id),
    name: agent.name,
    shortName: agent.name,
    description: agent.baseUrl?.trim()
      ? `Dispatch through external agent connector at ${agent.baseUrl.trim()}`
      : 'Dispatch through an external agent connector',
    kind: 'external',
    supportsCwd: true,
    supportsPermissionMode,
    supportsAutoMode: false,
    supportsModelSelection: false,
  };
}

export function getAgentExecutorMeta(
  id?: string | null,
  externalAgents: ExternalAgent[] = [],
): AgentExecutorMeta {
  const normalizedId = normalizeAgentExecutorId(id);
  if (isExternalAgentExecutorId(normalizedId)) {
    const externalAgentId = getExternalAgentIdFromExecutorId(normalizedId);
    const matchedAgent = externalAgents.find((agent) => agent.id === externalAgentId);
    if (matchedAgent) {
      return getExternalAgentExecutorMeta(matchedAgent);
    }
    return {
      id: normalizedId,
      name: 'External Agent',
      shortName: 'External',
      description: 'Dispatch through an external agent connector',
      kind: 'external',
      supportsCwd: true,
      supportsPermissionMode: false,
      supportsAutoMode: false,
      supportsModelSelection: false,
    };
  }
  return AGENT_EXECUTOR_MAP.get(normalizedId) ?? AGENT_EXECUTORS[0]!;
}

export function normalizeAgentExecutorId(id?: string | null): AgentExecutorId {
  if (isExternalAgentExecutorId(id)) {
    return String(id);
  }
  return DEFAULT_AGENT_EXECUTOR_ID;
}

export function getAgentExecutorStorageKey(conversationId: string): string {
  return `wisespace:agent-executor:${conversationId}`;
}

export function getAgentExecutorModelStorageKey(conversationId: string, executorId: AgentExecutorId): string {
  return `wisespace:agent-executor-model:${conversationId}:${executorId}`;
}
