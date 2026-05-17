import { create } from 'zustand';
import { invoke } from '@/lib/invoke';
import { AGENT_WAITING_RUN_STATUSES, isAgentRunStatus } from '@/lib/agentRunStatus';
import { useAgentStore } from './agentStore';
import type {
  AgentPermissionMode,
  AgentRun,
  CreateTaskFromCenterInput,
  CreateTaskFromCenterResult,
  TaskCenterDetail,
  TaskCenterItem,
} from '@/types/agent';

interface TaskCenterState {
  items: TaskCenterItem[];
  selectedRunId: string | null;
  detail: TaskCenterDetail | null;
  loading: boolean;
  detailLoading: boolean;
  creating: boolean;
  error: string | null;
  waitingCount: number;
  interruptedCount: number;
  failedCount: number;
  fetchTasks: () => Promise<void>;
  refreshSelectedDetail: () => Promise<void>;
  selectRun: (runId: string | null) => Promise<void>;
  createTask: (input: CreateTaskFromCenterInput) => Promise<CreateTaskFromCenterResult>;
  cancelTask: (conversationId: string) => Promise<void>;
  deleteTask: (runId: string) => Promise<void>;
  resumeTask: (runId: string) => Promise<void>;
  rerunTask: (detail: TaskCenterDetail) => Promise<void>;
}

function summarizeCounts(items: TaskCenterItem[]) {
  return {
    waitingCount: items.filter((item) => isAgentRunStatus(item.status) && AGENT_WAITING_RUN_STATUSES.has(item.status)).length,
    interruptedCount: items.filter((item) => item.status === 'interrupted').length,
    failedCount: items.filter((item) => item.status === 'failed').length,
  };
}

export const useTaskCenterStore = create<TaskCenterState>((set, get) => ({
  items: [],
  selectedRunId: null,
  detail: null,
  loading: false,
  detailLoading: false,
  creating: false,
  error: null,
  waitingCount: 0,
  interruptedCount: 0,
  failedCount: 0,

  fetchTasks: async () => {
    set({ loading: true });
    try {
      const items = await invoke<TaskCenterItem[]>('list_agent_runs_global');
      const selectedRunId = get().selectedRunId;
      const hasSelected = selectedRunId ? items.some((item) => item.runId === selectedRunId) : false;
      const nextSelectedRunId = hasSelected ? selectedRunId : null;
      set({
        items,
        selectedRunId: nextSelectedRunId,
        detail: nextSelectedRunId ? get().detail : null,
        loading: false,
        detailLoading: false,
        error: null,
        ...summarizeCounts(items),
      });
      if (!selectedRunId && items[0]) {
        void get().selectRun(items[0].runId);
      } else if (selectedRunId && !hasSelected && items[0]) {
        void get().selectRun(items[0].runId);
      } else if (nextSelectedRunId) {
        void get().refreshSelectedDetail();
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  refreshSelectedDetail: async () => {
    const runId = get().selectedRunId;
    if (!runId) return;
    try {
      const detail = await invoke<TaskCenterDetail>('get_agent_run_detail', { runId });
      await useAgentStore.getState().refreshConversationState(detail.item.conversationId);
      set({ detail, detailLoading: false, error: null });
    } catch (e) {
      set({ error: String(e), detailLoading: false });
    }
  },

  selectRun: async (runId) => {
    set({ selectedRunId: runId, detail: null });
    if (!runId) return;
    set({ detailLoading: true });
    try {
      const detail = await invoke<TaskCenterDetail>('get_agent_run_detail', { runId });
      await useAgentStore.getState().refreshConversationState(detail.item.conversationId);
      set({ detail, detailLoading: false, error: null });
    } catch (e) {
      set({ error: String(e), detailLoading: false });
    }
  },

  createTask: async (input) => {
    set({ creating: true });
    try {
      const result = await invoke<CreateTaskFromCenterResult>('create_agent_task_from_center', { input });
      set({ creating: false, error: null });
      await get().fetchTasks();
      if (result.run) {
        const run = result.run as AgentRun & { id?: string };
        await get().selectRun(run.id);
      }
      return result;
    } catch (e) {
      set({ creating: false, error: String(e) });
      throw e;
    }
  },

  cancelTask: async (conversationId) => {
    await useAgentStore.getState().cancelRun(conversationId);
    await get().fetchTasks();
  },

  deleteTask: async (runId) => {
    await invoke('delete_agent_run_task', { runId });
    const { items, selectedRunId } = get();
    const remainingItems = items.filter((item) => item.runId !== runId);
    const nextSelectedRunId = selectedRunId === runId ? remainingItems[0]?.runId ?? null : selectedRunId;
    set({
      items: remainingItems,
      selectedRunId: nextSelectedRunId,
      detail: selectedRunId === runId ? null : get().detail,
      ...summarizeCounts(remainingItems),
    });
    await get().fetchTasks();
    if (nextSelectedRunId) {
      await get().selectRun(nextSelectedRunId);
    }
  },

  resumeTask: async (runId) => {
    await useAgentStore.getState().resumeRun(runId);
    await get().fetchTasks();
    await get().selectRun(runId);
  },

  rerunTask: async (detail) => {
    const rawRun = detail.run as AgentRun & { prompt_snapshot?: string };
    const item = detail.item;
    await invoke('agent_start_run', {
      input: {
        conversationId: item.conversationId,
        prompt: rawRun.promptSnapshot ?? rawRun.prompt_snapshot ?? item.promptPreview,
        runnerKind: 'sdk',
        providerId: item.providerId,
        modelId: item.modelId,
        cwd: item.workspaceRoot || undefined,
        permissionMode: undefined as AgentPermissionMode | undefined,
      },
    });
    await get().fetchTasks();
  },
}));
