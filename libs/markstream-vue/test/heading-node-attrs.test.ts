import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HeadingNode from '../src/components/HeadingNode/HeadingNode.vue'
import NodeRenderer from '../src/components/NodeRenderer'
import { flushAll } from './setup/flush-all'

describe('headingNode attrs passthrough', () => {
  it('binds node.attrs onto the rendered heading element', async () => {
    const children: any[] = []

    const wrapper = mount(HeadingNode, {
      props: {
        node: {
          type: 'heading',
          level: 2,
          text: '',
          children,
          raw: '',
          attrs: {
            'id': 'my-heading',
            'data-test': 'heading',
          },
        },
      },
    })

    const h2 = wrapper.get('h2')
    expect(h2.attributes('id')).toBe('my-heading')
    expect(h2.attributes('data-test')).toBe('heading')

    await wrapper.setProps({
      node: {
        type: 'heading',
        level: 2,
        text: '',
        children,
        raw: '',
        attrs: {
          id: 'my-heading-2',
        },
      },
    })

    expect(wrapper.get('h2').attributes('id')).toBe('my-heading-2')
  })

  it('supports parseOptions.preTransformTokens injecting id on heading_open', async () => {
    const wrapper = mount(NodeRenderer, {
      props: {
        content: '# Hello',
        typewriter: false,
        batchRendering: false,
        parseOptions: {
          preTransformTokens(tokens: any[]) {
            for (const token of tokens) {
              if (token?.type !== 'heading_open')
                continue
              if (typeof token.attrSet === 'function')
                token.attrSet('id', 'hello-anchor')
              else
                token.attrs = [...(token.attrs ?? []), ['id', 'hello-anchor']]
            }
            return tokens
          },
        },
      },
    })

    await flushAll()
    expect(wrapper.get('h1.heading-node').attributes('id')).toBe('hello-anchor')
  })
})
