import { useMemo } from 'react';
import { Tabs, Empty, List, Descriptions, Tag, Typography, theme } from 'antd';
import {
  Search,
  Wrench,
  Paperclip,
  Info,
  FileText,
  Activity,
  Bot,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Shield,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useConversationStore, useArtifactStore, useAgentStore } from '@/stores';
import { buildWorkspaceContextSources, deriveWorkspaceContextState } from '@/lib/workspaceContextState';

const EMPTY_AGENT_RUNS: readonly [] = [];
const EMPTY_AGENT_RUN_EVENTS: readonly [] = [];

interface ChatInspectorProps {
  visible: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  conversationId: string | null;
}

export function ChatInspector({
  visible,
  activeTab,
  onTabChange,
  conversationId,
}: ChatInspectorProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  const conversation = useConversationStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId),
  );
  const workspaceSnapshot = useConversationStore((s) => s.workspaceSnapshot);
  const searchEnabled = useConversationStore((s) => s.searchEnabled);
  const searchProviderId = useConversationStore((s) => s.searchProviderId);
  const enabledMcpServerIds = useConversationStore((s) => s.enabledMcpServerIds);
  const enabledKnowledgeBaseIds = useConversationStore((s) => s.enabledKnowledgeBaseIds);
  const enabledMemoryNamespaceIds = useConversationStore((s) => s.enabledMemoryNamespaceIds);
  const messages = useConversationStore((s) => s.messages);
  const { artifacts } = useArtifactStore();
  const agentProfile = useAgentStore((s) =>
    conversationId ? s.profilesByConversation[conversationId] : undefined,
  );
  const agentRuns = useAgentStore((s) =>
    conversationId ? s.runsByConversation[conversationId] ?? EMPTY_AGENT_RUNS : EMPTY_AGENT_RUNS,
  );
  const agentRunEvents = useAgentStore((s) => {
    if (!conversationId) return EMPTY_AGENT_RUN_EVENTS;
    const latestRunId = s.runsByConversation[conversationId]?.[0]?.id;
    return latestRunId ? s.runEventsByRunId[latestRunId] ?? EMPTY_AGENT_RUN_EVENTS : EMPTY_AGENT_RUN_EVENTS;
  });
  const latestRun = agentRuns[0];
  const currentMode = conversation?.mode ?? 'chat';

  const contextState = useMemo(() => {
    return deriveWorkspaceContextState({
      conversation,
      workspaceSnapshot,
      searchEnabled,
      searchProviderId,
      enabledMcpServerIds,
      enabledKnowledgeBaseIds,
      enabledMemoryNamespaceIds,
    });
  }, [
    conversation,
    workspaceSnapshot,
    searchEnabled,
    searchProviderId,
    enabledMcpServerIds,
    enabledKnowledgeBaseIds,
    enabledMemoryNamespaceIds,
  ]);

  const contextSources = useMemo(
    () => buildWorkspaceContextSources(contextState),
    [contextState],
  );

  const toolApprovalLabel = useMemo(() => {
    switch (contextState.toolApprovalMode) {
      case 'allow_safe':
        return t('chat.inspector.toolApprovalAllowSafe', 'Allow safe tools');
      case 'inherit':
        return t('chat.inspector.toolApprovalInherit', 'Inherit from tool policy');
      default:
        return t('chat.inspector.toolApprovalAsk', 'Ask before tool use');
    }
  }, [contextState.toolApprovalMode, t]);

  const agentPermissionSummary = useMemo(() => {
    switch (agentProfile?.permissionMode) {
      case 'full_access':
        return {
          label: t('chat.inspector.permissionFullAccess', 'Full access'),
          color: 'red' as const,
          icon: <ShieldAlert size={12} />,
        };
      case 'accept_edits':
        return {
          label: t('chat.inspector.permissionAcceptEdits', 'Accept edits'),
          color: 'gold' as const,
          icon: <ShieldCheck size={12} />,
        };
      default:
        return {
          label: t('chat.inspector.permissionDefault', 'Ask each time'),
          color: 'default' as const,
          icon: <Shield size={12} />,
        };
    }
  }, [agentProfile?.permissionMode, t]);

  const toolCalls = useMemo(() => {
    return agentRunEvents
      .filter((event) => event.eventType === 'tool_use' || event.eventType === 'tool_result')
      .map((event) => {
        let payload: Record<string, unknown> = {};
        try {
          payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
        } catch {
          payload = {};
        }
        return {
          name: String(payload.toolName ?? event.eventType),
          messageId: String(payload.assistantMessageId ?? event.runId),
        };
      });
  }, [agentRunEvents]);

  const conversationArtifacts = useMemo(() => {
    if (!conversationId) return [];
    return artifacts.filter((a) => a.conversationId === conversationId);
  }, [artifacts, conversationId]);

  const runTimeline = useMemo(() => {
    return agentRunEvents.map((event) => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(event.payloadJson) as Record<string, unknown>;
      } catch {
        payload = {};
      }
      const title = String(payload.toolName ?? payload.message ?? event.eventType);
      return {
        id: event.id,
        type: event.eventType,
        title,
        createdAt: event.createdAt,
      };
    });
  }, [agentRunEvents]);

  const tabItems = useMemo(
    () => [
      {
        key: 'sources',
        label: t('chat.inspector.sources'),
        icon: <Search size={14} />,
        children: contextSources.length > 0 ? (
          <List
            size="small"
            dataSource={contextSources}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={<Typography.Text>{item.title}</Typography.Text>}
                  description={<Tag>{item.type}</Tag>}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description={t('common.noData')} style={{ marginTop: 48 }} />
        ),
      },
      {
        key: 'tools',
        label: t('chat.inspector.tools'),
        icon: <Wrench size={14} />,
        children: toolCalls.length > 0 ? (
          <List
            size="small"
            dataSource={toolCalls}
            renderItem={(item) => (
              <List.Item>
                <Typography.Text code>{item.name}</Typography.Text>
              </List.Item>
            )}
          />
        ) : (
          <Empty description={t('chat.inspector.tools')} style={{ marginTop: 48 }} />
        ),
      },
      {
        key: 'attachments',
        label: t('chat.inspector.attachments'),
        icon: <Paperclip size={14} />,
        children: (() => {
          const attachments = messages.flatMap((m) => m.attachments ?? []);
          return attachments.length > 0 ? (
            <List
              size="small"
              dataSource={attachments}
              renderItem={(item) => (
                <List.Item>
                  <Typography.Text ellipsis>{item.file_name}</Typography.Text>
                </List.Item>
              )}
            />
          ) : (
            <Empty description={t('chat.inspector.attachments')} style={{ marginTop: 48 }} />
          );
        })(),
      },
      {
        key: 'session',
        label: t('chat.inspector.session'),
        icon: <Info size={14} />,
        children: conversation ? (
          <Descriptions column={1} size="small" style={{ padding: '8px 0' }}>
            <Descriptions.Item label={t('chat.inspector.session')}>
              <Typography.Text copyable={{ text: conversation.id }}>
                {conversation.id.slice(0, 8)}...
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('chat.inspector.mode', 'Mode')}>
              <Tag
                color={currentMode === 'agent' ? 'blue' : 'default'}
                icon={currentMode === 'agent' ? <Bot size={12} /> : <MessageSquare size={12} />}
              >
                {currentMode === 'agent' ? t('common.agentMode') : t('common.chatMode')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('chat.inspector.boundary', 'Boundary')}>
              {currentMode === 'agent'
                ? t('chat.inspector.agentBoundary', 'Agent mode can run tools, write files, and follow workspace execution policies.')
                : t('chat.inspector.chatBoundary', 'Chat mode stays in conversation flow without agent execution.')}
            </Descriptions.Item>
            <Descriptions.Item label={t('gateway.defaultProvider')}>
              {latestRun?.providerId || conversation.provider_id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('gateway.defaultModel')}>
              {latestRun?.modelId || conversation.model_id || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('common.status', 'Status')}>
              {latestRun?.status || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('common.permission', 'Permission')}>
              <Tag color={agentPermissionSummary.color} icon={agentPermissionSummary.icon}>
                {agentPermissionSummary.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('chat.inspector.toolApproval', 'Tool approval')}>
              <Tag
                color={
                  contextState.toolApprovalMode === 'allow_safe'
                    ? 'green'
                    : contextState.toolApprovalMode === 'inherit'
                      ? 'blue'
                      : 'default'
                }
              >
                {toolApprovalLabel}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('chat.inspector.researchMode', 'Research mode')}>
              <Tag color={contextState.researchMode ? 'purple' : 'default'}>
                {contextState.researchMode ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label={t('chat.inspector.workspace', 'Workspace')}>
              <Typography.Text ellipsis>
                {agentProfile?.workspaceRoot || t('chat.inspector.workspaceBindings', 'Conversation workspace bindings')}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('gateway.created')}>
              {new Date(conversation.created_at).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label={t('chat.inspector.tools')}>
              {conversation.message_count}
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Empty description={t('common.noData')} style={{ marginTop: 48 }} />
        ),
      },
      {
        key: 'run',
        label: 'Run',
        icon: <Activity size={14} />,
        children: latestRun ? (
          <div style={{ padding: '8px 0' }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Status">
                <Tag>{latestRun.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Runner">
                {latestRun.runnerKind}
              </Descriptions.Item>
              <Descriptions.Item label="Resume">
                {latestRun.resumeCapability || 'none'}
              </Descriptions.Item>
              <Descriptions.Item label="Interrupted">
                {latestRun.interruptedReason || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Started">
                {latestRun.startedAt}
              </Descriptions.Item>
              <Descriptions.Item label="Finished">
                {latestRun.finishedAt || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Cost">
                {latestRun.costUsd ? `$${latestRun.costUsd.toFixed(4)}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Error">
                {latestRun.errorSummary || '-'}
              </Descriptions.Item>
            </Descriptions>
            <List
              size="small"
              dataSource={runTimeline}
              style={{ marginTop: 12 }}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={<Typography.Text>{item.type}</Typography.Text>}
                    description={
                      <Typography.Text type="secondary" ellipsis>
                        {item.title}
                      </Typography.Text>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        ) : (
          <Empty description={t('common.noData')} style={{ marginTop: 48 }} />
        ),
      },
      {
        key: 'artifacts',
        label: t('chat.inspector.artifacts'),
        icon: <FileText size={14} />,
        children: conversationArtifacts.length > 0 ? (
          <List
            size="small"
            dataSource={conversationArtifacts}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={<Typography.Text>{item.title}</Typography.Text>}
                  description={<Tag>{item.kind}</Tag>}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description={t('common.noData')} style={{ marginTop: 48 }} />
        ),
      },
    ],
    [
      t,
      contextSources,
      toolCalls,
      messages,
      conversation,
      currentMode,
      latestRun,
      agentPermissionSummary,
      contextState.researchMode,
      contextState.toolApprovalMode,
      toolApprovalLabel,
      agentProfile?.workspaceRoot,
      runTimeline,
      conversationArtifacts,
    ],
  );

  return (
    <div
      style={{
        width: visible ? 360 : 0,
        minWidth: visible ? 360 : 0,
        overflow: 'hidden',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        borderLeft: visible ? '1px solid var(--border-color)' : 'none',
        backgroundColor: token.colorBgContainer,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {visible && (
        <Tabs
          activeKey={activeTab}
          onChange={onTabChange}
          items={tabItems}
          size="small"
          style={{ flex: 1, padding: '0 12px' }}
        />
      )}
    </div>
  );
}
