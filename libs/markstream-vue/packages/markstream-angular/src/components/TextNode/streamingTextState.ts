export interface ResolveStreamingTextStateOptions {
  nextContent: string
  previousContent: string
  typewriterEnabled: boolean
}

export interface StreamingTextStateResult {
  settledContent: string
  streamedDelta: string
  appended: boolean
}

export function resolveStreamingTextState({
  nextContent,
  previousContent,
  typewriterEnabled,
}: ResolveStreamingTextStateOptions): StreamingTextStateResult {
  if (!typewriterEnabled) {
    return {
      settledContent: nextContent,
      streamedDelta: '',
      appended: false,
    }
  }

  if (nextContent === previousContent) {
    return {
      settledContent: nextContent,
      streamedDelta: '',
      appended: false,
    }
  }

  if (previousContent && nextContent.startsWith(previousContent) && nextContent.length > previousContent.length) {
    return {
      settledContent: previousContent,
      streamedDelta: nextContent.slice(previousContent.length),
      appended: true,
    }
  }

  return {
    settledContent: nextContent,
    streamedDelta: '',
    appended: false,
  }
}
