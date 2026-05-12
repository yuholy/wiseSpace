import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('custom html blocks should interrupt paragraphs', () => {
  it('does not merge a custom html block into the previous paragraph', () => {
    const markdown = `
<TaskPlan>
step 1
</TaskPlan>
测试案例
<RadioBtn>
<title>组织结构列表</title>
<content>少时诵诗书</content>
</RadioBtn>
`

    const tags = ['TaskPlan', 'RadioBtn']
    const md = getMarkdown('custom-html-paragraph-interrupt', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags, final: true }) as any[]
    expect(nodes[0]?.type).toBe('taskplan')
    expect(nodes[1]?.type).toBe('paragraph')
    expect(nodes[1]?.raw).toBe('测试案例')
    expect(nodes[2]?.type).toBe('radiobtn')
  })

  it('handles indented inner lines inside the custom html block', () => {
    const markdown = `
<TaskPlan>
step 1
</TaskPlan>
测试案例
<RadioBtn>
    <title>组织结构列表</title>
    <content>少时诵诗书</content>
</RadioBtn>
`

    const tags = ['TaskPlan', 'RadioBtn']
    const md = getMarkdown('custom-html-paragraph-interrupt-indented', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags, final: true }) as any[]

    expect(nodes[0]?.type).toBe('taskplan')
    expect(nodes[1]?.type).toBe('paragraph')
    expect(nodes[1]?.raw).toBe('测试案例')
    expect(nodes[2]?.type).toBe('radiobtn')
  })

  it('does not insert blank lines inside a custom html block', () => {
    const markdown = `
<Outer>
line
<Inner>
x
</Inner>
</Outer>
`

    const tags = ['Outer', 'Inner']
    const md = getMarkdown('custom-html-paragraph-interrupt-nested', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags, final: true }) as any[]

    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type).toBe('outer')
    expect(String(nodes[0]?.content ?? '')).toContain('line\n<Inner>')
    expect(String(nodes[0]?.content ?? '')).not.toContain('line\n\n<Inner>')
  })

  it('handles custom html blocks inside a blockquote', () => {
    const markdown = `
> 测试案例
> <RadioBtn>
> <title>组织结构列表</title>
> <content>少时诵诗书</content>
> </RadioBtn>
`

    const tags = ['RadioBtn']
    const md = getMarkdown('custom-html-paragraph-interrupt-blockquote', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags, final: true }) as any[]

    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type).toBe('blockquote')
    expect(nodes[0]?.children?.[0]?.type).toBe('paragraph')
    expect(nodes[0]?.children?.[0]?.raw).toBe('测试案例')
    expect(nodes[0]?.children?.[1]?.type).toBe('radiobtn')
  })

  it('handles custom html blocks inside a list item', () => {
    const markdown = `
- 测试案例
  <RadioBtn>
  <title>组织结构列表</title>
  <content>少时诵诗书</content>
  </RadioBtn>
`

    const tags = ['RadioBtn']
    const md = getMarkdown('custom-html-paragraph-interrupt-list', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags, final: true }) as any[]

    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type).toBe('list')
    expect(nodes[0]?.items?.[0]?.type).toBe('list_item')
    expect(nodes[0]?.items?.[0]?.children?.[0]?.type).toBe('paragraph')
    expect(nodes[0]?.items?.[0]?.children?.[0]?.raw).toBe('测试案例')
    expect(nodes[0]?.items?.[0]?.children?.[1]?.type).toBe('radiobtn')
  })

  it('does not insert blank lines inside indented code blocks', () => {
    const markdown = `
    console.log('x')
    <RadioBtn>
    <title>组织结构列表</title>
    </RadioBtn>
`

    const tags = ['RadioBtn']
    const md = getMarkdown('custom-html-paragraph-interrupt-indented-code', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags, final: true }) as any[]

    expect(nodes[0]?.type).toBe('code_block')
    expect(String(nodes[0]?.code ?? '')).toContain('console.log(\'x\')\n<RadioBtn>')
    expect(String(nodes[0]?.code ?? '')).not.toContain('console.log(\'x\')\n\n<RadioBtn>')
  })

  it('keeps a trailing paragraph after an html line followed by a custom block with inner lists', () => {
    const markdown = `<stepstart>开始解答（已查阅9550字资料）</stepstart>
<thinking>
我需要回答用户关于"xxx公司旗下的上市公司有哪些？"的问题。

首先，我需要检查提供的知识库信息和公司基本信息，看看是否包含xxx公司旗下的上市公司信息。

从提供的知识库信息中，我看到以下相关内容：

1. "x公司有限公司成立于1988年，由原xxx公司与xx集团重组而成，是xx省属重点企业。...旗下拥有近19家企业，员工总数约1万人，并控股xxxx公司公司、xxx公司、xxx公司等x家上市公司。"
</thinking>
xxx公司旗下的上市公司有：`

    for (const tags of [['thinking'], ['stepstart', 'thinking']]) {
      const md = getMarkdown(`custom-html-paragraph-interrupt-adjacent-complete-tag-${tags.join('-')}`, { customHtmlTags: tags })
      const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags, final: true }) as any[]

      expect(nodes.map(node => node?.type)).toEqual(['paragraph', 'thinking', 'paragraph'])
      expect(['stepstart', 'html_block', 'html_inline']).toContain(nodes[0]?.children?.[0]?.type)
      expect(String(nodes[1]?.content ?? '')).toContain('1. "x公司有限公司成立于1988年')
      expect(nodes[2]?.raw).toBe('xxx公司旗下的上市公司有：')
    }
  })
})
