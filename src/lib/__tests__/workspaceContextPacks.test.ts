import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteWorkspaceContextPack,
  describeWorkspaceContextPack,
  listWorkspaceContextPacks,
  saveWorkspaceContextPack,
} from '../workspaceContextPacks';

function makeSnapshot() {
  return {
    searchPolicy: {
      enabled: true,
      searchProviderId: 'search-1',
      queryMode: 'auto' as const,
      resultLimit: 8,
    },
    toolBinding: {
      serverIds: ['mcp-1'],
      approvalMode: 'ask' as const,
    },
    knowledgeBinding: {
      knowledgeBaseIds: ['kb-1'],
      autoAttach: true,
    },
    memoryPolicy: {
      enabled: true,
      namespaceId: 'mem-1',
      writeBack: true,
    },
    toggles: {
      searchEnabled: true,
      searchProviderId: 'search-1',
      enabledKnowledgeBaseIds: ['kb-1'],
      enabledMcpServerIds: ['mcp-1'],
      memoryEnabled: true,
      memoryNamespaceId: 'mem-1',
      memoryWriteBack: true,
    },
    researchMode: true,
    pinnedArtifactIds: [],
  };
}

describe('workspaceContextPacks', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and lists packs by workspace key', () => {
    const pack = saveWorkspaceContextPack({
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      workspaceName: 'Main workspace',
      label: 'Saved pack',
      snapshot: makeSnapshot(),
    });

    expect(pack).not.toBeNull();
    const packs = listWorkspaceContextPacks('ws-1', 'conv-1');
    expect(packs).toHaveLength(1);
    expect(packs[0]?.label).toBe('Saved pack');
  });

  it('deletes saved packs', () => {
    const pack = saveWorkspaceContextPack({
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      workspaceName: 'Main workspace',
      label: 'Saved pack',
      snapshot: makeSnapshot(),
    });

    expect(pack).not.toBeNull();
    deleteWorkspaceContextPack(pack!.id);
    expect(listWorkspaceContextPacks('ws-1', 'conv-1')).toHaveLength(0);
  });

  it('builds a readable summary line', () => {
    const pack = saveWorkspaceContextPack({
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      workspaceName: 'Main workspace',
      label: 'Saved pack',
      snapshot: makeSnapshot(),
    });

    expect(pack).not.toBeNull();
    expect(describeWorkspaceContextPack(pack!)).toContain('Search on');
    expect(describeWorkspaceContextPack(pack!)).toContain('1 tool server');
  });
});
