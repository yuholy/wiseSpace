import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('custom html close followed by block markers (same line)', () => {
  const tags = ['think']
  const md = getMarkdown('custom-html-close-followed-by-block-markers', { customHtmlTags: tags })
  const prefix = '<think>t</think>'

  type Case
    = | { label: string, suffix: string, expectedType: string }
      | { label: string, markdown: string, expectedType: string }

  const cases: Case[] = [
    { label: 'heading', suffix: '## h', expectedType: 'heading' },
    { label: 'bullet list', suffix: '- a', expectedType: 'list' },
    { label: 'ordered list', suffix: '1. a', expectedType: 'list' },
    { label: 'blockquote', suffix: '> q', expectedType: 'blockquote' },
    { label: 'fence', suffix: '```js\nx\n```', expectedType: 'code_block' },
    { label: 'table', suffix: '| a | b |\n| - | - |\n| 1 | 2 |', expectedType: 'table' },
    { label: 'thematic break', suffix: '---', expectedType: 'thematic_break' },
    { label: 'admonition', suffix: '::: tip\nx\n:::', expectedType: 'admonition' },
    { label: 'math block', suffix: '$$\n1+1\n$$', expectedType: 'math_block' },
  ]

  // Footnote definitions only become a structured "footnote" node when there is
  // a corresponding reference in the document.
  cases.push({
    label: 'footnote',
    markdown: `A[^1].\n\n${prefix}[^1]: x`,
    expectedType: 'footnote',
  })

  const normalizedCases = cases.map((c) => {
    if ('markdown' in c)
      return c
    return { label: c.label, markdown: `${prefix}${c.suffix}`, expectedType: c.expectedType }
  })

  for (const c of normalizedCases) {
    it(`splits boundary for ${c.label}`, () => {
      const nodes = parseMarkdownToStructure(c.markdown, md, { customHtmlTags: tags, final: true }) as any[]
      expect(nodes.some(n => n?.type === c.expectedType)).toBe(true)
    })
  }
})
