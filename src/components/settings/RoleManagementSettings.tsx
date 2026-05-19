import { App, Button, Empty, Input, Tag, theme } from 'antd';
import { RotateCcw, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MAX_VISIBLE_ROLE_COUNT, ROLE_PRESETS, getRolePresetById } from '@/lib/rolePresets';
import { useRolePresetStore } from '@/stores';
import { SettingsGroup } from './SettingsGroup';

const CATEGORY_LABELS: Record<string, string> = {
  general: '通用',
  engineering: '工程',
  review: '审查',
  research: '研究',
  product: '产品',
};

export default function RoleManagementSettings() {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const visibleRoleIds = useRolePresetStore((s) => s.visibleRoleIds);
  const toggleVisibleRole = useRolePresetStore((s) => s.toggleVisibleRole);
  const resetVisibleRoles = useRolePresetStore((s) => s.resetVisibleRoles);
  const [keyword, setKeyword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState(ROLE_PRESETS[0]?.id ?? '');

  const visibleRoles = useMemo(
    () => visibleRoleIds.map((roleId) => getRolePresetById(roleId)).filter((role) => role !== null),
    [visibleRoleIds],
  );

  const filteredRoles = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return ROLE_PRESETS;
    return ROLE_PRESETS.filter((role) =>
      `${role.name} ${role.description} ${CATEGORY_LABELS[role.category] ?? role.category}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [keyword]);

  useEffect(() => {
    if (!filteredRoles.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(filteredRoles[0]?.id ?? '');
    }
  }, [filteredRoles, selectedRoleId]);

  const selectedRole = useMemo(
    () => filteredRoles.find((role) => role.id === selectedRoleId) ?? filteredRoles[0] ?? null,
    [filteredRoles, selectedRoleId],
  );

  const handleToggleRole = (roleId: string) => {
    const ok = toggleVisibleRole(roleId);
    if (!ok) {
      message.warning(t('settings.roleManager.maxVisibleHint', { count: MAX_VISIBLE_ROLE_COUNT }));
    }
  };

  return (
    <div className="p-6 pb-12">
      <SettingsGroup
        title={t('settings.roleManager.selectedTitle')}
        extra={(
          <Button
            type="text"
            size="small"
            icon={<RotateCcw size={14} />}
            onClick={resetVisibleRoles}
          >
            {t('common.reset')}
          </Button>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ color: token.colorTextSecondary, fontSize: 13 }}>
              {t('settings.roleManager.selectedDesc')}
            </div>
            <Tag color={visibleRoleIds.length >= MAX_VISIBLE_ROLE_COUNT ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
              {visibleRoleIds.length}/{MAX_VISIBLE_ROLE_COUNT}
            </Tag>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {visibleRoles.map((role) => (
              <Tag key={role.id} color="processing" style={{ marginInlineEnd: 0, borderRadius: 999 }}>
                {role.name}
              </Tag>
            ))}
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title={t('settings.roleManager.allRolesTitle')}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '320px minmax(0, 1fr)',
            gap: 16,
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              borderRadius: 14,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: 12, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
              <Input
                allowClear
                size="middle"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder={t('settings.roleManager.searchPlaceholder')}
                prefix={<Search size={14} color={token.colorTextTertiary} />}
              />
            </div>
            <div style={{ maxHeight: 560, overflowY: 'auto', padding: 8 }}>
              {filteredRoles.length === 0 ? (
                <div style={{ padding: '32px 12px' }}>
                  <Empty description={t('settings.roleManager.emptyResults')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                </div>
              ) : (
                filteredRoles.map((role) => {
                  const selected = selectedRole?.id === role.id;
                  const visible = visibleRoleIds.includes(role.id);
                  return (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRoleId(role.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px 12px 11px',
                        borderRadius: 12,
                        border: 'none',
                        background: selected ? token.colorPrimaryBg : 'transparent',
                        boxShadow: selected ? `inset 0 0 0 1px ${token.colorPrimaryBorder}` : 'none',
                        marginBottom: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: selected ? 600 : 500, color: token.colorText }}>
                          {role.name}
                        </span>
                        <Tag color={visible ? 'processing' : 'default'} style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '18px' }}>
                          {visible ? t('settings.roleManager.visibleTag') : t('settings.roleManager.hiddenTag')}
                        </Tag>
                      </div>
                      <div style={{ fontSize: 12, color: token.colorTextSecondary, lineHeight: 1.45 }}>
                        {role.description}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div
            style={{
              borderRadius: 14,
              border: `1px solid ${token.colorBorderSecondary}`,
              background: token.colorBgContainer,
              minHeight: 560,
              padding: 18,
            }}
          >
            {selectedRole ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontSize: 20, fontWeight: 700, color: token.colorText }}>
                        {selectedRole.name}
                      </span>
                      <Tag color="default" style={{ marginInlineEnd: 0 }}>
                        {CATEGORY_LABELS[selectedRole.category] ?? selectedRole.category}
                      </Tag>
                      <Tag color={visibleRoleIds.includes(selectedRole.id) ? 'processing' : 'default'} style={{ marginInlineEnd: 0 }}>
                        {visibleRoleIds.includes(selectedRole.id) ? t('settings.roleManager.visibleTag') : t('settings.roleManager.hiddenTag')}
                      </Tag>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.65, color: token.colorTextSecondary, maxWidth: 720 }}>
                      {selectedRole.description}
                    </div>
                  </div>

                  <Button
                    type={visibleRoleIds.includes(selectedRole.id) ? 'default' : 'primary'}
                    onClick={() => handleToggleRole(selectedRole.id)}
                  >
                    {visibleRoleIds.includes(selectedRole.id)
                      ? t('settings.roleManager.hideFromChat')
                      : t('settings.roleManager.selectAction')}
                  </Button>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: token.colorTextSecondary, marginBottom: 8 }}>
                    {t('settings.roleManager.detailTitle')}
                  </div>
                  <div
                    style={{
                      borderRadius: 12,
                      background: token.colorFillAlter,
                      padding: 14,
                      fontSize: 13,
                      color: token.colorText,
                      lineHeight: 1.7,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedRole.systemPrompt}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description={t('settings.roleManager.emptyResults')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
          </div>
        </div>
      </SettingsGroup>

      <div style={{ color: token.colorTextSecondary, fontSize: 12, padding: '0 4px' }}>
        {t('settings.roleManager.footerHint', { count: MAX_VISIBLE_ROLE_COUNT })}
      </div>
    </div>
  );
}
