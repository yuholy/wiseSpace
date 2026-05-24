import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, List, Segmented, Space, Tag, Typography } from 'antd';
import { Blocks, Bot, Cable, PlugZap, RefreshCw, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useExtensionStore, useUIStore } from '@/stores';
import type { ExtensionKind, ExtensionSummary } from '@/types';
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
  const { t } = useTranslation();
  const extensions = useExtensionStore((s) => s.extensions);
  const loading = useExtensionStore((s) => s.loading);
  const error = useExtensionStore((s) => s.error);
  const loadExtensions = useExtensionStore((s) => s.loadExtensions);
  const clearError = useExtensionStore((s) => s.clearError);
  const setActivePage = useUIStore((s) => s.setActivePage);
  const setSettingsSection = useUIStore((s) => s.setSettingsSection);
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');

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
            defaultValue: 'This page only summarizes status and provides quick navigation. Detailed changes still happen in the original Skills, MCP, or Agent Executors pages.',
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
                return (
                  <List.Item
                    actions={[
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
                          <Space size={[6, 6]} wrap>
                            <Tag>{extension.scope.availability}</Tag>
                            <Tag>{extension.permissions.trustLevel}</Tag>
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
    </div>
  );
}
