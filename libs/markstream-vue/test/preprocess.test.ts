import { describe, expect, it } from 'vitest'

describe('preProcessMarkdown 测试', () => {
  // 导入预处理函数进行测试
  function preProcessMarkdown(markdown: string): string {
    // 使用更精确的正则表达式来匹配数学公式块
    // 匹配 \[ ... \] 格式的数学公式块
    return markdown.replace(/\\?\[[\s\S]*?\\?\]/g, (match) => {
      // 如果已经是转义的反斜杠，不需要再处理
      if (match.startsWith('\\\\[')) {
        return match
      }

      // 处理单反斜杠的情况，将其转换为双反斜杠以保护数学公式内容
      let processed = match

      // 保护数学公式中的反斜杠命令
      processed = processed.replace(
        /\\(text|frac|left|right|times|sqrt|sum|int|alpha|beta|gamma|delta|theta|lambda|mu|sigma|pi|infty)/g,
        '\\\\$1',
      )

      // 保护其他常见的反斜杠字符
      processed = processed.replace(/\\([{}()[\]|&%$#_^~])/g, '\\\\$1')

      return processed
    })
  }

  it('应该正确保护数学公式中的反斜杠', () => {
    const input = `\\[
\\text{付费转化率} = \\left( \\frac{\\text{付费用户数}}{\\text{月活用户数}} \\right) \\times 100\\%
\\]`

    const processed = preProcessMarkdown(input)

    console.log('原始输入:', JSON.stringify(input))
    console.log('处理后:', JSON.stringify(processed))

    // 验证反斜杠被正确保护
    expect(processed).toContain('\\\\text{付费转化率}')
    expect(processed).toContain('\\\\left(')
    expect(processed).toContain('\\\\right)')
    expect(processed).toContain('\\\\frac{')
    expect(processed).toContain('\\\\times')
  })

  it('应该处理列表中的数学公式', () => {
    const input = `1. **公式**  
   \\[
   \\text{付费转化率} = \\left( \\frac{\\text{付费用户数}}{\\text{月活用户数}} \\right) \\times 100\\%
   \\]`

    const processed = preProcessMarkdown(input)

    console.log('列表输入:', JSON.stringify(input))
    console.log('列表处理后:', JSON.stringify(processed))

    expect(processed).toContain('\\\\text{付费转化率}')
    expect(processed).toContain('\\\\right)')
  })
})
