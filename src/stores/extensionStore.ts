import { create } from 'zustand';
import { invoke } from '@/lib/invoke';
import type { ExtensionSummary } from '@/types';

interface ExtensionStoreState {
  extensions: ExtensionSummary[];
  loading: boolean;
  error: string | null;
  loadExtensions: () => Promise<void>;
  clearError: () => void;
}

export const useExtensionStore = create<ExtensionStoreState>((set) => ({
  extensions: [],
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

  clearError: () => set({ error: null }),
}));
