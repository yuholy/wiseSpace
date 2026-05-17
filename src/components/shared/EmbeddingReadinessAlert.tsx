import { Alert, Button, Space, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '@/stores/uiStore';
import type { EmbeddingReadiness } from '@/lib/embeddingReadiness';

export function EmbeddingReadinessAlert({
  readiness,
  compact = false,
}: {
  readiness: EmbeddingReadiness;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const setActivePage = useUIStore((s) => s.setActivePage);
  const setSettingsSection = useUIStore((s) => s.setSettingsSection);

  if (readiness.ready) {
    return (
      <Alert
        type="success"
        showIcon
        message={t('settings.embeddingReadiness.ready')}
        description={
          <Space wrap size={[6, 6]}>
            <Tag>{t('settings.embeddingReadiness.providers', { count: readiness.enabledProviderCount })}</Tag>
            <Tag>{t('settings.embeddingReadiness.keys', { count: readiness.enabledKeyCount })}</Tag>
            <Tag>{t('settings.embeddingReadiness.models', { count: readiness.availableModelCount })}</Tag>
          </Space>
        }
      />
    );
  }

  const reasonLabels = readiness.missingReasons.map((reason) =>
    t(`settings.embeddingReadiness.reason.${reason}`),
  );

  return (
    <Alert
      type="warning"
      showIcon
      message={t('settings.embeddingReadiness.notReady')}
      description={
        <div className="flex flex-col gap-2">
          <Space wrap size={[6, 6]}>
            {reasonLabels.map((label) => (
              <Tag key={label} color="warning">{label}</Tag>
            ))}
          </Space>
          <div>{t('settings.embeddingReadiness.hint')}</div>
          {!compact && (
            <Button
              type="link"
              style={{ padding: 0, alignSelf: 'flex-start' }}
              onClick={() => {
                setSettingsSection('providers');
                setActivePage('settings');
              }}
            >
              {t('settings.embeddingReadiness.openProviders')}
            </Button>
          )}
        </div>
      }
    />
  );
}
