import type { RefObject } from 'react'
import { useCallback, useEffect, useRef } from 'react'

const STICKY_BOTTOM_THRESHOLD_PX = 24

export function useChatAutoScroll(
  containerRef: RefObject<HTMLElement | null>,
  contentKey: string,
) {
  const frameRef = useRef<number | null>(null)
  const stickToBottomRef = useRef(true)

  const syncStickToBottom = useCallback(() => {
    const container = containerRef.current
    if (!container)
      return
    const distanceFromBottom = container.scrollHeight - container.clientHeight - container.scrollTop
    stickToBottomRef.current = distanceFromBottom <= STICKY_BOTTOM_THRESHOLD_PX
  }, [containerRef])

  const scheduleScrollToBottom = useCallback(() => {
    if (typeof window === 'undefined')
      return
    if (frameRef.current != null)
      return

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      const container = containerRef.current
      if (!container)
        return
      container.scrollTop = container.scrollHeight
      syncStickToBottom()
    })
  }, [containerRef, syncStickToBottom])

  useEffect(() => {
    const container = containerRef.current
    if (!container)
      return

    syncStickToBottom()

    const handleScroll = () => {
      syncStickToBottom()
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (stickToBottomRef.current)
          scheduleScrollToBottom()
      })
      resizeObserver.observe(container)
      const shell = container.querySelector('.chatbot-renderer-shell') as HTMLElement | null
      if (shell)
        resizeObserver.observe(shell)
    }

    if (stickToBottomRef.current)
      scheduleScrollToBottom()

    return () => {
      container.removeEventListener('scroll', handleScroll)
      resizeObserver?.disconnect()
    }
  }, [containerRef, scheduleScrollToBottom, syncStickToBottom])

  useEffect(() => {
    if (!stickToBottomRef.current)
      return
    scheduleScrollToBottom()
  }, [contentKey, scheduleScrollToBottom])

  useEffect(() => {
    return () => {
      if (frameRef.current != null)
        window.cancelAnimationFrame(frameRef.current)
    }
  }, [])
}
