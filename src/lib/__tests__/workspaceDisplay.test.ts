import { describe, expect, it } from 'vitest';

import {
  getReadableWorkspaceLabel,
  looksLikeGeneratedWorkspaceName,
} from '../workspaceDisplay';

describe('workspaceDisplay', () => {
  it('detects generated conversation workspace names', () => {
    expect(looksLikeGeneratedWorkspaceName('conv_abc123')).toBe(true);
    expect(looksLikeGeneratedWorkspaceName('conversation-xyz')).toBe(true);
    expect(looksLikeGeneratedWorkspaceName('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  it('does not treat normal folder names as generated workspace names', () => {
    expect(looksLikeGeneratedWorkspaceName('my-project')).toBe(false);
    expect(looksLikeGeneratedWorkspaceName('项目排期讨论')).toBe(false);
  });

  it('prefers conversation title when workspace path is auto-generated', () => {
    expect(
      getReadableWorkspaceLabel(
        'C:/Users/test/Documents/wisespace/workspace/conv_abc123',
        '项目排期讨论',
      ),
    ).toBe('项目排期讨论');
  });

  it('keeps folder name when workspace path is user-selected', () => {
    expect(
      getReadableWorkspaceLabel(
        'C:/Users/test/code/my-project',
        '项目排期讨论',
      ),
    ).toBe('my-project');
  });
});
