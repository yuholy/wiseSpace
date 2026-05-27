import { create } from 'zustand';
import { invoke } from '@/lib/invoke';
import type {
  AgentTask,
  AgentTaskEvent,
  BuiltinSubagentAssignee,
  CreateDelegatedSubagentTaskInput,
  DispatchExternalAgentTaskResult,
} from '@/types';

interface SubagentState {
  tasks: AgentTask[];
  loading: boolean;
  error: string | null;
  listBuiltinSubagentAssignees: () => Promise<BuiltinSubagentAssignee[]>;
  createDelegatedSubagentTask: (input: CreateDelegatedSubagentTaskInput) => Promise<AgentTask>;
  runDelegatedSubagentTask: (taskId: string) => Promise<DispatchExternalAgentTaskResult>;
  loadTasks: (filters?: {
    conversationId?: string;
    parentRunId?: string;
    parentTaskId?: string;
    externalAgentId?: string;
    limit?: number;
  }) => Promise<void>;
  listTaskEvents: (taskId: string) => Promise<AgentTaskEvent[]>;
}

export const useSubagentStore = create<SubagentState>((set) => ({
  tasks: [],
  loading: false,
  error: null,

  listBuiltinSubagentAssignees: async () => {
    return invoke<BuiltinSubagentAssignee[]>('list_builtin_subagent_assignees');
  },

  createDelegatedSubagentTask: async (input) => {
    const task = await invoke<AgentTask>('create_delegated_subagent_task', { input });
    set((state) => ({ tasks: [task, ...state.tasks], error: null }));
    return task;
  },

  runDelegatedSubagentTask: async (taskId) => {
    const result = await invoke<DispatchExternalAgentTaskResult>('run_delegated_subagent_task', {
      taskId,
    });
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === taskId ? result.task : task)),
      error: null,
    }));
    return result;
  },

  loadTasks: async (filters) => {
    const tasks = await invoke<AgentTask[]>('list_agent_tasks', {
      conversationId: filters?.conversationId,
      parentRunId: filters?.parentRunId,
      parentTaskId: filters?.parentTaskId,
      externalAgentId: filters?.externalAgentId,
      limit: filters?.limit,
    });
    set({ tasks, error: null });
  },

  listTaskEvents: async (taskId) => {
    return invoke<AgentTaskEvent[]>('list_agent_task_events', { taskId });
  },
}));
