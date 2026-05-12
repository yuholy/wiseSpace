import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure, processTokens } from '../src'

function walkNodes(nodes: any[], visit: (node: any) => void) {
  for (const node of nodes) {
    if (!node)
      continue
    visit(node)
    if (Array.isArray(node.children))
      walkNodes(node.children, visit)
    if (node.type === 'list' && Array.isArray(node.items))
      walkNodes(node.items, visit)
    if (node.type === 'table') {
      if (node.header)
        walkNodes([node.header], visit)
      if (Array.isArray(node.rows))
        walkNodes(node.rows, visit)
    }
    if (node.type === 'table_row' && Array.isArray(node.cells))
      walkNodes(node.cells, visit)
  }
}

describe('hTML allowlist (方案 A)', () => {
  it('renders unknown tag <question> as literal text by default', () => {
    const md = getMarkdown()
    const nodes = parseMarkdownToStructure('Hello <question> world', md, { final: true })
    const para = nodes[0] as any
    expect(para.type).toBe('paragraph')
    const text = (para.children ?? [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.content)
      .join('')
    expect(text).toBe('Hello <question> world')
    expect((para.children ?? []).some((c: any) => c.type === 'html_inline')).toBe(false)
  })

  it('keeps standard HTML tags as html_inline/html_block', () => {
    const md = getMarkdown()
    const nodes = parseMarkdownToStructure('Hello <span>ok</span>', md, { final: true })
    const para = nodes[0] as any
    expect(para.type).toBe('paragraph')
    expect((para.children ?? []).some((c: any) => c.type === 'html_inline' && c.tag === 'span')).toBe(true)

    const block = parseMarkdownToStructure('<div>ok</div>', md, { final: true })
    expect(block[0]?.type).toBe('html_block')
  })

  it('treats tags in customHtmlTags as custom nodes', () => {
    const md = getMarkdown(undefined, { customHtmlTags: ['thinking'] })
    const nodes = parseMarkdownToStructure('before <thinking>hi</thinking> after', md, {
      customHtmlTags: ['thinking'],
      final: true,
    })
    const para = nodes[0] as any
    expect(para.type).toBe('paragraph')
    expect((para.children ?? []).some((c: any) => c.type === 'thinking')).toBe(true)
  })

  it('processTokens also applies the allowlist', () => {
    const md = getMarkdown()
    const tokens = md.parse('Hello <question> world', {})
    const nodes = processTokens(tokens as any, { final: true } as any) as any[]
    const htmlInlineQuestion: any[] = []
    walkNodes(nodes, (node) => {
      if (node.type === 'html_inline' && String(node.tag ?? '').toLowerCase() === 'question')
        htmlInlineQuestion.push(node)
    })
    expect(htmlInlineQuestion.length).toBe(0)
  })
})
