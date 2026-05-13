import { Button, Divider, Typography } from 'antd';
import { Github, Globe, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { isTauri, invoke } from '@/lib/invoke';
import { APP_REPO_HOST_LABEL, APP_REPO_URL } from '@/lib/repo';
import logoUrl from '@/assets/image/logo.png?url';
import { SettingsGroup } from './SettingsGroup';

const { Text } = Typography;
const OFFICIAL_WEBSITE = 'https://app.wisespace.top';

export function AboutPage() {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState('...');

  useEffect(() => {
    if (isTauri()) {
      import('@tauri-apps/api/app').then(({ getVersion }) => {
        getVersion().then(v => setAppVersion(v));
      });
    }
  }, []);

  const rowStyle = { padding: '4px 0' };

  const handleOpenDevTools = useCallback(async () => {
    if (isTauri()) {
      try {
        await invoke('open_devtools');
      } catch { /* ignore */ }
    }
  }, []);

  const openExternalUrl = useCallback(async (url: string) => {
    if (isTauri()) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(url);
        return;
      } catch {
        // fall through to window.open
      }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <div className="p-6 pb-12">
      {/* Logo + App Name (macOS-style) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 0 24px',
      }}>
        <img
          src={logoUrl}
          alt="wiseSpace"
          style={{ width: 96, height: 96, borderRadius: 20, marginBottom: 16 }}
          draggable={false}
        />
        <div style={{ fontSize: 22, fontWeight: 600 }}>wiseSpace</div>
        <Text type="secondary" style={{ marginTop: 4 }}>
          {t('settings.version')} {appVersion}
        </Text>
      </div>

      <SettingsGroup title={t('settings.groupAppInfo')}>
        <div style={rowStyle} className="flex items-center justify-between">
          <span>{t('settings.version')}</span>
          <Text type="secondary">{appVersion}</Text>
        </div>
        <Divider style={{ margin: '4px 0' }} />
        <div style={rowStyle} className="flex items-center justify-between">
          <span>{t('settings.openSource')}</span>
          <Text type="secondary">AGPL-3.0</Text>
        </div>
      </SettingsGroup>
      <SettingsGroup title={t('settings.groupLinks')}>
        <div style={rowStyle} className="flex items-center justify-between">
          <span>{t('settings.website')}</span>
          <Button
            icon={<Globe size={16} />}
            type="link"
            onClick={() => openExternalUrl(OFFICIAL_WEBSITE)}
          >
            {t('settings.website')}
          </Button>
        </div>
        <Divider style={{ margin: '4px 0' }} />
        <div style={rowStyle} className="flex items-center justify-between">
          <span>{APP_REPO_HOST_LABEL}</span>
          <Button
            icon={<Github size={16} />}
            type="link"
            onClick={() => openExternalUrl(APP_REPO_URL)}
          >
            {APP_REPO_HOST_LABEL}
          </Button>
        </div>
        {isTauri() && (
          <>
            <Divider style={{ margin: '4px 0' }} />
            <div style={rowStyle} className="flex items-center justify-between">
              <span>{t('settings.developerTools')}</span>
              <Button
                icon={<Terminal size={16} />}
                onClick={handleOpenDevTools}
              >
                {t('settings.openDevTools')}
              </Button>
            </div>
          </>
        )}
      </SettingsGroup>
    </div>
  );
}
