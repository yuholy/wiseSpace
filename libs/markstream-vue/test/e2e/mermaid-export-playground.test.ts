import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import Demo from '../../playground/src/pages/mermaid-export-demo.vue'
import MermaidBlockNode from '../../src/components/MermaidBlockNode/MermaidBlockNode.vue'

describe('playground mermaid-export demo', () => {
  it('intercepts export and displays uploaded URL', async () => {
    vi.useFakeTimers()

    const wrapper = mount(Demo as any, { attachTo: document.body })

    // Wait for mounted lifecycle
    await nextTick()

    // Find the rendered MermaidBlockNode instance
    const m = wrapper.findComponent(MermaidBlockNode as any)
    expect(m.exists()).toBeTruthy()

    // Ensure the export button will be shown by setting mermaidAvailable
    ;(m.vm as any).mermaidAvailable = true
    ;(m.vm as any).showSource = false
    await nextTick()

    // Inject a fake SVG into the mermaid content area so export handler has something
    const content = m.find('div._mermaid')
    expect(content.exists()).toBeTruthy()
    content.element.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><g></g></svg>'

    await nextTick()

    // Instead of relying on DOM click wiring, emit the `export` event directly on the child
    const ev = {
      payload: { type: 'export' },
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true },
      svgElement: content.element.querySelector('svg'),
      svgString: '<svg></svg>',
    }
    ;(m.vm as any).$emit('export', ev)

    // Advance timers to resolve the component's fake upload (700ms)
    vi.runAllTimers()
    // allow microtasks scheduled by async handlers to run
    await Promise.resolve()
    await nextTick()

    // The uploaded URL should be displayed by the demo
    expect(wrapper.html()).toContain('Uploaded')
    const link = wrapper.find('a')
    expect(link.exists()).toBeTruthy()
    expect(link.attributes('href') || '').toMatch(/^https:\/\/example\.com\/uploads/)

    vi.useRealTimers()
  })
})
