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

  it('captures loading errors', async () => {
    const { useExtensionStore } = await import('../extensionStore');
    invokeMock.mockRejectedValueOnce(new Error('boom'));

    await useExtensionStore.getState().loadExtensions();

    expect(useExtensionStore.getState().loading).toBe(false);
    expect(useExtensionStore.getState().error).toContain('boom');
  });
});
