import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('math plugin - bracket delimiter false positives', () => {
  it('should not treat JSON arrays as bracket-math blocks', () => {
    const md = getMarkdown('json-array')
    const markdown = `
[
  { "a": 1 },
  { "b": 2 }
]
`
    const tokens = md.parse(markdown, { __markstreamFinal: true }) as any[]
    expect(tokens.some(t => t?.type === 'math_block')).toBe(false)

    const nodes = parseMarkdownToStructure(markdown, md, { final: true })
    expect(nodes.some(n => n.type === 'math_block')).toBe(false)
  })

  it('should not treat numeric arrays as bracket-math blocks', () => {
    const md = getMarkdown('number-array')
    const markdown = `
[
  1,
  2
]
`
    const tokens = md.parse(markdown, { __markstreamFinal: true }) as any[]
    expect(tokens.some(t => t?.type === 'math_block')).toBe(false)

    const nodes = parseMarkdownToStructure(markdown, md, { final: true })
    expect(nodes.some(n => n.type === 'math_block')).toBe(false)
  })
})
