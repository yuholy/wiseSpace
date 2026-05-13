import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PageKey, SettingsSection } from '@/types';

interface UIState {
  activePage: PageKey;
  previousPage: PageKey;
  sidebarCollapsed: boolean;
  chatTaskCenterGroupCollapsed: boolean;
  settingsSection: SettingsSection;
  selectedProviderId: string | null;
  setActivePage: (page: PageKey) => void;
  enterSettings: () => void;
  exitSettings: () => void;
  toggleSidebar: () => void;
  setChatTaskCenterGroupCollapsed: (collapsed: boolean) => void;
  setSettingsSection: (section: SettingsSection) => void;
  setSelectedProviderId: (id: string | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      activePage: 'chat',
      previousPage: 'chat',
      sidebarCollapsed: false,
      chatTaskCenterGroupCollapsed: false,
      settingsSection: 'general',
      selectedProviderId: null,
      setActivePage: (page) => set({ activePage: page }),
      enterSettings: () => {
        const current = get().activePage;
        if (current !== 'settings') {
          set({ previousPage: current, activePage: 'settings' });
        }
      },
      exitSettings: () => {
        const prev = get().previousPage;
        set({ activePage: prev });
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setChatTaskCenterGroupCollapsed: (collapsed) => set({ chatTaskCenterGroupCollapsed: collapsed }),
      setSettingsSection: (section) => set({ settingsSection: section }),
      setSelectedProviderId: (id) => set({ selectedProviderId: id }),
    }),
    {
      name: 'wisespace_ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        chatTaskCenterGroupCollapsed: state.chatTaskCenterGroupCollapsed,
      }),
    },
  ),
);
