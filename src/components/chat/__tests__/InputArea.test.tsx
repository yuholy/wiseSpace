import { App } from 'antd';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InputArea } from '../InputArea';

const sendMessage = vi.fn();
const createConversation = vi.fn();
const setSearchEnabled = vi.fn();
const setSearchProviderId = vi.fn();
const loadSearchProviders = vi.fn();
const loadMcpServers = vi.fn();
const toggleMcpServer = vi.fn();
const loadKnowledgeBases = vi.fn();
const toggleKnowledgeBase = vi.fn();
const loadMemoryNamespaces = vi.fn();
const toggleMemoryNamespace = vi.fn();
const setThinkingBudget = vi.fn();
const setThinkingLevel = vi.fn();
const insertContextClear = vi.fn();
const setActivePage = vi.fn();
const setSettingsSection = vi.fn();
const sendAgentMessage = vi.fn();
const setActiveAgentExecutorId = vi.fn();
const setActiveAgentExecutorModel = vi.fn();
const updateAgentCwd = vi.fn();
const updateAgentPermissionMode = vi.fn();
const fetchAgentProfile = vi.fn();
const dispatchTask = vi.fn();
const syncTask = vi.fn();
const loadExternalAgents = vi.fn();
const fetchMessages = vi.fn();

const conversationState = {
  streaming: false,
  compressing: false,
  activeConversationId: 'conv-1',
  sendMessage,
  sendAgentMessage,
  createConversation,
  fetchMessages,
  messages: [],
  totalActiveCount: 0,
  hasOlderMessages: false,
  conversations: [
    {
      id: 'conv-1',
      title: 'Test',
      mode: 'chat',
      provider_id: 'provider-1',
      model_id: 'model-1',
    },
  ],
  searchEnabled: true,
  searchProviderId: 'search-1',
  workspaceSnapshot: null,
  setSearchEnabled,
  setSearchProviderId,
  enabledMcpServerIds: [] as string[],
  toggleMcpServer,
  enabledKnowledgeBaseIds: [] as string[],
  toggleKnowledgeBase,
  enabledMemoryNamespaceIds: [] as string[],
  toggleMemoryNamespace,
  thinkingBudget: null as number | null,
  thinkingLevel: null as string | null,
  setThinkingBudget,
  setThinkingLevel,
  insertContextClear,
  activeAgentExecutorId: null as string | null,
  setActiveAgentExecutorId,
  setActiveAgentExecutorModel,
};

const agentState = {
  profilesByConversation: {} as Record<string, { workspaceRoot?: string | null; permissionMode?: string | null }>,
  updateCwd: updateAgentCwd,
  updatePermissionMode: updateAgentPermissionMode,
  fetchProfile: fetchAgentProfile,
};

const providerState = {
  providers: [
    {
      id: 'provider-1',
      provider_type: 'gemini',
      enabled: true,
      models: [
        {
          provider_id: 'provider-1',
          model_id: 'model-1',
          name: 'model-1',
          model_type: 'Chat',
          enabled: true,
          capabilities: [] as string[],
          max_tokens: 128000,
          param_overrides: null,
        },
      ],
    },
  ],
};

const settingsState = {
  settings: {
    default_provider_id: null,
    default_model_id: null,
  },
};

const searchState = {
  providers: [
    {
      id: 'search-1',
      name: 'Test Search',
      providerType: 'tavily',
    },
  ],
  loadProviders: loadSearchProviders,
};

const mcpState = {
  servers: [],
  loadServers: loadMcpServers,
};

const knowledgeState = {
  bases: [],
  loadBases: loadKnowledgeBases,
};

const memoryState = {
  namespaces: [],
  loadNamespaces: loadMemoryNamespaces,
};

