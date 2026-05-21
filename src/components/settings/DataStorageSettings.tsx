import { Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import { DataManager } from './DataManager';
import { SettingsGroup } from './SettingsGroup';
import { StorageSpaceManager } from './StorageSpaceManager';

export function DataStorageSettings() {
  const { t } = useTranslation();

  return (
    <div className="p-6 pb-12">
      <SettingsGroup title={t('settings.dataStorage')}>
        <div style={{ color: 'var(--ant-color-text-secondary)', fontSize: 13 }}>
          {t('settings.dataStorageDesc')}
        </div>
      </SettingsGroup>

      <DataManager embedded />

      <Divider style={{ margin: '20px 0 12px' }} />

      <StorageSpaceManager embedded />
    </div>
  );
}
