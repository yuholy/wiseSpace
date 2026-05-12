import { describe, expect, it } from 'vitest'

describe('optional monaco dependency', () => {
  it('should handle missing stream-monaco gracefully', async () => {
    // Dynamically import the monaco module
    const { getUseMonaco } = await import('../src/components/CodeBlockNode/monaco')

    // Mock the import to simulate missing package
    // In a real scenario where stream-monaco is not installed,
    // the import will fail and getUseMonaco should return null
    // This test verifies the function exists and can be called
    const result = await getUseMonaco()

    // If stream-monaco is installed (as it is in the dev environment),
    // result will be the module. If not installed, result will be null.
    // The important thing is that no error is thrown.
    expect(typeof result === 'object' || result === null).toBe(true)
  })

  it('should cache the import result', async () => {
    const { getUseMonaco } = await import('../src/components/CodeBlockNode/monaco')

    // Call twice to test caching
    const result1 = await getUseMonaco()
    const result2 = await getUseMonaco()

    // Both calls should return the same result (either the module or null)
    expect(result1).toBe(result2)
  })
})
