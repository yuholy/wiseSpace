let monacoModule: any = null
let importAttempted = false
let pendingImport: Promise<any | null> | null = null
let workersPreloaded = false

async function preloadWorkers(mod: any) {
  if (workersPreloaded)
    return
  workersPreloaded = true
  const existingEnv = (globalThis as any)?.MonacoEnvironment
  if (existingEnv && (typeof existingEnv.getWorker === 'function' || typeof existingEnv.getWorkerUrl === 'function'))
    return
  if (typeof mod?.preloadMonacoWorkers === 'function')
    await mod.preloadMonacoWorkers()
}

async function warmupShikiTokenizer(mod: any) {
  const getOrCreateHighlighter = mod?.getOrCreateHighlighter
  if (typeof getOrCreateHighlighter !== 'function')
    return true

  try {
    const highlighter = await getOrCreateHighlighter(
      ['vitesse-dark', 'vitesse-light'],
      ['plaintext', 'text', 'javascript'],
    )

    if (highlighter && typeof highlighter.codeToTokens === 'function') {
      highlighter.codeToTokens('const a = 1', { lang: 'javascript', theme: 'vitesse-dark' })
    }

    return true
  }
  catch (error) {
    console.warn('[markstream-angular] Failed to warm up stream-monaco tokenizer; falling back to plain code rendering.', error)
    return false
  }
}

export async function getUseMonaco() {
  if (monacoModule)
    return monacoModule
  if (pendingImport)
    return await pendingImport
  if (importAttempted)
    return null

  pendingImport = (async () => {
    try {
      const imported: any = await import('stream-monaco')
      monacoModule = imported?.default ?? imported
      await preloadWorkers(monacoModule)

      const ready = await warmupShikiTokenizer(monacoModule)
      if (!ready) {
        monacoModule = null
        importAttempted = true
        return null
      }

      return monacoModule
    }
    catch {
      importAttempted = true
      return null
    }
  })()

  try {
    return await pendingImport
  }
  finally {
    pendingImport = null
  }
}
