import { Card, List, Space, Tag, Typography, theme } from 'antd';
import { Bot, FolderOpen, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AGENT_EXECUTORS } from '@/lib/agentExecutors';

function ExecutorIcon() {
  return <Bot size={18} />;
}

function commandHint(): string {
  return 'wiseSpace built-in agent runtime';
}

export default function AgentExecutorSettings() {
  const { token } = theme.useToken();
  const { t } = useTranslation();

  return (
    <div className="h-full overflow-y-auto" style={{ padding: 24 }}>
      <div className="mb-5">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t('settings.agentExecutors.title', { defaultValue: 'External Agents' })}
        </Typography.Title>
        <Typography.Text type="secondary">
          {t('settings.agentExecutors.description', {
            defaultValue:
              'wiseSpace currently keeps only the built-in local agent runtime. Working directory and permission mode can still be configured from the conversation page.',
          })}
        </Typography.Text>
      </div>

      <Card
        size="small"
        title={t('settings.agentExecutors.localRuntime', { defaultValue: 'Local Runtime' })}
      >
        <List
          dataSource={AGENT_EXECUTORS}
          renderItem={(executor) => (
            <List.Item>
              <List.Item.Meta
                avatar={<ExecutorIcon />}
                title={(
                  <Space wrap>
                    <span>{executor.name}</span>
                    <Tag
                      style={{
                        color: token.colorPrimary,
                        backgroundColor: token.colorPrimaryBg,
                        borderColor: token.colorPrimaryBorder,
                      }}
                    >
                      Local
                    </Tag>
                  </Space>
                )}
                description={(
                  <Space direction="vertical" size={6}>
                    <Typography.Text type="secondary">{executor.description}</Typography.Text>
                    <Typography.Text code>{commandHint()}</Typography.Text>
                    <Space wrap>
                      {executor.supportsCwd && (
                        <Tag icon={<FolderOpen size={12} />}>
                          {t('settings.agentExecutors.cwd', { defaultValue: 'Working Directory' })}
                        </Tag>
                      )}
                      {executor.supportsPermissionMode && (
                        <Tag icon={<ShieldCheck size={12} />}>
                          {t('settings.agentExecutors.permissionMode', { defaultValue: 'Permission Mode' })}
                        </Tag>
                      )}
                    </Space>
                  </Space>
                )}
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
}
