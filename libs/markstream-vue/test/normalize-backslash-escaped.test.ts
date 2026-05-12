import { normalizeStandaloneBackslashT } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('normalizeStandaloneBackslashT - already escaped', () => {
  it('does not double-escape already escaped katex commands', () => {
    expect(normalizeStandaloneBackslashT('\\in')).toBe('\\in')
    expect(normalizeStandaloneBackslashT('text \\alpha more')).toBe('\\text \\alpha more')
  })

  it('respects options: custom commands and disabling exclamation escape', () => {
    // custom commands only contains 'foo', so 'in' should not be escaped
    expect(normalizeStandaloneBackslashT('in', { commands: ['foo'], escapeExclamation: false })).toBe('in')
    // when escapeExclamation is false, '!' should remain
    expect(normalizeStandaloneBackslashT('a!b', { escapeExclamation: false })).toBe('a!b')
  })
})
