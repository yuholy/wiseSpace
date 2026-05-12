import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

interface Entry {
  target: Element
  isIntersecting: boolean
  intersectionRatio: number
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  callback: (entries: Entry[]) => void
  elements = new Set<Element>()

  constructor(cb: (entries: Entry[]) => void) {
    this.callback = cb
    FakeIntersectionObserver.instances.push(this)
  }

  observe(el: Element) {
    this.elements.add(el)
  }

  unobserve(el: Element) {
    this.elements.delete(el)
  }

  disconnect() {
    this.elements.clear()
  }

  trigger(el: Element, isIntersecting = true) {
    if (!this.elements.has(el))
      return
    this.callback([{ target: el, isIntersecting, intersectionRatio: isIntersecting ? 1 : 0 }])
  }
}

async function flushVueUpdates() {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
  FakeIntersectionObserver.instances = []
})

describe('markstream-vue2 mermaid viewport priority', () => {
  it('prerenders during idle before the block becomes visible', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestIdleCallback', ((cb: any) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 50 }), 1)) as any)
    vi.stubGlobal('cancelIdleCallback', ((id: number) => clearTimeout(id)) as any)

    const canParseOffthread = vi.fn(async () => true)
    const findPrefixOffthread = vi.fn(async () => null)
    vi.doMock('../packages/markstream-vue2/src/workers/mermaidWorkerClient', () => ({
      canParseOffthread,
      findPrefixOffthread,
      terminateWorker: vi.fn(),
    }))
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver as any)

    const MermaidBlockNode = (await import('../packages/markstream-vue2/src/components/MermaidBlockNode/MermaidBlockNode.vue')).default
    const node = {
      type: 'code_block',
      language: 'mermaid',
      code: 'graph LR\nA-->B\n',
      raw: '```mermaid\ngraph LR\nA-->B\n```',
    }

    const wrapper = mount(MermaidBlockNode as any, {
      props: {
        node,
        loading: true,
      },
    })

    await flushVueUpdates()

    ;(wrapper.vm as any).mermaidAvailable = true
    ;(wrapper.vm as any).showSource = false
    await flushVueUpdates()

    await wrapper.setProps({
      node: {
        ...node,
        code: 'graph LR\nA-->B\nB-->C\n',
        raw: '```mermaid\ngraph LR\nA-->B\nB-->C\n```',
      },
    })
    await flushVueUpdates()
    await vi.advanceTimersByTimeAsync(250)
    await flushVueUpdates()

    expect(canParseOffthread).not.toHaveBeenCalled()
    expect(findPrefixOffthread).not.toHaveBeenCalled()

    const observer = FakeIntersectionObserver.instances.at(-1)
    expect(observer).toBeTruthy()

    await vi.advanceTimersByTimeAsync(1200)
    await flushVueUpdates()

    expect(canParseOffthread).toHaveBeenCalled()
  })
})
