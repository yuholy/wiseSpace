import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../packages/markdown-parser/src'

describe('math mixed $ and $$ delimiters', () => {
  it('should parse both $ and $$ in the same line', () => {
    const md = getMarkdown('test-mixed-delimiters')
    const result = parseMarkdownToStructure('数学：$$E=mc^2$$ 和 $1$', md)

    console.log('Full Result:', JSON.stringify(result, null, 2))

    const paragraph = result[0]
    expect(paragraph?.type).toBe('paragraph')

    const mathNodes = paragraph?.children?.filter(c => c.type === 'math_inline')
    console.log('Math nodes:', JSON.stringify(mathNodes, null, 2))
    console.log('All children:', JSON.stringify(paragraph?.children, null, 2))

    // Should have 2 math_inline nodes
    expect(mathNodes).toHaveLength(2)
    expect(mathNodes?.[0]?.content).toBe('E=mc^2')
    expect(mathNodes?.[0]?.markup).toBe('$$')
    expect(mathNodes?.[1]?.content).toBe('1')
    expect(mathNodes?.[1]?.markup).toBe('$')
  })
})
