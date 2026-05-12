import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../src'
import { fixTableTokens } from '../src/plugins/fixTableTokens'

describe('table loading mid-states', () => {
  it('recognizes spaced separator rows as loading tables', () => {
    const md = getMarkdown('table-loading-spaced-separator')
    const markdown = `# 表格
|列1|列2|列3|列4|列5|
| - | - | - | - | `

    const nodes = parseMarkdownToStructure(markdown, md, { final: false }) as any[]
    const table = nodes.find(node => node.type === 'table') as any

    expect(table).toBeTruthy()
    expect(table.loading).toBe(true)
    expect(table.header.cells.map((cell: any) => cell.raw)).toEqual(['列1', '列2', '列3', '列4', '列5'])
  })

  it('keeps header cells when the separator row is only partially typed', () => {
    const md = getMarkdown('table-loading-partial-separator')
    const markdown = `# 表格
|列1|列2|列3|列4|列5|
|:-`

    const nodes = parseMarkdownToStructure(markdown, md, { final: false }) as any[]
    const table = nodes.find(node => node.type === 'table') as any

    expect(table).toBeTruthy()
    expect(table.loading).toBe(true)
    expect(table.header.cells.map((cell: any) => cell.raw)).toEqual(['列1', '列2', '列3', '列4', '列5'])
  })

  it('fixes inline fallback tables with spaced alignment markers', () => {
    const tokens = [
      { type: 'paragraph_open', tag: 'p' },
      { type: 'inline', tag: '', content: '|列1|列2|列3|\n| :- | :-: | -: |', children: null },
      { type: 'paragraph_close', tag: 'p' },
    ] as any[]

    const fixed = fixTableTokens(tokens)

    expect(fixed[0]?.type).toBe('table_open')
    expect(fixed[0]?.loading).toBe(true)
    expect(fixed.filter(token => token.type === 'th_open')).toHaveLength(3)
    expect(fixed.filter(token => token.type === 'inline').map(token => token.content)).toEqual(['列1', '列2', '列3'])
  })

  it('does not hang on long malformed separator rows', { timeout: 500 }, () => {
    const tokens = [
      { type: 'paragraph_open', tag: 'p' },
      {
        type: 'inline',
        tag: '',
        content: `|${'列|'.repeat(4000)}\n|${' :-'.repeat(4000)}`,
        children: [{}, {}, {}],
      },
      { type: 'paragraph_close', tag: 'p' },
    ] as any[]

    const fixed = fixTableTokens(tokens)

    expect(fixed).toHaveLength(3)
    expect(fixed[1]?.type).toBe('inline')
  })
})
