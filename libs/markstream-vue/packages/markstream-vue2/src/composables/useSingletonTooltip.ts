import * as VueModule from 'vue-demi'
import { ref } from 'vue-demi'

function getVueCtor() {
  // Vue 2 interop differs across bundlers:
  // - `require('vue')` may return the constructor
  // - or a module-like object with `.default` pointing to the constructor
  // - or even nested `.default.default` in some CJS/ESM bridges
  const anyMod = VueModule as any
  const isVueCtor = (candidate: any) => typeof candidate === 'function' && typeof candidate.extend === 'function'
  const candidates = [
    anyMod,
    anyMod?.default,
    anyMod?.default?.default,
    (anyMod?.default ?? anyMod)?.default,
    anyMod?.Vue2,
    anyMod?.Vue,
  ]
  for (const candidate of candidates) {
    if (isVueCtor(candidate))
      return candidate
    if (isVueCtor(candidate?.default))
      return candidate.default
  }
  return (anyMod?.default ?? anyMod) as any
}

const visible = ref(false)
const content = ref('')
const placement = ref<'top' | 'bottom' | 'left' | 'right'>('top')
const anchorEl = ref<HTMLElement | null>(null)
const tooltipId = ref<string | null>(null)
const originX = ref<number | null>(null)
const originY = ref<number | null>(null)
const tooltipIsDark = ref<boolean | null>(null)

let showTimer: ReturnType<typeof setTimeout> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null

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

// Mount singleton Tooltip once
let mounted = false
let mountPromise: Promise<void> | null = null
export function ensureTooltipMounted() {
  if (mounted)
    return Promise.resolve()
  if (typeof document === 'undefined')
    return Promise.resolve()
  if (mountPromise)
    return mountPromise

  mountPromise = import('../components/Tooltip/Tooltip.vue')
    .then((mod) => {
      mounted = true
      const Tooltip = (mod as any)?.default ?? (mod as any)
      const container = document.createElement('div')
      container.setAttribute('data-singleton-tooltip', '1')
      document.body.appendChild(container)

      const VueCtor = getVueCtor()
      const App = VueCtor.extend({
        render(createElement) {
          return createElement(Tooltip as any, {
            props: {
              visible: visible.value,
              anchorEl: anchorEl.value,
              content: content.value,
              placement: placement.value,
              id: tooltipId.value,
              originX: originX.value,
              originY: originY.value,
              isDark: tooltipIsDark.value ?? undefined,
            },
          })
        },
      })

      new App().$mount(container)
    })
    .catch((err) => {
      mountPromise = null
      mounted = false
      console.warn('[markstream-vue2] Failed to load Tooltip component. Tooltips will be disabled.', err)
    })

  return mountPromise
}

export function showTooltipForAnchor(
  el: HTMLElement | null,
  text: string,
  place: typeof placement.value = 'top',
  immediate = false,
  origin?: { x: number, y: number } | undefined,
  isDark?: boolean | null,
) {
  if (!el)
    return
  ensureTooltipMounted()
  clearTimers()
  const doShow = () => {
    tooltipId.value = `tooltip-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    anchorEl.value = el
    content.value = text
    placement.value = place
    // expose origin coordinates for initial animation
    originX.value = origin?.x ?? null
    originY.value = origin?.y ?? null
    // allow caller to hint dark mode; if omitted, remain null (tooltip will detect global)
    tooltipIsDark.value = typeof isDark === 'boolean' ? isDark : null
    visible.value = true
    try {
      el.setAttribute('aria-describedby', tooltipId.value!)
    }
    catch {}
  }
  if (immediate)
    doShow()
  else showTimer = setTimeout(doShow, 80)
}

export function hideTooltip(immediate = false) {
  clearTimers()
  const doHide = () => {
    if (anchorEl.value && tooltipId.value) {
      try {
        anchorEl.value.removeAttribute('aria-describedby')
      }
      catch {}
    }
    visible.value = false
    anchorEl.value = null
    tooltipId.value = null
    originX.value = null
    originY.value = null
  }
  if (immediate)
    doHide()
  else hideTimer = setTimeout(doHide, 120)
}

export default {
  ensureTooltipMounted,
  showTooltipForAnchor,
  hideTooltip,
}
