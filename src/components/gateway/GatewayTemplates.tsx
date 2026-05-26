import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Typography, App, Tag, Select } from 'antd';
import { Zap, ZapOff, RefreshCw, AlertCircle } from 'lucide-react';
import { Codex } from '@lobehub/icons';
import { OpenCode } from '@lobehub/icons';
import { useGatewayStore } from '@/stores/gatewayStore';
import type { CliToolInfo, QuickConnectProtocol } from '@/types';

const { Title, Paragraph, Text } = Typography;

interface QuickConnectItem {
  key: string;
  name: string;
  avatar: (size: number) => ReactNode;
  description: string;
  configPathHint?: string;
  supportsManagedInstall?: boolean;
}

function PiGlyph({ size }: { size: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #111827 0%, #334155 100%)',
        color: '#fff',
      }}
    >
      <svg
        viewBox="0 0 800 800"
        aria-hidden="true"
        focusable="false"
        style={{ width: Math.round(size * 0.58), height: Math.round(size * 0.58) }}
      >
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"
        />
        <path fill="currentColor" d="M517.36 400H634.72V634.72H517.36Z" />
      </svg>
    </span>
  );
}

function DeepSeekSeal({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#171717',
        backgroundImage:
          'radial-gradient(rgba(244, 241, 232, 0.28) 0.7px, transparent 0.7px)',
        backgroundSize: `${Math.max(4, Math.round(size * 0.14))}px ${Math.max(4, Math.round(size * 0.14))}px`,
        color: '#f4f1e8',
        fontFamily: '"Noto Serif SC", serif',
        fontWeight: 700,
        width: size,
        height: size,
        borderRadius: 1,
        letterSpacing: '-0.04em',
        boxShadow: 'inset 0 0 0 1px rgba(244, 241, 232, 0.18), inset 0 0 0 3px #171717',
        transform: 'rotate(-1.5deg)',
        position: 'relative',
        fontSize: Math.round(size * 0.48),
        lineHeight: 1,
      }}
    >
      深
    </span>
  );
}

const CONNECT_ITEMS: QuickConnectItem[] = [
  {
    key: 'codex',
    name: 'Codex',
    avatar: (size) => <Codex.Avatar size={size} />,
    description: 'gateway.templateDescCodex',
    configPathHint: '~/.codex/auth.json',
  },
  {
    key: 'opencode',
    name: 'OpenCode',
    avatar: (size) => <OpenCode.Avatar size={size} />,
    description: 'gateway.templateDescOpencode',
    configPathHint: '~/.config/opencode/opencode.json',
  },
  {
    key: 'pi',
    name: 'Pi',
    avatar: (size) => <PiGlyph size={size} />,
    description: 'gateway.templateDescPi',
    configPathHint: '~/.pi/agent/models.json',
    supportsManagedInstall: true,
  },
  {
    key: 'deepseek_tui',
    name: 'DeepSeek-TUI',
    avatar: (size) => <DeepSeekSeal size={size} />,
    description: 'gateway.templateDescDeepSeekTui',
    configPathHint: '~/.deepseek/config.toml',
    supportsManagedInstall: true,
  },
];

/** Tab icon that cycles through integration target avatars */
export function QuickConnectCycleIcon({ size = 16 }: { size?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % CONNECT_ITEMS.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size,
      height: size,
      verticalAlign: '-0.125em',
      overflow: 'hidden',
    }}>
      {CONNECT_ITEMS[index].avatar(size)}
    </span>
  );
}

function StatusTag({
  status,
  connectedProtocol,
}: {
  status: string;
  connectedProtocol?: QuickConnectProtocol | null;
}) {
  const { t } = useTranslation();
  const displayStatus = status === 'connected' && connectedProtocol == null ? 'not_connected' : status;
  switch (displayStatus) {
    case 'connected':
      return (
        <Tag color="success">
          {connectedProtocol === 'https'
            ? t('gateway.cliConnectedHttps')
            : connectedProtocol === 'http'
              ? t('gateway.cliConnectedHttp')
              : t('gateway.cliNotConnected')}
        </Tag>
      );
    case 'not_connected':
      return <Tag color="default">{t('gateway.cliNotConnected')}</Tag>;
    case 'not_installed':
      return <Tag color="error">{t('gateway.cliNotInstalled')}</Tag>;
    default:
      return null;
  }
}

