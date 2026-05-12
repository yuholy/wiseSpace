export type KatexLoader = () => Promise<any> | any

let katex: any = null
let importAttempted = false
let pendingImport: Promise<any | null> | null = null
let katexLoader: KatexLoader | null = defaultKatexLoader

function normalizeKatexModule(mod: any) {
  const resolved = mod?.default ?? mod
  if (resolved && typeof resolved.renderToString === 'function')
    return resolved
  return null
}

function getGlobalKatex() {
  try {
    const globalStore = globalThis as any
    return normalizeKatexModule(globalStore?.katex)
  }
  catch {
    return null
  }
}

function defaultKatexLoader() {
  return (async () => {
    const globalKatex = getGlobalKatex()
    if (globalKatex)
      return globalKatex

    const mod = await import('katex')
    try {
      await import('katex/contrib/mhchem')
    }
    catch {
      // Ignore optional mhchem support failures.
    }
    return normalizeKatexModule(mod)
  })()
}

function resetCache() {
  katex = null
  importAttempted = false
  pendingImport = null
}

export function setKatexLoader(loader: KatexLoader | null) {
  katexLoader = loader
  resetCache()
}

export function enableKatex(loader?: KatexLoader) {
  setKatexLoader(loader ?? defaultKatexLoader)
}

export function disableKatex() {
  setKatexLoader(null)
}

export function isKatexEnabled() {
  return typeof katexLoader === 'function'
}

export async function getKatex() {
  const globalKatex = getGlobalKatex()
  if (globalKatex) {
    katex = globalKatex
    return katex
  }

  if (katex)
    return katex
  if (pendingImport)
    return await pendingImport
  if (importAttempted)
    return null

  const loader = katexLoader
  if (!loader) {
    importAttempted = true
    return null
  }

  pendingImport = (async () => {
    try {
      const result = await loader()
      const normalized = normalizeKatexModule(result) ?? result
      if (normalized) {
        katex = normalized
        return katex
      }
    }
    catch {
      // Swallow loader errors so callers can gracefully fall back.
    }

    importAttempted = true
    return null
  })()

  try {
    return await pendingImport
  }
  finally {
    pendingImport = null
  }
}
