import { create } from 'zustand';
import { invoke } from '@/lib/invoke';
import { useAgentStore } from './agentStore';
import type {
  AgentPermissionMode,
  AgentRun,
  CreateTaskFromCenterInput,
  CreateTaskFromCenterResult,
  TaskCenterDetail,
  TaskCenterItem,
} from '@/types/agent';

const WAITING_STATUSES = new Set(['waiting_approval', 'waiting_input', 'interrupted']);
const FAILED_STATUSES = new Set(['failed', 'cancelled']);

interface TaskCenterState {
  items: TaskCenterItem[];
  selectedRunId: string | null;
  detail: TaskCenterDetail | null;
  loading: boolean;
  detailLoading: boolean;
  creating: boolean;
  error: string | null;
  waitingCount: number;
  failedCount: number;
  fetchTasks: () => Promise<void>;
  selectRun: (runId: string | null) => Promise<void>;
  createTask: (input: CreateTaskFromCenterInput) => Promise<CreateTaskFromCenterResult>;
  cancelTask: (conversationId: string) => Promise<void>;
  resumeTask: (runId: string) => Promise<void>;
  rerunTask: (detail: TaskCenterDetail) => Promise<void>;
}

function summarizeCounts(items: TaskCenterItem[]) {
  return {
    waitingCount: items.filter((item) => WAITING_STATUSES.has(item.status)).length,
    failedCount: items.filter((item) => FAILED_STATUSES.has(item.status)).length,
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
  failedCount: 0,

  fetchTasks: async () => {
    set({ loading: true });
    try {
      const items = await invoke<TaskCenterItem[]>('list_agent_runs_global');
      set({ items, loading: false, error: null, ...summarizeCounts(items) });
      const selectedRunId = get().selectedRunId;
      if (!selectedRunId && items[0]) {
        void get().selectRun(items[0].runId);
      }
    } catch (e) {
      set({ error: String(e), loading: false });
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
