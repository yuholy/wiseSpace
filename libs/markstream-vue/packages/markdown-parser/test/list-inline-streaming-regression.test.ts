import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../src'

function collectByType(nodes: any, type: string, out: any[] = []) {
  if (!nodes)
    return out
  if (Array.isArray(nodes)) {
    nodes.forEach(node => collectByType(node, type, out))
    return out
  }
  if (nodes.type === type)
    out.push(nodes)
  if (Array.isArray(nodes.children))
    nodes.children.forEach((child: any) => collectByType(child, type, out))
  if (Array.isArray(nodes.items))
    nodes.items.forEach((item: any) => collectByType(item, type, out))
  return out
}

function collectText(nodes: any) {
  return collectByType(nodes, 'text')
    .map((node: any) => String(node.content ?? ''))
    .join('')
}

function expectListStreamingTextToStayVisible(options: {
  id: string
  full: string
  explanation: string
  suffix: string
  protectedType?: string
}) {
  const md = getMarkdown(options.id)
  const explanationReadyAt = options.full.indexOf(options.explanation) + options.explanation.length
  const suffixStartAt = options.full.indexOf(options.suffix)

  for (let i = explanationReadyAt; i <= options.full.length; i++) {
    const chunk = options.full.slice(0, i)
    const nodes = parseMarkdownToStructure(chunk, md, { final: false })
    const text = collectText(nodes)

    expect(text, `prefix(${i}): ${chunk}`).toContain(options.explanation)
    expect(text.match(new RegExp(options.explanation, 'g')) ?? [], `prefix(${i}): ${chunk}`).toHaveLength(1)

    if (i > suffixStartAt) {
      const expectedSuffix = options.full.slice(suffixStartAt, i)
      expect(text, `prefix(${i}): ${chunk}`).toContain(expectedSuffix)

      if (options.protectedType) {
        const protectedNodes = collectByType(nodes, options.protectedType)
        expect(
          protectedNodes.some((node: any) => JSON.stringify(node).includes(expectedSuffix)),
          `prefix(${i}): ${chunk}`,
        ).toBe(false)
      }
    }
  }
}

describe('list inline streaming regression', () => {
  it('keeps explanatory list text stable while inline code opens, grows, closes, and is followed by more text', () => {
    const full = `- **计算工具验证**
   通过数学计算工具确认结果：
   \`363 ÷ 15,135 × 100 = 2.39841427...\`
   后续说明继续输出`

    expectListStreamingTextToStayVisible({
      id: 'list-inline-code-streaming-regression',
      full,
      explanation: '通过数学计算工具确认结果：',
      suffix: '后续说明继续输出',
      protectedType: 'inline_code',
    })
  })

  it('keeps explanatory list text stable while an inline link opens, closes, and is followed by more text', () => {
    const full = `- **链接验证**
   通过链接工具确认结果：
   [查看详情](https://example.com)
   后续说明继续输出`

    expectListStreamingTextToStayVisible({
      id: 'list-inline-link-streaming-regression',
      full,
      explanation: '通过链接工具确认结果：',
      suffix: '后续说明继续输出',
      protectedType: 'link',
    })
  })

  it('keeps explanatory list text stable while emphasis opens, closes, and is followed by more text', () => {
    const full = `- **强调说明**
   通过人工复核确认结果：
   *结果待确认*
   后续说明继续输出`

    expectListStreamingTextToStayVisible({
      id: 'list-emphasis-streaming-regression',
      full,
      explanation: '通过人工复核确认结果：',
      suffix: '后续说明继续输出',
      protectedType: 'emphasis',
    })
  })

  it('keeps explanatory list text stable while inline math closes and is followed by more text', () => {
    const full = `- **数学验证**
   通过公式确认结果：
   $x^2 + y^2$
   后续说明继续输出`

    expectListStreamingTextToStayVisible({
      id: 'list-math-inline-streaming-regression',
      full,
      explanation: '通过公式确认结果：',
      suffix: '后续说明继续输出',
      protectedType: 'math_inline',
    })
  })

  it('keeps explanatory list text stable while a numeric reference appears and is followed by more text', () => {
    const full = `- **参考验证**
   通过参考编号确认结果：
   [1]
   后续说明继续输出`

    expectListStreamingTextToStayVisible({
      id: 'list-reference-streaming-regression',
      full,
      explanation: '通过参考编号确认结果：',
      suffix: '后续说明继续输出',
      protectedType: 'reference',
    })
  })
})
