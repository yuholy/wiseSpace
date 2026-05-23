import type { Conversation } from '@/types';
import type { ConversationWorkspaceSnapshot } from '@/types/workspace';

export type WorkspaceContextState = {
  searchEnabled: boolean;
  searchProviderId: string | null;
  enabledMcpServerIds: string[];
  enabledKnowledgeBaseIds: string[];
  enabledMemoryNamespaceIds: string[];
  memoryEnabled: boolean;
  researchMode: boolean;
  toolApprovalMode: 'inherit' | 'ask' | 'allow_safe';
};

export type WorkspaceContextSource = {
  type: 'search' | 'knowledge' | 'memory' | 'tool';
  title: string;
};

type WorkspaceContextStateInput = {
  conversation?: Conversation | null;
  workspaceSnapshot?: ConversationWorkspaceSnapshot | null;
  searchEnabled?: boolean;
  searchProviderId?: string | null;
  enabledMcpServerIds?: string[];
  enabledKnowledgeBaseIds?: string[];
  enabledMemoryNamespaceIds?: string[];
};

export function deriveWorkspaceContextState(
  input: WorkspaceContextStateInput,
): WorkspaceContextState {
  const snapshot = input.workspaceSnapshot;

  if (snapshot) {
    const enabledMemoryNamespaceIds = snapshot.memoryPolicy.enabled
      ? (snapshot.memoryPolicy.namespaceId ? [snapshot.memoryPolicy.namespaceId] : [])
      : [];

    return {
      searchEnabled: snapshot.searchPolicy.enabled,
      searchProviderId: snapshot.searchPolicy.searchProviderId ?? null,
      enabledMcpServerIds: [...snapshot.toolBinding.serverIds],
      enabledKnowledgeBaseIds: [...snapshot.knowledgeBinding.knowledgeBaseIds],
      enabledMemoryNamespaceIds,
      memoryEnabled: snapshot.memoryPolicy.enabled,
      researchMode: snapshot.researchMode,
      toolApprovalMode: snapshot.toolBinding.approvalMode,
    };
  }

  const conversation = input.conversation;
  const enabledMemoryNamespaceIds = input.enabledMemoryNamespaceIds
    ?? conversation?.enabled_memory_namespace_ids
    ?? [];

  return {
    searchEnabled: input.searchEnabled ?? conversation?.search_enabled ?? false,
    searchProviderId: input.searchProviderId ?? conversation?.search_provider_id ?? null,
    enabledMcpServerIds: [...(input.enabledMcpServerIds ?? conversation?.enabled_mcp_server_ids ?? [])],
    enabledKnowledgeBaseIds: [...(input.enabledKnowledgeBaseIds ?? conversation?.enabled_knowledge_base_ids ?? [])],
    enabledMemoryNamespaceIds: [...enabledMemoryNamespaceIds],
    memoryEnabled: enabledMemoryNamespaceIds.length > 0,
    researchMode: false,
    toolApprovalMode: 'ask',
  };
}

export function buildWorkspaceContextSources(
  state: WorkspaceContextState,
): WorkspaceContextSource[] {
  const sources: WorkspaceContextSource[] = [];

  state.enabledKnowledgeBaseIds.forEach((id) => {
    sources.push({ type: 'knowledge', title: id });
  });

  if (state.searchEnabled) {
    sources.push({ type: 'search', title: state.searchProviderId ?? 'search' });
  }

  if (state.researchMode) {
    sources.push({ type: 'search', title: 'research-mode' });
  }

  if (state.memoryEnabled) {
    sources.push({ type: 'memory', title: state.enabledMemoryNamespaceIds[0] ?? 'memory' });
  }

  state.enabledMcpServerIds.forEach((id) => {
    sources.push({ type: 'tool', title: id });
  });

  return sources;
}
