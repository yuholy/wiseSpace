import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom'

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

let tooltipEl: HTMLDivElement | null = null
let currentAnchor: HTMLElement | null = null
let cleanupAutoUpdate: (() => void) | null = null
let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let currentId: string | null = null

function clearTimers() {
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function ensureTooltipEl() {
  if (tooltipEl || typeof document === 'undefined')
    return tooltipEl

  tooltipEl = document.createElement('div')
  tooltipEl.className = 'ms-tooltip'
  tooltipEl.setAttribute('role', 'tooltip')
  tooltipEl.dataset.visible = 'false'
  tooltipEl.style.position = 'fixed'
  tooltipEl.style.left = '0px'
  tooltipEl.style.top = '0px'
  tooltipEl.style.transform = 'translate3d(0,0,0)'
  document.body.appendChild(tooltipEl)
  return tooltipEl
}

function detectDarkModeHint(hint?: boolean | null) {
  if (typeof hint === 'boolean')
    return hint

  if (typeof document !== 'undefined') {
    try {
      if (document.documentElement.classList.contains('dark'))
        return true
    }
    catch {
      // Ignore classList failures on locked-down documents.
    }
  }

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    catch {
      // Ignore matchMedia failures in non-browser environments.
    }
  }

  return false
}

async function updateTooltipPosition(placement: TooltipPlacement) {
  if (!tooltipEl || !currentAnchor)
    return

  const { x, y } = await computePosition(currentAnchor, tooltipEl, {
    placement,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    strategy: 'fixed',
  })

  tooltipEl.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`
}

export function showTooltipForAnchor(
  anchor: HTMLElement | null,
  content: string,
  placement: TooltipPlacement = 'top',
  immediate = false,
  isDark?: boolean | null,
) {
  if (!anchor || typeof document === 'undefined')
    return

  const element = ensureTooltipEl()
  if (!element)
    return

  clearTimers()
  const doShow = async () => {
    if (!tooltipEl)
      return

    currentAnchor = anchor
    tooltipEl.textContent = content
    tooltipEl.dataset.placement = placement
    tooltipEl.dataset.dark = detectDarkModeHint(isDark) ? 'true' : 'false'
    tooltipEl.dataset.visible = 'false'
    currentId = `tooltip-${Date.now()}-${Math.random().toString(36).slice(2)}`
    tooltipEl.id = currentId

    try {
      anchor.setAttribute('aria-describedby', currentId)
    }
    catch {
      // Ignore aria sync failures.
    }

    await updateTooltipPosition(placement)
    tooltipEl.dataset.visible = 'true'
    cleanupAutoUpdate?.()
    cleanupAutoUpdate = autoUpdate(anchor, tooltipEl, () => {
      void updateTooltipPosition(placement)
    })
  }

  if (immediate)
    void doShow()
  else
    showTimer = setTimeout(doShow, 80)
}

export function hideTooltip(immediate = false) {
  if (!tooltipEl)
    return

  clearTimers()
  const doHide = () => {
    if (!tooltipEl)
      return

    tooltipEl.dataset.visible = 'false'
    if (currentAnchor && currentId) {
      try {
        currentAnchor.removeAttribute('aria-describedby')
      }
      catch {
        // Ignore aria sync failures.
      }
    }
    currentAnchor = null
    currentId = null
    cleanupAutoUpdate?.()
    cleanupAutoUpdate = null
  }

  if (immediate)
    doHide()
  else
    hideTimer = setTimeout(doHide, 120)
}
