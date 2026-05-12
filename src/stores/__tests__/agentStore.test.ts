import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@/lib/invoke', () => ({
  invoke: invokeMock,
  listen: vi.fn(),
}));

describe('agentStore message-keyed indexes', () => {
  beforeEach(async () => {
    vi.resetModules();
    invokeMock.mockReset();
  });

  it('tracks pending permissions and ask-user events by assistant message key', async () => {
    const { useAgentStore } = await import('../agentStore');

    useAgentStore.setState({
      pendingPermissions: {},
      pendingPermissionsByMessageKey: {},
      pendingAskUser: {},
      pendingAskUserByMessageKey: {},
      toolCalls: {},
      sdkIdToExecId: {},
    });

    useAgentStore.getState().handlePermissionRequest({
      conversationId: 'conv-1',
      assistantMessageId: 'msg-1',
      toolUseId: 'tool-1',
      toolName: 'shell',
      input: { command: 'dir' },
      riskLevel: 'execute',
    });
    useAgentStore.getState().handlePermissionRequest({
      conversationId: 'conv-1',
      assistantMessageId: '',
      toolUseId: 'tool-2',
      toolName: 'shell',
      input: { command: 'pwd' },
      riskLevel: 'read_only',
    });
    useAgentStore.getState().handleAskUser({
      conversationId: 'conv-1',
      assistantMessageId: 'msg-1',
      askId: 'ask-1',
      question: 'continue?',
      options: ['yes', 'no'],
    });

    const state = useAgentStore.getState();
    expect(state.pendingPermissionsByMessageKey['conv-1:msg-1']?.map((request) => request.toolUseId)).toEqual(['tool-1']);
    expect(state.pendingPermissionsByMessageKey['conv-1:']?.map((request) => request.toolUseId)).toEqual(['tool-2']);
    expect(state.pendingAskUserByMessageKey['conv-1:msg-1']?.map((request) => request.askId)).toEqual(['ask-1']);

    useAgentStore.getState().handlePermissionResolved('tool-1', 'approve');
    useAgentStore.getState().handleAskUserResolved('ask-1');

    const resolvedState = useAgentStore.getState();
    expect(resolvedState.pendingPermissionsByMessageKey['conv-1:msg-1']).toBeUndefined();
    expect(resolvedState.pendingPermissionsByMessageKey['conv-1:']?.map((request) => request.toolUseId)).toEqual(['tool-2']);
    expect(resolvedState.pendingAskUserByMessageKey['conv-1:msg-1']).toBeUndefined();
  });

  it('refreshes conversation state before approving a permission when the active run id is missing', async () => {
    invokeMock.mockImplementation(async (command: string, payload?: Record<string, unknown>) => {
      if (command === 'agent_get_profile') {
        return {
          id: 'profile-1',
          conversationId: 'conv-1',
          permissionMode: 'default',
          defaultRunnerKind: 'sdk',
          defaultProviderId: null,
          defaultModelId: null,
          createdAt: '2026-05-11T00:00:00Z',
          updatedAt: '2026-05-11T00:00:00Z',
        };
      }
      if (command === 'agent_list_runs') {
        return [{
          id: 'run-1',
          conversationId: 'conv-1',
          profileId: 'profile-1',
          runnerKind: 'sdk',
          status: 'waiting_approval',
          promptSnapshot: 'prompt',
          startedAt: '2026-05-11T00:00:00Z',
          costUsd: 0,
          resumeCapability: 'none',
        }];
      }
      if (command === 'agent_list_run_events') {
        return [];
      }
      if (command === 'agent_control_run') {
        return payload;
      }
      throw new Error(`Unexpected invoke: ${command}`);
    });

    const { useAgentStore } = await import('../agentStore');

    const permissionEvent = {
      conversationId: 'conv-1',
      assistantMessageId: 'msg-1',
      toolUseId: 'tool-1',
      toolName: 'bash',
      input: { command: 'dir' },
      riskLevel: 'execute' as const,
    };

    useAgentStore.setState({
      activeRunIdByConversation: {},
      runsByConversation: {},
      runEventsByRunId: {},
      profilesByConversation: {},
      sessions: {},
      pendingPermissions: {
        'tool-1': permissionEvent,
      },
      pendingPermissionsByMessageKey: {
        'conv-1:msg-1': [permissionEvent],
      },
    });

    await useAgentStore.getState().approveToolUse('conv-1', 'tool-1', 'allow_once');

    expect(invokeMock).toHaveBeenCalledWith('agent_list_runs', { conversationId: 'conv-1' });
    expect(invokeMock).toHaveBeenCalledWith('agent_control_run', expect.objectContaining({
      input: expect.objectContaining({
        runId: 'run-1',
        targetId: 'tool-1',
        value: 'allow_once',
      }),
    }));
  });

  it('marks tool calls as waiting approval when a permission request arrives', async () => {
    const { useAgentStore } = await import('../agentStore');

    useAgentStore.setState({
      toolCalls: {
        'tool-1': {
          toolUseId: 'tool-1',
          toolName: 'bash',
          input: { command: 'dir' },
          assistantMessageId: 'msg-1',
          executionStatus: 'queued',
        },
      },
      sdkIdToExecId: {},
      pendingPermissions: {},
      pendingPermissionsByMessageKey: {},
    });

    useAgentStore.getState().handlePermissionRequest({
      conversationId: 'conv-1',
      assistantMessageId: 'msg-1',
      toolUseId: 'tool-1',
      toolName: 'bash',
      input: { command: 'dir' },
      riskLevel: 'execute',
    });

    expect(useAgentStore.getState().toolCalls['tool-1']?.approvalStatus).toBe('pending');
    expect(useAgentStore.getState().pendingPermissions['tool-1']?.toolName).toBe('bash');
  });
});
