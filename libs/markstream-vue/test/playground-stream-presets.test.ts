import { describe, expect, it } from 'vitest'
import { findMatchingStreamPreset, getStreamPreset } from '../playground/src/composables/streamPresets'

describe('playground stream presets', () => {
  it('matches the SSE preset by exact control values', () => {
    expect(findMatchingStreamPreset({
      chunkDelayMin: 18,
      chunkDelayMax: 44,
      chunkSizeMin: 1,
      chunkSizeMax: 4,
      burstiness: 18,
    })?.id).toBe('sse')
  })

  it('returns null when current controls no longer match a preset', () => {
    expect(findMatchingStreamPreset({
      chunkDelayMin: 18,
      chunkDelayMax: 45,
      chunkSizeMin: 1,
      chunkSizeMax: 4,
      burstiness: 18,
    })).toBeNull()
  })

  it('resolves named presets and ignores custom ids', () => {
    expect(getStreamPreset('proxy-buffered')?.label).toBe('Proxy Buffered')
    expect(getStreamPreset('custom')).toBeNull()
  })
})
