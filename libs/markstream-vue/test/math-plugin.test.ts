import { isMathLike } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('isMathLike heuristic', () => {
  it('detects TeX commands', () => {
    expect(isMathLike('\\frac{a}{b}')).toBe(true)
    expect(isMathLike('\\alpha + x')).toBe(true)
  })

  it('detects function-like patterns', () => {
    expect(isMathLike('f(x)')).toBe(true)
    expect(isMathLike('sin(x) + cos(y)')).toBe(true)
  })

  it('detects superscripts and subscripts', () => {
    expect(isMathLike('x^2 + y_1')).toBe(true)
  })

  it('detects operators', () => {
    expect(isMathLike('a + b = c')).toBe(true)
  })

  it('rejects non-math text', () => {
    expect(isMathLike('This is a normal sentence.')).toBe(false)
    expect(isMathLike('[1, 2, 3]')).toBe(false)
  })
})
