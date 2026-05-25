import { useEffect, useMemo, useState } from 'react';
import { App, Button, Descriptions, Empty, List, Modal, Space, Tabs, Tag, Typography, theme } from 'antd';
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
import { invoke } from '@/lib/invoke';
import { useConversationStore, useArtifactStore, useAgentStore, useExternalAgentStore } from '@/stores';
import { buildProactiveTaskSuggestions } from '@/lib/proactiveTaskSuggestions';
import {
  deleteWorkspaceContextPack,
  describeWorkspaceContextPack,
  listWorkspaceContextPacks,
  saveWorkspaceContextPack,
  type WorkspaceContextPack,
} from '@/lib/workspaceContextPacks';
import {
  buildWorkspaceContextSources,
  deriveWorkspaceContextState,
  resolveEffectiveToolApprovalMode,
} from '@/lib/workspaceContextState';
import { getAgentTaskTypeLabel, getExternalTaskSummary } from '@/lib/externalTaskSummary';
import type { AgentTask, AgentTaskEvent } from '@/types';

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
  const { t, i18n } = useTranslation();
  const { token } = theme.useToken();
  const { message: messageApi } = App.useApp();
  const isZh = (i18n.resolvedLanguage ?? i18n.language ?? '').toLowerCase().startsWith('zh');
  const localizedDefault = (zh: string, en: string) => (isZh ? zh : en);
  const getLocalizedTaskTypeLabel = (taskType: string) => {
    switch (taskType) {
      case 'review':
        return t('chat.inspector.taskTypeReview', 'Review');
      case 'research':
        return t('chat.inspector.taskTypeResearch', 'Research');
      case 'scan_files':
        return t('chat.inspector.taskTypeScanFiles', 'Scan Files');
      case 'summarize':
        return t('chat.inspector.taskTypeSummarize', 'Summarize');
      case 'plan':
        return t('chat.inspector.taskTypePlan', 'Plan');
      default:
        return getAgentTaskTypeLabel(taskType);
    }
  };

  const conversation = useConversationStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId),
  );
  const workspaceSnapshot = useConversationStore((s) => s.workspaceSnapshot);
  const updateWorkspaceSnapshot = useConversationStore((s) => s.updateWorkspaceSnapshot);
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
  const resumeRun = useAgentStore((s) => s.resumeRun);
  const agentRuns = useAgentStore((s) =>
    conversationId ? s.runsByConversation[conversationId] ?? EMPTY_AGENT_RUNS : EMPTY_AGENT_RUNS,
  );
  const agentRunEvents = useAgentStore((s) => {
    if (!conversationId) return EMPTY_AGENT_RUN_EVENTS;
    const latestRunId = s.runsByConversation[conversationId]?.[0]?.id;
    return latestRunId ? s.runEventsByRunId[latestRunId] ?? EMPTY_AGENT_RUN_EVENTS : EMPTY_AGENT_RUN_EVENTS;
  });
  const createDelegatedSubagentTask = useExternalAgentStore((s) => s.createDelegatedSubagentTask);
  const runDelegatedSubagentTask = useExternalAgentStore((s) => s.runDelegatedSubagentTask);
  const listTaskEvents = useExternalAgentStore((s) => s.listTaskEvents);
  const latestRun = agentRuns[0];
  const currentMode = conversation?.mode ?? 'chat';
  const [delegatedTasks, setDelegatedTasks] = useState<AgentTask[]>([]);
  const [delegatedTasksLoading, setDelegatedTasksLoading] = useState(false);
  const [delegatedActionTaskId, setDelegatedActionTaskId] = useState<string | null>(null);
  const [selectedDelegatedTaskId, setSelectedDelegatedTaskId] = useState<string | null>(null);
  const [selectedDelegatedTaskEvents, setSelectedDelegatedTaskEvents] = useState<AgentTaskEvent[]>([]);
  const [delegatedTaskEventsOpen, setDelegatedTaskEventsOpen] = useState(false);
  const [delegatedTaskEventsLoading, setDelegatedTaskEventsLoading] = useState(false);
  const [contextPacks, setContextPacks] = useState<WorkspaceContextPack[]>([]);
  const [contextPackActionId, setContextPackActionId] = useState<string | null>(null);

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

  const effectiveToolApprovalMode = useMemo(() => resolveEffectiveToolApprovalMode({
    currentMode,
    agentPermissionMode: agentProfile?.permissionMode,
    workspaceToolApprovalMode: contextState.toolApprovalMode,
  }), [agentProfile?.permissionMode, contextState.toolApprovalMode, currentMode]);

  const toolApprovalLabel = useMemo(() => {
    switch (effectiveToolApprovalMode) {
      case 'allow_safe':
        return currentMode === 'agent'
          ? t('chat.inspector.toolApprovalFollowLocalRelaxed', 'Follow local permission')
          : t('chat.inspector.toolApprovalAllowSafe', 'Allow safe tools');
      case 'inherit':
        return t('chat.inspector.toolApprovalInherit', 'Inherit from tool policy');
      default:
        return currentMode === 'agent'
          ? t('chat.inspector.toolApprovalFollowLocalStrict', 'Follow local permission')
          : t('chat.inspector.toolApprovalAsk', 'Ask before tool use');
    }
  }, [currentMode, effectiveToolApprovalMode, t]);

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

  const latestUserMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'user') {
        return message.id;
      }
    }
    return null;
  }, [messages]);

  const latestUserMessageText = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message.role === 'user' && message.content.trim()) {
        return message.content.trim();
      }
    }
    return '';
  }, [messages]);

  const proactiveSuggestions = useMemo(
    () => buildProactiveTaskSuggestions({
      currentMode,
      latestRun,
      latestUserText: latestUserMessageText,
      existingTaskTypes: delegatedTasks.map((task) => task.taskType || task.kind),
    }),
    [currentMode, delegatedTasks, latestRun, latestUserMessageText],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadDelegatedTasks() {
      if (!latestRun?.id) {
        setDelegatedTasks([]);
        return;
      }
      setDelegatedTasksLoading(true);
      try {
        const tasks = await invoke<AgentTask[]>('list_agent_tasks', {
          parentRunId: latestRun.id,
          limit: 20,
        });
        if (!cancelled) {
          setDelegatedTasks(tasks);
        }
      } catch {
        if (!cancelled) {
          setDelegatedTasks([]);
        }
      } finally {
        if (!cancelled) {
          setDelegatedTasksLoading(false);
        }
      }
    }

    void loadDelegatedTasks();
    return () => {
      cancelled = true;
    };
  }, [latestRun?.id]);

  useEffect(() => {
    setContextPacks(listWorkspaceContextPacks(conversation?.workspace_id, conversationId));
  }, [conversation?.workspace_id, conversationId, workspaceSnapshot]);

  const createReviewDelegatedTask = async () => {
    if (!conversationId || !latestRun) return;
    setDelegatedActionTaskId('__create__');
    try {
      const task = await createDelegatedSubagentTask({
        conversationId,
        parentRunId: latestRun.id,
        sourceMessageId: latestUserMessageId,
        taskType: 'review',
        presetKey: 'code-reviewer',
        delegationReason: '手动创建 review 子任务，用于复核当前 Agent run 的结果与风险。',
        title: 'Manual review subtask',
        inputText: `Review the latest agent run for conversation "${conversation?.title ?? 'Untitled'}" and return findings first.`,
      });
      setDelegatedTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);

      const result = await runDelegatedSubagentTask(task.id);
      setDelegatedTasks((current) =>
        current.map((item) => (item.id === task.id ? result.task : item)),
      );
      messageApi.success(
        result.assistantMessage
          ? t('chat.inspector.reviewTaskCompleted', 'Review subtask finished and synced the result into the conversation.')
          : t('chat.inspector.reviewTaskStarted', 'Review subtask finished.'),
      );
    } catch (error) {
      messageApi.error(
        t('chat.inspector.delegatedTaskFailed', 'Failed to run the delegated task.') +
          ` ${String(error)}`,
      );
    } finally {
      setDelegatedActionTaskId(null);
      if (latestRun?.id) {
        try {
          const tasks = await invoke<AgentTask[]>('list_agent_tasks', {
            parentRunId: latestRun.id,
            limit: 20,
          });
          setDelegatedTasks(tasks);
        } catch {
          // Keep optimistic task state if refresh fails.
        }
      }
    }
  };

  const createResearchDelegatedTask = async () => {
    if (!conversationId || !latestRun) return;
    setDelegatedActionTaskId('__research__');
    try {
      const task = await createDelegatedSubagentTask({
        conversationId,
        parentRunId: latestRun.id,
        sourceMessageId: latestUserMessageId,
        taskType: 'research',
        presetKey: 'researcher',
        delegationReason: localizedDefault(
          '根据当前请求补充 research 子任务，用于收集证据、对比方案与未知项。',
          'Create a research subtask to gather evidence, comparisons, and open questions for the current run.',
        ),
        title: localizedDefault('research 子任务', 'Research subtask'),
        inputText: `Research the latest request for conversation "${conversation?.title ?? 'Untitled'}" and return conclusion, evidence, and next steps.\n\nLatest user request:\n${latestUserMessageText || '-'}`,
      });
      setDelegatedTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);

      const result = await runDelegatedSubagentTask(task.id);
      setDelegatedTasks((current) =>
        current.map((item) => (item.id === task.id ? result.task : item)),
      );
      messageApi.success(
        result.assistantMessage
          ? localizedDefault('research 子任务已完成，并已同步结果到当前对话。', 'Research subtask finished and synced the result into the conversation.')
          : localizedDefault('research 子任务已完成。', 'Research subtask finished.'),
      );
    } catch (error) {
      messageApi.error(
        localizedDefault('执行 research 子任务失败。', 'Failed to run the research subtask.') +
          ` ${String(error)}`,
      );
    } finally {
      setDelegatedActionTaskId(null);
      if (latestRun?.id) {
        try {
          const tasks = await invoke<AgentTask[]>('list_agent_tasks', {
            parentRunId: latestRun.id,
            limit: 20,
          });
          setDelegatedTasks(tasks);
        } catch {
          // Keep optimistic task state if refresh fails.
        }
      }
    }
  };

  const refreshContextPacks = () => {
    setContextPacks(listWorkspaceContextPacks(conversation?.workspace_id, conversationId));
  };

  const saveCurrentContextPack = async () => {
    if (!conversationId || !workspaceSnapshot) return;
    setContextPackActionId('__save__');
    try {
      const pack = saveWorkspaceContextPack({
        workspaceId: conversation?.workspace_id,
        conversationId,
        workspaceName: conversation?.title ?? null,
        label: `${conversation?.title ?? localizedDefault('当前工作区', 'Current workspace')} · ${new Date().toLocaleString()}`,
        snapshot: workspaceSnapshot,
      });
      if (!pack) {
        throw new Error(localizedDefault('当前没有可保存的工作区上下文。', 'No workspace context is available to save.'));
      }
      refreshContextPacks();
      messageApi.success(localizedDefault('已保存工作区上下文包。', 'Saved the workspace context pack.'));
    } catch (error) {
      messageApi.error(localizedDefault('保存工作区上下文包失败。', 'Failed to save the workspace context pack.') + ` ${String(error)}`);
    } finally {
      setContextPackActionId(null);
    }
  };

  const applyContextPack = async (pack: WorkspaceContextPack) => {
    if (!conversationId) return;
    setContextPackActionId(pack.id);
    try {
      await updateWorkspaceSnapshot(conversationId, pack.snapshot);
      refreshContextPacks();
      messageApi.success(localizedDefault('已应用工作区上下文包。', 'Applied the workspace context pack.'));
    } catch (error) {
      messageApi.error(localizedDefault('应用工作区上下文包失败。', 'Failed to apply the workspace context pack.') + ` ${String(error)}`);
    } finally {
      setContextPackActionId(null);
    }
  };

  const removeContextPack = (packId: string) => {
    deleteWorkspaceContextPack(packId);
    refreshContextPacks();
    messageApi.success(localizedDefault('已删除工作区上下文包。', 'Deleted the workspace context pack.'));
  };

  const handleProactiveSuggestion = async (action: string) => {
    if (!latestRun) return;

    if (action === 'resume_run') {
      setDelegatedActionTaskId('__resume__');
      try {
        await resumeRun(latestRun.id);
        messageApi.success(localizedDefault('已请求恢复中断的 run。', 'Requested resume for the interrupted run.'));
      } catch (error) {
        messageApi.error(localizedDefault('恢复 run 失败。', 'Failed to resume the run.') + ` ${String(error)}`);
      } finally {
        setDelegatedActionTaskId(null);
      }
      return;
    }

    if (action === 'create_review_subtask') {
      await createReviewDelegatedTask();
      return;
    }

    if (action === 'create_research_subtask') {
      await createResearchDelegatedTask();
    }
  };

  const rerunDelegatedTask = async (taskId: string) => {
    setDelegatedActionTaskId(taskId);
    try {
      const result = await runDelegatedSubagentTask(taskId);
      setDelegatedTasks((current) =>
        current.map((item) => (item.id === taskId ? result.task : item)),
      );
      messageApi.success(
        result.assistantMessage
          ? t('chat.inspector.delegatedTaskCompleted', 'Delegated task finished and synced the result into the conversation.')
          : t('chat.inspector.delegatedTaskUpdated', 'Delegated task updated.'),
      );
    } catch (error) {
      messageApi.error(
        t('chat.inspector.delegatedTaskFailed', 'Failed to run the delegated task.') +
          ` ${String(error)}`,
      );
    } finally {
      setDelegatedActionTaskId(null);
    }
  };

  const openDelegatedTaskEvents = async (taskId: string) => {
    setDelegatedTaskEventsOpen(true);
    setSelectedDelegatedTaskId(taskId);
    setDelegatedTaskEventsLoading(true);
    try {
      const events = await listTaskEvents(taskId);
      setSelectedDelegatedTaskEvents(events);
    } catch (error) {
      setSelectedDelegatedTaskEvents([]);
      messageApi.error(
        t('chat.inspector.delegatedTaskEventsFailed', 'Failed to load delegated task events.') +
          ` ${String(error)}`,
      );
    } finally {
      setDelegatedTaskEventsLoading(false);
    }
  };

  const selectedDelegatedTask = useMemo(
    () => delegatedTasks.find((task) => task.id === selectedDelegatedTaskId) ?? null,
    [delegatedTasks, selectedDelegatedTaskId],
  );

  const tabItems = useMemo(
    () => [
      {
        key: 'sources',
        label: t('chat.inspector.sources'),
        icon: <Search size={14} />,
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {contextSources.length > 0 ? (
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
              <Empty description={t('common.noData')} style={{ marginTop: 24 }} />
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <Space direction="vertical" size={0}>
                  <Typography.Text strong>
                    {localizedDefault('工作区上下文包', 'Workspace context packs')}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {localizedDefault(
                      '把当前工作区绑定、搜索和记忆状态保存成一个可复用的上下文包。',
                      'Save the current workspace bindings, search, and memory state as a reusable context pack.',
                    )}
                  </Typography.Text>
                </Space>
                <Button
                  size="small"
                  onClick={() => {
                    void saveCurrentContextPack();
                  }}
                  loading={contextPackActionId === '__save__'}
                  disabled={!conversationId || !workspaceSnapshot}
                >
                  {localizedDefault('保存当前上下文', 'Save current context')}
                </Button>
              </div>

              {contextPacks.length > 0 ? (
                <List
                  size="small"
                  dataSource={contextPacks}
                  renderItem={(pack) => (
                    <List.Item
                      actions={[
                        <Button
                          key="apply"
                          size="small"
                          loading={contextPackActionId === pack.id}
                          onClick={() => {
                            void applyContextPack(pack);
                          }}
                        >
                          {localizedDefault('应用', 'Apply')}
                        </Button>,
                        <Button
                          key="delete"
                          size="small"
                          onClick={() => {
                            removeContextPack(pack.id);
                          }}
                        >
                          {localizedDefault('删除', 'Delete')}
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={<Typography.Text>{pack.label}</Typography.Text>}
                        description={(
                          <Space direction="vertical" size={2} style={{ width: '100%' }}>
                            <Typography.Text type="secondary">
                              {describeWorkspaceContextPack(pack)}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              {new Date(pack.updatedAt).toLocaleString()}
                            </Typography.Text>
                          </Space>
                        )}
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={localizedDefault('当前工作区还没有保存的上下文包。', 'No saved context packs for this workspace yet.')}
                  style={{ marginTop: 12 }}
                />
              )}
            </div>
          </div>
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
                  effectiveToolApprovalMode === 'allow_safe'
                    ? 'green'
                    : effectiveToolApprovalMode === 'inherit'
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
            {proactiveSuggestions.length > 0 ? (
              <div style={{ marginTop: 16 }}>
                <div className="mb-2">
                  <Typography.Text strong>
                    {localizedDefault('主动建议', 'Proactive suggestions')}
                  </Typography.Text>
                  <div>
                    <Typography.Text type="secondary">
                      {localizedDefault(
                        '根据当前 run 状态和最近一次用户请求，主 Agent 认为这些下一步可能更高效。',
                        'Based on the current run state and the latest user request, the primary agent suggests these next actions.',
                      )}
                    </Typography.Text>
                  </div>
                </div>
                <List
                  size="small"
                  dataSource={proactiveSuggestions}
                  renderItem={(suggestion) => (
                    <List.Item
                      actions={[
                        <Button
                          key="apply"
                          size="small"
                          loading={
                            (suggestion.action === 'resume_run' && delegatedActionTaskId === '__resume__')
                            || (suggestion.action === 'create_review_subtask' && delegatedActionTaskId === '__create__')
                            || (suggestion.action === 'create_research_subtask' && delegatedActionTaskId === '__research__')
                          }
                          onClick={() => {
                            void handleProactiveSuggestion(suggestion.action);
                          }}
                        >
                          {suggestion.action === 'resume_run'
                            ? localizedDefault('恢复 run', 'Resume run')
                            : suggestion.action === 'create_research_subtask'
                              ? localizedDefault('运行 research 子任务', 'Run research subtask')
                              : localizedDefault('运行 review 子任务', 'Run review subtask')}
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={(
                          <Typography.Text>
                            {suggestion.action === 'resume_run'
                              ? localizedDefault('恢复中断的 run', 'Resume interrupted run')
                              : suggestion.action === 'create_research_subtask'
                                ? localizedDefault('委派 research 子任务', 'Delegate a research subtask')
                                : localizedDefault('委派 review 子任务', 'Delegate a review subtask')}
                          </Typography.Text>
                        )}
                        description={(
                          <Typography.Text type="secondary">
                            {suggestion.action === 'resume_run'
                              ? localizedDefault(
                                '当前 run 支持从现有执行上下文继续恢复。',
                                'The latest run can continue from the existing execution context.',
                              )
                              : suggestion.action === 'create_research_subtask'
                                ? localizedDefault(
                                  '让子任务先收集证据、对比方案并整理未知项。',
                                  'Ask a focused research subtask to gather evidence, compare options, and list unknowns.',
                                )
                                : localizedDefault(
                                  '让子任务先复核风险、回归影响和缺失测试。',
                                  'Ask a focused review subtask to double-check risks, regressions, and missing tests.',
                                )}
                          </Typography.Text>
                        )}
                      />
                    </List.Item>
                  )}
                />
              </div>
            ) : null}
            <div style={{ marginTop: 16 }}>
              <div className="mb-2 flex items-center justify-between">
                <Space direction="vertical" size={0}>
                  <Typography.Text strong>
                    {t('chat.inspector.delegatedTasks', 'Delegated tasks')}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {t(
                      'chat.inspector.delegatedTasksHelp',
                      'Primary-agent subtasks appear here with their type, reason, and result summary.',
                    )}
                  </Typography.Text>
                </Space>
                <Button
                  size="small"
                  type="default"
                  onClick={() => {
                    void createReviewDelegatedTask();
                  }}
                  loading={delegatedActionTaskId === '__create__'}
                >
                  {t('chat.inspector.createReviewTask', 'Create review subtask')}
                </Button>
              </div>
              {delegatedTasks.length > 0 ? (
                <List
                  size="small"
                  loading={delegatedTasksLoading}
                  dataSource={delegatedTasks}
                  renderItem={(task) => {
                    const canRun =
                      task.assigneeKind === 'internal_subagent' &&
                      (task.status === 'planned' || task.status === 'failed');
                    const color =
                      task.status === 'completed'
                        ? 'green'
                        : task.status === 'failed'
                          ? 'red'
                          : task.status === 'running'
                            ? 'blue'
                            : 'default';

                    return (
                      <List.Item
                        actions={
                          [
                            ...(canRun
                              ? [
                                <Button
                                  key="run"
                                  size="small"
                                  onClick={() => {
                                    void rerunDelegatedTask(task.id);
                                  }}
                                  loading={delegatedActionTaskId === task.id}
                                >
                                  {task.status === 'failed'
                                    ? t('common.retry', 'Retry')
                                    : t('chat.inspector.runNow', 'Run now')}
                                </Button>,
                              ]
                              : []),
                            <Button
                              key="events"
                              size="small"
                              onClick={() => {
                                void openDelegatedTaskEvents(task.id);
                              }}
                            >
                              {t('chat.inspector.viewTaskEvents', 'View events')}
                            </Button>,
                          ]
                        }
                      >
                        <List.Item.Meta
                          title={(
                            <Space size={8}>
                              <Typography.Text>{task.title}</Typography.Text>
                              <Tag color={color}>{task.status}</Tag>
                            </Space>
                          )}
                          description={(
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <Space size={[8, 4]} wrap>
                                <Tag>{getLocalizedTaskTypeLabel(task.taskType || task.kind)}</Tag>
                                {task.presetKey ? (
                                  <Tag>{task.presetKey}</Tag>
                                ) : null}
                              </Space>
                              {task.delegationReason ? (
                                <Typography.Text type="secondary">
                                  {t('chat.inspector.delegationReason', 'Delegation reason')}: {task.delegationReason}
                                </Typography.Text>
                              ) : null}
                              {task.inputText ? (
                                <Typography.Text type="secondary">
                                  {t('chat.inspector.taskInput', 'Task input')}: {task.inputText}
                                </Typography.Text>
                              ) : null}
                              <Typography.Text type="secondary">
                                {getExternalTaskSummary(task)}
                              </Typography.Text>
                              {task.errorMessage ? (
                                <Typography.Text type="danger">{task.errorMessage}</Typography.Text>
                              ) : null}
                            </div>
                          )}
                        />
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={t(
                    'chat.inspector.noDelegatedTasks',
                    'No delegated tasks for this run yet.',
                  )}
                  style={{ marginTop: 12 }}
                />
              )}
            </div>
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
      effectiveToolApprovalMode,
      toolApprovalLabel,
      agentProfile?.workspaceRoot,
      runTimeline,
      proactiveSuggestions,
      delegatedTasks,
      delegatedTasksLoading,
      delegatedActionTaskId,
      contextPacks,
      contextPackActionId,
      createReviewDelegatedTask,
      createResearchDelegatedTask,
      handleProactiveSuggestion,
      applyContextPack,
      removeContextPack,
      saveCurrentContextPack,
      openDelegatedTaskEvents,
      rerunDelegatedTask,
      conversationArtifacts,
      workspaceSnapshot,
      conversationId,
      localizedDefault,
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
      <Modal
        title={t('chat.inspector.delegatedTaskEventsTitle', 'Delegated task events')}
        open={delegatedTaskEventsOpen}
        footer={null}
        onCancel={() => {
          setDelegatedTaskEventsOpen(false);
          setSelectedDelegatedTaskId(null);
          setSelectedDelegatedTaskEvents([]);
        }}
        width={720}
      >
        {selectedDelegatedTask ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Typography.Text strong>{selectedDelegatedTask.title}</Typography.Text>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Space size={[8, 4]} wrap>
                  <Tag>
                    {getLocalizedTaskTypeLabel(
                      selectedDelegatedTask.taskType || selectedDelegatedTask.kind,
                    )}
                  </Tag>
                  <Tag
                    color={
                      selectedDelegatedTask.status === 'completed'
                        ? 'green'
                        : selectedDelegatedTask.status === 'failed'
                          ? 'red'
                          : 'blue'
                    }
                  >
                    {selectedDelegatedTask.status}
                  </Tag>
                </Space>
                {selectedDelegatedTask.delegationReason ? (
                  <Typography.Text type="secondary">
                    {t('chat.inspector.delegationReason', 'Delegation reason')}:{' '}
                    {selectedDelegatedTask.delegationReason}
                  </Typography.Text>
                ) : null}
                {selectedDelegatedTask.inputText ? (
                  <Typography.Text type="secondary">
                    {t('chat.inspector.taskInput', 'Task input')}: {selectedDelegatedTask.inputText}
                  </Typography.Text>
                ) : null}
              </div>
            </div>
            {delegatedTaskEventsLoading ? (
              <Typography.Text type="secondary">
                {t('chat.inspector.loadingTaskEvents', 'Loading task events...')}
              </Typography.Text>
            ) : selectedDelegatedTaskEvents.length > 0 ? (
              <List
                size="small"
                dataSource={selectedDelegatedTaskEvents}
                renderItem={(event) => (
                  <List.Item key={event.id}>
                    <List.Item.Meta
                      title={(
                        <Space size={8}>
                          <Tag>{event.eventType}</Tag>
                          <Typography.Text type="secondary">
                            {new Date(event.createdAt).toLocaleString()}
                          </Typography.Text>
                        </Space>
                      )}
                      description={(
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            fontSize: 12,
                            color: token.colorTextSecondary,
                          }}
                        >
                          {event.payloadJson}
                        </pre>
                      )}
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('chat.inspector.noTaskEvents', 'No task events yet.')}
              />
            )}
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('chat.inspector.noTaskEvents', 'No task events yet.')}
          />
        )}
      </Modal>
    </div>
  );
}
