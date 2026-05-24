import { describe, expect, it } from 'vitest';
import {
  buildWorkspaceContextSources,
  deriveToolApprovalModeFromAgentPermission,
  deriveWorkspaceContextState,
  resolveEffectiveToolApprovalMode,
} from '../workspaceContextState';

describe('workspaceContextState', () => {
  it('prefers workspace snapshot over legacy conversation fields', () => {
    const state = deriveWorkspaceContextState({
      conversation: {
        id: 'conv-1',
        title: 'Test',
        provider_id: 'provider-1',
        model_id: 'model-1',
        system_prompt: null,
        temperature: null,
        max_tokens: null,
        top_p: null,
        frequency_penalty: null,
        search_enabled: false,
        search_provider_id: null,
        thinking_budget: null,
        thinking_level: null,
        enabled_mcp_server_ids: ['legacy-tool'],
        enabled_knowledge_base_ids: ['legacy-kb'],
        enabled_memory_namespace_ids: ['legacy-memory'],
        context_compression: false,
        category_id: null,
        parent_conversation_id: null,
        is_pinned: false,
        is_archived: false,
        message_count: 0,
        created_at: 1,
        updated_at: 1,
      },
      workspaceSnapshot: {
        searchPolicy: {
          enabled: true,
          searchProviderId: 'snapshot-search',
          queryMode: 'manual',
          resultLimit: 10,
        },
        toolBinding: {
          serverIds: ['snapshot-tool'],
          approvalMode: 'ask',
        },
        knowledgeBinding: {
          knowledgeBaseIds: ['snapshot-kb'],
          autoAttach: true,
        },
        memoryPolicy: {
          enabled: true,
          namespaceId: 'snapshot-memory',
          writeBack: true,
        },
        toggles: {
          searchEnabled: true,
          searchProviderId: 'snapshot-search',
          enabledKnowledgeBaseIds: ['snapshot-kb'],
          enabledMcpServerIds: ['snapshot-tool'],
          memoryEnabled: true,
          memoryNamespaceId: 'snapshot-memory',
          memoryWriteBack: true,
        },
        researchMode: false,
        pinnedArtifactIds: [],
      },
    });

    expect(state).toEqual({
      searchEnabled: true,
      searchProviderId: 'snapshot-search',
      enabledMcpServerIds: ['snapshot-tool'],
      enabledKnowledgeBaseIds: ['snapshot-kb'],
      enabledMemoryNamespaceIds: ['snapshot-memory'],
      memoryEnabled: true,
      researchMode: false,
      toolApprovalMode: 'ask',
    });
  });

  it('falls back to current store values when snapshot is unavailable', () => {
    const state = deriveWorkspaceContextState({
      searchEnabled: true,
      searchProviderId: 'search-live',
      enabledMcpServerIds: ['tool-live'],
      enabledKnowledgeBaseIds: ['kb-live'],
      enabledMemoryNamespaceIds: ['memory-live'],
    });

    expect(buildWorkspaceContextSources(state)).toEqual([
      { type: 'knowledge', title: 'kb-live' },
      { type: 'search', title: 'search-live' },
      { type: 'memory', title: 'memory-live' },
      { type: 'tool', title: 'tool-live' },
    ]);
  });

  it('includes research mode and approval mode from workspace snapshots', () => {
    const state = deriveWorkspaceContextState({
      workspaceSnapshot: {
        searchPolicy: {
          enabled: false,
          queryMode: 'manual',
          resultLimit: 10,
        },
        toolBinding: {
          serverIds: [],
          approvalMode: 'allow_safe',
        },
        knowledgeBinding: {
          knowledgeBaseIds: [],
          autoAttach: false,
        },
        memoryPolicy: {
          enabled: false,
          writeBack: false,
        },
        toggles: {
          searchEnabled: false,
          enabledKnowledgeBaseIds: [],
          enabledMcpServerIds: [],
          memoryEnabled: false,
          memoryWriteBack: false,
        },
        researchMode: true,
        pinnedArtifactIds: [],
      },
    });

    expect(state.researchMode).toBe(true);
    expect(state.toolApprovalMode).toBe('allow_safe');
    expect(buildWorkspaceContextSources(state)).toEqual([
      { type: 'search', title: 'research-mode' },
    ]);
  });

  it('maps agent permissions to effective tool approval mode', () => {
    expect(deriveToolApprovalModeFromAgentPermission('default')).toBe('ask');
    expect(deriveToolApprovalModeFromAgentPermission('accept_edits')).toBe('allow_safe');
    expect(deriveToolApprovalModeFromAgentPermission('full_access')).toBe('allow_safe');
  });

  it('prefers local agent permission for tool approval in agent mode', () => {
    expect(resolveEffectiveToolApprovalMode({
      currentMode: 'agent',
      agentPermissionMode: 'full_access',
      workspaceToolApprovalMode: 'ask',
    })).toBe('allow_safe');

    expect(resolveEffectiveToolApprovalMode({
      currentMode: 'chat',
      agentPermissionMode: 'full_access',
      workspaceToolApprovalMode: 'ask',
    })).toBe('ask');
  });
});
