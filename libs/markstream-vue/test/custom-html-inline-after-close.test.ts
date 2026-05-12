import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('custom html block followed by inline text (same line)', () => {
  const md = getMarkdown('custom-html-inline-after-close', { customHtmlTags: ['thinking'] })
  const prefix = `<thinking>inside\n\nmore</thinking>我是`

  it('wraps trailing inline tokens into a paragraph (no stray root-level inline nodes)', () => {
    const markdown = `${prefix}**潮位站潮位预报智能体**，专门负责为您提供镇海潮位站的潮位预报服务。`

    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: ['thinking'] }) as any[]

    expect(nodes[0].type).toBe('thinking')
    expect(nodes[1].type).toBe('paragraph')
    expect(nodes[1].children?.map((n: any) => n.type)).toEqual(['text', 'strong', 'text'])
    expect(nodes[1].children?.[0]?.content).toBe('我是')
    expect(nodes[1].children?.[1]?.children?.[0]?.content).toBe('潮位站潮位预报智能体')
  })

  it('does not reintroduce the newline for other inline forms', () => {
    const cases: Array<{ label: string, suffix: string, mustContainType: string }> = [
      { label: 'plain text', suffix: '普通文本。', mustContainType: 'text' },
      { label: 'emphasis', suffix: '*x*。', mustContainType: 'emphasis' },
      { label: 'strong+em', suffix: '***xx***。', mustContainType: 'strong' },
      { label: 'inline code', suffix: '`code`。', mustContainType: 'inline_code' },
      { label: 'link', suffix: '[a](https://example.com)。', mustContainType: 'link' },
      { label: 'strikethrough', suffix: '~~del~~。', mustContainType: 'strikethrough' },
    ]

    for (const c of cases) {
      const nodes = parseMarkdownToStructure(`${prefix}${c.suffix}`, md, { customHtmlTags: ['thinking'] }) as any[]
      expect(nodes[0].type, c.label).toBe('thinking')
      expect(nodes[1].type, c.label).toBe('paragraph')
      expect(nodes.length, c.label).toBe(2)

      const childTypes = (nodes[1].children ?? []).map((n: any) => n?.type).filter(Boolean)
      expect(childTypes, c.label).toContain(c.mustContainType)
    }
  })
})
