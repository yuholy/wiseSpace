import { theme } from 'antd';
import { useUIStore } from '@/stores';
import {
  SettingsSidebar,
  ProviderSettings,
  GeneralSettings,
  DisplaySettings,
  ProxySettings,
  DataStorageSettings,
  AboutPage,
  McpServerSettings,
  AgentExecutorSettings,
  BackupCenter,
} from '@/components/settings';
import { DefaultModelSettings } from '@/components/settings/DefaultModelSettings';
import { ConversationSettings } from '@/components/settings/ConversationSettings';
import type { SettingsSection } from '@/types';

const SECTION_COMPONENTS: Record<SettingsSection, React.ComponentType> = {
  providers: ProviderSettings,
  conversationSettings: ConversationSettings,
  defaultModel: DefaultModelSettings,
  general: GeneralSettings,
  display: DisplaySettings,
  proxy: ProxySettings,
  shortcuts: GeneralSettings,
  data: DataStorageSettings,
  storage: DataStorageSettings,
  dataStorage: DataStorageSettings,
  about: AboutPage,
  searchProviders: ProviderSettings,
  mcpServers: McpServerSettings,
  agentExecutors: AgentExecutorSettings,
  backup: BackupCenter,
};

export function SettingsPage() {
  const { token } = theme.useToken();
  const settingsSection = useUIStore((s) => s.settingsSection);
  const normalizedSection = settingsSection === 'searchProviders' ? 'providers' : settingsSection;
  const ContentComponent = SECTION_COMPONENTS[normalizedSection as SettingsSection] ?? AgentExecutorSettings;

  return (
    <div className="flex h-full">
      <div
        className="w-56 shrink-0 h-full"
        style={{ borderRight: '1px solid var(--border-color)', backgroundColor: token.colorBgContainer }}
      >
        <SettingsSidebar />
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto" style={{ backgroundColor: token.colorBgElevated }}>
        <ContentComponent />
      </div>
    </div>
  );
}