function ToolCard({
  item,
  toolInfo,
  selectedKeyId,
  selectedProtocol,
  quickConnectBlocked,
  onInstall,
  onConnect,
  onDisconnect,
  busyTool,
}: {
  item: QuickConnectItem;
  toolInfo?: CliToolInfo;
  selectedKeyId?: string;
  selectedProtocol?: QuickConnectProtocol;
  quickConnectBlocked: boolean;
  onInstall: (toolId: string) => void;
  onConnect: (toolId: string) => void;
  onDisconnect: (toolId: string, restoreBackup: boolean) => void;
  busyTool: string | null;
}) {
  const { t } = useTranslation();
  const { modal } = App.useApp();

  const status = toolInfo?.status ?? 'not_installed';
  const connectedProtocol = toolInfo?.connectedProtocol ?? null;
  const displayStatus = status === 'connected' && connectedProtocol == null ? 'not_connected' : status;
  const isBusy = busyTool === item.key;
  const isNotInstalled = displayStatus === 'not_installed';
  const isConnected = displayStatus === 'connected';
  const configPath = toolInfo?.configPath ?? item.configPathHint;
  const needsReconnect =
    isConnected &&
    connectedProtocol != null &&
    selectedProtocol != null &&
    connectedProtocol !== selectedProtocol;

  const handleConnect = useCallback(() => {
    if (isNotInstalled) {
      modal.confirm({
        title: t('gateway.cliNotInstalledConfirmTitle'),
        content: t('gateway.cliNotInstalledConfirmContent'),
        okText: t('gateway.cliNotInstalledConfirmOk'),
        cancelText: t('gateway.cliNotInstalledConfirmCancel'),
        onOk: () => onConnect(item.key),
      });
    } else {
      onConnect(item.key);
    }
  }, [item.key, isNotInstalled, onConnect, modal, t]);

  const handleInstall = useCallback(() => {
    onInstall(item.key);
  }, [item.key, onInstall]);

  const handleDisconnect = useCallback(() => {
    const hasBackup = toolInfo?.hasBackup ?? false;
    if (hasBackup) {
      modal.confirm({
        title: t('gateway.cliDisconnectTitle'),
        content: t('gateway.cliDisconnectContent'),
        okText: t('gateway.cliRestoreBackup'),
        cancelText: t('gateway.cliRemoveFieldsOnly'),
        onOk: () => onDisconnect(item.key, true),
        onCancel: () => onDisconnect(item.key, false),
      });
    } else {
      onDisconnect(item.key, false);
    }
  }, [item.key, toolInfo, onDisconnect, modal, t]);

  return (
    <Card key={item.key} size="small" hoverable className="gateway-quick-connect-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ flexShrink: 0 }}>
          {item.avatar(40)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Title level={5} style={{ margin: 0 }}>{item.name}</Title>
            {toolInfo?.version && !isNotInstalled && (
              <Text type="secondary" style={{ fontSize: 12 }}>v{toolInfo.version.replace(/^[^\d]*/, '')}</Text>
            )}
            <StatusTag status={status} connectedProtocol={connectedProtocol} />
          </div>
          <Paragraph
            type="secondary"
            style={{ fontSize: 13, margin: 0, marginTop: 4 }}
            ellipsis={{ rows: 1 }}
          >
            {t(item.description)}
          </Paragraph>
          {configPath && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {configPath}
            </Text>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>
          {isNotInstalled && item.supportsManagedInstall ? (
            <Button
              icon={<Zap size={14} />}
              onClick={handleInstall}
              loading={isBusy}
            >
              {t('gateway.cliInstall')}
            </Button>
          ) : isConnected && !needsReconnect ? (
            <Button
              danger
              icon={<ZapOff size={14} />}
              onClick={handleDisconnect}
              loading={isBusy}
            >
              {t('gateway.cliDisconnect')}
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<Zap size={14} />}
              onClick={handleConnect}
              disabled={quickConnectBlocked || !selectedKeyId || !selectedProtocol}
              loading={isBusy}
            >
              {needsReconnect ? t('gateway.cliSwitchProtocolReconnect') : t('gateway.quickConnect')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function GatewayTemplates() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const {
    status,
    cliTools,
    cliToolsLoading,
    keys,
    fetchStatus,
    fetchCliToolStatuses,
    installCliTool,
    connectCliTool,
    disconnectCliTool,
    fetchKeys,
  } = useGatewayStore();
  const [busyTool, setBusyTool] = useState<string | null>(null);
  const enabledKeys = keys.filter((k) => k.enabled && k.has_encrypted_key);
  const quickConnectBlocked = !status.is_running;
  const [selectedKeyId, setSelectedKeyId] = useState<string | undefined>(undefined);
  const availableProtocols = useMemo<QuickConnectProtocol[]>(() => {
    const protocols: QuickConnectProtocol[] = [];

    if (!status.force_ssl) {
      protocols.push('http');
    }
    if (status.https_port != null) {
      protocols.push('https');
    }

    if (protocols.length > 0) {
      return protocols;
    }

    return status.force_ssl ? ['https'] : ['http'];
  }, [status.force_ssl, status.https_port]);
  const [selectedProtocol, setSelectedProtocol] = useState<QuickConnectProtocol | undefined>(undefined);

  useEffect(() => {
    fetchStatus();
    fetchCliToolStatuses();
    fetchKeys();
  }, [fetchStatus, fetchCliToolStatuses, fetchKeys]);

  // Auto-select first key when keys load
  useEffect(() => {
    if (!selectedKeyId && enabledKeys.length > 0) {
      setSelectedKeyId(enabledKeys[0].id);
    }
  }, [enabledKeys, selectedKeyId]);

  useEffect(() => {
    if (!selectedProtocol || !availableProtocols.includes(selectedProtocol)) {
      setSelectedProtocol(availableProtocols[0]);
      return;
    }

    if (availableProtocols.length === 1 && selectedProtocol !== availableProtocols[0]) {
      setSelectedProtocol(availableProtocols[0]);
    }
  }, [availableProtocols, selectedProtocol]);

  const handleRefresh = useCallback(() => {
    void fetchStatus();
    void fetchCliToolStatuses();
  }, [fetchStatus, fetchCliToolStatuses]);

  const handleInstall = useCallback(
    async (toolId: string) => {
      setBusyTool(toolId);
      try {
        await installCliTool(toolId);
        const name = CONNECT_ITEMS.find((i) => i.key === toolId)?.name;
        message.success(t('gateway.cliInstallSuccess', { name }));
      } catch (e) {
        message.error(t('gateway.cliInstallError', { error: String(e) }));
      } finally {
        setBusyTool(null);
      }
    },
    [installCliTool, message, t],
  );

  const handleConnect = useCallback(
    async (toolId: string) => {
      if (!selectedKeyId || !selectedProtocol) return;
      setBusyTool(toolId);
      try {
        await connectCliTool(toolId, selectedKeyId, selectedProtocol);
        const name = CONNECT_ITEMS.find((i) => i.key === toolId)?.name;
        message.success(t('gateway.cliConnectSuccess', { name }));
      } catch (e) {
        message.error(t('gateway.cliConnectError', { error: String(e) }));
      } finally {
        setBusyTool(null);
      }
    },
    [connectCliTool, message, selectedKeyId, selectedProtocol, t],
  );

  const handleDisconnect = useCallback(
    async (toolId: string, restoreBackup: boolean) => {
      setBusyTool(toolId);
      try {
        await disconnectCliTool(toolId, restoreBackup);
        const name = CONNECT_ITEMS.find((i) => i.key === toolId)?.name;
        message.success(t('gateway.cliDisconnectSuccess', { name }));
      } catch (e) {
        message.error(t('gateway.cliDisconnectError', { error: String(e) }));
      } finally {
        setBusyTool(null);
      }
    },
    [disconnectCliTool, message, t],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Button
          icon={<RefreshCw size={14} />}
          onClick={handleRefresh}
          loading={cliToolsLoading}
        >
          {t('gateway.cliRefresh')}
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Select
            style={{ width: 200 }}
            value={selectedKeyId}
            onChange={setSelectedKeyId}
            placeholder={t('gateway.cliSelectKey')}
            options={enabledKeys.map((k) => ({
              value: k.id,
              label: `${k.name} (${k.key_prefix})`,
            }))}
          />
          <Select<QuickConnectProtocol>
            data-testid="gateway-protocol-select"
            style={{ width: 140 }}
            value={selectedProtocol}
            onChange={setSelectedProtocol}
            placeholder={t('gateway.cliSelectProtocol')}
            disabled={availableProtocols.length <= 1}
            options={availableProtocols.map((protocol) => ({
              value: protocol,
              label: protocol === 'https' ? t('gateway.cliProtocolHttps') : t('gateway.cliProtocolHttp'),
            }))}
          />
        </div>
      </div>
      {quickConnectBlocked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--ant-color-warning-bg)', borderRadius: 6, marginBottom: 4 }}>
          <AlertCircle size={16} style={{ color: 'var(--ant-color-warning)' }} />
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('gateway.cliStartGatewayFirst')}
          </Text>
        </div>
      )}
      {enabledKeys.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--ant-color-warning-bg)', borderRadius: 6, marginBottom: 4 }}>
          <AlertCircle size={16} style={{ color: 'var(--ant-color-warning)' }} />
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('gateway.cliNoKeys')}
          </Text>
        </div>
      )}
      {CONNECT_ITEMS.map((item) => (
        <ToolCard
          key={item.key}
          item={item}
          toolInfo={cliTools.find((t) => t.id === item.key)}
          selectedKeyId={selectedKeyId}
          selectedProtocol={selectedProtocol}
          quickConnectBlocked={quickConnectBlocked}
          onInstall={handleInstall}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          busyTool={busyTool}
        />
      ))}
    </div>
  );
}
