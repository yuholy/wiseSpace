import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MathBlockNode from '../src/components/MathBlockNode/MathBlockNode.vue'
import { flushAll } from './setup/flush-all'

const mocks = vi.hoisted(() => ({
  renderKaTeXWithBackpressure: vi.fn(() => new Promise<string>(() => {})),
}))

vi.mock('../src/components/MathInlineNode/katex', () => ({
  getKatexSync: () => null,
  getKatex: async () => null,
}))

vi.mock('../src/workers/katexWorkerClient', async () => {
  const actual: any = await vi.importActual('../src/workers/katexWorkerClient')
  return {
    ...actual,
    renderKaTeXWithBackpressure: mocks.renderKaTeXWithBackpressure,
  }
})

describe('mathBlockNode loading state', () => {
  it('keeps loading math blocks in loading mode instead of flashing raw fallback', async () => {
    const wrapper = mount(MathBlockNode as any, {
      props: {
        node: {
          type: 'math_block',
          content: '\\begin{pmatrix}\na & b \\\\\nc & d',
          raw: '\\[\n\\begin{pmatrix}\na & b \\\\\nc & d\n\\]',
          loading: true,
        },
      },
    })

    await flushAll()

    expect(mocks.renderKaTeXWithBackpressure).toHaveBeenCalled()
    expect(wrapper.attributes('data-markstream-mode')).toBe('loading')
    expect(wrapper.find('.math-loading-overlay').exists()).toBe(true)
    expect(wrapper.find('.math-block__fallback').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('\\begin{pmatrix}')
  })
})
