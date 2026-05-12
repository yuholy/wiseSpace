import { describe, expect, it } from 'vitest'
import {
  getHtmlTagFromContent,
  isHtmlLikeTagName,
  mergeCustomHtmlTags,
  normalizeCustomHtmlTagName,
  normalizeCustomHtmlTags,
  resolveCustomHtmlTags,
} from '../src'

describe('custom html tag helpers', () => {
  it('normalizes valid tag-like names and rejects invalid prefixes', () => {
    expect(normalizeCustomHtmlTagName('thinking')).toBe('thinking')
    expect(normalizeCustomHtmlTagName('<Thinking attr="x">')).toBe('thinking')
    expect(normalizeCustomHtmlTagName('</answer-box>')).toBe('answer-box')
    expect(normalizeCustomHtmlTagName('<my_component>')).toBe('my_component')
    expect(normalizeCustomHtmlTagName('<thinking')).toBe('thinking')

    expect(normalizeCustomHtmlTagName('foo:bar')).toBe('')
    expect(normalizeCustomHtmlTagName('<foo:bar>')).toBe('')
    expect(normalizeCustomHtmlTagName('x.y')).toBe('')
    expect(normalizeCustomHtmlTagName('<x.y>')).toBe('')
  })

  it('keeps custom tag lists normalized and deduplicated', () => {
    expect(normalizeCustomHtmlTags(['thinking', '<Thinking>', 'foo:bar', 'my_component', 'answer-box']))
      .toEqual(['thinking', 'my_component', 'answer-box'])

    expect(mergeCustomHtmlTags(['thinking'], ['<hint>'], ['foo:bar', 'hint', 'my_component']))
      .toEqual(['thinking', 'hint', 'my_component'])

    expect(resolveCustomHtmlTags(['<Thinking>', 'hint', 'my_component']))
      .toEqual({
        key: 'thinking,hint,my_component',
        tags: ['thinking', 'hint', 'my_component'],
      })
  })

  it('uses the same validation for configured tag names and content extraction', () => {
    expect(isHtmlLikeTagName('thinking')).toBe(true)
    expect(isHtmlLikeTagName('answer-box')).toBe(true)
    expect(isHtmlLikeTagName('ssr_card')).toBe(true)
    expect(isHtmlLikeTagName('foo:bar')).toBe(false)

    expect(getHtmlTagFromContent('<thinking attr="x">ok</thinking>')).toBe('thinking')
    expect(getHtmlTagFromContent('<foo:bar>ok</foo:bar>')).toBe('')
    expect(getHtmlTagFromContent('<ssr_card>ok</ssr_card>')).toBe('ssr_card')
  })
})
