import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Badge,
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  theme,
} from 'antd';
import {
  Check,
  CircleAlert,
  FolderOpen,
  MessageSquare,
  Play,
  RefreshCcw,
  RotateCcw,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { listen } from '@/lib/invoke';
import { useAgentStore, useConversationStore, useProviderStore, useSettingsStore, useTaskCenterStore } from '@/stores';
import { useUIStore } from '@/stores/uiStore';
import type { AgentRunEvent, AskUserEvent, PermissionRequestEvent, TaskCenterItem } from '@/types/agent';

const WAITING_STATUSES = new Set(['waiting_approval', 'waiting_input', 'interrupted']);
const RUNNING_STATUSES = new Set(['queued', 'starting', 'running', 'cancelling']);
const FAILED_STATUSES = new Set(['failed', 'cancelled']);
const MAX_TIMELINE_EVENTS = 30;

const EVENT_LABELS: Record<string, string> = {
  ask_resolved: '已回复问题',
  ask_user: '等待补充信息',
  permission_request: '等待工具权限',
  permission_resolved: '权限已处理',
  run_cancel_requested: '请求取消',
  run_failed: '运行失败',
  run_finished: '运行完成',
  run_resume_accepted: '恢复运行',
  run_resume_rejected: '恢复失败',
  tool_result: '工具完成',
  tool_start: '工具开始',
  tool_use: '调用工具',
};

type TaskFormValues = {
  prompt: string;
  providerModel: string;
  workspaceRoot?: string;
  permissionMode?: string;
};

function statusColor(status: string) {
  if (WAITING_STATUSES.has(status)) return 'gold';
  if (RUNNING_STATUSES.has(status)) return 'blue';
  if (FAILED_STATUSES.has(status)) return 'red';
  if (status === 'completed') return 'green';
  return 'default';
}

function parseProviderModel(value: string) {
  const [providerId, modelId] = value.split('::');
  return { providerId, modelId };
}

function eventField(event: AgentRunEvent, camel: keyof AgentRunEvent, snake: string) {
  const raw = event as unknown as Record<string, unknown>;
  return (event[camel] ?? raw[snake]) as string | undefined;
}

function rawEventPayload(event: AgentRunEvent) {
  const raw = event as unknown as Record<string, unknown>;
  const payload = (event.payloadJson ?? raw.payload_json) as string | undefined;
  if (!payload) return '';
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

function parseEventPayload(event: AgentRunEvent): Record<string, unknown> {
  const raw = event as unknown as Record<string, unknown>;
  const payload = (event.payloadJson ?? raw.payload_json) as string | undefined;
  if (!payload) return {};
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return { text: payload };
  }
}

function compactText(value: unknown, max = 140) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function eventLabel(eventType: string) {
  return EVENT_LABELS[eventType] ?? eventType;
}

function eventSummary(event: AgentRunEvent) {
  const eventType = eventField(event, 'eventType', 'event_type') ?? '';
  const payload = parseEventPayload(event);
  const toolName = payload.toolName ?? payload.tool_name;

  switch (eventType) {
    case 'run_finished': {
      const turns = payload.numTurns ? `轮次 ${payload.numTurns}` : '';
      const cost = typeof payload.costUsd === 'number' ? `成本 $${payload.costUsd.toFixed(4)}` : '';
      return [turns, cost].filter(Boolean).join(' · ') || '任务已完成';
    }
    case 'tool_use':
      return `${toolName || '工具'}：${compactText(payload.summary ?? payload.input ?? payload.text, 180) || '准备执行'}`;
    case 'tool_start':
      return `${toolName || '工具'} 正在执行`;
    case 'tool_result':
      return `${toolName || '工具'}：${compactText(payload.summary ?? payload.output ?? payload.result, 180) || '执行完成'}`;
    case 'permission_request':
      return `${toolName || '工具'} 需要授权${payload.riskLevel ? ` · 风险 ${payload.riskLevel}` : ''}`;
    case 'permission_resolved':
      return `处理结果：${compactText(payload.value ?? payload.decision ?? '已处理')}`;
    case 'ask_user':
      return compactText(payload.question ?? payload.prompt ?? 'Agent 正在等待你的补充信息', 180);
    case 'ask_resolved':
      return `已回复：${compactText(payload.answer ?? payload.value, 180)}`;
    case 'run_failed':
    case 'run_resume_rejected':
      return compactText(payload.message ?? payload.error ?? payload.reason ?? '运行遇到错误', 220);
    default:
      return compactText(payload.message ?? payload.summary ?? payload.text ?? rawEventPayload(event), 180);
  }
}

function TaskListSection({
  title,
  items,
  selectedRunId,
  onSelect,
  token,
}: {
  title: string;
  items: TaskCenterItem[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
  token: ReturnType<typeof theme.useToken>['token'];
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' }}>
        <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
          {title}
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {items.length}
        </Typography.Text>
      </Space>
      <List
        size="small"
        dataSource={items}
        renderItem={(item) => {
          const active = selectedRunId === item.runId;
          return (
            <List.Item
              onClick={() => onSelect(item.runId)}
              style={{
                cursor: 'pointer',
                borderRadius: 10,
                padding: '11px 12px',
                marginBottom: 6,
                background: active ? token.colorFillSecondary : 'transparent',
                border: `1px solid ${active ? token.colorPrimaryBorder : 'transparent'}`,
                borderLeft: `3px solid ${active ? token.colorPrimary : 'transparent'}`,
                borderBlockEnd: 0,
                boxShadow: 'none',
                transition: 'all 0.18s ease',
              }}
            >
              <List.Item.Meta
                title={(
                  <Space size={6} style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Typography.Text ellipsis style={{ maxWidth: 164, fontWeight: 600 }}>
                      {item.conversationTitle || item.promptPreview}
                    </Typography.Text>
                    <Tag color={statusColor(item.status)} style={{ marginInlineEnd: 0, flexShrink: 0 }}>
                      {item.status}
                    </Tag>
                  </Space>
                )}
                description={(
                  <Typography.Text type="secondary" ellipsis>
                    {item.promptPreview}
                  </Typography.Text>
                )}
              />
            </List.Item>
          );
        }}
      />
    </div>
  );
}

export function TasksPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [form] = Form.useForm<TaskFormValues>();
  const [createOpen, setCreateOpen] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  const {
    items,
    selectedRunId,
    detail,
    loading,
    detailLoading,
    creating,
    fetchTasks,
    selectRun,
    createTask,
    cancelTask,
    deleteTask,
    resumeTask,
    rerunTask,
  } = useTaskCenterStore();
  const providers = useProviderStore((s) => s.providers);
  const fetchProviders = useProviderStore((s) => s.fetchProviders);
  const settings = useSettingsStore((s) => s.settings);
  const conversations = useConversationStore((s) => s.conversations);
  const fetchConversations = useConversationStore((s) => s.fetchConversations);
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);
  const setActivePage = useUIStore((s) => s.setActivePage);
  const pendingPermissionsById = useAgentStore((s) => s.pendingPermissions);
  const pendingAskUserById = useAgentStore((s) => s.pendingAskUser);
  const approveToolUse = useAgentStore((s) => s.approveToolUse);
  const respondAskUser = useAgentStore((s) => s.respondAskUser);
  const pendingPermissions = useMemo(() => Object.values(pendingPermissionsById), [pendingPermissionsById]);
  const pendingAskUser = useMemo(() => Object.values(pendingAskUserById), [pendingAskUserById]);

  useEffect(() => {
    void fetchTasks();
    void fetchProviders();
    void fetchConversations();
  }, [fetchConversations, fetchProviders, fetchTasks]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void fetchTasks();
        if (selectedRunId) void selectRun(selectedRunId);
      }, 250);
    };

    const listeners = [
      listen('agent-run-event', refreshSoon),
      listen('agent-done', refreshSoon),
      listen('agent-error', refreshSoon),
      listen('agent-permission-request', refreshSoon),
      listen('agent-ask-user', refreshSoon),
    ];
    return () => {
      if (timer) clearTimeout(timer);
      listeners.forEach((unlisten) => {
        void unlisten.then((fn) => fn());
      });
    };
  }, [fetchTasks, selectRun, selectedRunId]);

  const grouped = useMemo(() => ({
    waiting: items.filter((item) => WAITING_STATUSES.has(item.status)),
    running: items.filter((item) => RUNNING_STATUSES.has(item.status)),
    failed: items.filter((item) => FAILED_STATUSES.has(item.status)),
    completed: items.filter((item) => item.status === 'completed'),
  }), [items]);

  const modelOptions = useMemo(() => providers
    .filter((provider) => provider.enabled)
    .flatMap((provider) => provider.models
      .filter((model) => model.enabled && model.model_type === 'Chat')
      .map((model) => ({
        label: `${provider.name} / ${model.name || model.model_id}`,
        value: `${provider.id}::${model.model_id}`,
      }))), [providers]);

  useEffect(() => {
    if (!createOpen) return;
    const defaultValue = settings.default_provider_id && settings.default_model_id
      ? `${settings.default_provider_id}::${settings.default_model_id}`
      : modelOptions[0]?.value;
    form.setFieldsValue({
      providerModel: defaultValue,
      permissionMode: 'default',
    });
  }, [createOpen, form, modelOptions, settings.default_model_id, settings.default_provider_id]);

  const detailPermissions = pendingPermissions.filter((item) => item.conversationId === detail?.item.conversationId);
  const detailAsks = pendingAskUser.filter((item) => item.conversationId === detail?.item.conversationId);
  const timelineEvents = useMemo(() => {
    if (!detail) return [];
    return [...detail.events].reverse().slice(0, MAX_TIMELINE_EVENTS);
  }, [detail]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const { providerId, modelId } = parseProviderModel(values.providerModel);
      const result = await createTask({
        prompt: values.prompt,
        providerId,
        modelId,
        workspaceRoot: values.workspaceRoot || undefined,
        permissionMode: values.permissionMode || 'default',
      });
      await fetchConversations();
      setCreateOpen(false);
      form.resetFields();
      message.success('任务已创建');
      if (result.run) {
        void selectRun(result.run.id);
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (text && text !== 'Error') {
        message.error(text);
      }
    }
  };

  const handleOpenWorkspace = async () => {
    const selected = await open({ directory: true, multiple: false, title: '选择工作空间' });
    if (selected && typeof selected === 'string') {
      form.setFieldValue('workspaceRoot', selected);
    }
  };

  const openConversation = (conversationId: string) => {
    if (!conversations.some((item) => item.id === conversationId)) {
      void fetchConversations();
    }
    setActiveConversation(conversationId);
    setActivePage('chat');
  };

  return (
    <div
      className="h-full flex overflow-hidden"
      style={{
        background: token.colorBgContainer,
        ['--color-fill-alter' as string]: token.colorFillAlter,
        ['--color-bg-elevated' as string]: token.colorBgElevated,
        ['--color-border-secondary' as string]: token.colorBorderSecondary,
        ['--color-primary-border' as string]: token.colorPrimaryBorder,
      }}
    >
      <aside
        style={{
          width: 356,
          minWidth: 356,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
          padding: '16px 14px',
          overflow: 'auto',
          background: token.colorBgContainer,
        }}
      >
        <Space
          style={{
            width: '100%',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
          size={12}
        >
          <Space>
            <Typography.Title level={4} style={{ margin: 0 }}>任务中心</Typography.Title>
            <Badge count={grouped.waiting.length} size="small" />
          </Space>
          <Button type="primary" icon={<Play size={14} />} onClick={() => setCreateOpen(true)}>
            新建
          </Button>
        </Space>

        {loading && items.length === 0 ? (
          <Spin />
        ) : items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 Agent 任务" />
        ) : (
          <>
            <TaskListSection title="待处理" items={grouped.waiting} selectedRunId={selectedRunId} onSelect={selectRun} token={token} />
            <TaskListSection title="运行中" items={grouped.running} selectedRunId={selectedRunId} onSelect={selectRun} token={token} />
            <TaskListSection title="失败/中断" items={grouped.failed} selectedRunId={selectedRunId} onSelect={selectRun} token={token} />
            <TaskListSection title="最近完成" items={grouped.completed} selectedRunId={selectedRunId} onSelect={selectRun} token={token} />
          </>
        )}
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: 20, overflow: 'auto' }}>
        {!detail && detailLoading ? <Spin /> : null}
        {!detail && !detailLoading ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择一个任务查看详情" />
        ) : null}
        {detail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" style={{ borderRadius: 16 }}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
                  <div>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      {detail.item.conversationTitle}
                    </Typography.Title>
                    <Typography.Text type="secondary">{detail.item.promptPreview}</Typography.Text>
                  </div>
                  <Tag color={statusColor(detail.item.status)}>{detail.item.status}</Tag>
                </Space>

                <Descriptions size="small" column={2}>
                  <Descriptions.Item label="来源会话">{detail.item.conversationId}</Descriptions.Item>
                  <Descriptions.Item label="来源">{detail.item.conversationSource}</Descriptions.Item>
                  <Descriptions.Item label="工作空间">{detail.item.workspaceRoot || '-'}</Descriptions.Item>
                  <Descriptions.Item label="模型">{detail.item.modelId || '-'}</Descriptions.Item>
                  <Descriptions.Item label="开始时间">{detail.item.startedAt}</Descriptions.Item>
                  <Descriptions.Item label="结束时间">{detail.item.finishedAt || '-'}</Descriptions.Item>
                </Descriptions>

                <Space wrap>
                  <Button icon={<MessageSquare size={14} />} onClick={() => openConversation(detail.item.conversationId)}>
                    打开会话
                  </Button>
                  {RUNNING_STATUSES.has(detail.item.status) || WAITING_STATUSES.has(detail.item.status) ? (
                    <Button danger icon={<Square size={14} />} onClick={() => cancelTask(detail.item.conversationId)}>
                      取消
                    </Button>
                  ) : null}
                  {detail.item.status === 'interrupted' ? (
                    <Button icon={<RefreshCcw size={14} />} onClick={() => resumeTask(detail.item.runId)}>
                      恢复
                    </Button>
                  ) : null}
                  {FAILED_STATUSES.has(detail.item.status) || detail.item.status === 'completed' ? (
                    <Button icon={<RotateCcw size={14} />} onClick={() => rerunTask(detail)}>
                      重跑
                    </Button>
                  ) : null}
                  {!RUNNING_STATUSES.has(detail.item.status) && !WAITING_STATUSES.has(detail.item.status) ? (
                    <Popconfirm
                      title="删除任务记录？"
                      description="这会从任务中心移除本次运行记录，但不会删除原会话内容。"
                      okText="删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={async () => {
                        await deleteTask(detail.item.runId);
                        message.success('任务记录已删除');
                      }}
                    >
                      <Button danger icon={<Trash2 size={14} />}>
                        删除
                      </Button>
                    </Popconfirm>
                  ) : null}
                </Space>
              </Space>
            </Card>

            {(detailPermissions.length > 0 || detailAsks.length > 0) && (
              <Card size="small" title="待处理" style={{ borderRadius: 16 }}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {detailPermissions.map((request: PermissionRequestEvent) => (
                    <Card key={request.toolUseId} size="small" style={{ borderRadius: 12 }}>
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Space>
                          <CircleAlert size={15} />
                          <Typography.Text strong>{request.toolName}</Typography.Text>
                          <Tag>{request.riskLevel}</Tag>
                        </Space>
                        <Typography.Paragraph code style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                          {JSON.stringify(request.input, null, 2)}
                        </Typography.Paragraph>
                        <Space>
                          <Button icon={<Check size={14} />} onClick={() => approveToolUse(request.conversationId, request.toolUseId, 'allow_once')}>
                            允许一次
                          </Button>
                          <Button onClick={() => approveToolUse(request.conversationId, request.toolUseId, 'allow_always')}>
                            始终允许
                          </Button>
                          <Button danger icon={<X size={14} />} onClick={() => approveToolUse(request.conversationId, request.toolUseId, 'deny')}>
                            拒绝
                          </Button>
                        </Space>
                      </Space>
                    </Card>
                  ))}
                  {detailAsks.map((ask: AskUserEvent) => (
                    <Card key={ask.askId} size="small" style={{ borderRadius: 12 }}>
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Typography.Text strong>{ask.question}</Typography.Text>
                        <Input.TextArea
                          rows={3}
                          value={answerDrafts[ask.askId] ?? ''}
                          onChange={(event) => setAnswerDrafts((drafts) => ({ ...drafts, [ask.askId]: event.target.value }))}
                        />
                        <Button
                          type="primary"
                          onClick={() => respondAskUser(ask.askId, answerDrafts[ask.askId] ?? '')}
                        >
                          回复
                        </Button>
                      </Space>
                    </Card>
                  ))}
                </Space>
              </Card>
            )}

            {detail.item.errorSummary && (
              <Card size="small" title="错误摘要" style={{ borderRadius: 16 }}>
                <Typography.Text type="danger">{detail.item.errorSummary}</Typography.Text>
              </Card>
            )}

            <Card
              size="small"
              title="任务时间线"
              style={{ borderRadius: 16 }}
              extra={detail.events.length > MAX_TIMELINE_EVENTS ? (
                <Typography.Text type="secondary">
                  显示最近 {MAX_TIMELINE_EVENTS} 条 / 共 {detail.events.length} 条
                </Typography.Text>
              ) : (
                <Typography.Text type="secondary">共 {detail.events.length} 条</Typography.Text>
              )}
            >
              {detail.events.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无事件" />
              ) : (
                <List
                  size="small"
                  dataSource={timelineEvents}
                  renderItem={(event) => {
                    const eventType = eventField(event, 'eventType', 'event_type') ?? '';
                    const rawPayload = rawEventPayload(event);
                    return (
                      <List.Item>
                        <List.Item.Meta
                          title={(
                            <Space size={8} wrap>
                              <Tag>{eventLabel(eventType)}</Tag>
                              <Typography.Text type="secondary">
                                {eventField(event, 'createdAt', 'created_at')}
                              </Typography.Text>
                              <Typography.Text type="secondary">#{event.sequenceNo}</Typography.Text>
                            </Space>
                          )}
                          description={(
                            <Space direction="vertical" size={6} style={{ width: '100%' }}>
                              <Typography.Text>{eventSummary(event)}</Typography.Text>
                              {rawPayload ? (
                                <Collapse
                                  ghost
                                  size="small"
                                  items={[{
                                    key: event.id,
                                    label: '查看原始数据',
                                    children: (
                                      <Typography.Paragraph code style={{ whiteSpace: 'pre-wrap', marginBottom: 0, maxHeight: 260, overflow: 'auto' }}>
                                        {rawPayload}
                                      </Typography.Paragraph>
                                    ),
                                  }]}
                                />
                              ) : null}
                            </Space>
                          )}
                        />
                      </List.Item>
                    );
                  }}
                />
              )}
            </Card>
          </Space>
        ) : null}
      </main>

      <Modal
        title="新建 Agent 任务"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="创建并运行"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="prompt" label="任务" rules={[{ required: true, message: '请输入任务内容' }]}>
            <Input.TextArea rows={5} placeholder="描述希望 Agent 完成的任务" />
          </Form.Item>
          <Form.Item name="providerModel" label="模型" rules={[{ required: true, message: '请选择模型' }]}>
            <Select showSearch options={modelOptions} optionFilterProp="label" />
          </Form.Item>
          <Form.Item label="工作空间">
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="workspaceRoot" noStyle>
                <Input placeholder="默认使用新会话工作空间" />
              </Form.Item>
              <Button icon={<FolderOpen size={14} />} onClick={handleOpenWorkspace} />
            </Space.Compact>
          </Form.Item>
          <Form.Item name="permissionMode" label="权限模式">
            <Select
              options={[
                { label: '默认', value: 'default' },
                { label: '允许编辑', value: 'accept_edits' },
                { label: '完全访问', value: 'full_access' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
