import { describe, expect, it } from 'vitest';
import { buildProactiveTaskSuggestions } from '../proactiveTaskSuggestions';

describe('proactiveTaskSuggestions', () => {
  it('suggests resuming an interrupted resumable run', () => {
    const suggestions = buildProactiveTaskSuggestions({
      currentMode: 'agent',
      latestRun: {
        id: 'run-1',
        conversationId: 'conv-1',
        profileId: 'profile-1',
        runnerKind: 'local',
        status: 'interrupted',
        promptSnapshot: '',
        startedAt: '',
        costUsd: 0,
        resumeCapability: 'resumable',
      },
    });

    expect(suggestions.some((suggestion) => suggestion.action === 'resume_run')).toBe(true);
  });

  it('suggests a research subtask for research-like prompts', () => {
    const suggestions = buildProactiveTaskSuggestions({
      currentMode: 'agent',
      latestUserText: 'Please research the deployment options for this service.',
      existingTaskTypes: [],
    });

    expect(suggestions.some((suggestion) => suggestion.action === 'create_research_subtask')).toBe(true);
  });

  it('does not suggest delegated tasks in chat mode', () => {
    const suggestions = buildProactiveTaskSuggestions({
      currentMode: 'chat',
      latestUserText: 'Please review this patch.',
    });

    expect(suggestions).toHaveLength(0);
  });
});
