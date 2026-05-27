// ── Subagent / AgentTask types ─────────────────────────────────────
// These types describe the subagent delegation task model.
// They were previously part of the external agent system but now
// serve only the internal subagent delegation flow.

export interface AgentTask {
  id: string;
  conversationId?: string | null;
  workspaceId?: string | null;
  parentRunId?: string | null;
  parentTaskId?: string | null;
  sourceMessageId?: string | null;
  externalAgentId: string;
  externalTaskId?: string | null;
  assigneeKind: string;
  assigneeLabel?: string | null;
  delegationDepth: number;
  kind: string;
  taskType: string;
  presetKey?: string | null;
  delegationReason?: string | null;
  inputText?: string | null;
  status: string;
  title: string;
  requestPayloadJson: string;
  resultPayloadJson?: string | null;
  errorMessage?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AgentTaskEvent {
  id: string;
  taskId: string;
  eventType: string;
  payloadJson: string;
  createdAt: number;
}

export interface BuiltinSubagentAssignee {
  key: string;
  name: string;
  description: string;
  promptHint: string;
  defaultTaskKind: string;
}

export interface CreateDelegatedSubagentTaskInput {
  conversationId?: string | null;
  parentRunId: string;
  parentTaskId?: string | null;
  sourceMessageId?: string | null;
  taskType: string;
  presetKey?: string | null;
  delegationReason?: string | null;
  title: string;
  inputText: string;
  contextJson?: string | null;
}

export interface DispatchExternalAgentTaskResult {
  task: AgentTask;
  assistantMessage?: import('./index').Message | null;
}
