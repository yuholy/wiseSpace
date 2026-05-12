import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveImageBlob } from '../chatImageActions';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/invoke', () => ({
  isTauri: () => true,
  invoke: (cmd: string, args?: Record<string, unknown>) => invokeMock(cmd, args),
}));

describe('chat image actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('frontend fetch should not be used'))));
  });

  it('loads remote images through the Tauri backend to avoid WebView CORS failures', async () => {
    invokeMock.mockResolvedValueOnce({
      data: 'aGVsbG8=',
      mimeType: 'image/png',
    });

    const blob = await resolveImageBlob('https://example.com/generated.png');

    expect(invokeMock).toHaveBeenCalledWith('fetch_remote_image', {
      url: 'https://example.com/generated.png',
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(blob.type).toBe('image/png');
    await expect(blob.text()).resolves.toBe('hello');
  });
});
