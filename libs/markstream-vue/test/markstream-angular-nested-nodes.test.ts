import { describe, expect, it } from 'vitest'
import { parseNestedMarkdownToNodes } from '../packages/markstream-angular/src/parseNestedMarkdownToNodes'

describe('markstream-angular nested nodes helper', () => {
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
        cacheKey: 'markstream-angular-nested-nodes-streaming',
        customHtmlTags: ['thinking'],
        final: false,
      },
    ) as any[]

    expect(partial).toHaveLength(1)
    expect(partial[0]?.type).toBe('thinking')
    expect(partial[0]?.loading).toBe(true)
    expect(String(partial[0]?.content || '')).toContain('streaming body')
  })

  it('keeps mermaid and code blocks available inside thinking content', () => {
    const topLevel = parseNestedMarkdownToNodes(
      {
        content: `<thinking>
## Nested Mermaid

\`\`\`mermaid
flowchart TD
  A --> B
\`\`\`

\`\`\`ts
export const ready = true
\`\`\`
</thinking>`,
      },
      {
        cacheKey: 'markstream-angular-nested-nodes-thinking-heavy',
        customHtmlTags: ['thinking'],
        final: true,
      },
    ) as any[]

    expect(topLevel).toHaveLength(1)
    expect(topLevel[0]?.type).toBe('thinking')

    const innerNodes = parseNestedMarkdownToNodes(
      {
        node: topLevel[0],
      },
      {
        cacheKey: 'markstream-angular-nested-nodes-thinking-heavy-inner',
        customHtmlTags: ['thinking'],
        final: true,
      },
    ) as any[]

    expect(innerNodes.map(node => node?.type)).toContain('heading')
    const codeBlocks = innerNodes.filter(node => node?.type === 'code_block')
    expect(codeBlocks).toHaveLength(2)
    expect(codeBlocks.map(node => node?.language)).toEqual(['mermaid', 'ts'])
  })
})
