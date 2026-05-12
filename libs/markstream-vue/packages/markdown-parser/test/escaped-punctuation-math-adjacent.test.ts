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

function expectLiteralBracketAndDollar(nodes: any) {
  const text = flattenText(nodes)
  expect(text).toContain('[x]')
  expect(text).toContain('$5$')
}

function expectLiteralDollar(nodes: any) {
  const text = flattenText(nodes)
  expect(text).toContain('$5$')
}

describe('escaped punctuation adjacent to real math parsing', () => {
  it('keeps escaped bracket and dollar literal while parsing later inline math in a paragraph', () => {
    const md = getMarkdown('escaped-punctuation-math-inline')
    const nodes = parseMarkdownToStructure('literal \\[x\\] and \\$5\\$ and real $y$', md, { final: true })

    expectLiteralBracketAndDollar(nodes)
    expect(collect(nodes as any, 'math_inline').length).toBe(1)
  })

  it('keeps escaped bracket and dollar literal while parsing later inline math in a heading', () => {
    const md = getMarkdown('escaped-punctuation-math-heading')
    const nodes = parseMarkdownToStructure('## literal \\[x\\] and \\$5\\$ and real $y$', md, { final: true })

    expect(nodes[0]?.type).toBe('heading')
    expectLiteralBracketAndDollar(nodes)
    expect(collect(nodes as any, 'math_inline').length).toBe(1)
  })

  it('keeps escaped bracket and dollar literal while parsing later inline math in footnotes', () => {
    const md = getMarkdown('escaped-punctuation-math-footnote')
    const markdown = `ref[^1]

[^1]: literal \\[x\\] and \\$5\\$ and real $y$`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true })

    expect(nodes[1]?.type).toBe('footnote')
    expectLiteralBracketAndDollar(nodes[1])
    expect(collect([nodes[1]] as any, 'math_inline').length).toBe(1)
  })

  it('keeps escaped bracket and dollar literal while parsing later inline math after custom tag close', () => {
    const tags = ['thinking']
    const md = getMarkdown('escaped-punctuation-math-custom-inline', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure('Text <thinking>inside</thinking>literal \\[x\\] and \\$5\\$ and real $y$', md, {
      customHtmlTags: tags,
      final: true,
    })

    expect(nodes[0]?.type).toBe('paragraph')
    expect(collect(nodes as any, 'thinking').length).toBe(1)
    expectLiteralBracketAndDollar(nodes)
    expect(collect(nodes as any, 'math_inline').length).toBe(1)
  })

  it('keeps escaped bracket and dollar literal while parsing later inline math in admonitions', () => {
    const md = getMarkdown('escaped-punctuation-math-admonition')
    const markdown = `::: note
literal \\[x\\] and \\$5\\$ and real $y$
:::`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true })

    expect(nodes[0]?.type).toBe('admonition')
    expectLiteralBracketAndDollar(nodes)
    expect(collect(nodes as any, 'math_inline').length).toBe(1)
  })

  it('keeps escaped bracket literal while still parsing a later real bracket math block', () => {
    const md = getMarkdown('escaped-punctuation-bracket-math-block')
    const markdown = `literal \\[x\\]

\\[
y
\\]`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true })

    expect(flattenText(nodes)).toContain('[x]')
    expect(collect(nodes as any, 'math_block').length).toBe(1)
  })

  it('does not treat escaped dollar literal as math when adjacent to real bracket math block', () => {
    const md = getMarkdown('escaped-punctuation-dollar-bracket-block')
    const markdown = `literal \\$5\\$

\\[
y
\\]`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true })

    expect(flattenText(nodes)).toContain('$5$')
    expect(collect(nodes as any, 'math_inline').length).toBe(0)
    expect(collect(nodes as any, 'math_block').length).toBe(1)
  })

  it('keeps escaped dollar and bracket literal inside blockquotes while parsing later inline math', () => {
    const md = getMarkdown('escaped-punctuation-math-blockquote')
    const nodes = parseMarkdownToStructure('> literal \\[x\\] and \\$5\\$ and real $y$', md, { final: true })

    expect(nodes[0]?.type).toBe('blockquote')
    expectLiteralBracketAndDollar(nodes)
    expect(collect(nodes as any, 'math_inline').length).toBe(1)
  })

  it('keeps escaped dollar literal before inline $$ math', () => {
    const md = getMarkdown('escaped-punctuation-before-inline-double-dollar')
    const nodes = parseMarkdownToStructure('literal \\$5\\$ before $$x$$', md, { final: true })

    expectLiteralDollar(nodes)
    const mathNodes = collect(nodes as any, 'math_inline')
    expect(mathNodes.length).toBe(1)
    expect(mathNodes[0]?.markup).toBe('$$')
    expect(mathNodes[0]?.content).toBe('x')
  })

  it('keeps escaped dollar literal after inline $$ math while still parsing later single-dollar math', () => {
    const md = getMarkdown('escaped-punctuation-after-inline-double-dollar')
    const nodes = parseMarkdownToStructure('prefix $$x$$ and literal \\$5\\$ and real $y$', md, { final: true })

    expectLiteralDollar(nodes)
    const mathNodes = collect(nodes as any, 'math_inline')
    expect(mathNodes.length).toBe(2)
    expect(mathNodes[0]?.markup).toBe('$$')
    expect(mathNodes[0]?.content).toBe('x')
    expect(mathNodes[1]?.markup).toBe('$')
    expect(mathNodes[1]?.content).toBe('y')
  })
})
