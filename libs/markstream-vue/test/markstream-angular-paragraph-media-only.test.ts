import { describe, expect, it } from 'vitest'
import {
  isMediaOnlyParagraphNodes,
  normalizeMediaOnlyParagraphNodes,
  splitParagraphChildren,
} from '../packages/markstream-angular/src/components/shared/node-helpers'

describe('markstream-angular paragraph media-only links', () => {
  it('keeps image links in the same inline segment and normalizes separator whitespace', () => {
    const children = [
      {
        type: 'link',
        href: 'https://www.npmjs.com/package/markstream-vue',
        title: null,
        text: 'NPM version',
        raw: '',
        children: [
          {
            type: 'image',
            src: 'https://img.shields.io/npm/v/markstream-vue?color=a1b858&label=',
            alt: 'NPM version',
            title: 'NPM version',
            raw: '',
          },
        ],
      },
      {
        type: 'text',
        content: '\n',
        raw: '\n',
      },
      {
        type: 'link',
        href: 'README.zh-CN.md',
        title: null,
        text: '中文版',
        raw: '',
        children: [
          {
            type: 'image',
            src: 'https://img.shields.io/badge/docs-中文文档-blue',
            alt: '中文版',
            title: '中文版',
            raw: '',
          },
        ],
      },
    ] as any[]

    const segments = splitParagraphChildren(children as any)
    expect(segments).toHaveLength(1)
    expect(segments[0]).toMatchObject({ kind: 'inline' })

    const inlineNodes = (segments[0] as any).nodes
    expect(isMediaOnlyParagraphNodes(inlineNodes)).toBe(true)

    const normalized = normalizeMediaOnlyParagraphNodes(inlineNodes)
    expect(normalized.map(node => node.type)).toEqual(['link', 'text', 'link'])
    expect((normalized[1] as any).content).toBe(' ')
    expect(((normalized[0] as any).children[0] as any).type).toBe('image')
    expect(((normalized[2] as any).children[0] as any).type).toBe('image')
  })
})
