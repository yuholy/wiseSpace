import { describe, expect, it, vi } from 'vitest';
import type { ProviderDeepLinkPayload } from '@/lib/providerDeepLink';
import { confirmProviderDeepLinkImport } from '../useProviderDeepLink';

const payload: ProviderDeepLinkPayload = {
  name: 'Example AI',
  baseurl: 'https://api.example.com',
  apikey: 'sk-example',
  type: 'openai',
};

describe('confirmProviderDeepLinkImport', () => {
  it('opens provider settings and imports after user confirmation', async () => {
    const confirm = vi.fn();
    const importProvider = vi.fn().mockResolvedValue({
      provider_id: 'provider-1',
      provider_name: 'Example AI',
      created_provider: true,
      added_key: true,
      reused_key: false,
    });
    const fetchProviders = vi.fn().mockResolvedValue(undefined);
    const setSelectedProviderId = vi.fn();
    const messageSuccess = vi.fn();

    confirmProviderDeepLinkImport(payload, {
      modal: { confirm },
      message: { success: messageSuccess, error: vi.fn() },
      enterSettings: vi.fn(),
      setSettingsSection: vi.fn(),
      setSelectedProviderId,
      importProvider,
      fetchProviders,
      t: (key) => key,
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    const confirmOptions = confirm.mock.calls[0][0];
    await confirmOptions.onOk();

    expect(importProvider).toHaveBeenCalledWith(payload);
    expect(fetchProviders).toHaveBeenCalledTimes(1);
    expect(setSelectedProviderId).toHaveBeenCalledWith('provider-1');
    expect(messageSuccess).toHaveBeenCalledWith('settings.deepLinkProviderCreated');
  });

  it('reports reused key imports without adding duplicate keys', async () => {
    const confirm = vi.fn();
    const messageSuccess = vi.fn();

    confirmProviderDeepLinkImport(payload, {
      modal: { confirm },
      message: { success: messageSuccess, error: vi.fn() },
      enterSettings: vi.fn(),
      setSettingsSection: vi.fn(),
      setSelectedProviderId: vi.fn(),
      importProvider: vi.fn().mockResolvedValue({
        provider_id: 'provider-1',
        provider_name: 'Example AI',
        created_provider: false,
        added_key: false,
        reused_key: true,
      }),
      fetchProviders: vi.fn().mockResolvedValue(undefined),
      t: (key) => key,
    });

    await confirm.mock.calls[0][0].onOk();

    expect(messageSuccess).toHaveBeenCalledWith('settings.deepLinkProviderReusedKey');
  });
});
