import { describe, expect, it } from 'vitest'
import { parseInlineTokens } from '../src'

function flattenText(nodes: any[]): string {
  const out: string[] = []
  const walk = (n: any) => {
    if (!n)
      return
    if (Array.isArray(n)) {
      n.forEach(walk)
      return
    }
    if (n.type === 'text' && typeof n.content === 'string')
      out.push(n.content)
    if (Array.isArray(n.children))
      n.children.forEach(walk)
    if (Array.isArray(n.items))
      n.items.forEach(walk)
  }
  walk(nodes)
  return out.join('')
}

describe('parseInlineTokens strict strong matching', () => {
  it('default (non-strict) treats unclosed ** as mid-state strong', () => {
    const raw = '[**cxx](xxx)'
    const tokens: any[] = [{ type: 'text', content: raw }]
    const nodes = parseInlineTokens(tokens, raw)
    expect(nodes.length).toBeGreaterThan(0)
    // Expect the parser will create a strong node in non-strict mode
    const first = nodes[0] as any
    expect(first).toBeDefined()
    expect(first.type).toBe('strong')
    expect(first.children?.[0]?.type).toBe('link')
    expect(first.children?.[0]?.text).toContain('cxx')
  })

  it('strict mode keeps original text when no closing ** is found', () => {
    const raw = '[**cxx](xxx)'
    const tokens: any[] = [{ type: 'text', content: raw }]
    const nodes = parseInlineTokens(tokens, raw, undefined, { requireClosingStrong: true })
    expect(nodes.length).toBeGreaterThan(0)
    const first = nodes[0] as any
    expect(first.type).toBe('link')
    expect(first.children[0].content).toBe(raw.match(/\[([^\]]+)\]/)?.[1])
  })

  it('strict mode does not duplicate prefix text before unmatched **', () => {
    const raw = 'foo**bar'
    const tokens: any[] = [{ type: 'text', content: raw }]
    const nodes = parseInlineTokens(tokens, raw, undefined, { requireClosingStrong: true })
    expect(nodes.length).toBeGreaterThan(0)
    const first = nodes[0] as any
    expect(first.type).toBe('text')
    expect(first.content).toBe('foo**bar')
  })

  it('strict mode does not duplicate prefix when unmatched ** is inside link text', () => {
    const raw = '前缀[**cxx](xxx)'
    const tokens: any[] = [{ type: 'text', content: raw }]
    const nodes = parseInlineTokens(tokens, raw, undefined, { requireClosingStrong: true })
    expect(flattenText(nodes as any[])).toBe('前缀**cxx')
  })
})
