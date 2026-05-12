import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NodeRenderer from '../src/components/NodeRenderer'
import { flushAll } from './setup/flush-all'

describe('nodeRenderer showTooltips prop', () => {
  it('disables LinkNode tooltip when showTooltips is false', async () => {
    const wrapper = mount(NodeRenderer, {
      props: {
        content: 'Visit [Vue](https://vuejs.org \"Vue Site\") now.',
        showTooltips: false,
      },
    })
    await flushAll()

    const link = wrapper.find('a[href=\"https://vuejs.org\"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('title')).toBe('Vue Site')
  })

  it('keeps LinkNode tooltip enabled by default', async () => {
    const wrapper = mount(NodeRenderer, {
      props: {
        content: 'Visit [Vue](https://vuejs.org \"Vue Site\") now.',
      },
    })
    await flushAll()

    const link = wrapper.find('a[href=\"https://vuejs.org\"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('title')).toBe('')
  })

  it('inherits showTooltips=false inside list item nested renderer', async () => {
    const wrapper = mount(NodeRenderer, {
      props: {
        content: '- Visit [Vue](https://vuejs.org) now.',
        showTooltips: false,
      },
    })
    await flushAll()

    const link = wrapper.find('a[href=\"https://vuejs.org\"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('title')).toBe('https://vuejs.org')
  })
})
