function getLastPathSegment(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : path;
}

export function looksLikeGeneratedWorkspaceName(segment: string): boolean {
  const value = segment.trim();
  if (!value) return false;

  if (/^(conv|conversation|chat)[-_][a-z0-9_-]+$/i.test(value)) {
    return true;
  }

  if (/^[0-9a-f]{8,}$/i.test(value)) {
    return true;
  }

  if (/^[0-9a-f]{8}-[0-9a-f-]{9,}$/i.test(value)) {
    return true;
  }

  if (/^workspace-\d{14}(?:-\d+)?$/i.test(value)) {
    return true;
  }

  return false;
}

export function getReadableWorkspaceLabel(
  workspacePath: string | null | undefined,
  conversationTitle: string | null | undefined,
): string {
  const title = conversationTitle?.trim();
  if (!workspacePath) {
    return title || '选择工作空间';
  }

  const segment = getLastPathSegment(workspacePath);
  if (looksLikeGeneratedWorkspaceName(segment) && title) {
    return title;
  }

  return segment;
}
