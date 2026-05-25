import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@/types';

const invokeMock = vi.fn();

vi.mock('@/lib/invoke', () => ({
  invoke: invokeMock,
}));

async function loadStore() {
  const { useSettingsStore } = await import('../settingsStore');
  return useSettingsStore;
}

describe('settingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('applies settings locally before the initial fetch completes', async () => {
    const useSettingsStore = await loadStore();

    await useSettingsStore.getState().saveSettings({ theme_mode: 'dark' });

    expect(useSettingsStore.getState().settings.theme_mode).toBe('dark');
    expect(invokeMock).not.toHaveBeenCalledWith('save_settings', expect.anything());
  });

  it('replays queued settings after the first fetch resolves', async () => {
    const useSettingsStore = await loadStore();
    let resolveSettingsFetch!: (value: Partial<AppSettings>) => void;

    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_settings') {
        return new Promise((resolve) => {
          resolveSettingsFetch = resolve;
        });
      }
      if (command === 'save_settings') {
        return Promise.resolve();
      }
      throw new Error(`Unexpected invoke: ${command}`);
    });

    const fetchPromise = useSettingsStore.getState().fetchSettings();
    await Promise.resolve();

    await useSettingsStore.getState().saveSettings({ primary_color: '#000000' });
    expect(useSettingsStore.getState().settings.primary_color).toBe('#000000');

    resolveSettingsFetch({ theme_mode: 'light', primary_color: '#1677ff' });
    await fetchPromise;

    expect(useSettingsStore.getState().settings.theme_mode).toBe('light');
    expect(useSettingsStore.getState().settings.primary_color).toBe('#000000');
    expect(invokeMock).toHaveBeenCalledWith('save_settings', {
      settings: expect.objectContaining({
        theme_mode: 'light',
        primary_color: '#000000',
      }),
    });
  });
});
