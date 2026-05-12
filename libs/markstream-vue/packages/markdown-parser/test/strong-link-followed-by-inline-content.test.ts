import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../src'

function expectLinkChild(node: any, expected: {
  href: string
  text: string
  loading: boolean
  childType: string
  childText: string
}) {
  expect(node.type).toBe('link')
  expect(node.href).toBe(expected.href)
  expect(node.text).toBe(expected.text)
  expect(node.loading).toBe(expected.loading)
  expect(node.attrs).toEqual(expect.arrayContaining([['href', expected.href]]))
  expect(node.children).toHaveLength(1)
  expect(node.children[0].type).toBe(expected.childType)
  expect(node.children[0].raw).toBe(expected.text)
  expect(node.children[0].children).toHaveLength(1)
  expect(node.children[0].children[0].type).toBe('text')
  expect(node.children[0].children[0].content).toBe(expected.childText)
}

describe('strong link followed by inline content', () => {
  const md = getMarkdown('strong-link-followed-by-inline-content')

  it('keeps trailing text and the next italic link outside the preceding strong link', () => {
    const markdown = `[**加粗的链接**](https://example.com)会导致后面的斜体链接解析不正确
[*斜体的链接*](https://test.com)`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(3)

    expectLinkChild(paragraph.children[0], {
      href: 'https://example.com',
      text: '**加粗的链接**',
      loading: false,
      childType: 'strong',
      childText: '加粗的链接',
    })

    expect(paragraph.children[1]).toEqual(expect.objectContaining({
      type: 'text',
      content: '会导致后面的斜体链接解析不正确\n',
      raw: '会导致后面的斜体链接解析不正确\n',
    }))

    expectLinkChild(paragraph.children[2], {
      href: 'https://test.com',
      text: '*斜体的链接*',
      loading: false,
      childType: 'emphasis',
      childText: '斜体的链接',
    })
  })

  it('keeps two inline links separated by the plain text between them', () => {
    const markdown = `[**加粗的链接**](https://example.com) 或者 [*斜体的链接*](https://test.com)`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(3)

    expectLinkChild(paragraph.children[0], {
      href: 'https://example.com',
      text: '**加粗的链接**',
      loading: false,
      childType: 'strong',
      childText: '加粗的链接',
    })

    expect(paragraph.children[1]).toEqual(expect.objectContaining({
      type: 'text',
      content: ' 或者 ',
      raw: ' 或者 ',
    }))

    expectLinkChild(paragraph.children[2], {
      href: 'https://test.com',
      text: '*斜体的链接*',
      loading: false,
      childType: 'emphasis',
      childText: '斜体的链接',
    })
  })

  it('keeps trailing punctuation and explanatory text outside the strong link', () => {
    const markdown = `[**加粗的链接**](https://example.com)，这里不是链接部分，但是有链接效果`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(2)

    expectLinkChild(paragraph.children[0], {
      href: 'https://example.com',
      text: '**加粗的链接**',
      loading: false,
      childType: 'strong',
      childText: '加粗的链接',
    })

    expect(paragraph.children[1]).toEqual(expect.objectContaining({
      type: 'text',
      content: '，这里不是链接部分，但是有链接效果',
      raw: '，这里不是链接部分，但是有链接效果',
    }))
  })

  it('keeps immediate trailing text outside a strong link even without whitespace', () => {
    const markdown = `[**加粗的链接**](https://example.com)tail`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(2)

    expectLinkChild(paragraph.children[0], {
      href: 'https://example.com',
      text: '**加粗的链接**',
      loading: false,
      childType: 'strong',
      childText: '加粗的链接',
    })

    expect(paragraph.children[1]).toEqual(expect.objectContaining({
      type: 'text',
      content: 'tail',
      raw: 'tail',
    }))
  })

  it('keeps completed strong and italic links stable in non-final parsing mode', () => {
    const markdown = `[**加粗的链接**](https://example.com) 或者 [*斜体的链接*](https://test.com)`
    const nodes = parseMarkdownToStructure(markdown, md, { final: false }) as any[]

    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(3)

    expectLinkChild(paragraph.children[0], {
      href: 'https://example.com',
      text: '**加粗的链接**',
      loading: false,
      childType: 'strong',
      childText: '加粗的链接',
    })

    expect(paragraph.children[1]).toEqual(expect.objectContaining({
      type: 'text',
      content: ' 或者 ',
      raw: ' 或者 ',
    }))

    expectLinkChild(paragraph.children[2], {
      href: 'https://test.com',
      text: '*斜体的链接*',
      loading: false,
      childType: 'emphasis',
      childText: '斜体的链接',
    })
  })

  it('keeps strong links with inline code labels separated from trailing text', () => {
    const markdown = `[**用 \`pnpm\` 安装**](https://example.com)tail`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(2)

    const link = paragraph.children[0]
    expect(link.type).toBe('link')
    expect(link.href).toBe('https://example.com')
    expect(link.text).toBe('**用 pnpm 安装**')
    expect(link.loading).toBe(false)
    expect(link.children).toHaveLength(1)
    expect(link.children[0].type).toBe('strong')
    expect(link.children[0].children).toHaveLength(3)
    expect(link.children[0].children[0]).toEqual(expect.objectContaining({
      type: 'text',
      content: '用 ',
    }))
    expect(link.children[0].children[1]).toEqual(expect.objectContaining({
      type: 'inline_code',
      code: 'pnpm',
    }))
    expect(link.children[0].children[2]).toEqual(expect.objectContaining({
      type: 'text',
      content: ' 安装',
    }))

    expect(paragraph.children[1]).toEqual(expect.objectContaining({
      type: 'text',
      content: 'tail',
      raw: 'tail',
    }))
  })

  it('preserves title attrs on strong links while keeping trailing text outside the link', () => {
    const markdown = `[**x**](https://a.com "title")tail`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(2)

    const link = paragraph.children[0]
    expect(link.type).toBe('link')
    expect(link.href).toBe('https://a.com')
    expect(link.title).toBe('title')
    expect(link.text).toBe('**x**')
    expect(link.loading).toBe(false)
    expect(link.attrs).toEqual(expect.arrayContaining([
      ['href', 'https://a.com'],
      ['title', 'title'],
    ]))

    expect(paragraph.children[1]).toEqual(expect.objectContaining({
      type: 'text',
      content: 'tail',
      raw: 'tail',
    }))
  })

  it('keeps adjacent strong-label and code-label links independent', () => {
    const markdown = `[**x**](https://a.com)[\`y\`](https://b.com)`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(2)

    expectLinkChild(paragraph.children[0], {
      href: 'https://a.com',
      text: '**x**',
      loading: false,
      childType: 'strong',
      childText: 'x',
    })

    const codeLink = paragraph.children[1]
    expect(codeLink.type).toBe('link')
    expect(codeLink.href).toBe('https://b.com')
    expect(codeLink.text).toBe('y')
    expect(codeLink.loading).toBe(false)
    expect(codeLink.children).toHaveLength(1)
    expect(codeLink.children[0]).toEqual(expect.objectContaining({
      type: 'inline_code',
      code: 'y',
      raw: 'y',
    }))
  })

  it('marks an unfinished strong link URL as loading in non-final mode', () => {
    const markdown = `[**x**](https://a.com`
    const nodes = parseMarkdownToStructure(markdown, md, { final: false }) as any[]

    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(1)

    const strong = paragraph.children[0]
    expect(strong.type).toBe('strong')
    expect(strong.children).toHaveLength(1)

    const link = strong.children[0]
    expect(link.type).toBe('link')
    expect(link.loading).toBe(true)
    expect(link.text).toBe('x')
    expect(link.children).toHaveLength(1)
    expect(link.children[0]).toEqual(expect.objectContaining({
      type: 'text',
      content: 'x',
      raw: 'x',
    }))
  })

  it('keeps triple-emphasis labels separated from trailing text', () => {
    const markdown = `[***x***](https://a.com)tail`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(2)

    const link = paragraph.children[0]
    expect(link.type).toBe('link')
    expect(link.href).toBe('https://a.com')
    expect(link.text).toBe('*x*')
    expect(link.loading).toBe(false)
    expect(link.children).toHaveLength(1)
    expect(link.children[0].type).toBe('emphasis')
    expect(link.children[0].children).toHaveLength(1)
    expect(link.children[0].children[0].type).toBe('strong')
    expect(link.children[0].children[0].children[0]).toEqual(expect.objectContaining({
      type: 'text',
      content: 'x',
    }))

    expect(paragraph.children[1]).toEqual(expect.objectContaining({
      type: 'text',
      content: 'tail',
      raw: 'tail',
    }))
  })

  it('keeps html inline labels separated from trailing text', () => {
    const markdown = `[<span>x</span>](https://a.com)tail`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(2)

    const link = paragraph.children[0]
    expect(link.type).toBe('link')
    expect(link.href).toBe('https://a.com')
    expect(link.text).toBe('<span>x</span>')
    expect(link.loading).toBe(false)
    expect(link.children).toHaveLength(1)
    expect(link.children[0]).toEqual(expect.objectContaining({
      type: 'html_inline',
      tag: 'span',
      content: '<span>x</span>',
      loading: false,
    }))
    expect(link.children[0].children).toHaveLength(1)
    expect(link.children[0].children[0]).toEqual(expect.objectContaining({
      type: 'text',
      content: 'x',
    }))

    expect(paragraph.children[1]).toEqual(expect.objectContaining({
      type: 'text',
      content: 'tail',
      raw: 'tail',
    }))
  })

  it('keeps punctuation after a strong link outside the link node', () => {
    const markdown = `[**x**](https://a.com)!tail`
    const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(nodes).toHaveLength(1)
    const paragraph = nodes[0]
    expect(paragraph.type).toBe('paragraph')
    expect(paragraph.children).toHaveLength(2)

    expectLinkChild(paragraph.children[0], {
      href: 'https://a.com',
      text: '**x**',
      loading: false,
      childType: 'strong',
      childText: 'x',
    })

    expect(paragraph.children[1]).toEqual(expect.objectContaining({
      type: 'text',
      content: '!tail',
      raw: '!tail',
    }))
  })
})
