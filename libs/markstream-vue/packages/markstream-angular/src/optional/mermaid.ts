export type MermaidLoader = () => Promise<any> | any

const defaultMermaidLoader: MermaidLoader = () => import('mermaid')
const GLOBAL_MERMAID_KEY = '__MARKSTREAM_ANGULAR_MERMAID__'

let cachedMermaid: any = null
let importAttempted = false
let lastInitKey: string | null = null
let pendingImport: Promise<any | null> | null = null
let mermaidLoader: MermaidLoader | null = defaultMermaidLoader

function computeInitKey(config: Record<string, any>) {
  const securityLevel = String(config?.securityLevel ?? 'loose')
  const htmlLabels = config?.flowchart?.htmlLabels
  return `${securityLevel}|htmlLabels:${htmlLabels === false ? '0' : '1'}`
}

function normalizeMermaidModule(mod: any) {
  if (!mod)
    return mod

  const candidate = mod?.default ?? mod
  if (candidate && (typeof candidate.render === 'function' || typeof candidate.parse === 'function' || typeof candidate.initialize === 'function'))
    return candidate

  if (candidate?.mermaidAPI && (typeof candidate.mermaidAPI.render === 'function' || typeof candidate.mermaidAPI.parse === 'function')) {
    const api = candidate.mermaidAPI
    return {
      ...candidate,
      render: api.render.bind(api),
      parse: api.parse ? api.parse.bind(api) : undefined,
      initialize: (opts: any) => {
        if (typeof candidate.initialize === 'function')
          return candidate.initialize(opts)
        return api.initialize ? api.initialize(opts) : undefined
      },
    }
  }

  if (mod?.mermaid && typeof mod.mermaid.render === 'function')
    return mod.mermaid

  return candidate
}

function patchInitialize(target: any) {
  if (!target)
    return

  try {
    const originalInitialize = target?.initialize
    target.initialize = (opts: any) => {
      const merged = { suppressErrorRendering: true, ...(opts || {}) }
      if (typeof originalInitialize === 'function')
        return originalInitialize.call(target, merged)
      if (target?.mermaidAPI && typeof target.mermaidAPI.initialize === 'function')
        return target.mermaidAPI.initialize(merged)
      return undefined
    }
  }
  catch {
    // Ignore patching failures and keep the original instance.
  }
}

function ensureInitialized(instance: any, config?: Record<string, any>) {
  if (!instance || !config)
    return

  const key = computeInitKey(config)
  if (lastInitKey === key)
    return

  try {
    if (typeof instance.initialize === 'function')
      instance.initialize(config)
    else if (instance.mermaidAPI?.initialize)
      instance.mermaidAPI.initialize(config)
    lastInitKey = key
  }
  catch {
    // Mermaid may already be initialized; keep going.
  }
}

function getGlobalMermaid() {
  try {
    const globalStore = globalThis as any
    return normalizeMermaidModule(globalStore?.[GLOBAL_MERMAID_KEY] ?? globalStore?.mermaid)
  }
  catch {
    return null
  }
}

function setGlobalMermaid(instance: any) {
  try {
    ;(globalThis as any)[GLOBAL_MERMAID_KEY] = instance
  }
  catch {
    // Ignore global cache writes when the host forbids mutation.
  }
}

function resetCachedMermaid() {
  cachedMermaid = null
  importAttempted = false
  lastInitKey = null
  pendingImport = null
  try {
    delete (globalThis as any)[GLOBAL_MERMAID_KEY]
  }
  catch {
    // Ignore failures when the global object is sealed.
  }
}

export function setMermaidLoader(loader: MermaidLoader | null) {
  mermaidLoader = loader
  resetCachedMermaid()
}

export function enableMermaid(loader?: MermaidLoader) {
  setMermaidLoader(loader ?? defaultMermaidLoader)
}

export function disableMermaid() {
  setMermaidLoader(null)
}

export function isMermaidEnabled() {
  return typeof mermaidLoader === 'function'
}

export async function getMermaid(initConfig?: Record<string, any>) {
  if (cachedMermaid) {
    ensureInitialized(cachedMermaid, initConfig)
    return cachedMermaid
  }

  const globalMermaid = getGlobalMermaid()
  if (globalMermaid) {
    patchInitialize(globalMermaid)
    cachedMermaid = globalMermaid
    setGlobalMermaid(cachedMermaid)
    ensureInitialized(cachedMermaid, initConfig)
    return cachedMermaid
  }

  if (pendingImport) {
    const instance = await pendingImport
    if (instance)
      ensureInitialized(instance, initConfig)
    return instance
  }

  if (importAttempted)
    return null

  const loader = mermaidLoader
  if (!loader) {
    importAttempted = true
    return null
  }

  pendingImport = (async () => {
    try {
      const mod = await loader()
      const instance = normalizeMermaidModule(mod)
      if (!instance) {
        importAttempted = true
        return null
      }
      patchInitialize(instance)
      cachedMermaid = instance
      setGlobalMermaid(cachedMermaid)
      return cachedMermaid
    }
    catch {
      importAttempted = true
      return null
    }
  })()

  try {
    const instance = await pendingImport
    if (instance)
      ensureInitialized(instance, initConfig)
    return instance
  }
  finally {
    pendingImport = null
  }
}
