/**
 * @vitest-environment jsdom
 */

import { mount } from '@vue/test-utils'
import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'
import HeadingNode from '../packages/markstream-vue2/src/components/HeadingNode/HeadingNode.vue'
import { flushAll } from './setup/flush-all'

describe('vue2 - HeadingNode attrs passthrough', () => {
  it('supports parseOptions.preTransformTokens injecting id on heading_open', async () => {
    const md = getMarkdown('vue2-heading-node-attrs-test')
    const nodes = parseMarkdownToStructure('# Hello', md, {
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
    })

    const node = nodes[0] as any

    const wrapper = mount(HeadingNode, {
      props: {
        node,
      },
    })

    await flushAll()
    expect(wrapper.get('h1.heading-node').attributes('id')).toBe('hello-anchor')
  })
})
