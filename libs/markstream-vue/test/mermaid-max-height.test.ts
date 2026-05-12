import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import MermaidBlockNode from '../src/components/MermaidBlockNode/MermaidBlockNode.vue'

async function renderWithMaxHeight(maxHeight: string) {
  const wrapper = mount(MermaidBlockNode as any, {
    props: {
      node: {
        type: 'code_block',
        language: 'mermaid',
        code: 'graph LR\nA-->B\n',
        raw: '```mermaid\ngraph LR\nA-->B\n```',
      },
      loading: false,
      maxHeight,
    },
    attachTo: document.body,
  })

  ;(wrapper.vm as any).mermaidAvailable = true
  ;(wrapper.vm as any).showSource = false
  await nextTick()

  const content = wrapper.get('div._mermaid').element as HTMLElement
  content.innerHTML = '<svg viewBox="0 0 100 200"></svg>'

  const wrapperEl = wrapper.get('[data-mermaid-wrapper]').element as HTMLElement
  const container = wrapperEl.parentElement as HTMLElement
  Object.defineProperty(container, 'clientWidth', {
    configurable: true,
    value: 1000,
  })

  const setupState = (wrapper.vm as any).$?.setupState
  setupState.updateContainerHeight()
  await nextTick()

  return { wrapper, container }
}

describe('mermaid block max height', () => {
  it('caps preview height unless maxHeight is none', async () => {
    const capped = await renderWithMaxHeight('500px')
    expect(capped.container.style.height).toBe('500px')
    capped.wrapper.unmount()

    const uncapped = await renderWithMaxHeight('none')
    expect(uncapped.container.style.height).toBe('2000px')
    uncapped.wrapper.unmount()
  })
})
