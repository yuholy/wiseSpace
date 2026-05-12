import { beforeEach, describe, expect, it } from 'vitest'
import { clearGlobalCustomComponents, getCustomNodeComponents, removeCustomComponents, setCustomComponents } from '../src/utils/nodeComponents'

describe('nodeComponents scoped API', () => {
  beforeEach(() => {
    // clear any global state by removing known ids
    try {
      removeCustomComponents('test-scope')
      // clear global via clearGlobalCustomComponents when needed
    }
    catch {
      // ignore
    }
  })

  it('sets and retrieves a scoped mapping', () => {
    setCustomComponents('test-scope', { custom_node: 'MyComp' })
    const mapping = getCustomNodeComponents('test-scope')
    expect(mapping.custom_node).toBe('MyComp')
  })

  it('sets and retrieves a global mapping (legacy)', () => {
    setCustomComponents({ code_block: 'MarkdownCodeBlock' })
    const mapping = getCustomNodeComponents()
    expect(mapping.code_block).toBe('MarkdownCodeBlock')
  })

  it('removes a scoped mapping', () => {
    setCustomComponents('test-scope', { foo: 'bar' })
    expect(getCustomNodeComponents('test-scope').foo).toBe('bar')
    removeCustomComponents('test-scope')
    expect(getCustomNodeComponents('test-scope').foo).toBeUndefined()
  })

  it('clears global mapping and disallows removing global via removeCustomComponents', () => {
    setCustomComponents({ code_block: 'MarkdownCodeBlock' })
    expect(getCustomNodeComponents().code_block).toBe('MarkdownCodeBlock')
    // clear global mapping
    clearGlobalCustomComponents()
    expect(getCustomNodeComponents().code_block).toBeUndefined()
    // attempting to remove global via removeCustomComponents should throw
    expect(() => removeCustomComponents('__global__')).toThrow()
  })
})
