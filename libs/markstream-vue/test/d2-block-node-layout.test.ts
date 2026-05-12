import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import D2BlockNode from '../src/components/D2BlockNode/D2BlockNode.vue'

vi.mock('../src/components/D2BlockNode/d2', () => ({
  getD2: vi.fn(async () => class FakeD2 {
    async compile(code: string) {
      return {
        diagram: { code },
        renderOptions: {},
      }
    }

    async render() {
      return {
        svg: '<svg width="364" height="766" viewBox="0 0 364 766"><svg class="inner-diagram" width="364" height="766" viewBox="0 0 364 766"><rect width="100" height="100" /></svg></svg>',
      }
    }
  }),
}))

async function flushRender() {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

async function waitForPreview(wrapper: ReturnType<typeof mount>, timeout = 1000) {
  const start = Date.now()
  while (!wrapper.find('.d2-svg').exists()) {
    if (Date.now() - start > timeout)
      throw new Error('Timed out waiting for D2 preview to render')
    await flushRender()
  }
}

describe('d2 block layout', () => {
  it('scales only the root svg and does not pin preview height with stale min-heights', async () => {
    const wrapper = mount(D2BlockNode as any, {
      props: {
        node: {
          type: 'code_block',
          language: 'd2',
          code: 'a -> b',
          raw: '```d2\na -> b\n```',
        },
        loading: false,
      },
      attachTo: document.body,
    })

    await waitForPreview(wrapper)

    const svgMarkup = wrapper.get('.d2-svg').html()
    expect(svgMarkup.match(/markstream-d2-root-svg/g)?.length ?? 0).toBe(1)

    const setupState = (wrapper.vm as any).$?.setupState
    setupState.bodyMinHeight = 5079
    await nextTick()

    expect(wrapper.get('.d2-block-body').attributes('style') || '').not.toContain('5079')

    wrapper.unmount()
  })
})
