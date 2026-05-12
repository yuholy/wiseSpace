import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it, vi } from 'vitest'

describe('html full document nesting', () => {
  const md = getMarkdown('html-full-document-nested')
  const fixture = resolve(__dirname, 'fixtures', 'html-full-document-nested.md')

  it('parses a full HTML document as one complete html_block with nested levels intact', () => {
    const markdown = readFileSync(fixture, 'utf8')
    const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(nodes).toHaveLength(1)
    expect(nodes[0].type).toBe('html_block')
    expect(nodes[0].tag).toBe('html')
    expect(nodes[0].loading).toBe(false)

    const html = String(nodes[0].raw ?? nodes[0].content ?? '')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html>')
    expect(html).toContain('<head>')
    expect(html).toContain('<body>')
    expect(html).toContain('<table>')
    expect(html).toContain('<tr>')
    expect(html).toContain('<td>')
    expect(html).toContain('<div class="chart-container">')
    expect(html).toContain('<div id="exceptionChart"></div>')
    expect(html).toContain('myChart.setOption(option);')
    expect(html).toContain('</html>')

    expect(nodes.some(n => n.type === 'code_block' || n.type === 'fence')).toBe(false)
  })

  it('keeps a complete html document as a single html_block in streaming mode too', () => {
    const markdown = readFileSync(fixture, 'utf8')
    const nodes = parseMarkdownToStructure(markdown, md, { final: false }) as any[]

    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type).toBe('html_block')
    expect(nodes[0]?.tag).toBe('html')
    expect(nodes[0]?.loading).toBe(false)
  })

  it('keeps token hooks active while preserving single html_block shape', () => {
    const markdown = readFileSync(fixture, 'utf8')
    const preTransformTokens = vi.fn((tokens: any[]) => tokens)
    const nodes = parseMarkdownToStructure(markdown, md, { final: true, preTransformTokens }) as any[]
    expect(preTransformTokens).toHaveBeenCalledTimes(1)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type).toBe('html_block')
    expect(nodes[0]?.tag).toBe('html')
    expect(nodes[0]?.loading).toBe(false)
  })
})
