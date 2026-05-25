import { useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Empty, List, Modal, Segmented, Space, Tag, Typography } from 'antd';
import { Blocks, Bot, Cable, PlugZap, RefreshCw, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getExternalBridgeFamilyLabel,
  getExternalBridgeNetworkScopeLabel,
  getExternalBridgeRiskColor,
  readExternalBridgeProfile,
} from '@/lib/externalBridgeProfile';
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
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {t('settings.extensions.description', {
            defaultValue: 'This is an overview, not the detailed configuration page. Use it to review Skills, MCP servers, and External Agents in one place, then jump to the corresponding settings to edit them.',
          })}
        </Typography.Paragraph>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('settings.extensions.overviewHint', {
            defaultValue: 'This page only summarizes status and provides quick navigation. Detailed changes still happen in the original Skills, MCP, or External Agents pages.',
          })}
        />

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
              { label: t('settings.extensions.filter.externalAgents', { defaultValue: 'External Agents' }), value: 'external_agent' },
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
                const bridgeProfile = extension.kind === 'external_agent'
                  ? readExternalBridgeProfile({
                      ...extension,
                      kindDetail: detailsById[extension.id]?.kindDetail,
                    } as ExtensionDetail)
                  : null;
                return (
                  <List.Item
                    actions={[
                      extension.runtime?.supportsConnectionTest ? (
                        <Button
                          key="test"
                          size="small"
                          loading={Boolean(testingById[extension.id])}
                          onClick={() => {
                            void runConnectionTest(extension);
                          }}
                        >
                          {t('settings.extensions.testConnection', { defaultValue: localizedDefault('测试连接', 'Test connection') })}
                        </Button>
                      ) : null,
                      extension.runtime?.supportsEnableToggle ? (
                        <Button
                          key="toggle"
                          size="small"
                          loading={Boolean(togglingById[extension.id])}
                          onClick={() => {
                            void toggleExtension(extension);
                          }}
                        >
                          {extension.enabled
                            ? t('settings.extensions.disable', {
                                defaultValue: localizedDefault('停用', 'Disable'),
                              })
                            : t('settings.extensions.enable', {
                                defaultValue: localizedDefault('启用', 'Enable'),
                              })}
                        </Button>
                      ) : null,
                      <Button
                        key="detail"
                        size="small"
                        onClick={() => {
                          void openDetail(extension);
                        }}
                      >
                        {t('settings.extensions.viewDetail', { defaultValue: localizedDefault('查看运行时详情', 'View runtime detail') })}
                      </Button>,
                      <Button
                        key="open"
                        size="small"
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
                    ]}
                  >
                    <List.Item.Meta
                      avatar={kindIcon(extension.kind)}
                      title={(
                        <Space size={8} wrap>
                          <span>{extension.name}</span>
                          <Tag color={kindColor(extension.kind)} bordered={false}>{extension.kind}</Tag>
                          <Tag color={healthColor(extension.health.status)} bordered={false}>{extension.health.status}</Tag>
                          <Tag bordered={false}>
                            {extension.enabled
                              ? t('common.enabled', { defaultValue: localizedDefault('已启用', 'Enabled') })
                              : t('common.disabled', { defaultValue: localizedDefault('已停用', 'Disabled') })}
                          </Tag>
                          <Tag bordered={false}>{extension.permissions.approvalMode}</Tag>
                        </Space>
                      )}
                      description={(
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <Typography.Text type="secondary">
                            {extension.description || t('settings.extensions.noDescription', { defaultValue: 'No description provided.' })}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            {extension.health.summary || t('settings.extensions.noHealthSummary', { defaultValue: 'No diagnostic summary available yet.' })}
                          </Typography.Text>
                          {connectionCheck ? (
                            <Typography.Text type={connectionCheck.ok ? 'success' : 'danger'}>
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
                            <Tag>{extension.scope.availability}</Tag>
                            <Tag>{extension.permissions.trustLevel}</Tag>
                            {extension.runtime ? (
                              <>
                                <Tag>{extension.runtime.hostKind}</Tag>
                                <Tag>{extension.runtime.isolation}</Tag>
                              </>
                            ) : null}
                            {bridgeProfile ? (
                              <>
                                <Tag>{getExternalBridgeFamilyLabel(bridgeProfile.family)}</Tag>
                                <Tag color={getExternalBridgeRiskColor(bridgeProfile.riskLevel)}>
                                  {getExternalBridgeNetworkScopeLabel(bridgeProfile.networkScope)}
                                </Tag>
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
                            {extension.contributions.map((contribution) => (
                              <Tag key={contribution.id}>{contribution.type}</Tag>
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
            {(() => {
              const bridgeProfile = readExternalBridgeProfile(selectedExtensionDetail);
              if (!bridgeProfile) return null;

              return (
                <Alert
                  type={bridgeProfile.riskLevel === 'elevated' ? 'warning' : 'info'}
                  showIcon
                  message={bridgeProfile.permissionSummary}
                  description={(
                    <Space size={[8, 6]} wrap style={{ marginTop: 8 }}>
                      <Tag>{getExternalBridgeFamilyLabel(bridgeProfile.family)}</Tag>
                      <Tag color={getExternalBridgeRiskColor(bridgeProfile.riskLevel)}>
                        {getExternalBridgeNetworkScopeLabel(bridgeProfile.networkScope)}
                      </Tag>
                      <Tag color={bridgeProfile.authConfigured ? 'success' : 'warning'}>
                        {bridgeProfile.authConfigured
                          ? t('settings.extensions.authConfigured', {
                              defaultValue: localizedDefault('已配置鉴权', 'Auth configured'),
                            })
                          : t('settings.extensions.authMissing', {
                              defaultValue: localizedDefault('未配置鉴权', 'No auth'),
                            })}
                      </Tag>
                      {bridgeProfile.authType ? <Tag>{bridgeProfile.authType}</Tag> : null}
                    </Space>
                  )}
                />
              );
            })()}
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
