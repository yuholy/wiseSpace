import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { flushAll } from './setup/flush-all'

class CountingResizeObserver {
  static observeCalls = 0

  observe() {
    CountingResizeObserver.observeCalls += 1
  }

  unobserve() {}
  disconnect() {}
}

function createParagraph(index: number) {
  return {
    type: 'paragraph',
    raw: `Paragraph ${index}`,
    children: [
      {
        type: 'text',
        content: `Paragraph ${index}`,
        raw: `Paragraph ${index}`,
      },
    ],
  }
}

function createCodeBlock(index: number) {
  return {
    type: 'code_block',
    language: 'js',
    code: `console.log(${index})`,
    raw: `\`\`\`js\nconsole.log(${index})\n\`\`\``,
    loading: false,
  }
}

describe('node renderer measurement performance', () => {
  it('skips node height observers when virtualization is off', async () => {
    CountingResizeObserver.observeCalls = 0
    vi.stubGlobal('ResizeObserver', CountingResizeObserver as any)

    const NodeRenderer = (await import('../src/components/NodeRenderer')).default
    const wrapper = mount(NodeRenderer, {
      props: {
        nodes: [createParagraph(1), createCodeBlock(1)],
        viewportPriority: false,
      },
    })

    await flushAll()

    expect(CountingResizeObserver.observeCalls).toBe(0)
    wrapper.unmount()
  })

  it('still measures node heights when virtualization is on', async () => {
    CountingResizeObserver.observeCalls = 0
    vi.stubGlobal('ResizeObserver', CountingResizeObserver as any)

    const NodeRenderer = (await import('../src/components/NodeRenderer')).default
    const nodes = Array.from({ length: 4 }, (_, index) => createParagraph(index + 1))
    const wrapper = mount(NodeRenderer, {
      props: {
        nodes,
        maxLiveNodes: 1,
        viewportPriority: false,
      },
    })

    await flushAll()

    expect(CountingResizeObserver.observeCalls).toBeGreaterThan(0)
    wrapper.unmount()
  })
})
