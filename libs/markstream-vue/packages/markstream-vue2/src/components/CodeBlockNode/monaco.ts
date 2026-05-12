import { preload } from '../NodeRenderer/preloadMonaco'

let mod: any = null
let importAttempted = false

async function warmupShikiTokenizer(m: any) {
  const getOrCreateHighlighter = m?.getOrCreateHighlighter
  if (typeof getOrCreateHighlighter !== 'function')
    return true

  try {
    const highlighter = await getOrCreateHighlighter(
      ['vitesse-dark', 'vitesse-light'],
      ['plaintext', 'text', 'javascript'],
    )

    if (highlighter && typeof highlighter.codeToTokens === 'function') {
      // Trigger a minimal tokenize pass to ensure the TextMate regex engine
      // is initialized. In some bundlers (notably Webpack 4) this can
      // otherwise fail later in Monaco's background tokenization with
      // "Cannot read properties of null (reading 'compileAG')".
      highlighter.codeToTokens('const a = 1', { lang: 'javascript', theme: 'vitesse-dark' })
    }
    return true
  }
  catch (err) {
    // If the optional tokenizer stack fails to initialize, fall back to
    // plain <pre><code> rendering instead of letting Monaco crash the app.
    console.warn('[markstream-vue2] Failed to warm up Shiki tokenizer; disabling stream-monaco for this session.', err)
    return false
  }
}

export async function getUseMonaco() {
  if (mod)
    return mod
  if (importAttempted)
    return null

  try {
    const imported = await import('stream-monaco/legacy')
    mod = (imported as any)?.default ?? imported
    await preload(mod)
    const ok = await warmupShikiTokenizer(mod)
    if (!ok) {
      mod = null
      importAttempted = true
      return null
    }
    return mod
  }
  catch {
    importAttempted = true
    // Return null to indicate the module is not available
    // The caller should handle the fallback gracefully
    return null
  }
}
