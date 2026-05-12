import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('custom html close followed by heading marker (same line)', () => {
  const md = getMarkdown('custom-html-close-heading-same-line', { customHtmlTags: ['think'] })

  it('parses the trailing "##" as a heading node (not plain text)', () => {
    const markdown = `<think>让我思考一下</think>## 我是潮位站潮位预报智能体，\n专门负责为您提供镇海潮位站的潮位预报服务。`
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: ['think'], final: true }) as any[]

    // The custom tag can be represented as a root node (html_block) or as an inline
    // custom node wrapped in a paragraph depending on markdown-it tokenization.
    const hasThinkRoot = nodes[0]?.type === 'think'
    const hasThinkInline = nodes[0]?.type === 'paragraph'
      && Array.isArray(nodes[0]?.children)
      && nodes[0].children.some((c: any) => c?.type === 'think' && c?.loading === false)

    expect(hasThinkRoot || hasThinkInline).toBe(true)

    expect(nodes[1].type).toBe('heading')
    expect(nodes[1].level).toBe(2)
    expect(nodes[1].text).toContain('我是潮位站潮位预报智能体')
  })
})
