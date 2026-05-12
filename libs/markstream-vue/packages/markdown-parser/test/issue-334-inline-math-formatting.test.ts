import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../src'

function parseParagraphChildren(markdown: string) {
  const md = getMarkdown('issue-334')
  const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]
  const paragraph = nodes[0]
  expect(paragraph?.type).toBe('paragraph')
  return paragraph?.children ?? []
}

function parseCustomComponentChildren(markdownContent: string) {
  const tags = ['thinking']
  const md = getMarkdown('issue-334-custom', { customHtmlTags: tags })
  const nodes = parseMarkdownToStructure(`<thinking>${markdownContent}</thinking>`, md, {
    customHtmlTags: tags,
    final: true,
  }) as any[]
  const paragraph = nodes[0]
  expect(paragraph?.type).toBe('paragraph')
  const thinking = (paragraph?.children ?? []).find((node: any) => node?.type === 'thinking')
  expect(thinking).toBeDefined()
  return thinking?.children ?? []
}

function collectTypes(children: any[]) {
  return children.map((node: any) => node?.type)
}

function collectByType(value: any, targetType: string): any[] {
  const out: any[] = []
  const walk = (node: any) => {
    if (!node)
      return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node?.type === targetType)
      out.push(node)
    if (Array.isArray(node?.children))
      node.children.forEach(walk)
    if (Array.isArray(node?.items))
      node.items.forEach(walk)
  }
  walk(value)
  return out
}

describe('issue #334 - inline formatting before math', () => {
  it('keeps strong, emphasis, and strikethrough nodes when inline math is on the same line', () => {
    const children = parseParagraphChildren('**粗体** 和 *斜体* 和 ~~删除线~~ 和 $E = mc^2$')
    expect(collectTypes(children)).toEqual([
      'strong',
      'text',
      'emphasis',
      'text',
      'strikethrough',
      'text',
      'math_inline',
    ])

    expect(children[0]?.children?.[0]?.content).toBe('粗体')
    expect(children[2]?.children?.[0]?.content).toBe('斜体')
    expect(children[4]?.children?.[0]?.content).toBe('删除线')
    expect(children[5]?.content).toBe(' 和 ')
    expect(children[6]?.content).toBe('E = mc^2')
  })

  it('keeps underscore-based strong and emphasis nodes when inline math is on the same line', () => {
    const children = parseParagraphChildren('__粗体__ 和 _斜体_ 和 ~~删除线~~ 和 $E = mc^2$')

    expect(collectTypes(children)).toEqual([
      'strong',
      'text',
      'emphasis',
      'text',
      'strikethrough',
      'text',
      'math_inline',
    ])

    expect(children[0]?.children?.[0]?.content).toBe('粗体')
    expect(children[2]?.children?.[0]?.content).toBe('斜体')
    expect(children[4]?.children?.[0]?.content).toBe('删除线')
    expect(children[6]?.content).toBe('E = mc^2')
  })

  it('keeps nested triple-asterisk formatting before inline math', () => {
    const children = parseParagraphChildren('***粗斜体*** 和 ~~删除线~~ 和 $E = mc^2$')

    const outer = children[0]
    const inner = outer?.children?.[0]
    expect(['strong', 'emphasis']).toContain(outer?.type)
    expect(['strong', 'emphasis']).toContain(inner?.type)
    expect(inner?.type).not.toBe(outer?.type)
    expect(inner?.children?.[0]?.content).toBe('粗斜体')

    expect(children.slice(1).map((node: any) => node?.type)).toEqual([
      'text',
      'strikethrough',
      'text',
      'math_inline',
    ])
    expect(children[2]?.children?.[0]?.content).toBe('删除线')
    expect(children[4]?.content).toBe('E = mc^2')
  })

  it('keeps formatting order when inline math appears before later emphasis markers', () => {
    const children = parseParagraphChildren('$E = mc^2$ 和 **粗体** 和 *斜体* 和 ~~删除线~~')

    expect(collectTypes(children)).toEqual([
      'math_inline',
      'text',
      'strong',
      'text',
      'emphasis',
      'text',
      'strikethrough',
    ])

    expect(children[0]?.content).toBe('E = mc^2')
    expect(children[2]?.children?.[0]?.content).toBe('粗体')
    expect(children[4]?.children?.[0]?.content).toBe('斜体')
    expect(children[6]?.children?.[0]?.content).toBe('删除线')
  })

  it('does not turn escaped delimiters into formatting nodes before inline math', () => {
    const children = parseParagraphChildren('\\*\\*字面量\\*\\* 和 \\_\\_下划线\\_\\_ 和 $E = mc^2$')

    expect(collectTypes(children)).toEqual([
      'text',
      'math_inline',
    ])
    expect(children[0]?.content).toBe('**字面量** 和 __下划线__ 和 ')
    expect(children[1]?.content).toBe('E = mc^2')
  })

  it('keeps escaped delimiters literal while still parsing later real formatting before inline math', () => {
    const children = parseParagraphChildren('\\*\\*字面量\\*\\* 和 **真实粗体** 和 $E = mc^2$')

    expect(collectTypes(children)).toEqual([
      'text',
      'strong',
      'text',
      'math_inline',
    ])
    expect(children[0]?.content).toBe('**字面量** 和 ')
    expect(children[1]?.children?.[0]?.content).toBe('真实粗体')
    expect(children[2]?.content).toBe(' 和 ')
    expect(children[3]?.content).toBe('E = mc^2')
  })

  it('keeps math recoverable even when malformed nested formatting appears before it', () => {
    const children = parseParagraphChildren('**粗体 *未闭合 和 ~~删除线~~ 和 $E = mc^2$')

    const mathNodes = collectByType(children, 'math_inline')
    expect(mathNodes).toHaveLength(1)
    expect(mathNodes[0]?.content).toBe('E = mc^2')

    const serialized = JSON.stringify(children)
    expect(serialized).toContain('未闭合')
    expect(serialized).toContain('删除线')
  })
})

