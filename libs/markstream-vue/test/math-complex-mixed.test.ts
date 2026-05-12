import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../packages/markdown-parser/src'

describe('math complex mixed $ and $$ delimiters', () => {
  it('should parse alternating $ and $$ delimiters correctly', () => {
    const md = getMarkdown('test-complex-mixed')
    const result = parseMarkdownToStructure('数学：$E=mc^2$ 和 $$E=mc^2$$ 和 $E=mc^2$ 和 $$E=mc^2$$', md)

    console.log('Full Result:', JSON.stringify(result, null, 2))

    const paragraph = result[0]
    expect(paragraph?.type).toBe('paragraph')

    const mathNodes = paragraph?.children?.filter(c => c.type === 'math_inline')
    console.log('Math nodes:', JSON.stringify(mathNodes, null, 2))
    console.log('All children:', JSON.stringify(paragraph?.children, null, 2))

    expect(mathNodes).toHaveLength(4)

    // Alternating delimiters should all be recognized
    expect(mathNodes?.[0]?.content).toBe('E=mc^2')
    expect(mathNodes?.[0]?.markup).toBe('$')
    expect(mathNodes?.[1]?.content).toBe('E=mc^2')
    expect(mathNodes?.[1]?.markup).toBe('$$')
    expect(mathNodes?.[2]?.content).toBe('E=mc^2')
    expect(mathNodes?.[2]?.markup).toBe('$')
    expect(mathNodes?.[3]?.content).toBe('E=mc^2')
    expect(mathNodes?.[3]?.markup).toBe('$$')
  })

  it('should parse $$ followed by $ correctly', () => {
    const md = getMarkdown('test-complex-mixed-2')
    const result = parseMarkdownToStructure('数学：$$E=mc^2$$ 和 $E=mc^2$', md)

    const paragraph = result[0]
    expect(paragraph?.type).toBe('paragraph')

    const mathNodes = paragraph?.children?.filter(c => c.type === 'math_inline')

    // Should have 2 math_inline nodes
    expect(mathNodes).toHaveLength(2)

    // First math: $$E=mc^2$$
    expect(mathNodes?.[0]?.content).toBe('E=mc^2')
    expect(mathNodes?.[0]?.markup).toBe('$$')

    // Second math: $E=mc^2$
    expect(mathNodes?.[1]?.content).toBe('E=mc^2')
    expect(mathNodes?.[1]?.markup).toBe('$')
  })

  // Known limitation: When $ comes before $$, the $ gets pushed as text
  // because the $$ rule runs first and processes everything before $$
  // This would require significant refactoring to fix
  it('should parse $ followed by $$ correctly', () => {
    const md = getMarkdown('test-complex-mixed-3')
    const result = parseMarkdownToStructure('数学：$E=mc^2$ 和 $$E=mc^2$$', md)

    const paragraph = result[0]
    expect(paragraph?.type).toBe('paragraph')

    const mathNodes = paragraph?.children?.filter(c => c.type === 'math_inline')

    // Should have 2 math_inline nodes
    expect(mathNodes).toHaveLength(2)

    // First math: $E=mc^2$
    expect(mathNodes?.[0]?.content).toBe('E=mc^2')
    expect(mathNodes?.[0]?.markup).toBe('$')

    // Second math: $$E=mc^2$$
    expect(mathNodes?.[1]?.content).toBe('E=mc^2')
    expect(mathNodes?.[1]?.markup).toBe('$$')
  })
})
