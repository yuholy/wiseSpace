import { create } from 'zustand';
import { invoke } from '@/lib/invoke';
import type { ExtensionDetail, ExtensionSummary } from '@/types';

interface ExtensionConnectionCheck {
  ok: boolean;
  message?: string | null;
  status?: number | null;
  checkedAt: number;
}

interface ExtensionStoreState {
  extensions: ExtensionSummary[];
  detailsById: Record<string, ExtensionDetail>;
  connectionChecksById: Record<string, ExtensionConnectionCheck>;
  testingById: Record<string, boolean>;
  togglingById: Record<string, boolean>;
  refreshingById: Record<string, boolean>;
  loading: boolean;
  error: string | null;
  loadExtensions: () => Promise<void>;
  loadExtensionDetail: (id: string) => Promise<ExtensionDetail>;
  refreshExtensionRuntime: (id: string) => Promise<ExtensionDetail>;
  testExtensionConnection: (extension: Pick<ExtensionSummary, 'id' | 'kind'>) => Promise<ExtensionConnectionCheck>;
  setExtensionEnabled: (id: string, enabled: boolean) => Promise<ExtensionSummary>;
  clearError: () => void;
}

function extensionLocalId(id: string): string {
  const [, localId] = id.split('::');
  return localId ?? id;
}

export const useExtensionStore = create<ExtensionStoreState>((set) => ({
  extensions: [],
  detailsById: {},
  connectionChecksById: {},
  testingById: {},
  togglingById: {},
  refreshingById: {},
  loading: false,
  error: null,

  loadExtensions: async () => {
    set({ loading: true, error: null });
    try {
      const extensions = await invoke<ExtensionSummary[]>('list_extensions');
      set({ extensions, loading: false, error: null });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  loadExtensionDetail: async (id) => {
    const detail = await invoke<ExtensionDetail>('get_extension_detail', { id });
    set((state) => ({
      detailsById: {
        ...state.detailsById,
        [id]: detail,
      },
      error: null,
    }));
    return detail;
  },

  refreshExtensionRuntime: async (id) => {
    set((state) => ({
      refreshingById: {
        ...state.refreshingById,
        [id]: true,
      },
    }));

    try {
      const [extensions, detail] = await Promise.all([
        invoke<ExtensionSummary[]>('list_extensions'),
        invoke<ExtensionDetail>('get_extension_detail', { id }),
      ]);
      set((state) => ({
        extensions,
        detailsById: {
          ...state.detailsById,
          [id]: detail,
        },
        error: null,
      }));
      return detail;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    } finally {
      set((state) => ({
        refreshingById: {
          ...state.refreshingById,
          [id]: false,
        },
      }));
    }
  },

  testExtensionConnection: async (extension) => {
    set((state) => ({
      testingById: {
        ...state.testingById,
        [extension.id]: true,
      },
    }));

    try {
      const localId = extensionLocalId(extension.id);
      let result: ExtensionConnectionCheck;

      if (extension.kind === 'mcp_server') {
        const response = await invoke<{ ok: boolean; error?: string }>('test_mcp_server', { id: localId });
        result = {
          ok: response.ok,
          message: response.ok ? 'Connection test succeeded.' : (response.error ?? 'Connection test failed.'),
          checkedAt: Date.now(),
        };
      } else if (extension.kind === 'external_agent') {
        const response = await invoke<{ ok: boolean; status?: number | null; message?: string | null }>(
          'test_external_agent_connection',
          { id: localId },
        );
        result = {
          ok: response.ok,
          message: response.message ?? (response.ok ? 'Connection test succeeded.' : 'Connection test failed.'),
          status: response.status ?? null,
          checkedAt: Date.now(),
        };
      } else {
        result = {
          ok: false,
          message: 'Connection test is not supported for this extension.',
          checkedAt: Date.now(),
        };
      }

      set((state) => ({
        connectionChecksById: {
          ...state.connectionChecksById,
          [extension.id]: result,
        },
        error: null,
      }));
      return result;
    } catch (e) {
      const failure = {
        ok: false,
        message: String(e),
        checkedAt: Date.now(),
      };
      set((state) => ({
        connectionChecksById: {
          ...state.connectionChecksById,
          [extension.id]: failure,
        },
        error: String(e),
      }));
      return failure;
    } finally {
      set((state) => ({
        testingById: {
          ...state.testingById,
          [extension.id]: false,
        },
      }));
    }
  },

  setExtensionEnabled: async (id, enabled) => {
    set((state) => ({
      togglingById: {
        ...state.togglingById,
        [id]: true,
      },
      extensions: state.extensions.map((extension) =>
        extension.id === id ? { ...extension, enabled } : extension,
      ),
      detailsById: state.detailsById[id]
        ? {
            ...state.detailsById,
            [id]: {
              ...state.detailsById[id],
              enabled,
            },
          }
        : state.detailsById,
    }));

    try {
      const updated = await invoke<ExtensionSummary>('set_extension_enabled', { id, enabled });
      set((state) => ({
        extensions: state.extensions.map((extension) => (extension.id === id ? updated : extension)),
        detailsById: state.detailsById[id]
          ? {
              ...state.detailsById,
              [id]: {
                ...state.detailsById[id],
                ...updated,
              },
            }
          : state.detailsById,
        error: null,
      }));
      return updated;
    } catch (e) {
      set((state) => ({
        extensions: state.extensions.map((extension) =>
          extension.id === id ? { ...extension, enabled: !enabled } : extension,
        ),
        detailsById: state.detailsById[id]
          ? {
              ...state.detailsById,
              [id]: {
                ...state.detailsById[id],
                enabled: !enabled,
              },
            }
          : state.detailsById,
        error: String(e),
      }));
      throw e;
    } finally {
      set((state) => ({
        togglingById: {
          ...state.togglingById,
          [id]: false,
        },
      }));
    }
  },

  clearError: () => set({ error: null }),
}));
