import { describe, expect, it } from 'vitest'
import { collect, hasNode, paragraphHasCheckbox, textIncludes } from './midstate-utils'

describe('midstate-utils', () => {
  it('collect finds nested nodes of a given type', () => {
    const nodes = [
      { type: 'paragraph', children: [{ type: 'text', content: 'a' }] },
      { type: 'list', items: [{ type: 'list_item', children: [{ type: 'paragraph', children: [{ type: 'text', content: 'b' }] }] }] },
      { type: 'custom', children: [{ type: 'emphasis', children: [{ type: 'text', content: 'x' }] }] },
    ]
    const paras = collect(nodes as any, 'paragraph')
    expect(paras.length).toBeGreaterThanOrEqual(1)
    const emph = collect(nodes as any, 'emphasis')
    expect(emph.length).toBe(1)
  })

  it('hasNode returns true when node exists', () => {
    const nodes = [{ type: 'a' }, { type: 'b' }, { type: 'c' }]
    expect(hasNode(nodes as any, 'b')).toBe(true)
    expect(hasNode(nodes as any, 'z')).toBe(false)
  })

  it('textIncludes works on simple structures', () => {
    const nodes = [{ type: 'paragraph', children: [{ type: 'text', content: 'hello world' }] }]
    expect(textIncludes(nodes as any, 'hello')).toBe(true)
    expect(textIncludes(nodes as any, 'bye')).toBe(false)
  })

  it('textIncludes supports RegExp matching', () => {
    const nodes = [{ type: 'paragraph', children: [{ type: 'text', content: 'Hello WORLD' }] }]
    expect(textIncludes(nodes as any, /WORLD$/i)).toBe(true)
    expect(textIncludes(nodes as any, /nope/)).toBe(false)
  })

  it('paragraphHasCheckbox detects checkbox children', () => {
    const p = { type: 'paragraph', children: [{ type: 'checkbox', checked: true }, { type: 'text', content: 'hi' }] }
    expect(paragraphHasCheckbox([p] as any)).toBe(true)
    const p2 = { type: 'paragraph', children: [{ type: 'text', content: 'nope' }] }
    expect(paragraphHasCheckbox([p2] as any)).toBe(false)
  })
})
