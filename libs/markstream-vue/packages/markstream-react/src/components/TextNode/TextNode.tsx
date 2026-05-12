import type { NodeComponentProps } from '../../types/node-component'
import clsx from 'clsx'
import React, { useEffect, useRef, useState } from 'react'
import { resolveStreamingTextUpdate } from '../../utils/streamingTextState'

export function TextNode(props: NodeComponentProps<{ type: 'text', content: string, center?: boolean }>) {
  const { node, children, ctx, indexKey, typewriter } = props
  const content = String(node.content ?? '')
  const typewriterEnabled = typewriter ?? ctx?.typewriter ?? true
  const streamStateKey = indexKey == null || indexKey === ''
    ? ''
    : String(indexKey)
  const [settledContent, setSettledContent] = useState(content)
  const [streamedDelta, setStreamedDelta] = useState('')
  const [streamFadeVersion, setStreamFadeVersion] = useState(0)
  const lastStreamRenderVersionRef = useRef(ctx?.streamRenderVersion)
  const renderedContentRef = useRef({
    settledContent: content,
    streamedDelta: '',
  })

  const setRenderedContent = (nextSettledContent: string, nextStreamedDelta: string) => {
    renderedContentRef.current = {
      settledContent: nextSettledContent,
      streamedDelta: nextStreamedDelta,
    }
    setSettledContent(nextSettledContent)
    setStreamedDelta(nextStreamedDelta)
  }

  const getRenderedContent = () => {
    const { settledContent, streamedDelta } = renderedContentRef.current
    return settledContent + streamedDelta
  }

  useEffect(() => {
    const streamRenderVersion = ctx?.streamRenderVersion
    const streamRenderVersionChanged = streamRenderVersion !== lastStreamRenderVersionRef.current

    if (children != null) {
      setRenderedContent('', '')
      lastStreamRenderVersionRef.current = streamRenderVersion
      return
    }

    const textStreamState = ctx?.textStreamState
    const currentState = renderedContentRef.current
    const persistedContent = streamStateKey
      ? textStreamState?.get(streamStateKey)
      : undefined
    const nextState = resolveStreamingTextUpdate({
      nextContent: content,
      persistedContent,
      currentState,
      typewriterEnabled,
      streamRenderVersionChanged,
    })

    setRenderedContent(nextState.settledContent, nextState.streamedDelta)
    if (nextState.appended)
      setStreamFadeVersion(version => version + 1)
    if (streamStateKey)
      textStreamState?.set(streamStateKey, content)
    lastStreamRenderVersionRef.current = streamRenderVersion
  }, [children, content, ctx?.textStreamState, ctx?.streamRenderVersion, streamStateKey, typewriterEnabled])

  const handleStreamedDeltaAnimationEnd = () => {
    if (!renderedContentRef.current.streamedDelta)
      return
    setRenderedContent(getRenderedContent(), '')
  }

  if (children != null) {
    return (
      <span
        className={clsx(
          'text-node whitespace-pre-wrap break-words',
          node.center && 'text-node-center',
        )}
      >
        {children}
      </span>
    )
  }

  return (
    <span
      className={clsx(
        'text-node whitespace-pre-wrap break-words',
        node.center && 'text-node-center',
      )}
    >
      {settledContent ? <span>{settledContent}</span> : null}
      {streamedDelta
        ? (
            <span
              className={clsx(
                'text-node-stream-delta',
                streamFadeVersion % 2 === 0
                  ? 'text-node-stream-delta--a'
                  : 'text-node-stream-delta--b',
              )}
              onAnimationEnd={handleStreamedDeltaAnimationEnd}
            >
              {streamedDelta}
            </span>
          )
        : null}
    </span>
  )
}

export default TextNode
