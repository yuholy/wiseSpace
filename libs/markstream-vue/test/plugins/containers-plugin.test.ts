import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('containers plugin', () => {
  it('renders admonition container via ::: admonition', () => {
    const md = getMarkdown('t')
    const content = `::: note\nThis is a note\n:::`
    const html = md.render(content)
    expect(html).toContain('vmr-container-note')
    expect(html).toContain('This is a note')
  })

  it('renders multiple container types', () => {
    const md = getMarkdown('t')
    const content = `::: warning\nWarn\n:::\n\n::: tip\nTip\n:::`
    const html = md.render(content)
    expect(html).toContain('vmr-container-warning')
    expect(html).toContain('vmr-container-tip')
  })

  it('renders warning block with expected HTML structure', () => {
    const md = getMarkdown('play')
    const content = `::: warning\n这是一个警告块。\n:::`
    const html = md.render(content)
    // exact wrapper class
    expect(html).toContain('class="vmr-container vmr-container-warning"')
    // contains paragraph with content
    expect(html).toContain('<p>这是一个警告块。</p>')
  })

  it('preserves original markdown inside container', () => {
    const md = getMarkdown('t')
    const content = `::: note-test \n# head text\n:::`
    const tokens = parseMarkdownToStructure(content, md)

    // the raw should contain the markdown `# head text`
    expect(tokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          raw: expect.stringContaining('#'),
        }),
      ]),
    )
  })
})
