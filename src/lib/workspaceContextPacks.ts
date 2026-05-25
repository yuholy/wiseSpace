import type { ConversationWorkspaceSnapshot } from '@/types';

const STORAGE_KEY = 'wisespace_workspace_context_packs';
const MAX_PACKS_PER_WORKSPACE = 12;

export interface WorkspaceContextPackSummary {
  searchEnabled: boolean;
  toolCount: number;
  knowledgeCount: number;
  memoryEnabled: boolean;
  researchMode: boolean;
}

export interface WorkspaceContextPack {
  id: string;
  workspaceKey: string;
  workspaceId?: string | null;
  conversationId?: string | null;
  workspaceName?: string | null;
  label: string;
  snapshot: ConversationWorkspaceSnapshot;
  summary: WorkspaceContextPackSummary;
  createdAt: number;
  updatedAt: number;
}

function safeReadStorage(): WorkspaceContextPack[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWriteStorage(packs: WorkspaceContextPack[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(packs));
}

export function resolveWorkspaceContextPackKey(
  workspaceId?: string | null,
  conversationId?: string | null,
): string | null {
  if (workspaceId?.trim()) {
    return `workspace:${workspaceId}`;
  }
  if (conversationId?.trim()) {
    return `conversation:${conversationId}`;
  }
  return null;
}

export function summarizeWorkspaceContextPack(
  snapshot: ConversationWorkspaceSnapshot,
): WorkspaceContextPackSummary {
  return {
    searchEnabled: snapshot.searchPolicy.enabled,
    toolCount: snapshot.toolBinding.serverIds.length,
    knowledgeCount: snapshot.knowledgeBinding.knowledgeBaseIds.length,
    memoryEnabled: snapshot.memoryPolicy.enabled,
    researchMode: snapshot.researchMode,
  };
}

export function listWorkspaceContextPacks(
  workspaceId?: string | null,
  conversationId?: string | null,
): WorkspaceContextPack[] {
  const workspaceKey = resolveWorkspaceContextPackKey(workspaceId, conversationId);
  if (!workspaceKey) {
    return [];
  }

  return safeReadStorage()
    .filter((pack) => pack.workspaceKey === workspaceKey)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function saveWorkspaceContextPack(input: {
  workspaceId?: string | null;
  conversationId?: string | null;
  workspaceName?: string | null;
  label: string;
  snapshot: ConversationWorkspaceSnapshot;
}): WorkspaceContextPack | null {
  const workspaceKey = resolveWorkspaceContextPackKey(input.workspaceId, input.conversationId);
  if (!workspaceKey) {
    return null;
  }

  const now = Date.now();
  const next: WorkspaceContextPack = {
    id: crypto.randomUUID(),
    workspaceKey,
    workspaceId: input.workspaceId ?? null,
    conversationId: input.conversationId ?? null,
    workspaceName: input.workspaceName ?? null,
    label: input.label.trim() || 'Saved workspace context',
    snapshot: input.snapshot,
    summary: summarizeWorkspaceContextPack(input.snapshot),
    createdAt: now,
    updatedAt: now,
  };

  const existing = safeReadStorage().filter((pack) => pack.workspaceKey !== workspaceKey);
  const workspacePacks = listWorkspaceContextPacks(input.workspaceId, input.conversationId)
    .slice(0, MAX_PACKS_PER_WORKSPACE - 1);
  safeWriteStorage([next, ...workspacePacks, ...existing]);
  return next;
}

export function deleteWorkspaceContextPack(id: string): void {
  const remaining = safeReadStorage().filter((pack) => pack.id !== id);
  safeWriteStorage(remaining);
}

export function describeWorkspaceContextPack(pack: WorkspaceContextPack): string {
  const tokens: string[] = [];
  if (pack.summary.searchEnabled) tokens.push('Search on');
  if (pack.summary.toolCount > 0) tokens.push(`${pack.summary.toolCount} tool server(s)`);
  if (pack.summary.knowledgeCount > 0) tokens.push(`${pack.summary.knowledgeCount} knowledge base(s)`);
  if (pack.summary.memoryEnabled) tokens.push('Memory on');
  if (pack.summary.researchMode) tokens.push('Research mode');
  return tokens.length > 0 ? tokens.join(' · ') : 'No extra context toggles';
}
