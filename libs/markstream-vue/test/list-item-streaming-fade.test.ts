import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NodeRenderer from '../src/components/NodeRenderer'
import { flushAll } from './setup/flush-all'

describe('list item streaming fade', () => {
  it('replays appended-text fade inside list items', async () => {
    const wrapper = mount(NodeRenderer, {
      props: {
        batchRendering: false,
        content: '- Hello',
      },
    })

    await flushAll()

    await wrapper.setProps({
      content: '- HelloWorld',
    })
    await flushAll()

    const listItem = wrapper.get('li.list-item')
    const delta = wrapper.get('li.list-item .text-node-stream-delta')

    expect(delta.text()).toBe('World')
    expect(listItem.text()).toContain('HelloWorld')
  })
})
