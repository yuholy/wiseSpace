import type { CodeBlockMonacoTheme } from '../../types/component-props'

type SetTheme = (theme: CodeBlockMonacoTheme | undefined) => Promise<void> | void

let applyPromise: Promise<void> | null = null
let inFlightKey: string | null = null
let pendingTheme: CodeBlockMonacoTheme | null = null
let pendingKey: string | null = null
let lastAppliedKey: string | null = null
let currentSetTheme: SetTheme | null = null

const themeKeyCache = new WeakMap<object, string>()
let themeKeySeq = 0

function warnThemeSchedulerDev(error: unknown) {
  if (import.meta.env?.DEV)
    console.warn('[markstream-vue] Failed to apply Monaco theme:', error)
}

function getThemeKey(theme: CodeBlockMonacoTheme | null | undefined): string | null {
  if (theme == null)
    return null
  if (typeof theme === 'string')
    return theme
  if (typeof theme === 'object' && 'name' in theme)
    return String(theme.name)
  if (typeof theme === 'object') {
    const cached = themeKeyCache.get(theme)
    if (cached)
      return cached
    try {
      const str = JSON.stringify(theme)
      if (str) {
        themeKeyCache.set(theme, str)
        return str
      }
    }
    catch {}
    const id = `__theme_${++themeKeySeq}`
    themeKeyCache.set(theme, id)
    return id
  }
  return String(theme)
}

export function scheduleGlobalMonacoTheme(setTheme: SetTheme, theme: CodeBlockMonacoTheme | null | undefined): Promise<void> {
  const key = getThemeKey(theme)
  if (!key)
    return Promise.resolve()

  currentSetTheme = setTheme

  if (!applyPromise && lastAppliedKey === key)
    return Promise.resolve()

  if (applyPromise) {
    if (pendingKey === key || inFlightKey === key)
      return applyPromise
    pendingTheme = theme
    pendingKey = key
    return applyPromise
  }

  pendingTheme = theme
  pendingKey = key

  applyPromise = (async () => {
    while (pendingKey && pendingTheme != null) {
      const nextTheme = pendingTheme
      const nextKey = pendingKey
      pendingTheme = null
      pendingKey = null

      if (lastAppliedKey === nextKey)
        continue

      try {
        inFlightKey = nextKey
        await (currentSetTheme ?? setTheme)(nextTheme)
        lastAppliedKey = nextKey
      }
      catch (error) {
        warnThemeSchedulerDev(error)
      }
    }
  })().finally(() => {
    applyPromise = null
    inFlightKey = null
  })

  return applyPromise
}
