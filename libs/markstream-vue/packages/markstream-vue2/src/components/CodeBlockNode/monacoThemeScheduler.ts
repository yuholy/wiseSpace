type SetTheme = (theme: any) => Promise<void>

let applyPromise: Promise<void> | null = null
let pendingTheme: any = null
let pendingKey: string | null = null
let lastAppliedKey: string | null = null
let currentSetTheme: SetTheme | null = null

const themeKeyCache = new WeakMap<object, string>()
let themeKeySeq = 0

function getThemeKey(theme: any): string | null {
  if (theme == null)
    return null
  if (typeof theme === 'string')
    return theme
  if (typeof theme === 'object' && theme && 'name' in theme)
    return String((theme as any).name)
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

export function scheduleGlobalMonacoTheme(setTheme: SetTheme, theme: any): Promise<void> {
  const key = getThemeKey(theme)
  if (!key)
    return Promise.resolve()

  currentSetTheme = setTheme

  if (!applyPromise && lastAppliedKey === key)
    return Promise.resolve()

  pendingTheme = theme
  pendingKey = key

  if (applyPromise)
    return applyPromise

  applyPromise = (async () => {
    while (pendingKey && pendingTheme != null) {
      const nextTheme = pendingTheme
      const nextKey = pendingKey
      pendingTheme = null
      pendingKey = null

      if (lastAppliedKey === nextKey)
        continue

      try {
        await (currentSetTheme ?? setTheme)(nextTheme)
        lastAppliedKey = nextKey
      }
      catch {}
    }
  })().finally(() => {
    applyPromise = null
  })

  return applyPromise
}
