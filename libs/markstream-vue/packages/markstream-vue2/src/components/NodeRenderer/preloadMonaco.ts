let isPreload = false
export async function preload(m) {
  if (isPreload)
    return
  isPreload = true
  const existingEnv = (globalThis as any)?.MonacoEnvironment
  if (existingEnv && (typeof existingEnv.getWorker === 'function' || typeof existingEnv.getWorkerUrl === 'function'))
    return
  return m.preloadMonacoWorkers()
}
