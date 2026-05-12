import type { Ref } from 'vue-demi'
import { inject, provide, ref } from 'vue-demi'

// Injection key for viewport-priority registration
const ViewportPriorityKey = Symbol('ViewportPriority') as unknown as InjectionKey<RegisterFn>

export interface VisibilityHandle {
  isVisible: Ref<boolean>
  whenVisible: Promise<void>
  destroy: () => void
}

export type RegisterFn = (el: HTMLElement, opts?: { rootMargin?: string, threshold?: number }) => VisibilityHandle

type InjectionKey<T> = symbol & { __type?: T }
interface IdleDeadlineLike {
  didTimeout: boolean
  timeRemaining: () => number
}

/**
 * Provide a shared viewport-priority registrar.
 * Targets resolve immediately when they enter the viewport and otherwise
 * trickle through during browser idle so heavy nodes can prerender offscreen.
 */
export function provideViewportPriority(
  getRootEl: (target?: HTMLElement | null) => HTMLElement | null | undefined,
  enabled: Ref<boolean> | boolean,
): RegisterFn {
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'
  const enabledRef = typeof enabled === 'boolean' ? ref(enabled) : enabled
  const requestIdle = isBrowser
    ? ((window as any).requestIdleCallback as ((cb: (deadline: IdleDeadlineLike) => void, opts?: { timeout?: number }) => number) | undefined)
    ?? ((cb: (deadline: IdleDeadlineLike) => void) => window.setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 16))
    : null
  const cancelIdle = isBrowser
    ? ((window as any).cancelIdleCallback as ((id: number) => void) | undefined)
    ?? ((id: number) => window.clearTimeout(id))
    : null

  interface ObserverConfig {
    root: HTMLElement | null
    rootMargin: string
    threshold: number
  }

  // Lazily created IO bound to the provided root element
  let io: IntersectionObserver | null = null
  let currentConfig: ObserverConfig | null = null
  const targets = new Map<Element, { resolve: () => void, visible: Ref<boolean> }>()
  const idleQueue = new Set<Element>()
  let idleJob: number | null = null

  function normalizeConfig(target?: HTMLElement, opts?: { rootMargin?: string, threshold?: number }): ObserverConfig {
    return {
      root: getRootEl?.(target ?? null) ?? null,
      rootMargin: opts?.rootMargin ?? '300px',
      threshold: opts?.threshold ?? 0,
    }
  }

  function sameConfig(a: ObserverConfig | null, b: ObserverConfig) {
    return !!a
      && a.root === b.root
      && a.rootMargin === b.rootMargin
      && a.threshold === b.threshold
  }

  function clearIdleJob() {
    if (idleJob == null)
      return
    try {
      cancelIdle?.(idleJob)
    }
    catch {}
    idleJob = null
  }

  function cleanupObserver() {
    if (targets.size)
      return
    try {
      io?.disconnect()
    }
    catch {}
    io = null
    currentConfig = null
    if (!idleQueue.size)
      clearIdleJob()
  }

  function settleTarget(target: Element) {
    const data = targets.get(target)
    if (!data)
      return
    if (!data.visible.value) {
      data.visible.value = true
      try {
        data.resolve()
      }
      catch {}
    }
    try {
      io?.unobserve(target)
    }
    catch {}
    targets.delete(target)
    idleQueue.delete(target)
    cleanupObserver()
  }

  function scheduleIdleDrain() {
    if (!requestIdle || idleJob != null || !idleQueue.size)
      return
    idleJob = requestIdle(() => {
      idleJob = null
      const next = idleQueue.values().next().value as Element | undefined
      if (!next)
        return
      idleQueue.delete(next)
      settleTarget(next)
      if (idleQueue.size)
        scheduleIdleDrain()
    }, { timeout: 1200 })
  }

  function ensureObserver(target?: HTMLElement, opts?: { rootMargin?: string, threshold?: number }) {
    if (!isBrowser)
      return io
    // Guard: some browser-like environments (e.g., jsdom) don't provide IO
    if (typeof IntersectionObserver === 'undefined')
      return null

    const nextConfig = normalizeConfig(target, opts)
    if (io && sameConfig(currentConfig, nextConfig))
      return io

    if (io) {
      try {
        io.disconnect()
      }
      catch {}
    }

    io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const isVisible = entry.isIntersecting || entry.intersectionRatio > 0
        if (isVisible)
          settleTarget(entry.target)
      }
    }, {
      root: nextConfig.root,
      rootMargin: nextConfig.rootMargin, // prefetch slightly before entering viewport
      threshold: nextConfig.threshold,
    })

    currentConfig = nextConfig
    for (const el of targets.keys())
      io.observe(el)

    return io
  }

  const register: RegisterFn = (el, opts) => {
    const visible = ref(false)
    let settled = false
    let resolve!: () => void
    const whenVisible = new Promise<void>((res) => {
      resolve = () => {
        if (!settled) {
          settled = true
          res()
        }
      }
    })

    const cleanup = () => {
      try {
        io?.unobserve(el)
      }
      catch {}
      targets.delete(el)
      idleQueue.delete(el)
      cleanupObserver()
    }

    if (!isBrowser || !enabledRef.value) {
      visible.value = true
      resolve()
      return { isVisible: visible, whenVisible, destroy: cleanup }
    }

    const obs = ensureObserver(el, opts)
    if (!obs) {
      visible.value = true
      resolve()
      return { isVisible: visible, whenVisible, destroy: cleanup }
    }

    targets.set(el, { resolve, visible })
    obs.observe(el)
    idleQueue.add(el)
    scheduleIdleDrain()
    return { isVisible: visible, whenVisible, destroy: cleanup }
  }

  provide(ViewportPriorityKey, register)
  return register
}

