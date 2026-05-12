import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

function nodeToText(node: any): string {
  if (!node)
    return ''
  if (typeof node.raw === 'string' && node.raw)
    return node.raw
  if (typeof node.content === 'string' && node.content)
    return node.content
  if (Array.isArray(node.children)) {
    return node.children
      .map((c: any) => (typeof c?.content === 'string' ? c.content : (typeof c?.raw === 'string' ? c.raw : '')))
      .join('')
  }
  return ''
}

describe('parseMarkdownToStructure - JSON object text', () => {
  it('should not emit unexpected leading nodes', () => {
    const md = getMarkdown('json-test')
    // Regression: a JSON line ending with `[` (e.g. `"question": [`) used to
    // be mis-detected as a bracket-math block starter and would inject leading
    // top-level `text` tokens (duplicating `"question": ` as paragraphs).
    const markdown = `
{
 "summarize": "demo",
 "question": [
  "q1",
  "q2"
 ]
}
`

    // Mirror the playground setup: `final` defaults to false and custom tags are enabled.
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: ['thinking'] })
    expect(nodes.length).toBeGreaterThan(0)

    // Leading blank lines should not create nodes.
    const first = nodes[0]
    expect(first?.type).not.toBe('thematic_break')
    const firstText = nodeToText(first)
    expect(firstText.trim().length).toBeGreaterThan(0)
    expect(firstText.trimStart().startsWith('{')).toBe(true)

    const tokens = md.parse(markdown, { __markstreamFinal: false }) as any[]
    expect(tokens[0]?.type).not.toBe('text')
  })
})
