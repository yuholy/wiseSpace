import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@/lib/invoke', () => ({
  invoke: invokeMock,
}));

describe('extensionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads unified extensions successfully', async () => {
    const { useExtensionStore } = await import('../extensionStore');
    invokeMock.mockResolvedValueOnce([
      {
        id: 'skill::lint',
        kind: 'skill',
        name: 'lint',
        enabled: true,
        source: { kind: 'builtin' },
        health: { status: 'healthy' },
        scope: { availability: 'workspace_attachable' },
        permissions: { trustLevel: 'safe', approvalMode: 'inherit' },
        contributions: [],
        tags: [],
      },
    ]);

    await useExtensionStore.getState().loadExtensions();

    expect(invokeMock).toHaveBeenCalledWith('list_extensions');
    expect(useExtensionStore.getState().extensions).toHaveLength(1);
    expect(useExtensionStore.getState().loading).toBe(false);
    expect(useExtensionStore.getState().error).toBeNull();
  });

  it('loads extension detail and caches it by id', async () => {
    const { useExtensionStore } = await import('../extensionStore');
    invokeMock.mockResolvedValueOnce({
      id: 'skill::lint',
      kind: 'skill',
      name: 'lint',
      enabled: true,
      source: { kind: 'builtin' },
      health: { status: 'healthy' },
      scope: { availability: 'workspace_attachable' },
      permissions: { trustLevel: 'safe', approvalMode: 'inherit' },
      runtime: { hostKind: 'native_skill_loader', isolation: 'in_process' },
      contributions: [],
      tags: [],
      diagnostics: { canTestConnection: false },
      kindDetail: { group: 'quality' },
    });

    const detail = await useExtensionStore.getState().loadExtensionDetail('skill::lint');

    expect(invokeMock).toHaveBeenCalledWith('get_extension_detail', { id: 'skill::lint' });
    expect(detail.name).toBe('lint');
    expect(useExtensionStore.getState().detailsById['skill::lint']).toEqual(detail);
  });

  it('captures loading errors', async () => {
    const { useExtensionStore } = await import('../extensionStore');
    invokeMock.mockRejectedValueOnce(new Error('boom'));

    await useExtensionStore.getState().loadExtensions();

    expect(useExtensionStore.getState().loading).toBe(false);
    expect(useExtensionStore.getState().error).toContain('boom');
  });

  it('tests connection through the unified runtime command map', async () => {
    const { useExtensionStore } = await import('../extensionStore');
    invokeMock.mockResolvedValueOnce({ ok: true, message: 'connected' });

    const result = await useExtensionStore.getState().testExtensionConnection({
      id: 'external_agent::agent-1',
      kind: 'external_agent',
    });

    expect(invokeMock).toHaveBeenCalledWith('test_external_agent_connection', { id: 'agent-1' });
    expect(result.ok).toBe(true);
    expect(useExtensionStore.getState().connectionChecksById['external_agent::agent-1']).toEqual(result);
    expect(useExtensionStore.getState().testingById['external_agent::agent-1']).toBe(false);
  });

  it('toggles extension enabled state through the unified command', async () => {
    const { useExtensionStore } = await import('../extensionStore');
    useExtensionStore.setState({
      extensions: [
        {
          id: 'skill::lint',
          kind: 'skill',
          name: 'lint',
          enabled: true,
          source: { kind: 'builtin' },
          health: { status: 'healthy' },
          scope: { availability: 'workspace_attachable' },
          permissions: { trustLevel: 'safe', approvalMode: 'inherit' },
          contributions: [],
          tags: [],
        },
      ],
    });
    invokeMock.mockResolvedValueOnce({
      id: 'skill::lint',
      kind: 'skill',
      name: 'lint',
      enabled: false,
      source: { kind: 'builtin' },
      health: { status: 'warning' },
      scope: { availability: 'workspace_attachable' },
      permissions: { trustLevel: 'safe', approvalMode: 'inherit' },
      contributions: [],
      tags: [],
    });

    const updated = await useExtensionStore.getState().setExtensionEnabled('skill::lint', false);

    expect(invokeMock).toHaveBeenCalledWith('set_extension_enabled', { id: 'skill::lint', enabled: false });
    expect(updated.enabled).toBe(false);
    expect(useExtensionStore.getState().extensions[0]?.enabled).toBe(false);
    expect(useExtensionStore.getState().togglingById['skill::lint']).toBe(false);
  });

  it('refreshes runtime state by reloading both summary and detail', async () => {
    const { useExtensionStore } = await import('../extensionStore');
    useExtensionStore.setState({
      extensions: [
        {
          id: 'external_agent::agent-1',
          kind: 'external_agent',
          name: 'Remote Bridge',
          enabled: true,
          source: { kind: 'remote_connector' },
          health: { status: 'warning' },
          scope: { availability: 'workspace_attachable' },
          permissions: { trustLevel: 'networked', approvalMode: 'inherit' },
          contributions: [],
          tags: [],
        },
      ],
    });
    invokeMock
      .mockResolvedValueOnce([
        {
          id: 'external_agent::agent-1',
          kind: 'external_agent',
          name: 'Remote Bridge',
          enabled: true,
          source: { kind: 'remote_connector' },
          health: { status: 'healthy' },
          scope: { availability: 'workspace_attachable' },
          permissions: { trustLevel: 'networked', approvalMode: 'inherit' },
          contributions: [],
          tags: [],
        },
      ])
      .mockResolvedValueOnce({
        id: 'external_agent::agent-1',
        kind: 'external_agent',
        name: 'Remote Bridge',
        enabled: true,
        source: { kind: 'remote_connector', path: 'https://bridge.example.com' },
        health: { status: 'healthy' },
        scope: { availability: 'workspace_attachable' },
        permissions: { trustLevel: 'networked', approvalMode: 'inherit' },
        runtime: { hostKind: 'external_agent_connector', isolation: 'remote' },
        contributions: [],
        tags: [],
        diagnostics: { canTestConnection: true },
        kindDetail: { agentKind: 'custom_http' },
      });

    const detail = await useExtensionStore.getState().refreshExtensionRuntime('external_agent::agent-1');

    expect(invokeMock).toHaveBeenNthCalledWith(1, 'list_extensions');
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'get_extension_detail', { id: 'external_agent::agent-1' });
    expect(detail.health.status).toBe('healthy');
    expect(useExtensionStore.getState().refreshingById['external_agent::agent-1']).toBe(false);
    expect(useExtensionStore.getState().detailsById['external_agent::agent-1']).toEqual(detail);
  });
});
