import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

function collectLinks(nodes: any[]) {
  const out: any[] = []
  const walk = (n: any) => {
    if (!n)
      return
    if (n.type === 'link')
      out.push(n)
    if (Array.isArray(n.children))
      n.children.forEach(walk)
    if (Array.isArray(n.items))
      n.items.forEach(walk)
    if (n.type === 'table') {
      n.rows.forEach(walk)
      n.header.cells.forEach(walk)
    }
    else if (n.type === 'table_row') {
      n.cells.forEach(walk)
    }
  }
  nodes.forEach(walk)
  return out
}

describe('parseMarkdownToStructure - multiple links same line', () => {
  it('parses 3 adjacent links as 3 link nodes', () => {
    const md = getMarkdown('multiple-links-same-line')
    const markdown = '[citation](http://url1)  [citation](http://url1) [citation](http://url1)'
    const nodes = parseMarkdownToStructure(markdown, md)

    const links = collectLinks(nodes)
    expect(links).toHaveLength(3)
    expect(links.map(l => l.href)).toEqual(['http://url1', 'http://url1', 'http://url1'])
  })
})
