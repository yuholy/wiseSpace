import type {
  ExtensionDetail,
  ExternalAgentContributionDetail,
  ExternalBridgeFamily,
  ExternalBridgeNetworkScope,
  ExternalBridgeProfile,
} from '@/types';

function deriveBridgeFamily(kind?: string | null): ExternalBridgeFamily {
  const normalized = (kind ?? '').toLowerCase();
  if (normalized.includes('pi')) return 'pi_adapter';
  if (normalized.includes('openclaw')) return 'openclaw';
  if (normalized.includes('nanoclaw')) return 'nanoclaw';
  if (normalized.includes('http')) return 'http_bridge';
  return 'generic_remote';
}

function deriveNetworkScope(baseUrl?: string | null): ExternalBridgeNetworkScope {
  if (!baseUrl?.trim()) return 'unknown';

  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return 'loopback';
    }

    if (
      hostname.startsWith('10.')
      || hostname.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    ) {
      return 'private_network';
    }

    if (hostname.endsWith('.local') || hostname.endsWith('.lan')) {
      return 'lan';
    }

    return 'public_remote';
  } catch {
    return 'unknown';
  }
}

function deriveRiskLevel(
  networkScope: ExternalBridgeNetworkScope,
  authConfigured: boolean,
): ExternalBridgeProfile['riskLevel'] {
  if (networkScope === 'loopback') {
    return authConfigured ? 'managed' : 'local';
  }

  if (networkScope === 'private_network' || networkScope === 'lan') {
    return authConfigured ? 'managed' : 'elevated';
  }

  if (networkScope === 'public_remote') {
    return authConfigured ? 'managed' : 'elevated';
  }

  return authConfigured ? 'managed' : 'local';
}

function buildPermissionSummary(
  networkScope: ExternalBridgeNetworkScope,
  authConfigured: boolean,
): string {
  if (networkScope === 'loopback') {
    return authConfigured
      ? 'Local bridge with authentication configured.'
      : 'Local bridge without extra authentication.';
  }

  if (networkScope === 'private_network' || networkScope === 'lan') {
    return authConfigured
      ? 'LAN bridge with authentication configured.'
      : 'LAN bridge is reachable without authentication.';
  }

  if (networkScope === 'public_remote') {
    return authConfigured
      ? 'Remote bridge uses explicit authentication.'
      : 'Remote bridge is exposed without authentication.';
  }

  return authConfigured
    ? 'Connector authentication is configured.'
    : 'Connector authentication is not configured.';
}

export function readExternalBridgeProfile(
  extension: Pick<ExtensionDetail, 'kind' | 'source' | 'kindDetail'>,
): ExternalBridgeProfile | null {
  if (extension.kind !== 'external_agent') {
    return null;
  }

  const detail = (extension.kindDetail ?? {}) as ExternalAgentContributionDetail & {
    bridgeProfile?: ExternalBridgeProfile;
    agentKind?: string;
    baseUrl?: string | null;
  };
  if (detail.bridgeProfile) {
    return detail.bridgeProfile;
  }

  const authConfigured = Boolean(detail.authConfigured);
  const networkScope = detail.networkScope ?? deriveNetworkScope(detail.baseUrl ?? extension.source.path);
  return {
    family: deriveBridgeFamily(detail.agentKind ?? extension.source.label),
    networkScope,
    authConfigured,
    authType: detail.authType ?? null,
    riskLevel: deriveRiskLevel(networkScope, authConfigured),
    permissionSummary: buildPermissionSummary(networkScope, authConfigured),
  };
}

export function getExternalBridgeFamilyLabel(family: ExternalBridgeFamily): string {
  switch (family) {
    case 'pi_adapter':
      return 'Pi Adapter';
    case 'openclaw':
      return 'OpenClaw';
    case 'nanoclaw':
      return 'NanoClaw';
    case 'http_bridge':
      return 'HTTP bridge';
    default:
      return 'Remote connector';
  }
}

export function getExternalBridgeNetworkScopeLabel(
  scope: ExternalBridgeNetworkScope,
): string {
  switch (scope) {
    case 'loopback':
      return 'Loopback';
    case 'lan':
      return 'LAN';
    case 'private_network':
      return 'Private network';
    case 'public_remote':
      return 'Public remote';
    default:
      return 'Unknown scope';
  }
}

export function getExternalBridgeRiskColor(
  riskLevel: ExternalBridgeProfile['riskLevel'],
): 'default' | 'gold' | 'red' {
  switch (riskLevel) {
    case 'managed':
      return 'default';
    case 'local':
      return 'default';
    case 'elevated':
      return 'red';
    default:
      return 'gold';
  }
}
