import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Dropdown, Empty, List, Modal, Segmented, Space, Tag, Tooltip, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { ArrowRight, Blocks, Bot, Cable, MoreHorizontal, PlugZap, RefreshCw, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useExtensionStore, useUIStore } from '@/stores';
import type { ExtensionDetail, ExtensionKind, ExtensionSummary } from '@/types';
import { SettingsGroup } from './SettingsGroup';

type KindFilter = 'all' | ExtensionKind;

function kindIcon(kind: ExtensionKind) {
  switch (kind) {
    case 'skill':
      return <Wrench size={14} />;
    case 'mcp_server':
      return <PlugZap size={14} />;
    case 'external_agent':
      return <Cable size={14} />;
    case 'tool_bundle':
      return <Blocks size={14} />;
    case 'ui_panel':
      return <Bot size={14} />;
    default:
      return <Blocks size={14} />;
  }
}

function kindColor(kind: ExtensionKind): string {
  switch (kind) {
    case 'skill':
      return 'blue';
    case 'mcp_server':
      return 'gold';
    case 'external_agent':
      return 'purple';
    case 'tool_bundle':
      return 'cyan';
    case 'ui_panel':
      return 'green';
    default:
      return 'default';
  }
}

function healthColor(status: string): string {
  switch (status) {
    case 'healthy':
      return 'success';
    case 'warning':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'default';
  }
}

function healthLabel(status: string, t: ReturnType<typeof useTranslation>['t']) {
  switch (status) {
    case 'healthy':
      return t('settings.extensions.health.healthy', { defaultValue: 'Healthy' });
    case 'warning':
      return t('settings.extensions.health.warning', { defaultValue: 'Warning' });
    case 'error':
      return t('settings.extensions.health.error', { defaultValue: 'Error' });
    default:
      return status;
  }
}

function kindLabel(kind: ExtensionKind, t: ReturnType<typeof useTranslation>['t']) {
  switch (kind) {
    case 'skill':
      return t('settings.extensions.kind.skill', { defaultValue: 'Skill' });
    case 'mcp_server':
      return t('settings.extensions.kind.mcpServer', { defaultValue: 'MCP Server' });
    case 'external_agent':
      return t('settings.extensions.kind.externalAgent', { defaultValue: 'External Agent' });
    case 'tool_bundle':
      return t('settings.extensions.kind.toolBundle', { defaultValue: 'Tool Bundle' });
    case 'ui_panel':
      return t('settings.extensions.kind.uiPanel', { defaultValue: 'UI Panel' });
    default:
      return kind;
  }
}

function trustLevelLabel(level: string, t: ReturnType<typeof useTranslation>['t']) {
  switch (level) {
    case 'networked':
      return t('settings.extensions.labels.networked', { defaultValue: 'Network Access' });
    case 'elevated':
      return t('settings.extensions.labels.elevated', { defaultValue: 'Local Elevated Access' });
    case 'privileged':
      return t('settings.extensions.labels.privileged', { defaultValue: 'Privileged Access' });
    default:
      return level;
  }
}

function availabilityLabel(value: string, t: ReturnType<typeof useTranslation>['t']) {
  switch (value) {
    case 'workspace_attachable':
      return t('settings.extensions.labels.workspaceAttachable', { defaultValue: 'Workspace Attachable' });
    default:
      return value;
  }
}

function hostKindLabel(value: string, t: ReturnType<typeof useTranslation>['t']) {
  switch (value) {
    case 'mcp_host':
      return t('settings.extensions.labels.mcpHost', { defaultValue: 'MCP Host' });
    case 'external_agent_connector':
      return t('settings.extensions.labels.externalAgentConnector', { defaultValue: 'External Agent Connector' });
    default:
      return value;
  }
}

function isolationLabel(value: string, t: ReturnType<typeof useTranslation>['t']) {
  switch (value) {
    case 'subprocess':
      return t('settings.extensions.labels.subprocess', { defaultValue: 'Local Subprocess' });
    case 'remote':
      return t('settings.extensions.labels.remote', { defaultValue: 'Remote Runtime' });
    default:
      return value;
  }
}

function contributionLabel(value: string, t: ReturnType<typeof useTranslation>['t']) {
  switch (value) {
    case 'tool_provider':
      return t('settings.extensions.labels.toolProvider', { defaultValue: 'Tool Provider' });
    case 'task_executor':
      return t('settings.extensions.labels.taskExecutor', { defaultValue: 'Task Executor' });
    default:
      return value;
  }
}

