import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('blockquote regressions', () => {
  const md = getMarkdown('blockquote-regressions')

  it('keeps tables nested inside blockquotes', () => {
    const markdown = `> PCB描述如下：
>
> | 料号 | 品名 | 规格 |
> | -- | -- | -- |
> | 120300-5420-01 | PCB | 临时物料-枪机项目-型号：507AA＿SENSOR＿V10-单板尺寸：27.33＊39.22＊1.0mm-4层-FR4-黑油-拼板-4＊4-拼版尺寸：129.32＊162.88＊1.0mm-0SP-TG＞＝150℃ MOT＞＝130℃-环保测试（RoHS2.0）-五株 [1]`

    const nodes = parseMarkdownToStructure(markdown, md)
    expect(nodes.length).toBe(1)
    const blockquote: any = nodes[0]
    expect(blockquote.type).toBe('blockquote')

    const hasParagraph = blockquote.children?.some((child: any) => child.type === 'paragraph')
    expect(hasParagraph).toBe(true)

    const tableNode: any = blockquote.children?.find((child: any) => child.type === 'table')
    expect(tableNode).toBeTruthy()
    expect(tableNode.rows?.[0]?.cells?.length).toBe(3)
    const firstCellText = tableNode.rows?.[0]?.cells?.[0]?.children?.[0]?.content || ''
    expect(firstCellText).toContain('120300-5420-01')
  })
})
