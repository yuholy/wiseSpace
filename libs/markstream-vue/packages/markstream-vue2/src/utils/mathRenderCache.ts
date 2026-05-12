interface CachedMathRender {
  html: string
}

const MAX_CACHE_SIZE = 200
const mathRenderCache = new Map<string, CachedMathRender>()

function touchCacheEntry(key: string, value: CachedMathRender) {
  mathRenderCache.delete(key)
  mathRenderCache.set(key, value)
  if (mathRenderCache.size > MAX_CACHE_SIZE) {
    const oldestKey = mathRenderCache.keys().next().value
    if (oldestKey)
      mathRenderCache.delete(oldestKey)
  }
}

export function getCachedMathRender(key: string | null | undefined) {
  if (!key)
    return null
  const cached = mathRenderCache.get(key) || null
  if (cached)
    touchCacheEntry(key, cached)
  return cached
}

export function setCachedMathRender(key: string | null | undefined, html: string) {
  if (!key || !html)
    return
  touchCacheEntry(key, { html })
}

export function clearCachedMathRender(key?: string | null) {
  if (!key) {
    mathRenderCache.clear()
    return
  }
  mathRenderCache.delete(key)
}
