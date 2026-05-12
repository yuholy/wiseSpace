import { afterEach, describe, expect, it, vi } from 'vitest'

const mathNode = {
  type: 'math_block',
  content: '\\sum_{n=1}^{3} n = 6',
  raw: '$$\\sum_{n=1}^{3} n = 6$$',
  markup: '$$',
  loading: false,
} as const

const katexRenderer = {
  renderToString(content: string, options?: { displayMode?: boolean }) {
    return options?.displayMode
      ? `<span class="katex-display">${content}</span>`
      : `<span class="katex">${content}</span>`
  },
}

const browserKeys = [
  'window',
  'document',
  'navigator',
  'self',
  'Element',
  'HTMLElement',
  'SVGElement',
  'Node',
  'Text',
  'Comment',
  'Document',
  'MutationObserver',
  'Event',
  'CustomEvent',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
] as const

async function withGlobalOverrides<T>(values: Partial<Record<(typeof browserKeys)[number], unknown>>, run: () => Promise<T>) {
  const previous = new Map<string, PropertyDescriptor | undefined>()

  for (const key of browserKeys) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    if (!(key in values))
      continue
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: values[key],
    })
  }

  try {
    return await run()
  }
  finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor)
      }
      else {
        Reflect.deleteProperty(globalThis, key)
      }
    }
  }
}

async function renderServerMathBlock() {
  return withGlobalOverrides(
    Object.fromEntries(browserKeys.map(key => [key, undefined])) as Partial<Record<(typeof browserKeys)[number], undefined>>,
    async () => {
      vi.resetModules()
      const vue = await import('vue')
      const { renderToString } = await import('vue/server-renderer')
      const { setKatexLoader } = await import('../src/components/MathInlineNode/katex')
      const MathBlockNode = (await import('../src/components/MathBlockNode/MathBlockNode.vue')).default

      setKatexLoader(() => katexRenderer)

      const app = vue.createSSRApp({
        render: () => vue.h(MathBlockNode, { node: mathNode }),
      })

      return renderToString(app)
    },
  )
}

describe('mathBlockNode hydration', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('hydrates server-rendered KaTeX markup without mismatch warnings', async () => {
    const serverHtml = await renderServerMathBlock()

    expect(serverHtml).toContain('data-markstream-mode="katex"')
    expect(serverHtml).toContain('katex-display')

    document.body.innerHTML = `<div id="app">${serverHtml}</div>`

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.resetModules()
    const vue = await import('vue')
    const { setKatexLoader } = await import('../src/components/MathInlineNode/katex')
    const MathBlockNode = (await import('../src/components/MathBlockNode/MathBlockNode.vue')).default

    setKatexLoader(() => katexRenderer)

    const app = vue.createSSRApp({
      render: () => vue.h(MathBlockNode, { node: mathNode }),
    })

    const container = document.querySelector('#app') as HTMLElement
    app.mount(container)

    await vue.nextTick()
    await Promise.resolve()

    const diagnostics = [
      ...consoleError.mock.calls.flat(),
      ...consoleWarn.mock.calls.flat(),
    ].join(' ')

    expect(container.innerHTML).toContain('katex-display')
    expect(diagnostics).not.toMatch(/Hydration/i)
    expect(diagnostics).not.toMatch(/mismatch/i)
  })
})
