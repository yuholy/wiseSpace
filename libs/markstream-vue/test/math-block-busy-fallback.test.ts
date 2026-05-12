import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
// Import after mocks
import MathBlockNode from '../src/components/MathBlockNode/MathBlockNode.vue'

import { flushAll } from './setup/flush-all'

// Mock getKatex to return a lightweight renderer
vi.mock('../src/components/MathInlineNode/katex', () => ({
  getKatexSync: () => null,
  getKatex: async () => ({
    renderToString: (content: string, opts: any) => `<span class="katex ${opts?.displayMode ? 'block' : 'inline'}">${content}</span>`,
  }),
}))

// Mock worker client to simulate worker busy so component falls back to main thread
vi.mock('../src/workers/katexWorkerClient', async () => {
  const actual: any = await vi.importActual('../src/workers/katexWorkerClient')
  return {
    ...actual,
    WORKER_BUSY_CODE: 'WORKER_BUSY',
    renderKaTeXWithBackpressure: async () => {
      const err: any = new Error('Worker busy')
      err.code = 'WORKER_BUSY'
      err.name = 'WorkerBusy'
      throw err
    },
  }
})

describe('mathBlockNode busy worker fallback', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('falls back to sync KaTeX render instead of raw when worker is busy', async () => {
    const wrapper = mount(MathBlockNode as any, {
      props: {
        node: {
          type: 'math_block',
          content: 'a^2 + b^2 = c^2',
          raw: '$$a^2 + b^2 = c^2$$',
          loading: true,
        },
      },
    })
    await flushAll()

    const html = wrapper.html()
    // Should contain our mocked KaTeX HTML
    expect(html).toContain('katex block')
    // Should not show raw text fallback
    expect(html).not.toContain('$$a^2 + b^2 = c^2$$')
  })
})
