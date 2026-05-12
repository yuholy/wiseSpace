import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../src'

function collectTexts(n: any): string[] {
  if (!n)
    return []
  if (Array.isArray(n))
    return n.flatMap(collectTexts)
  if (typeof n === 'string')
    return [n]
  const texts: string[] = []
  if (n.type === 'text' && typeof n.content === 'string')
    texts.push(n.content)
  if (n.children && Array.isArray(n.children))
    texts.push(...n.children.flatMap(collectTexts))
  if (n.items && Array.isArray(n.items))
    texts.push(...n.items.flatMap(collectTexts))
  return texts
}

function countOccurrences(nodes: any, needle: string) {
  const allTexts = collectTexts(nodes).join('\n')
  return (allTexts.match(new RegExp(needle, 'g')) || []).length
}

describe('parseMarkdownToStructure - duplicate question rendering', () => {
  it('does not duplicate the question text when parsing mixed math/ce commands', () => {
    const md = getMarkdown()

    const markdown = `**当堂检测**：
1. 下列物质属于酚的是（ ）
   A. $\ce{CH3CH2OH}$  B. $\ce{C6H5CH2OH}$  C. $\ce{}$  D. $\ce{HO-CH2-CH2OH}$
   **答案**：C`

    const nodes = parseMarkdownToStructure(markdown, md)
    const allTexts = collectTexts(nodes).join('\n')
    console.log('All texts:', JSON.stringify(allTexts, null, 2))
    // Count occurrences of the core question string
    expect(countOccurrences(nodes, '下列物质属于酚的是')).toBe(1)
  })

  const streamingCases = [
    {
      name: 'plain text prefix before $$ math',
      markdown: `第（1）题  
题干解析：本题考查利用导数求含参函数的极值，核心条件为函数 $$ f(x) = \\ln x - m + \\dfrac{m}{x} $$（$$ m \\in \\mathbb{R} $$）`,
      needle: '第（1）题',
    },
    {
      name: 'plain text prefix before $ math',
      markdown: `第（2）题  
已知函数 $f(x)=x^2$，求导数。`,
      needle: '第（2）题',
    },
    {
      name: 'plain text prefix before \\( \\) math',
      markdown: String.raw`第（3）题  
若 \(a+b=1\)，求 \(ab\) 的值。`,
      needle: '第（3）题',
    },
    {
      name: 'strong prefix before $$ math',
      markdown: `**第（4）题**  
题干解析：函数 $$x^2$$ 的图像。`,
      needle: '第（4）题',
    },
    {
      name: 'markdown link prefix before $ math',
      markdown: `[第（5）题](https://example.com)  
题干解析：函数 $x^2$ 的图像。`,
      needle: '第（5）题',
    },
    {
      name: 'inline html prefix before $$ math',
      markdown: `<span>第（6）题</span>  
题干解析：函数 $$x^2$$ 的图像。`,
      needle: '第（6）题',
    },
  ] as const

  for (const testCase of streamingCases) {
    it(`does not duplicate the hardbreak prefix for ${testCase.name} while streaming`, () => {
      const md = getMarkdown()
      const nodes = parseMarkdownToStructure(testCase.markdown, md)

      expect(countOccurrences(nodes, testCase.needle)).toBe(1)
    })
  }
})
