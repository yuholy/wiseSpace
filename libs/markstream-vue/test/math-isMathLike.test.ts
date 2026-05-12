import { isMathLike } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('isMathLike heuristic', () => {
  it('detects \\boldsymbol{\u03B1}^T \\boldsymbol{\u03B2} = 0 as math-like', () => {
    const s = '\\boldsymbol{\\alpha}^T \\boldsymbol{\\beta} = 0'
    expect(isMathLike(s)).toBe(true)
  })

  it('returns false for plain text', () => {
    const s = 'This is just plain text, not math.'
    expect(isMathLike(s)).toBe(false)
  })
})

describe('isMathLike additional cases', () => {
  it('detects \vec and \hat forms', () => {
    expect(isMathLike('\\vec{v} + \\hat{x} = 0')).toBe(true)
    expect(isMathLike('\\overline{z} = x + iy')).toBe(true)
  })

  it('detects mathcal/mathbb', () => {
    expect(isMathLike('\\mathcal{F}(x) = \\int f')).toBe(true)
    expect(isMathLike('\\mathbb{R}')).toBe(true)
  })

  it('does not misclassify words containing math-like letters', () => {
    expect(isMathLike('The word mathematic is not a formula.')).toBe(false)
    expect(isMathLike('email@example.com')).toBe(false)
  })
})
