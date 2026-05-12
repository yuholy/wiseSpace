/**
 * @vitest-environment jsdom
 */

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import NestedRenderer from '../packages/markstream-vue2/src/components/NestedRenderer/NestedRenderer.vue'

import { removeCustomComponents, setCustomComponents } from '../packages/markstream-vue2/src/utils/nodeComponents'

const customId = 'vue2-nested-renderer-test'

vi.mock('../packages/markstream-vue2/src/components/MarkdownRenderCompat.vue', async () => {
  const { defineComponent, h } = await import('vue')
  const LegacyNodesRenderer = (await import('../packages/markstream-vue2/src/components/NodeRenderer/LegacyNodesRenderer.vue')).default

  return {
    default: defineComponent({
      name: 'MarkdownRenderCompatStub',
      props: {
        nodes: Array,
        customId: [String, Number],
        indexKey: [String, Number],
        typewriter: Boolean,
      },
      render() {
        return h(LegacyNodesRenderer as any, {
          nodes: this.nodes,
          customId: this.customId,
          indexKey: this.indexKey,
          typewriter: this.typewriter,
        })
      },
    }),
  }
})

const ThinkingNode = defineComponent({
  name: 'ThinkingNodeTest',
  props: {
    node: {
      type: Object,
      required: true,
    },
  },
  render() {
    return h('section', { class: 'thinking-shell' }, [
      h('header', { class: 'thinking-title' }, 'Thinking'),
      h(NestedRenderer as any, {
        node: this.node,
        customId,
        customHtmlTags: ['thinking'],
        typewriter: false,
        batchRendering: false,
        viewportPriority: false,
        deferNodesUntilVisible: false,
      }),
    ])
  },
})

async function flushAll() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
  await Promise.resolve()
}

describe('vue2 NestedRenderer', () => {
  beforeEach(() => {
    setCustomComponents(customId, { thinking: ThinkingNode })
  })

  afterEach(() => {
    removeCustomComponents(customId)
  })

  it('renders partial nested content during streaming', async () => {
    const wrapper = mount(NestedRenderer as any, {
      props: {
        content: '<thinking>outer start',
        final: false,
        customId,
        customHtmlTags: ['thinking'],
        typewriter: false,
        batchRendering: false,
        viewportPriority: false,
        deferNodesUntilVisible: false,
      },
    })

    await flushAll()

    expect(wrapper.findAll('.thinking-shell')).toHaveLength(1)
    expect(wrapper.text()).toContain('outer start')
  })

  it('renders nested custom nodes from final content', async () => {
    const wrapper = mount(NestedRenderer as any, {
      props: {
        content: '<thinking>outer start\n\n<thinking>inner done</thinking>\n\nouter end</thinking>',
        final: true,
        customId,
        customHtmlTags: ['thinking'],
        typewriter: false,
        batchRendering: false,
        viewportPriority: false,
        deferNodesUntilVisible: false,
      },
    })

    await flushAll()

    expect(wrapper.findAll('.thinking-shell')).toHaveLength(2)
    expect(wrapper.text()).toContain('outer end')
    expect(wrapper.text()).toContain('inner done')
  })
})
