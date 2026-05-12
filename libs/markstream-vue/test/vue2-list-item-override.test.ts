/**
 * @vitest-environment jsdom
 */

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ListNode from '../packages/markstream-vue2/src/components/ListNode/ListNode.vue'

import { removeCustomComponents, setCustomComponents } from '../packages/markstream-vue2/src/utils/nodeComponents'

vi.mock('../packages/markstream-vue2/src/components/ListItemNode', () => {
  return {
    default: defineComponent({
      name: 'MockListItemNode',
      props: ['node', 'value'],
      setup(props) {
        return () => h('li', { 'class': 'mock-list-item', 'data-value': props.value }, (props as any).node?.children?.[0]?.content ?? '')
      },
    }),
  }
})

describe('vue 2 - customComponents can override list_item', () => {
  it('renders list items with the custom component', () => {
    const scopeId = 'vue2-custom-list-item'
    const CustomListItem = defineComponent({
      name: 'CustomListItem',
      props: ['node', 'value'],
      setup(props) {
        return () => h('li', { 'class': 'custom-list-item', 'data-value': props.value }, (props as any).node?.children?.[0]?.content ?? '')
      },
    })

    setCustomComponents(scopeId, { list_item: CustomListItem as any })
    try {
      const wrapper = mount(ListNode, {
        props: {
          node: {
            type: 'list',
            ordered: true,
            start: 1,
            items: [
              { type: 'list_item', raw: '', children: [{ type: 'text', raw: '', content: 'First' }] },
              { type: 'list_item', raw: '', children: [{ type: 'text', raw: '', content: 'Second' }] },
            ],
            raw: '',
          },
          customId: scopeId,
          indexKey: 'list',
          typewriter: false,
        },
      })

      expect(wrapper.findAll('li.custom-list-item')).toHaveLength(2)
      expect(wrapper.findAll('li.custom-list-item')[0].attributes('data-value')).toBe('1')
      expect(wrapper.findAll('li.custom-list-item')[1].attributes('data-value')).toBe('2')
      expect(wrapper.text()).toContain('First')
      expect(wrapper.text()).toContain('Second')
      expect(wrapper.findAll('li.mock-list-item')).toHaveLength(0)
    }
    finally {
      removeCustomComponents(scopeId)
    }
  })
})
