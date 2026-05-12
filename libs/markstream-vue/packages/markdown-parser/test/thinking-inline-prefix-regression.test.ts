import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../src'

describe('thinking custom tag after inline html prefix', () => {
  const thinkingContent = String.raw`勾股定理是数学中一个非常重要的定理，尤其在几何学中有着广泛的应用。它描述了直角三角形三边之间的关系。

### 勾股定理的定义：
在**直角三角形**中，斜边（即与直角相对的边）的平方等于另外两条直角边的平方和。

用公式表示为：

$$
a^2 + b^2 = c^2
$$

其中：
- $ a $ 和 $ b $ 是直角三角形的两条直角边；
- $ c $ 是斜边（即最长的一条边）。

---

### 举例说明：
比如一个直角三角形，两条直角边分别是3和4，那么斜边 $ c $ 可以通过勾股定理计算得出：

$$
c = \sqrt{3^2 + 4^2} = \sqrt{9 + 16} = \sqrt{25} = 5
$$

所以这个三角形的三边是3、4、5，是一个经典的勾股数（毕达哥拉斯三元组）。


如果你有兴趣，我还可以为你提供勾股定理的几种不同证明方式，或者讲解一些有趣的勾股数例子！`

  it('keeps the full thinking markdown inside the thinking node and does not leak trailing block nodes', () => {
    const markdown = `<usrhead></usrhead><br>介绍下勾股定理<br><br><br><br><aihead></aihead><thinking>${thinkingContent}</thinking>`
    const tags = ['usrhead', 'aihead', 'thinking']
    const md = getMarkdown('thinking-inline-prefix-regression', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags, final: true }) as any[]

    expect(nodes.map(node => node?.type)).toEqual(['paragraph', 'thinking'])

    const prefix = nodes[0]
    expect(prefix?.type).toBe('paragraph')
    expect(prefix?.children?.map((node: any) => node?.type)).toEqual([
      'usrhead',
      'hardbreak',
      'text',
      'hardbreak',
      'hardbreak',
      'hardbreak',
      'hardbreak',
      'aihead',
    ])
    expect(prefix?.children?.[2]?.content).toBe('介绍下勾股定理')

    const thinking = nodes[1]
    expect(thinking?.type).toBe('thinking')
    expect(thinking?.content).toBe(thinkingContent)
    expect(String(thinking?.raw ?? '')).toContain('<thinking>')
    expect(String(thinking?.raw ?? '')).toContain('</thinking>')
    expect(nodes.at(-1)?.type).toBe('thinking')
  })

  it('keeps streaming block markers inside thinking before </thinking> arrives', () => {
    const markdown = `<usrhead></usrhead><br>介绍下勾股定理<br><br><br><br><aihead></aihead><thinking>${thinkingContent}`
    const tags = ['usrhead', 'aihead', 'thinking']
    const md = getMarkdown('thinking-inline-prefix-streaming-regression', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags, final: false }) as any[]

    expect(nodes.map(node => node?.type)).toEqual(['paragraph', 'thinking'])

    const thinking = nodes[1]
    expect(thinking?.type).toBe('thinking')
    expect(thinking?.loading).toBe(true)
    expect(String(thinking?.content ?? '')).toContain('### 勾股定理的定义：')
    expect(String(thinking?.content ?? '')).toContain('---')
    expect(String(thinking?.content ?? '')).toContain('$$\nc = \\sqrt{3^2 + 4^2} = \\sqrt{9 + 16} = \\sqrt{25} = 5\n$$')
    expect(nodes.at(-1)?.type).toBe('thinking')

    const innerNodes = parseMarkdownToStructure(String(thinking?.content ?? ''), getMarkdown('thinking-inline-prefix-streaming-inner'))
    expect(innerNodes.some(node => node?.type === 'heading')).toBe(true)
    expect(innerNodes.some(node => node?.type === 'thematic_break')).toBe(true)
    expect(innerNodes.some(node => node?.type === 'math_block')).toBe(true)
  })

  it('keeps a stable top-level thinking node from the first streaming chunk when the prefix contains <br>', () => {
    const tags = ['usrhead', 'aihead', 'thinking']
    const md = getMarkdown('thinking-inline-prefix-streaming-stability', { customHtmlTags: tags })
    const chunks = [
      '<usrhead></usrhead><br>介绍下勾股定理<br><br><br><br><aihead></aihead><thinking>第',
      '<usrhead></usrhead><br>介绍下勾股定理<br><br><br><br><aihead></aihead><thinking>第一段',
      '<usrhead></usrhead><br>介绍下勾股定理<br><br><br><br><aihead></aihead><thinking>第一段\n\n### 标题',
    ]

    for (const chunk of chunks) {
      const nodes = parseMarkdownToStructure(chunk, md, { customHtmlTags: tags, final: false }) as any[]
      expect(nodes.map(node => node?.type)).toEqual(['paragraph', 'thinking'])
      expect(nodes[0]?.children?.some((node: any) => node?.type === 'thinking')).toBe(false)
      expect(nodes[1]?.type).toBe('thinking')
      expect(nodes[1]?.loading).toBe(true)
    }
  })

  it('keeps a stable top-level thinking node when the prefix is only <br> and the close arrives on the same line', () => {
    const md = getMarkdown('thinking-br-prefix-same-line-stability', { customHtmlTags: ['thinking'] })

    const openNodes = parseMarkdownToStructure('<br><thinking>hi', md, { customHtmlTags: ['thinking'], final: false }) as any[]
    expect(openNodes.map(node => node?.type)).toEqual(['paragraph', 'thinking'])
    expect(openNodes[0]?.children?.map((node: any) => node?.type)).toEqual(['hardbreak'])
    expect(openNodes[1]?.type).toBe('thinking')
    expect(openNodes[1]?.loading).toBe(true)

    const closedNodes = parseMarkdownToStructure('<br><thinking>hi</thinking>', md, { customHtmlTags: ['thinking'], final: true }) as any[]
    expect(closedNodes.map(node => node?.type)).toEqual(['paragraph', 'thinking'])
    expect(closedNodes[0]?.children?.map((node: any) => node?.type)).toEqual(['hardbreak'])
    expect(closedNodes[1]?.type).toBe('thinking')
    expect(closedNodes[1]?.loading).toBe(false)
  })
})