function sourceActionTarget(extension: ExtensionSummary): { page?: 'skills' | 'settings'; section?: 'mcpServers' | 'agentExecutors' } {
  if (extension.kind === 'skill') {
    return { page: 'skills' };
  }
  if (extension.kind === 'mcp_server') {
    return { page: 'settings', section: 'mcpServers' };
  }
  return { page: 'settings', section: 'agentExecutors' };
}

export default function ExtensionsSettings() {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const isZh = (i18n.resolvedLanguage ?? i18n.language ?? '').toLowerCase().startsWith('zh');
  const localizedDefault = (zh: string, en: string) => (isZh ? zh : en);
  const extensions = useExtensionStore((s) => s.extensions);
  const loading = useExtensionStore((s) => s.loading);
  const error = useExtensionStore((s) => s.error);
  const loadExtensions = useExtensionStore((s) => s.loadExtensions);
  const loadExtensionDetail = useExtensionStore((s) => s.loadExtensionDetail);
  const refreshExtensionRuntime = useExtensionStore((s) => s.refreshExtensionRuntime);
  const testExtensionConnection = useExtensionStore((s) => s.testExtensionConnection);
  const setExtensionEnabled = useExtensionStore((s) => s.setExtensionEnabled);
  const detailsById = useExtensionStore((s) => s.detailsById);
  const connectionChecksById = useExtensionStore((s) => s.connectionChecksById);
  const testingById = useExtensionStore((s) => s.testingById);
  const togglingById = useExtensionStore((s) => s.togglingById);
  const refreshingById = useExtensionStore((s) => s.refreshingById);
  const clearError = useExtensionStore((s) => s.clearError);
  const setActivePage = useUIStore((s) => s.setActivePage);
  const setSettingsSection = useUIStore((s) => s.setSettingsSection);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    void loadExtensions();
  }, [loadExtensions]);

  const filtered = useMemo(() => {
    if (kindFilter === 'all') return extensions;
    return extensions.filter((item) => item.kind === kindFilter);
  }, [extensions, kindFilter]);

  const summary = useMemo(() => {
    const total = extensions.length;
    const healthy = extensions.filter((item) => item.health.status === 'healthy').length;
    const warning = extensions.filter((item) => item.health.status === 'warning').length;
    const errorCount = extensions.filter((item) => item.health.status === 'error').length;
    return { total, healthy, warning, errorCount };
  }, [extensions]);

  const selectedExtensionDetail: ExtensionDetail | null = selectedExtensionId
    ? detailsById[selectedExtensionId] ?? null
    : null;

  const openDetail = async (extension: ExtensionSummary) => {
    setSelectedExtensionId(extension.id);
    setDetailOpen(true);
    if (detailsById[extension.id]) {
      return;
    }
    setDetailLoading(true);
    try {
      await loadExtensionDetail(extension.id);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshRuntime = async (extensionId: string) => {
    await refreshExtensionRuntime(extensionId);
    message.success(
      t('settings.extensions.runtimeRefreshed', {
        defaultValue: localizedDefault('运行时状态已刷新。', 'Runtime state refreshed.'),
      }),
    );
  };

  const runConnectionTest = async (extension: ExtensionSummary) => {
    const result = await testExtensionConnection(extension);
    if (result.ok) {
      message.success(
        t('settings.extensions.connectionTest.success', {
          defaultValue: localizedDefault('连接测试成功。', 'Connection test succeeded.'),
        }),
      );
    } else {
      message.error(
        result.message ??
          t('settings.extensions.connectionTest.failed', {
            defaultValue: localizedDefault('连接测试失败。', 'Connection test failed.'),
          }),
      );
    }
  };

  const toggleExtension = async (extension: ExtensionSummary) => {
    const nextEnabled = !extension.enabled;
    await setExtensionEnabled(extension.id, nextEnabled);
    message.success(
      nextEnabled
        ? t('settings.extensions.enableSuccess', {
            defaultValue: localizedDefault('扩展已启用。', 'Extension enabled.'),
          })
        : t('settings.extensions.disableSuccess', {
            defaultValue: localizedDefault('扩展已停用。', 'Extension disabled.'),
          }),
    );
  };

  return (
    <div className="p-6 flex flex-col gap-4">
      {error && (
        <Alert
          type="error"
          message={error}
          closable
          onClose={clearError}
        />
      )}

      <SettingsGroup
        title={t('settings.extensions.title', { defaultValue: 'Extensions' })}
        extra={(
          <Button icon={<RefreshCw size={14} />} onClick={() => void loadExtensions()} loading={loading}>
            {t('common.refresh', { defaultValue: 'Refresh' })}
          </Button>
        )}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
          {t('settings.extensions.description', {
            defaultValue: 'This is an overview, not the detailed configuration page. Use it to review Skills, MCP servers, and External Agents in one place, then jump to the corresponding settings to edit them.',
          })}
        </Typography.Paragraph>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <Card size="small">
            <Typography.Text type="secondary">{t('settings.extensions.summary.total', { defaultValue: 'Total' })}</Typography.Text>
            <div className="text-2xl font-semibold mt-1">{summary.total}</div>
          </Card>
          <Card size="small">
            <Typography.Text type="secondary">{t('settings.extensions.summary.healthy', { defaultValue: 'Healthy' })}</Typography.Text>
            <div className="text-2xl font-semibold mt-1">{summary.healthy}</div>
          </Card>
          <Card size="small">
            <Typography.Text type="secondary">{t('settings.extensions.summary.warning', { defaultValue: 'Warnings' })}</Typography.Text>
            <div className="text-2xl font-semibold mt-1">{summary.warning}</div>
          </Card>
          <Card size="small">
            <Typography.Text type="secondary">{t('settings.extensions.summary.error', { defaultValue: 'Errors' })}</Typography.Text>
            <div className="text-2xl font-semibold mt-1">{summary.errorCount}</div>
          </Card>
        </div>

        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Segmented
            value={kindFilter}
            onChange={(value) => setKindFilter(value as KindFilter)}
            options={[
              { label: t('settings.extensions.filter.all', { defaultValue: 'All' }), value: 'all' },
              { label: t('settings.extensions.filter.skills', { defaultValue: 'Skills' }), value: 'skill' },
              { label: t('settings.extensions.filter.mcp', { defaultValue: 'MCP' }), value: 'mcp_server' },
            ]}
          />

          {filtered.length === 0 ? (
            <Empty
              description={t('settings.extensions.empty', { defaultValue: 'No extensions found' })}
            />
          ) : (
            <List
              loading={loading}
              dataSource={filtered}
              renderItem={(extension) => {
                const actionTarget = sourceActionTarget(extension);
                const connectionCheck = connectionChecksById[extension.id];
                const bridgeProfile = null;
                const extraTags = [
                  availabilityLabel(extension.scope.availability, t),
                  trustLevelLabel(extension.permissions.trustLevel, t),
                  extension.runtime ? hostKindLabel(extension.runtime.hostKind, t) : null,
                  extension.runtime ? isolationLabel(extension.runtime.isolation, t) : null,
                  bridgeProfile ? getExternalBridgeFamilyLabel(bridgeProfile.family) : null,
                  bridgeProfile ? getExternalBridgeNetworkScopeLabel(bridgeProfile.networkScope) : null,
                ].filter(Boolean) as string[];
                const quickMetaTags = extraTags.slice(0, 3);
                const moreActions: MenuProps['items'] = [
                  extension.runtime?.supportsConnectionTest
                    ? {
                        key: 'test',
                        label: t('settings.extensions.testConnection', {
                          defaultValue: localizedDefault('测试连接', 'Test connection'),
                        }),
                      }
                    : null,
                  extension.runtime?.supportsEnableToggle
                    ? {
                        key: 'toggle',
                        label: extension.enabled
                          ? t('settings.extensions.disable', {
                              defaultValue: localizedDefault('停用', 'Disable'),
                            })
                          : t('settings.extensions.enable', {
                              defaultValue: localizedDefault('启用', 'Enable'),
                            }),
                      }
                    : null,
                  {
                    key: 'detail',
                    label: t('settings.extensions.viewDetail', {
                      defaultValue: localizedDefault('查看运行时详情', 'View runtime detail'),
                    }),
                  },
                ].filter(Boolean);
                return (
                  <List.Item
                    actions={[
                      <Button
                        key="open"
                        type="primary"
                        size="small"
                        icon={<ArrowRight size={14} />}
                        onClick={() => {
                          if (actionTarget.page === 'skills') {
                            setActivePage('skills');
                            return;
                          }
                          setActivePage('settings');
                          if (actionTarget.section) setSettingsSection(actionTarget.section);
                        }}
                      >
                        {t('settings.extensions.openSource', { defaultValue: 'Open corresponding settings' })}
                      </Button>,
                      <Dropdown
                        key="more"
                        menu={{
                          items: moreActions,
                          onClick: ({ key }) => {
                            if (key === 'test') {
                              void runConnectionTest(extension);
                            } else if (key === 'toggle') {
                              void toggleExtension(extension);
                            } else if (key === 'detail') {
                              void openDetail(extension);
                            }
                          },
                        }}
                        trigger={['click']}
                      >
                        <Button
                          size="small"
                          icon={<MoreHorizontal size={14} />}
                          loading={
                            Boolean(testingById[extension.id])
                            || Boolean(togglingById[extension.id])
                          }
                        >
                          {t('settings.extensions.moreActions', {
                            defaultValue: localizedDefault('更多', 'More'),
                          })}
                        </Button>
                      </Dropdown>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={kindIcon(extension.kind)}
                      title={(
                        <Space size={8} wrap>
                          <span>{extension.name}</span>
                          <Tag color={kindColor(extension.kind)} bordered={false}>
                            {kindLabel(extension.kind, t)}
                          </Tag>
                          <Tag color={healthColor(extension.health.status)} bordered={false}>
                            {healthLabel(extension.health.status, t)}
                          </Tag>
                          <Tag bordered={false}>
                            {extension.enabled
                              ? t('common.enabled', { defaultValue: localizedDefault('已启用', 'Enabled') })
                              : t('common.disabled', { defaultValue: localizedDefault('已停用', 'Disabled') })}
                          </Tag>
                          <Typography.Text type="secondary">
                            {extension.permissions.approvalMode}
                          </Typography.Text>
                        </Space>
                      )}
                      description={(
                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                          <Tooltip title={extension.description || t('settings.extensions.noDescription', { defaultValue: 'No description provided.' })}>
                            <Typography.Paragraph
                              type="secondary"
                              ellipsis={{ rows: 2, tooltip: false }}
                              style={{ marginBottom: 0 }}
                            >
                              {extension.description || t('settings.extensions.noDescription', { defaultValue: 'No description provided.' })}
                            </Typography.Paragraph>
                          </Tooltip>
                          <Tooltip title={extension.health.summary || t('settings.extensions.noHealthSummary', { defaultValue: 'No diagnostic summary available yet.' })}>
                            <Typography.Paragraph
                              type="secondary"
                              ellipsis={{ rows: 1, tooltip: false }}
                              style={{ marginBottom: 0, fontSize: 12 }}
                            >
                              {extension.health.summary || t('settings.extensions.noHealthSummary', { defaultValue: 'No diagnostic summary available yet.' })}
                            </Typography.Paragraph>
                          </Tooltip>
                          {connectionCheck ? (
                            <Typography.Text style={{ fontSize: 12 }} type={connectionCheck.ok ? 'success' : 'danger'}>
                              {connectionCheck.ok
                                ? t('settings.extensions.connectionTest.lastSuccess', {
                                    defaultValue: localizedDefault('最近一次连接测试：可达', 'Last connection test: reachable'),
                                  })
                                : `${t('settings.extensions.connectionTest.lastFailure', {
                                    defaultValue: localizedDefault('最近一次连接测试失败', 'Last connection test failed'),
                                  })}${connectionCheck.message ? ` - ${connectionCheck.message}` : ''}`}
                            </Typography.Text>
                          ) : null}
                          <Space size={[6, 6]} wrap>
                            {quickMetaTags.map((tag) => (
                              <Tag key={tag}>{tag}</Tag>
                            ))}
                            {bridgeProfile ? (
                              <>
                                <Tag color={bridgeProfile.authConfigured ? 'success' : 'warning'}>
                                  {bridgeProfile.authConfigured
                                    ? t('settings.extensions.authConfigured', {
                                        defaultValue: localizedDefault('已配置鉴权', 'Auth configured'),
                                      })
                                    : t('settings.extensions.authMissing', {
                                        defaultValue: localizedDefault('未配置鉴权', 'No auth'),
                                      })}
                                </Tag>
                              </>
                            ) : null}
                            {extension.contributions.slice(0, 2).map((contribution) => (
                              <Tag key={contribution.id}>
                                {contributionLabel(contribution.type, t)}
                              </Tag>
                            ))}
                          </Space>
                        </Space>
                      )}
                    />
                  </List.Item>
                );
              }}
            />
          )}
        </Space>
      </SettingsGroup>

      <Modal
        title={t('settings.extensions.detailTitle', { defaultValue: localizedDefault('扩展运行时详情', 'Extension runtime detail') })}
        open={detailOpen}
        onCancel={() => {
          setDetailOpen(false);
          setSelectedExtensionId(null);
        }}
        footer={null}
        width={760}
      >
        {detailLoading && !selectedExtensionDetail ? (
          <Typography.Text type="secondary">
            {t('settings.extensions.loadingDetail', { defaultValue: localizedDefault('正在加载扩展详情...', 'Loading extension detail...') })}
          </Typography.Text>
        ) : selectedExtensionDetail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              action={(
                <Button
                  size="small"
                  loading={Boolean(selectedExtensionId && refreshingById[selectedExtensionId])}
                  onClick={() => {
                    if (!selectedExtensionId) return;
                    void refreshRuntime(selectedExtensionId);
                  }}
                >
                  {t('settings.extensions.refreshRuntime', {
                    defaultValue: localizedDefault('刷新运行时', 'Refresh runtime'),
                  })}
                </Button>
              )}
              message={t('settings.extensions.runtimeHint', {
                defaultValue: localizedDefault(
                  '这里会显示扩展运行在哪个宿主里、如何隔离，以及最近一次健康与连接状态。',
                  'This view shows where the extension runs, how it is isolated, and the latest runtime and connection state.',
                ),
              })}
            />
            {selectedExtensionDetail.runtime?.supportsConnectionTest && selectedExtensionId ? (
              <Alert
                type={
                  connectionChecksById[selectedExtensionId]
                    ? (connectionChecksById[selectedExtensionId].ok ? 'success' : 'warning')
                    : 'info'
                }
                showIcon
                action={(
                  <Space size={8}>
                    <Button
                      size="small"
                      loading={Boolean(refreshingById[selectedExtensionId])}
                      onClick={() => {
                        void refreshRuntime(selectedExtensionId);
                      }}
                    >
                      {t('settings.extensions.refreshRuntime', {
                        defaultValue: localizedDefault('刷新运行时', 'Refresh runtime'),
                      })}
                    </Button>
                    {selectedExtensionDetail.runtime?.supportsEnableToggle ? (
                      <Button
                        size="small"
                        loading={Boolean(togglingById[selectedExtensionId])}
                        onClick={() => {
                          void toggleExtension(selectedExtensionDetail);
                        }}
                      >
                        {selectedExtensionDetail.enabled
                          ? t('settings.extensions.disable', {
                              defaultValue: localizedDefault('停用', 'Disable'),
                            })
                          : t('settings.extensions.enable', {
                              defaultValue: localizedDefault('启用', 'Enable'),
                            })}
                      </Button>
                    ) : null}
                    <Button
                      size="small"
                      loading={Boolean(testingById[selectedExtensionId])}
                      onClick={() => {
                        void runConnectionTest(selectedExtensionDetail);
                      }}
                    >
                      {t('settings.extensions.testConnection', { defaultValue: localizedDefault('测试连接', 'Test connection') })}
                    </Button>
                  </Space>
                )}
                message={
                  connectionChecksById[selectedExtensionId]
                    ? (
                        connectionChecksById[selectedExtensionId].ok
                          ? t('settings.extensions.connectionTest.success', {
                              defaultValue: localizedDefault('连接测试成功。', 'Connection test succeeded.'),
                            })
                          : (connectionChecksById[selectedExtensionId].message ??
                              t('settings.extensions.connectionTest.failed', {
                                defaultValue: localizedDefault('连接测试失败。', 'Connection test failed.'),
                              }))
                      )
                    : t('settings.extensions.connectionTest.hint', {
                        defaultValue: localizedDefault('可以通过连接测试来确认这个运行时宿主是否可达。', 'Use connection test to verify whether this runtime host is reachable.'),
                      })
                }
              />
            ) : null}
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('settings.extensions.detail.name', { defaultValue: localizedDefault('名称', 'Name') })}>
                {selectedExtensionDetail.name}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.extensions.detail.kind', { defaultValue: localizedDefault('类型', 'Kind') })}>
                <Space size={[8, 4]} wrap>
                  <Tag>{selectedExtensionDetail.kind}</Tag>
                  <Tag color={healthColor(selectedExtensionDetail.health.status)}>
                    {selectedExtensionDetail.health.status}
                  </Tag>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.extensions.detail.runtimeHost', { defaultValue: localizedDefault('运行时宿主', 'Runtime host') })}>
                {selectedExtensionDetail.runtime?.hostKind ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.extensions.detail.isolation', { defaultValue: localizedDefault('隔离级别', 'Isolation') })}>
                {selectedExtensionDetail.runtime?.isolation ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.extensions.detail.approval', { defaultValue: localizedDefault('审批策略', 'Approval mode') })}>
                {selectedExtensionDetail.permissions.approvalMode}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.extensions.detail.source', { defaultValue: localizedDefault('来源', 'Source') })}>
                {selectedExtensionDetail.source.label ?? selectedExtensionDetail.source.kind}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.extensions.detail.path', { defaultValue: localizedDefault('路径 / 端点', 'Path / endpoint') })}>
                {selectedExtensionDetail.source.path ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.extensions.detail.healthSummary', { defaultValue: localizedDefault('健康摘要', 'Health summary') })}>
                {selectedExtensionDetail.health.summary ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.extensions.detail.lastError', { defaultValue: localizedDefault('最近一次错误', 'Last error') })}>
                {selectedExtensionDetail.diagnostics?.lastError ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('settings.extensions.detail.lastConnectionTest', { defaultValue: localizedDefault('最近一次连接测试', 'Last connection test') })}>
                {selectedExtensionId && connectionChecksById[selectedExtensionId]
                  ? (
                      connectionChecksById[selectedExtensionId].ok
                        ? t('settings.extensions.connectionTest.success', {
                            defaultValue: localizedDefault('连接测试成功。', 'Connection test succeeded.'),
                          })
                        : (connectionChecksById[selectedExtensionId].message ??
                            t('settings.extensions.connectionTest.failed', {
                              defaultValue: localizedDefault('连接测试失败。', 'Connection test failed.'),
                            }))
                    )
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Text strong>
                {t('settings.extensions.detail.contributions', { defaultValue: localizedDefault('承载能力', 'Contributions') })}
              </Typography.Text>
              <Space size={[8, 6]} wrap style={{ display: 'flex', marginTop: 8 }}>
                {selectedExtensionDetail.contributions.map((contribution) => (
                  <Tag key={contribution.id}>
                    {contribution.type}: {contribution.name}
                  </Tag>
                ))}
              </Space>
            </div>

            {selectedExtensionDetail.diagnostics?.compatibilityNotes?.length ? (
              <div>
                <Typography.Text strong>
                  {t('settings.extensions.detail.compatibilityNotes', { defaultValue: localizedDefault('兼容性说明', 'Compatibility notes') })}
                </Typography.Text>
                <List
                  size="small"
                  dataSource={selectedExtensionDetail.diagnostics.compatibilityNotes}
                  renderItem={(note) => <List.Item>{note}</List.Item>}
                  style={{ marginTop: 8 }}
                />
              </div>
            ) : null}

            {selectedExtensionDetail.kindDetail ? (
              <div>
                <Typography.Text strong>
                  {t('settings.extensions.detail.kindDetail', { defaultValue: localizedDefault('类型详情', 'Kind-specific detail') })}
                </Typography.Text>
                <pre
                  style={{
                    marginTop: 8,
                    marginBottom: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: 12,
                    padding: 12,
                    borderRadius: 8,
                    background: 'var(--surface-secondary, rgba(255,255,255,0.04))',
                  }}
                >
                  {JSON.stringify(selectedExtensionDetail.kindDetail, null, 2)}
                </pre>
              </div>
            ) : null}
          </Space>
        ) : (
          <Empty description={t('settings.extensions.detail.empty', { defaultValue: localizedDefault('暂无详情', 'No detail available') })} />
        )}
      </Modal>
    </div>
  );
}