/**
 * Child components call this to register an element and await priority.
 * If provider is missing, returns a no-op registrar that resolves immediately.
 */
export function useViewportPriority() {
  const injected = inject<RegisterFn | undefined>(ViewportPriorityKey, undefined)
  if (injected)
    return injected

  const localTargets = new WeakMap<Element, { resolve: () => void, visible: Ref<boolean> }>()
  let localIo: IntersectionObserver | null = null
  const localIdleQueue = new Set<Element>()
  let localIdleJob: number | null = null
  const requestIdle = typeof window !== 'undefined'
    ? ((window as any).requestIdleCallback as ((cb: (deadline: IdleDeadlineLike) => void, opts?: { timeout?: number }) => number) | undefined)
    ?? ((cb: (deadline: IdleDeadlineLike) => void) => window.setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 16))
    : null
  const cancelIdle = typeof window !== 'undefined'
    ? ((window as any).cancelIdleCallback as ((id: number) => void) | undefined)
    ?? ((id: number) => window.clearTimeout(id))
    : null

  const clearLocalIdleJob = () => {
    if (localIdleJob == null)
      return
    try {
      cancelIdle?.(localIdleJob)
    }
    catch {}
    localIdleJob = null
  }

  const settleLocalTarget = (target: Element) => {
    const data = localTargets.get(target)
    if (!data)
      return
    if (!data.visible.value) {
      data.visible.value = true
      try {
        data.resolve()
      }
      catch {}
    }
    try {
      localIo?.unobserve(target)
    }
    catch {}
    localTargets.delete(target)
    localIdleQueue.delete(target)
    if (!localIdleQueue.size)
      clearLocalIdleJob()
  }

  const scheduleLocalIdleDrain = () => {
    if (!requestIdle || localIdleJob != null || !localIdleQueue.size)
      return
    localIdleJob = requestIdle(() => {
      localIdleJob = null
      const next = localIdleQueue.values().next().value as Element | undefined
      if (!next)
        return
      localIdleQueue.delete(next)
      settleLocalTarget(next)
      if (localIdleQueue.size)
        scheduleLocalIdleDrain()
    }, { timeout: 1200 })
  }

  const ensureLocal = () => {
    if (localIo)
      return localIo
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined')
      return null
    localIo = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const vis = e.isIntersecting || e.intersectionRatio > 0
        if (vis)
          settleLocalTarget(e.target)
      }
    }, { root: null, rootMargin: '300px', threshold: 0 })
    return localIo
  }

  const register: RegisterFn = (el) => {
    const isVisible = ref(false)
    let settled = false
    let resolve!: () => void
    const whenVisible = new Promise<void>((res) => {
      resolve = () => {
        if (!settled) {
          settled = true
          res()
        }
      }
    })
    const cleanup = () => {
      try {
        localIo?.unobserve(el)
      }
      catch {}
      localTargets.delete(el)
      localIdleQueue.delete(el)
      if (!localIdleQueue.size)
        clearLocalIdleJob()
    }
    const obs = ensureLocal()
    if (!obs) {
      isVisible.value = true
      resolve()
      return { isVisible, whenVisible, destroy: cleanup }
    }
    localTargets.set(el, { resolve, visible: isVisible })
    obs.observe(el)
    localIdleQueue.add(el)
    scheduleLocalIdleDrain()
    return { isVisible, whenVisible, destroy: cleanup }
  }

  return register
}
