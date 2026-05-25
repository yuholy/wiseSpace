import type { AgentRun } from '@/types/agent';

export type ProactiveTaskSuggestionAction =
  | 'resume_run'
  | 'create_review_subtask'
  | 'create_research_subtask';

export interface ProactiveTaskSuggestion {
  key: string;
  action: ProactiveTaskSuggestionAction;
  title: string;
  description: string;
  taskType?: 'review' | 'research';
  presetKey?: string;
}

interface BuildProactiveTaskSuggestionsInput {
  currentMode: 'chat' | 'agent';
  latestRun?: AgentRun | null;
  latestUserText?: string | null;
  existingTaskTypes?: string[];
}

function normalizedText(text?: string | null): string {
  return (text ?? '').trim().toLowerCase();
}

function looksLikeReviewIntent(text: string): boolean {
  const hints = [
    'review',
    'code review',
    'review this',
    '审查',
    '复核',
    '评审',
    '风险',
    '回归',
    '帮我看看',
  ];
  return hints.some((hint) => text.includes(hint));
}

function looksLikeResearchIntent(text: string): boolean {
  const hints = [
    'research',
    'investigate',
    'compare',
    'summarize sources',
    '调研',
    '查一下',
    '搜集',
    '对比',
    '分析资料',
  ];
  return hints.some((hint) => text.includes(hint));
}

export function buildProactiveTaskSuggestions(
  input: BuildProactiveTaskSuggestionsInput,
): ProactiveTaskSuggestion[] {
  if (input.currentMode !== 'agent') {
    return [];
  }

  const suggestions: ProactiveTaskSuggestion[] = [];
  const latestRun = input.latestRun;
  const existingTaskTypes = new Set(input.existingTaskTypes ?? []);
  const lastUserText = normalizedText(input.latestUserText);

  if (
    latestRun?.status === 'interrupted'
    && latestRun.resumeCapability === 'resumable'
  ) {
    suggestions.push({
      key: 'resume_run',
      action: 'resume_run',
      title: 'Resume interrupted run',
      description: 'The latest run can continue from the existing execution context.',
    });
  }

  if (lastUserText && !existingTaskTypes.has('review') && looksLikeReviewIntent(lastUserText)) {
    suggestions.push({
      key: 'review',
      action: 'create_review_subtask',
      title: 'Delegate a review subtask',
      description: 'Spin up a focused review subtask to double-check risks, regressions, and missing tests.',
      taskType: 'review',
      presetKey: 'code-reviewer',
    });
  }

  if (lastUserText && !existingTaskTypes.has('research') && looksLikeResearchIntent(lastUserText)) {
    suggestions.push({
      key: 'research',
      action: 'create_research_subtask',
      title: 'Delegate a research subtask',
      description: 'Ask a focused research subtask to gather evidence, comparisons, and open questions.',
      taskType: 'research',
      presetKey: 'researcher',
    });
  }

  return suggestions;
}
