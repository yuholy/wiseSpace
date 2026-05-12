import { describe, expect, it } from 'vitest'
import { parseNestedMarkdownToNodes } from '../packages/markstream-vue2/src/utils/nestedNodes'

describe('vue2 nested nodes helper', () => {
  it('returns a shallow copy when nodes are already provided', () => {
    const nodes = [
      {
        type: 'paragraph',
        raw: '',
        children: [
          { type: 'text', raw: '', content: 'hello' },
        ],
      },
    ] as any[]

    const parsed = parseNestedMarkdownToNodes({ nodes })

    expect(parsed).toEqual(nodes)
    expect(parsed).not.toBe(nodes)
  })

  it('prefers existing node children over reparsing content', () => {
    const parsed = parseNestedMarkdownToNodes({
      node: {
        type: 'thinking',
        raw: '',
        content: 'should not be used',
        children: [
          {
            type: 'paragraph',
            raw: '',
            children: [
              { type: 'text', raw: '', content: 'nested child' },
            ],
          },
        ],
      } as any,
    })

    expect(parsed).toHaveLength(1)
    expect((parsed[0] as any).type).toBe('paragraph')
    expect(((parsed[0] as any).children?.[0] as any)?.content).toBe('nested child')
  })

  it('parses streaming custom-tag content into stable nested nodes', () => {
    const partial = parseNestedMarkdownToNodes(
      {
        content: '<thinking>streaming body',
      },
      {
        cacheKey: 'vue2-nested-nodes-streaming',
        customHtmlTags: ['thinking'],
        final: false,
      },
    ) as any[]

    expect(partial).toHaveLength(1)
    expect(partial[0]?.type).toBe('thinking')
    expect(partial[0]?.loading).toBe(true)
    expect(String(partial[0]?.content || '')).toContain('streaming body')

    const complete = parseNestedMarkdownToNodes(
      {
        content: '<thinking>before\n\n- item</thinking>',
      },
      {
        cacheKey: 'vue2-nested-nodes-complete',
        customHtmlTags: ['thinking'],
        final: true,
      },
    ) as any[]

    expect(complete).toHaveLength(1)
    expect(complete[0]?.type).toBe('thinking')
    expect(complete[0]?.loading).toBe(false)
    expect(String(complete[0]?.content || '')).toContain('- item')
  })
})
