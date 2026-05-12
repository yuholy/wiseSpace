import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import MermaidBlockNode from '../src/components/MermaidBlockNode/MermaidBlockNode.vue'
import { hideTooltip } from '../src/composables/useSingletonTooltip'

function makeNode() {
  return {
    type: 'code_block',
    language: 'mermaid',
    code: `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]`,
    raw: '',
  }
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitTooltipShow() {
  await wait(100)
  await nextTick()
}

describe('mermaidBlockNode tooltip toggles', () => {
  afterEach(async () => {
    hideTooltip(true)
    await nextTick()
  })

  it('renders action buttons with default tooltip settings', async () => {
    const wrapper = mount(MermaidBlockNode, {
      props: {
        loading: false,
        node: makeNode(),
      },
    })

    const firstActionBtn = wrapper.find('button.mermaid-action-btn')
    expect(firstActionBtn.exists()).toBe(true)

    wrapper.unmount()
  })

  it('disables tooltips when showTooltips is false', async () => {
    const wrapper = mount(MermaidBlockNode, {
      props: {
        loading: false,
        node: makeNode(),
        showTooltips: false,
      },
    })

    const firstActionBtn = wrapper.find('button.mermaid-action-btn')
    await firstActionBtn.trigger('focus')
    await waitTooltipShow()
    expect(firstActionBtn.attributes('aria-describedby')).toBeUndefined()

    wrapper.unmount()
  })

  it('normalizes streamed language labels in the header', async () => {
    const mermaidWrapper = mount(MermaidBlockNode, {
      props: {
        loading: false,
        node: {
          ...makeNode(),
          language: 'mermaid',
        },
      },
    })

    expect(mermaidWrapper.text()).toContain('Mermaid')
    mermaidWrapper.unmount()
  })
})
