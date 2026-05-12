import { describe, expect, it } from 'vitest'
import { parseImageToken } from '../../packages/markdown-parser/src/parser/inline-parsers/image-parser'

// Minimal token-like shapes used by parser (only include fields used by parser)
function makeChildImageToken() {
  return {
    type: 'image',
    tag: 'img',
    attrs: [
      ['src', 'https://example.com/vue.png'],
      ['alt', ''],
      ['title', 'Vue Logo'],
    ],
    content: 'Vue Logo',
    children: [
      {
        type: 'text',
        content: 'Vue Logo',
      },
    ],
  } as unknown as any
}

function makeOuterInlineToken() {
  return {
    type: 'inline',
    tag: '',
    attrs: null,
    content: '![Vue Logo](https://example.com/vue.png "Vue Logo")',
    children: [makeChildImageToken()],
  } as unknown as any
}

describe('image-parser', () => {
  it('falls back to child attrs or children content when attrs.alt is empty', () => {
    const outer = makeOuterInlineToken()
    const node = parseImageToken(outer as any)
    expect(node.src).toBe('https://example.com/vue.png')
    expect(node.title).toBe('Vue Logo')
    // alt should be taken from token.content/child when attrs.alt is empty
    expect(node.alt).toBe('Vue Logo')
  })

  it('uses child text when attrs.alt and parent content are empty', () => {
    const child = makeChildImageToken()
    // make the child have empty alt attr and parent content empty
    child.attrs = [
      ['src', 'https://example.com/vue.png'],
      ['alt', ''],
      ['title', 'Vue Logo'],
    ]
    child.content = ''
    child.children = [
      {
        type: 'text',
        content: 'Child Alt Text',
      },
    ]

    const outer = {
      type: 'inline',
      tag: '',
      attrs: null,
      content: '',
      children: [child],
    } as unknown as any

    const node = parseImageToken(outer as any)
    expect(node.src).toBe('https://example.com/vue.png')
    expect(node.title).toBe('Vue Logo')
    // alt should be taken from the inner child's text content
    expect(node.alt).toBe('Child Alt Text')
  })
})
