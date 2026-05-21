import { Suspense, lazy, useEffect } from 'react';
import { Spin, Tabs, theme } from 'antd';
import { useProviderStore, useUIStore } from '@/stores';
import { ProviderList } from './ProviderList';
import SearchProviderSettings from './SearchProviderSettings';
import { useTranslation } from 'react-i18next';

const ProviderDetail = lazy(() => import('./ProviderDetail').then((m) => ({ default: m.ProviderDetail })));

export function ProviderSettings() {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const fetchProviders = useProviderStore((s) => s.fetchProviders);
  const selectedProviderId = useUIStore((s) => s.selectedProviderId);
  const settingsSection = useUIStore((s) => s.settingsSection);
  const setSettingsSection = useUIStore((s) => s.setSettingsSection);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const activeTab = settingsSection === 'searchProviders' ? 'searchProviders' : 'providers';

  return (
    <div className="h-full px-4 pt-3 overflow-hidden">
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setSettingsSection(key as 'providers' | 'searchProviders')}
        items={[
          {
            key: 'providers',
            label: t('settings.modelProviders', '模型服务商'),
            children: (
              <div className="flex h-full min-h-0">
                <div className="w-64 shrink-0 pt-2" style={{ borderRight: '1px solid var(--border-color)' }}>
                  <ProviderList />
                </div>
                <div className="min-w-0 flex-1 overflow-y-auto p-4 pt-4">
                  {selectedProviderId ? (
                    <Suspense fallback={<div className="flex h-full items-center justify-center"><Spin /></div>}>
                      <ProviderDetail providerId={selectedProviderId} />
                    </Suspense>
                  ) : (
                    <div className="flex h-full items-center justify-center" style={{ color: token.colorTextSecondary }}>
                      <p>{t('settings.selectProvider')}</p>
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'searchProviders',
            label: t('settings.searchServiceProviders', '搜索服务商'),
            children: <SearchProviderSettings embedded />,
          },
        ]}
        className="h-full flex flex-col [&_.ant-tabs-content-holder]:flex-1 [&_.ant-tabs-content-holder]:min-h-0 [&_.ant-tabs-content]:h-full [&_.ant-tabs-tabpane]:h-full"
        style={{ height: '100%' }}
      />
    </div>
  );
}
