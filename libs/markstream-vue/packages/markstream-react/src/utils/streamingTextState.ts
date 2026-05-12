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

export interface StreamingRenderState {
  settledContent: string
  streamedDelta: string
}

export interface ResolveStreamingTextUpdateOptions {
  nextContent: string
  persistedContent?: string
  currentState: StreamingRenderState
  typewriterEnabled: boolean
  streamRenderVersionChanged?: boolean
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

export function resolveStreamingTextUpdate({
  nextContent,
  persistedContent,
  currentState,
  typewriterEnabled,
  streamRenderVersionChanged = false,
}: ResolveStreamingTextUpdateOptions): StreamingTextStateResult {
  const renderedContent = `${currentState.settledContent}${currentState.streamedDelta}`

  if (!typewriterEnabled) {
    return {
      settledContent: nextContent,
      streamedDelta: '',
      appended: false,
    }
  }

  // React StrictMode may replay effects with the same props while the delta
  // animation is still active. Preserve the current delta instead of settling
  // it immediately so the fade remains visible in dev and playgrounds.
  if (currentState.streamedDelta && renderedContent === nextContent) {
    if (streamRenderVersionChanged) {
      return {
        settledContent: renderedContent,
        streamedDelta: '',
        appended: false,
      }
    }
    return {
      settledContent: currentState.settledContent,
      streamedDelta: currentState.streamedDelta,
      appended: false,
    }
  }

  return resolveStreamingTextState({
    nextContent,
    previousContent: persistedContent ?? renderedContent,
    typewriterEnabled,
  })
}