const externalAgentState = {
  agents: [
    {
      id: 'pi-agent-1',
      name: 'Pi Adapter',
      kind: 'pi_adapter',
      baseUrl: 'http://127.0.0.1:8789',
      authType: 'none',
      authConfigJson: null,
      capabilitiesJson: '{}',
      enabled: true,
      createdAt: 0,
      updatedAt: 0,
    },
  ],
  loadAgents: loadExternalAgents,
  dispatchTask,
  syncTask,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('@/stores', () => ({
  useConversationStore: Object.assign(
    (selector: (state: typeof conversationState) => unknown) => selector(conversationState),
    { getState: () => conversationState },
  ),
  useAgentStore: Object.assign(
    (selector: (state: typeof agentState) => unknown) => selector(agentState),
    { getState: () => agentState },
  ),
  useProviderStore: Object.assign(
    (selector: (state: typeof providerState) => unknown) => selector(providerState),
    { getState: () => providerState },
  ),
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
  useSearchStore: (selector: (state: typeof searchState) => unknown) => selector(searchState),
  useMcpStore: (selector: (state: typeof mcpState) => unknown) => selector(mcpState),
  useKnowledgeStore: (selector: (state: typeof knowledgeState) => unknown) => selector(knowledgeState),
  useMemoryStore: (selector: (state: typeof memoryState) => unknown) => selector(memoryState),
}));

vi.mock('@/stores/uiStore', () => ({
  useUIStore: (selector: (state: { setActivePage: typeof setActivePage; setSettingsSection: typeof setSettingsSection }) => unknown) =>
    selector({ setActivePage, setSettingsSection }),
}));

vi.mock('@/stores/externalAgentStore', () => ({
  useExternalAgentStore: (selector: (state: typeof externalAgentState) => unknown) => selector(externalAgentState),
}));

vi.mock('@/lib/modelCapabilities', () => ({
  findModelByIds: (providers: typeof providerState.providers, providerId: string, modelId: string) =>
    providers.find((provider) => provider.id === providerId)?.models.find((model) => model.model_id === modelId) ?? null,
  supportsReasoning: (model: { capabilities?: string[] } | null | undefined) => model?.capabilities?.includes('Reasoning') ?? false,
  modelHasCapability: (model: { capabilities?: string[] } | null | undefined, capability: string) =>
    model?.capabilities?.includes(capability) ?? false,
}));

vi.mock('@/components/shared/SearchProviderIcon', () => ({
  SearchProviderTypeIcon: () => null,
  PROVIDER_TYPE_LABELS: {
    tavily: 'Tavily',
  },
}));

vi.mock('@lobehub/icons', () => ({
  ModelIcon: () => null,
}));

vi.mock('../VoiceCall', () => ({
  VoiceCall: () => null,
}));

vi.mock('../ConversationSettingsModal', () => ({
  ConversationSettingsModal: () => null,
}));

vi.mock('../ModelSelector', () => ({
  ModelSelector: () => null,
}));

describe('InputArea', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAgentProfile.mockResolvedValue(null);
    loadExternalAgents.mockResolvedValue(undefined);
    fetchMessages.mockResolvedValue(undefined);
    syncTask.mockResolvedValue({
      task: {
        id: 'task-sync',
        conversationId: 'conv-1',
        workspaceId: null,
        parentRunId: null,
        parentTaskId: null,
        sourceMessageId: 'msg-sync',
        externalAgentId: 'pi-agent-1',
        externalTaskId: 'task-sync',
        assigneeKind: 'external_agent',
        assigneeLabel: 'Pi Adapter',
        delegationDepth: 0,
        kind: 'code',
        taskType: 'code',
        presetKey: null,
        delegationReason: null,
        inputText: 'sync',
        status: 'completed',
        title: 'sync',
        requestPayloadJson: '{}',
        resultPayloadJson: '{}',
        errorMessage: null,
        createdAt: 0,
        updatedAt: 0,
      },
      assistantMessage: null,
    });
    providerState.providers[0].provider_type = 'gemini';
    providerState.providers[0].models[0].model_id = 'model-1';
    providerState.providers[0].models[0].name = 'model-1';
    providerState.providers[0].models[0].capabilities = [];
    providerState.providers[0].models[0].param_overrides = null;
    conversationState.conversations[0].model_id = 'model-1';
    conversationState.conversations[0].mode = 'chat';
    conversationState.thinkingBudget = null;
    conversationState.thinkingLevel = null;
    conversationState.activeAgentExecutorId = null;
    agentState.profilesByConversation = {};
  });

  it('clears the textarea immediately after sending even while search-backed send is still pending', async () => {
    let resolveSend!: () => void;
    sendMessage.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        }),
    );

    render(
      <App>
        <InputArea />
      </App>,
    );

    const textarea = screen.getByPlaceholderText('chat.inputPlaceholder') as HTMLTextAreaElement;
    await userEvent.type(textarea, 'search me');

    expect(textarea.value).toBe('search me');

    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    expect(sendMessage).toHaveBeenCalledWith('search me', undefined, 'search-1');
    expect(textarea.value).toBe('');

    resolveSend();
  });

  it('renders model-specific reasoning options for Gemini 3.1 models', async () => {
    providerState.providers[0].provider_type = 'gemini';
    providerState.providers[0].models[0].model_id = 'gemini-3.1-flash';
    providerState.providers[0].models[0].name = 'Gemini 3.1 Flash';
    providerState.providers[0].models[0].capabilities = ['Reasoning'];
    conversationState.conversations[0].model_id = 'gemini-3.1-flash';

    render(
      <App>
        <InputArea />
      </App>,
    );

    await userEvent.click(screen.getByLabelText('chat.thinkingIntensity'));

    expect(await screen.findByText('Minimal')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.queryByText('XHigh')).not.toBeInTheDocument();
  });

  it('shows Pi permission controls and dispatches external tasks with permission context', async () => {
    conversationState.conversations[0].mode = 'agent';
    conversationState.activeAgentExecutorId = 'external:pi-agent-1';
    agentState.profilesByConversation = {
      'conv-1': {
        workspaceRoot: 'E:/project/wiseSpace',
        permissionMode: 'accept_edits',
      },
    };
    dispatchTask.mockResolvedValueOnce({
      task: {
        id: 'task-1',
        conversationId: 'conv-1',
        workspaceId: null,
        parentRunId: null,
        parentTaskId: null,
        sourceMessageId: 'msg-1',
        externalAgentId: 'pi-agent-1',
        externalTaskId: 'task-1',
        assigneeKind: 'external_agent',
        assigneeLabel: 'Pi Adapter',
        delegationDepth: 0,
        kind: 'code',
        taskType: 'code',
        presetKey: null,
        delegationReason: null,
        inputText: '帮我检查一下',
        status: 'running',
        title: '帮我检查一下',
        requestPayloadJson: '{}',
        resultPayloadJson: null,
        errorMessage: null,
        createdAt: 0,
        updatedAt: 0,
      },
      assistantMessage: null,
    });

    render(
      <App>
        <InputArea />
      </App>,
    );

    expect(screen.getByText('common.permissionAcceptEdits')).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText('chat.inputPlaceholder') as HTMLTextAreaElement;
    await userEvent.type(textarea, '帮我检查一下');
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(dispatchTask).toHaveBeenCalledWith(expect.objectContaining({
        conversationId: 'conv-1',
        externalAgentId: 'pi-agent-1',
        inputText: '帮我检查一下',
        contextJson: JSON.stringify({
          workspaceRoot: 'E:/project/wiseSpace',
          permissionMode: 'accept_edits',
        }),
      }));
    });
  });
});
