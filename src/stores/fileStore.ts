import { create } from 'zustand';
import { invoke } from '@/lib/invoke';
import type { FileCategory, FileRow, FileSortKey, FilesPageEntry } from '@/types';

function normalizeFileRow(row: FileRow | FilesPageEntry): FileRow {
  if ('displayName' in row) {
    const previewUrl = row.previewUrl ?? undefined;
    return {
      id: row.id,
      name: row.displayName,
      path: row.path,
      storagePath: row.storagePath ?? undefined,
      size: row.sizeBytes,
      createdAt: row.createdAt,
      category: row.category,
      hasThumbnail: Boolean(previewUrl),
      previewUrl,
      missing: row.missing,
      sourceKind: row.sourceKind,
      workspaceId: row.workspaceId ?? null,
      workspaceName: row.workspaceName ?? null,
    };
  }

  return {
    ...row,
    hasThumbnail: row.hasThumbnail ?? Boolean(row.previewUrl),
  };
}

interface FileStoreState {
  rows: FileRow[];
  loading: boolean;
  error: string | null;
  search: string;
  sortKey: FileSortKey;
  workspaceFilter: string;

  loadCategory: (category: FileCategory) => Promise<void>;
  setSearch: (search: string) => void;
  setSortKey: (key: FileSortKey) => void;
  setWorkspaceFilter: (workspaceId: string) => void;
  getWorkspaceOptions: () => Array<{ value: string; label: string }>;
  getVisibleRows: () => FileRow[];
  clearError: () => void;
  openEntry: (path: string) => Promise<void>;
  revealEntry: (path: string) => Promise<void>;
  cleanupMissingEntry: (entryId: string) => Promise<void>;
}

export const useFileStore = create<FileStoreState>((set, get) => ({
  rows: [],
  loading: false,
  error: null,
  search: '',
  sortKey: 'createdAt',
  workspaceFilter: 'all',

  loadCategory: async (category: FileCategory) => {
    set({ loading: true, error: null });
    try {
      const { search, sortKey } = get();
      const args: Record<string, unknown> = { category, sort_key: sortKey };
      if (search) args.search = search;
      const rawRows = (await invoke<Array<FileRow | FilesPageEntry>>('list_files_page_entries', args)) ?? [];
      const rows = rawRows.map(normalizeFileRow);
      set({ rows, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setSearch: (search: string) => set({ search }),

  setSortKey: (key: FileSortKey) => set({ sortKey: key }),

  setWorkspaceFilter: (workspaceId: string) => set({ workspaceFilter: workspaceId }),

  getWorkspaceOptions: () => {
    const deduped = new Map<string, string>();
    for (const row of get().rows) {
      if (row.workspaceId && row.workspaceName) {
        deduped.set(row.workspaceId, row.workspaceName);
      }
    }
    return Array.from(deduped.entries()).map(([value, label]) => ({ value, label }));
  },

  getVisibleRows: () => {
    const { rows, workspaceFilter } = get();
    if (workspaceFilter === 'all') return rows;
    return rows.filter((row) => row.workspaceId === workspaceFilter);
  },

  clearError: () => set({ error: null }),

  openEntry: async (path: string) => {
    const row = get().rows.find((r) => r.path === path);
    if (!row || row.missing) return;
    try {
      await invoke('open_files_page_entry', { path });
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  revealEntry: async (path: string) => {
    const row = get().rows.find((r) => r.path === path);
    if (!row || row.missing) return;
    try {
      await invoke('reveal_files_page_entry', { path });
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  cleanupMissingEntry: async (entryId: string) => {
    const row = get().rows.find((r) => r.id === entryId);
    if (!row || !row.missing) return;
    try {
      await invoke('cleanup_missing_files_page_entry', { entryId });
      set({ rows: get().rows.filter((r) => r.id !== entryId) });
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },
}));
