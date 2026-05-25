export type ExtensionKind =
  | 'skill'
  | 'mcp_server'
  | 'external_agent'
  | 'tool_bundle'
  | 'ui_panel';

export type ExtensionSourceKind =
  | 'builtin'
  | 'marketplace'
  | 'local'
  | 'project'
  | 'remote_connector'
  | 'imported';

export type ExtensionHealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';

export interface ExtensionHealth {
  status: ExtensionHealthStatus;
  summary?: string | null;
  checkedAt?: string | null;
}

export type ExtensionAvailability =
  | 'global_only'
  | 'workspace_attachable'
  | 'conversation_override';

export interface ExtensionScope {
  availability: ExtensionAvailability;
  attachedWorkspaceIds?: string[];
  defaultEnabled?: boolean;
}

export type ExtensionTrustLevel = 'safe' | 'elevated' | 'networked' | 'privileged';
export type ExtensionApprovalMode = 'inherit' | 'ask' | 'allow_safe' | 'allow_all';

export interface ExtensionPermissionProfile {
  trustLevel: ExtensionTrustLevel;
  approvalMode: ExtensionApprovalMode;
  requiresFilesystemAccess?: boolean;
  requiresNetworkAccess?: boolean;
  requiresSecrets?: boolean;
}

export type ExtensionRuntimeHostKind =
  | 'native_skill_loader'
  | 'mcp_host'
  | 'external_agent_connector'
  | 'builtin_host';

export type ExtensionIsolationLevel =
  | 'in_process'
  | 'subprocess'
  | 'remote'
  | 'none';

export interface ExtensionRuntimeInfo {
  hostKind: ExtensionRuntimeHostKind;
  isolation: ExtensionIsolationLevel;
  supportsHotReload?: boolean;
  supportsConnectionTest?: boolean;
  supportsEnableToggle?: boolean;
  healthManagedByHost?: boolean;
}

export type ExternalBridgeFamily =
  | 'openclaw'
  | 'nanoclaw'
  | 'http_bridge'
  | 'generic_remote';

export type ExternalBridgeNetworkScope =
  | 'loopback'
  | 'lan'
  | 'private_network'
  | 'public_remote'
  | 'unknown';

export interface ExternalBridgeProfile {
  family: ExternalBridgeFamily;
  networkScope: ExternalBridgeNetworkScope;
  authConfigured: boolean;
  authType?: string | null;
  riskLevel: 'local' | 'managed' | 'elevated';
  permissionSummary?: string | null;
}

export type ExtensionContributionType =
  | 'prompt_skill'
  | 'tool_provider'
  | 'connector'
  | 'task_executor'
  | 'ui_surface';

export interface ExtensionContributionSummary {
  id: string;
  type: ExtensionContributionType;
  name: string;
  description?: string | null;
  userInvocable?: boolean;
  runtimeLabel?: string | null;
}

export interface ExtensionSourceInfo {
  kind: ExtensionSourceKind;
  label?: string | null;
  path?: string | null;
  ref?: string | null;
}

export interface ExtensionSummary {
  id: string;
  kind: ExtensionKind;
  name: string;
  description?: string | null;
  version?: string | null;
  enabled: boolean;
  source: ExtensionSourceInfo;
  health: ExtensionHealth;
  scope: ExtensionScope;
  permissions: ExtensionPermissionProfile;
  runtime?: ExtensionRuntimeInfo;
  contributions: ExtensionContributionSummary[];
  tags?: string[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface SkillContributionDetail {
  argumentHint?: string;
  whenToUse?: string;
  group?: string;
}

export interface McpContributionDetail {
  transport?: 'stdio' | 'http' | 'sse';
  toolCount?: number;
  permissionPolicy?: 'ask' | 'allow_safe' | 'allow_all';
}

export interface ExternalAgentContributionDetail {
  agentKind?: string;
  capabilityNames?: string[];
  baseUrl?: string | null;
  authType?: string | null;
  authConfigured?: boolean;
  networkScope?: ExternalBridgeNetworkScope;
  bridgeProfile?: ExternalBridgeProfile;
}

export interface ExtensionDiagnostics {
  canTestConnection?: boolean;
  canCheckUpdates?: boolean;
  lastError?: string | null;
  compatibilityNotes?: string[];
}

export type ExtensionKindDetail =
  | SkillContributionDetail
  | McpContributionDetail
  | ExternalAgentContributionDetail
  | Record<string, unknown>;

export interface ExtensionDetail extends ExtensionSummary {
  manifest?: Record<string, unknown> | null;
  diagnostics?: ExtensionDiagnostics;
  kindDetail?: ExtensionKindDetail;
}
