import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../src'

describe('parseMarkdownToStructure - streaming strong+math', () => {
  it('does not hang on unclosed strong ending with a closed $...$ span', { timeout: 500 }, () => {
    const md = getMarkdown('stream-strong-math')
    const markdown = '> **给定输入 $ x $'

    expect(() => parseMarkdownToStructure(markdown, md)).not.toThrow()

    // Simulate streaming: repeatedly parse progressive prefixes.
    for (let i = 1; i <= markdown.length; i++) {
      const chunk = markdown.slice(0, i)
      expect(() => parseMarkdownToStructure(chunk, md)).not.toThrow()
    }
  })

  it('does not recurse forever when a streaming strong prefix ends right before math opener content', { timeout: 500 }, () => {
    const md = getMarkdown('stream-strong-heading-math')
    const markdown = '### 1. **理解 \\\\(\\\\boldsymbol{alpha}^T \\\\boldsymbol{\\\\beta} = 0\\\\) 的含义**'

    for (let i = 1; i <= markdown.length; i++) {
      const chunk = markdown.slice(0, i)
      expect(() => parseMarkdownToStructure(chunk, md, { final: false })).not.toThrow()
    }
  })
})
