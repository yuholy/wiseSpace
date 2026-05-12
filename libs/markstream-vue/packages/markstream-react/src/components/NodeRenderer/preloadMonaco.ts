let isPreloaded = false

export async function preload(mod: any) {
  if (isPreloaded)
    return
  isPreloaded = true
  const existingEnv = (globalThis as any)?.MonacoEnvironment
  if (existingEnv && (typeof existingEnv.getWorker === 'function' || typeof existingEnv.getWorkerUrl === 'function'))
    return
  if (mod?.preloadMonacoWorkers)
    await mod.preloadMonacoWorkers()
}