describe('issue #334 - inline formatting inside custom components', () => {
  it('keeps strong, emphasis, strikethrough, and math inside custom component content', () => {
    const children = parseCustomComponentChildren('**粗体** 和 *斜体* 和 ~~删除线~~ 和 $E = mc^2$')

    expect(collectTypes(children)).toEqual([
      'strong',
      'text',
      'emphasis',
      'text',
      'strikethrough',
      'text',
      'math_inline',
    ])
    expect(children[0]?.children?.[0]?.content).toBe('粗体')
    expect(children[2]?.children?.[0]?.content).toBe('斜体')
    expect(children[4]?.children?.[0]?.content).toBe('删除线')
    expect(children[6]?.content).toBe('E = mc^2')
  })

  it('keeps underscore-based and triple-asterisk formatting inside custom component content', () => {
    const underscoreChildren = parseCustomComponentChildren('__粗体__ 和 _斜体_ 和 ~~删除线~~ 和 $E = mc^2$')
    expect(collectTypes(underscoreChildren)).toEqual([
      'strong',
      'text',
      'emphasis',
      'text',
      'strikethrough',
      'text',
      'math_inline',
    ])

    const tripleChildren = parseCustomComponentChildren('***粗斜体*** 和 ~~删除线~~ 和 $E = mc^2$')
    const outer = tripleChildren[0]
    const inner = outer?.children?.[0]
    expect(['strong', 'emphasis']).toContain(outer?.type)
    expect(['strong', 'emphasis']).toContain(inner?.type)
    expect(inner?.type).not.toBe(outer?.type)
    expect(inner?.children?.[0]?.content).toBe('粗斜体')
    expect(collectTypes(tripleChildren.slice(1))).toEqual([
      'text',
      'strikethrough',
      'text',
      'math_inline',
    ])
  })

  it('keeps escaped delimiters literal while still parsing later real formatting inside custom component content', () => {
    const children = parseCustomComponentChildren('\\*\\*字面量\\*\\* 和 **真实粗体** 和 $E = mc^2$')

    expect(collectTypes(children)).toEqual([
      'text',
      'strong',
      'text',
      'math_inline',
    ])
    expect(children[0]?.content).toBe('**字面量** 和 ')
    expect(children[1]?.children?.[0]?.content).toBe('真实粗体')
    expect(children[3]?.content).toBe('E = mc^2')
  })

  it('keeps math recoverable with malformed formatting inside custom component content', () => {
    const children = parseCustomComponentChildren('**粗体 *未闭合 和 ~~删除线~~ 和 $E = mc^2$')

    const mathNodes = collectByType(children, 'math_inline')
    expect(mathNodes).toHaveLength(1)
    expect(mathNodes[0]?.content).toBe('E = mc^2')

    const serialized = JSON.stringify(children)
    expect(serialized).toContain('未闭合')
    expect(serialized).toContain('删除线')
  })
})
