import { describe, expect, it } from 'vitest'
import { collect } from '../../../test/utils/midstate-utils'
import { getMarkdown, parseMarkdownToStructure } from '../src'

function flattenText(nodes: any): string {
  const parts: string[] = []
  const seen = new Set<any>()

  const walk = (node: any) => {
    if (!node || seen.has(node))
      return
    seen.add(node)

    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }

    if (node.type === 'text' && typeof node.content === 'string')
      parts.push(node.content)

    if (Array.isArray(node.children))
      node.children.forEach(walk)
    if (Array.isArray(node.items))
      node.items.forEach(walk)
    if (Array.isArray(node.rows))
      node.rows.forEach(walk)
    if (Array.isArray(node.cells))
      node.cells.forEach(walk)
    if (Array.isArray(node.term))
      node.term.forEach(walk)
    if (Array.isArray(node.definition))
      node.definition.forEach(walk)
    if (node.header)
      walk(node.header)
  }

  walk(nodes)
  return parts.join('')
}

function expectEscapedPunctuationLiteral(nodes: any) {
  const text = flattenText(nodes)
  const nodeList = Array.isArray(nodes) ? nodes : [nodes]
  expect(text).toContain('[x]')
  expect(text).toContain('_y_')
  expect(text).toContain('$z$')
  expect(text).toContain('\\')
  expect(collect(nodeList as any, 'math_inline').length).toBe(0)
  expect(collect(nodeList as any, 'strong').length).toBe(0)
}

describe('escaped punctuation in nested contexts', () => {
  const escapedLiteral = '\\[x\\] \\_y\\_ \\$z\\$ \\\\'

  it('keeps escaped punctuation literal inside headings', () => {
    const md = getMarkdown('escaped-punctuation-heading')
    const nodes = parseMarkdownToStructure(`## ${escapedLiteral}`, md, { final: true })

    expect(nodes[0]?.type).toBe('heading')
    expectEscapedPunctuationLiteral(nodes)
    expect(collect(nodes as any, 'emphasis').length).toBe(0)
  })

  it('keeps escaped punctuation literal inside link text', () => {
    const md = getMarkdown('escaped-punctuation-link')
    const nodes = parseMarkdownToStructure(`[${escapedLiteral}](https://example.com)`, md, { final: true })

    expect(collect(nodes as any, 'link').length).toBe(1)
    expectEscapedPunctuationLiteral(nodes)
    expect(collect(nodes as any, 'emphasis').length).toBe(0)
  })

  it('keeps escaped punctuation literal inside footnotes', () => {
    const md = getMarkdown('escaped-punctuation-footnote')
    const markdown = `ref[^1]

[^1]: ${escapedLiteral}`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true })

    expect(nodes[1]?.type).toBe('footnote')
    expectEscapedPunctuationLiteral(nodes[1])
    expect(collect([nodes[1]] as any, 'emphasis').length).toBe(0)
  })

  it('keeps escaped punctuation literal after custom tag close on the same line', () => {
    const tags = ['thinking']
    const md = getMarkdown('escaped-punctuation-custom-inline', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(`Text <thinking>inside</thinking>${escapedLiteral}`, md, {
      customHtmlTags: tags,
      final: true,
    })

    expect(nodes[0]?.type).toBe('paragraph')
    expect(collect(nodes as any, 'thinking').length).toBe(1)
    expectEscapedPunctuationLiteral(nodes)
    expect(collect(nodes as any, 'emphasis').length).toBe(0)
  })

  it('keeps escaped punctuation literal inside admonition content', () => {
    const md = getMarkdown('escaped-punctuation-admonition')
    const markdown = `::: note
${escapedLiteral}
:::`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true })

    expect(nodes[0]?.type).toBe('admonition')
    expectEscapedPunctuationLiteral(nodes)
    expect(collect(nodes as any, 'emphasis').length).toBe(0)
  })

  it('still parses later real emphasis after escaped punctuation inside headings', () => {
    const md = getMarkdown('escaped-punctuation-heading-emphasis')
    const nodes = parseMarkdownToStructure(`## ${escapedLiteral} *real*`, md, { final: true })

    expect(nodes[0]?.type).toBe('heading')
    expectEscapedPunctuationLiteral(nodes)
    expect(collect(nodes as any, 'emphasis').length).toBe(1)
  })

  it('still parses later real emphasis after escaped punctuation inside link text', () => {
    const md = getMarkdown('escaped-punctuation-link-emphasis')
    const nodes = parseMarkdownToStructure(`[${escapedLiteral} *real*](https://example.com)`, md, { final: true })

    expect(collect(nodes as any, 'link').length).toBe(1)
    expectEscapedPunctuationLiteral(nodes)
    expect(collect(nodes as any, 'emphasis').length).toBe(1)
  })

  it('still parses later real emphasis after escaped punctuation inside footnotes', () => {
    const md = getMarkdown('escaped-punctuation-footnote-emphasis')
    const markdown = `ref[^1]

[^1]: ${escapedLiteral} *real*`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true })

    expect(nodes[1]?.type).toBe('footnote')
    expectEscapedPunctuationLiteral(nodes[1])
    expect(collect([nodes[1]] as any, 'emphasis').length).toBe(1)
  })

  it('still parses later real emphasis after escaped punctuation after custom tag close', () => {
    const tags = ['thinking']
    const md = getMarkdown('escaped-punctuation-custom-inline-emphasis', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(`Text <thinking>inside</thinking>${escapedLiteral} *real*`, md, {
      customHtmlTags: tags,
      final: true,
    })

    expect(nodes[0]?.type).toBe('paragraph')
    expect(collect(nodes as any, 'thinking').length).toBe(1)
    expectEscapedPunctuationLiteral(nodes)
    expect(collect(nodes as any, 'emphasis').length).toBe(1)
  })

  it('still parses later real emphasis after escaped punctuation inside admonition content', () => {
    const md = getMarkdown('escaped-punctuation-admonition-emphasis')
    const markdown = `::: note
${escapedLiteral} *real*
:::`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true })

    expect(nodes[0]?.type).toBe('admonition')
    expectEscapedPunctuationLiteral(nodes)
    expect(collect(nodes as any, 'emphasis').length).toBe(1)
  })
})
