import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('parseMarkdownToStructure - numeric-only markdown', () => {
  const md = getMarkdown('numeric-only')

  it('does not drop a document that is only digits in streaming mode (final=false)', () => {
    const nodes = parseMarkdownToStructure('1234567', md)
    expect(nodes.length).toBeGreaterThan(0)
    expect(JSON.stringify(nodes)).toContain('1234567')
  })

  it('parses digits-only markdown in final mode as well', () => {
    const nodes = parseMarkdownToStructure('1234567', md, { final: true })
    expect(nodes.length).toBeGreaterThan(0)
    expect(JSON.stringify(nodes)).toContain('1234567')
  })
})
