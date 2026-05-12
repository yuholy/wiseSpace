import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

function normalizeText(input: string) {
  return input.replace(/\s+/g, ' ').trim()
}

describe('custom html_block -> custom nodes repeat', () => {
  it('parses repeated custom block tags with distinct content', () => {
    const markdown = `<new-question>A</new-question>
<sub-question>
B
</sub-question>

<sub-question>
C
</sub-question>`

    const tags = ['thinking', 'new-question', 'sub-question']
    const md = getMarkdown('custom-html-block-repeat', { customHtmlTags: tags })

    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags }) as any[]

    // markdown-it tokenizes the first two lines as a paragraph (inline HTML), and the
    // second <sub-question> as an html_block. The parser must NOT "re-extract" the
    // earlier <sub-question> (B) when converting the later html_block (C).
    expect(nodes).toHaveLength(2)

    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')

    const newQ = paragraph.children?.find((n: any) => n.type === 'new-question')
    const subInline = paragraph.children?.find((n: any) => n.type === 'sub-question')

    expect(newQ).toBeTruthy()
    expect(normalizeText(String(newQ.content))).toBe('A')

    expect(subInline).toBeTruthy()
    expect(normalizeText(String(subInline.content))).toBe('B')

    const subBlock = nodes[1]
    expect(subBlock.type).toBe('sub-question')
    expect(normalizeText(String(subBlock.content))).toBe('C')
  })
})
