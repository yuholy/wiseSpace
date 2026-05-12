import type { NodeComponentProps } from '../../types/node-component'
import clsx from 'clsx'
import React, { useEffect, useRef, useState } from 'react'
import { resolveStreamingTextUpdate } from '../../utils/streamingTextState'

export function InlineCodeNode(props: NodeComponentProps<{ type: 'inline_code', code: string }>) {
  const { node, children, ctx, indexKey, typewriter } = props
  const content = String(node.code ?? '')
  const typewriterEnabled = typewriter ?? ctx?.typewriter ?? true
  const streamStateKey = indexKey == null || indexKey === ''
    ? ''
    : String(indexKey)
  const [settledContent, setSettledContent] = useState(content)
  const [streamedDelta, setStreamedDelta] = useState('')
  const [streamFadeVersion, setStreamFadeVersion] = useState(0)
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
    if (children != null) {
      setRenderedContent('', '')
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
    })

    setRenderedContent(nextState.settledContent, nextState.streamedDelta)
    if (nextState.appended)
      setStreamFadeVersion(version => version + 1)
    if (streamStateKey)
      textStreamState?.set(streamStateKey, content)
  }, [children, content, ctx?.textStreamState, streamStateKey, typewriterEnabled])

  const handleStreamedDeltaAnimationEnd = () => {
    if (!renderedContentRef.current.streamedDelta)
      return
    setRenderedContent(getRenderedContent(), '')
  }

  return (
    <code className="inline-code inline text-[85%] px-1 py-0.5 rounded font-mono bg-[hsl(var(--secondary))] whitespace-normal break-words max-w-full">
      {children || (
        <>
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
        </>
      )}
    </code>
  )
}

export default InlineCodeNode
