import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_VISIBLE_ROLE_IDS, MAX_VISIBLE_ROLE_COUNT, ROLE_PRESETS } from '@/lib/rolePresets';

const ROLE_ID_SET = new Set(ROLE_PRESETS.map((preset) => preset.id));

function sanitizeVisibleRoleIds(roleIds: string[] | null | undefined): string[] {
  const filtered = (roleIds ?? []).filter((roleId, index, array) => (
    ROLE_ID_SET.has(roleId) && array.indexOf(roleId) === index
  ));

  if (filtered.length === 0) {
    return [...DEFAULT_VISIBLE_ROLE_IDS];
  }

  return filtered.slice(0, MAX_VISIBLE_ROLE_COUNT);
}

interface RolePresetState {
  visibleRoleIds: string[];
  setVisibleRoleIds: (roleIds: string[]) => void;
  toggleVisibleRole: (roleId: string) => boolean;
  resetVisibleRoles: () => void;
}

export const useRolePresetStore = create<RolePresetState>()(
  persist(
    (set, get) => ({
      visibleRoleIds: [...DEFAULT_VISIBLE_ROLE_IDS],
      setVisibleRoleIds: (roleIds) => set({ visibleRoleIds: sanitizeVisibleRoleIds(roleIds) }),
      toggleVisibleRole: (roleId) => {
        const current = get().visibleRoleIds;
        if (current.includes(roleId)) {
          set({ visibleRoleIds: current.filter((id) => id !== roleId) });
          return true;
        }
        if (current.length >= MAX_VISIBLE_ROLE_COUNT) {
          return false;
        }
        set({ visibleRoleIds: [...current, roleId] });
        return true;
      },
      resetVisibleRoles: () => set({ visibleRoleIds: [...DEFAULT_VISIBLE_ROLE_IDS] }),
    }),
    {
      name: 'wisespace_role_presets',
      partialize: (state) => ({
        visibleRoleIds: sanitizeVisibleRoleIds(state.visibleRoleIds),
      }),
    },
  ),
);
