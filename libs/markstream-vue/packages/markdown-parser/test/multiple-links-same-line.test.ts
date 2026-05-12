import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../src'

function flatten(nodes: any[]): any[] {
  const out: any[] = []
  for (const n of nodes ?? []) {
    out.push(n)
    if (Array.isArray(n?.children))
      out.push(...flatten(n.children))
  }
  return out
}

describe('parseMarkdownToStructure - multiple links same line', () => {
  it('parses 3 adjacent links as 3 link nodes', () => {
    const md = getMarkdown()
    const markdown = '[citation](http://url1)  [citation](http://url1) [citation](http://url1)'
    const nodes = parseMarkdownToStructure(markdown, md)

    const all = flatten(nodes)
    const links = all.filter(n => n?.type === 'link')

    expect(links).toHaveLength(3)
    expect(links.map(l => l.href)).toEqual(['http://url1', 'http://url1', 'http://url1'])
  })
})
