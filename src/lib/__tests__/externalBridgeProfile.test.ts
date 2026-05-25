import { describe, expect, it } from 'vitest';
import { readExternalBridgeProfile } from '../externalBridgeProfile';

describe('externalBridgeProfile', () => {
  it('derives a high-risk public bridge when auth is missing', () => {
    const profile = readExternalBridgeProfile({
      kind: 'external_agent',
      source: {
        kind: 'remote_connector',
        label: 'custom_http',
        path: 'https://bridge.example.com',
      },
      kindDetail: {
        agentKind: 'custom_http',
        baseUrl: 'https://bridge.example.com',
        authConfigured: false,
      },
    });

    expect(profile).not.toBeNull();
    expect(profile?.family).toBe('http_bridge');
    expect(profile?.networkScope).toBe('public_remote');
    expect(profile?.riskLevel).toBe('elevated');
  });

  it('treats localhost connectors as local bridges', () => {
    const profile = readExternalBridgeProfile({
      kind: 'external_agent',
      source: {
        kind: 'remote_connector',
        label: 'openclaw_remote',
        path: 'http://127.0.0.1:8787',
      },
      kindDetail: {
        agentKind: 'openclaw_remote',
        baseUrl: 'http://127.0.0.1:8787',
        authConfigured: false,
      },
    });

    expect(profile?.networkScope).toBe('loopback');
    expect(profile?.riskLevel).toBe('local');
  });
});
