import { getMarkdown } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('列表中的数学公式解析测试', () => {
  it('应该正确解析列表项中的数学公式块', () => {
    const md = getMarkdown('test')

    const testContent = `
1. 这是第一个列表项
   \\[
   E = mc^2
   \\]

2. 这是第二个列表项，包含付费转化率公式：
   \\[
   \\text{付费转化率} = \\left( \\frac{\\text{付费用户数}}{\\text{月活用户数}} \\right) \\times 100\\%
   \\]

3. 使用双美元符号的数学公式：
   $$
   \\frac{363}{15,\\!135} \\times 100\\% = 2.398\\%
   $$
`

    const tokens = md.parse(testContent, {})

    // 查找数学块 tokens
    const mathBlocks = tokens.filter(token => token.type === 'math_block')

    console.log('所有 tokens:')
    tokens.forEach((token, i) => {
      console.log(
        `  ${i}: ${token.type} ${token.tag || ''} - ${(
          token.content || ''
        ).slice(0, 50)}...`,
      )
    })

    console.log('\\n数学块详情:')
    mathBlocks.forEach((block, i) => {
      console.log(`  数学块 ${i + 1}:`)
      console.log(`    内容: ${block.content}`)
      console.log(`    标记: ${block.markup}`)
    })

    // 验证是否找到了数学块
    expect(mathBlocks.length).toBe(3)
    expect(mathBlocks[0].content).toContain('E = mc^2')
    expect(mathBlocks[1].content).toContain('付费转化率')
    expect(mathBlocks[2].content).toContain('363')
  })

  it('应该正确解析嵌套列表中的数学公式', () => {
    const md = getMarkdown('test')

    const testContent = `
1. 第一级列表
   - 第二级列表项
     \\[
     x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
     \\]
   - 另一个第二级列表项
     $$
     \\int_0^1 x^2 dx = \\frac{1}{3}
     $$

2. 另一个第一级列表项
   1. 有序嵌套列表
      \\[
      \\sum_{i=1}^n i = \\frac{n(n+1)}{2}
      \\]
`

    const tokens = md.parse(testContent, {})

    // 查找数学块 tokens
    const mathBlocks = tokens.filter(token => token.type === 'math_block')

    console.log('\\n=== 嵌套列表数学公式测试 ===')
    console.log('数学块数量:', mathBlocks.length)
    mathBlocks.forEach((block, i) => {
      console.log(`数学块 ${i + 1}:`)
      console.log(`  内容: ${block.content}`)
      console.log(`  标记: ${block.markup}`)
      console.log('---')
    })

    // 验证是否找到了数学块
    expect(mathBlocks.length).toBe(3)
    expect(mathBlocks[0].content).toContain(
      'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    )
    expect(mathBlocks[1].content).toContain('\\int_0^1 x^2 dx')
    expect(mathBlocks[2].content).toContain('\\sum_{i=1}^n i')
  })
})
