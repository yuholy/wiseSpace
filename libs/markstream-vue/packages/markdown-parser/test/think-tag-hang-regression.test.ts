import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../src'

describe('parseMarkdownToStructure - <think> regression', () => {
  it('does not hang on <think> blocks with lots of backslashes', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const markdown = readFileSync(join(here, 'fixtures/think-hang.md'), 'utf8')
    const md = getMarkdown('think-regression', { customHtmlTags: ['think'] })

    expect(() => {
      // The hang used to occur inside `md.parse()` (math plugin) with a `$`
      // immediately following a `]` like `[M–H]$^–$`.
      md.parse(markdown, {})
      parseMarkdownToStructure(markdown, md, { customHtmlTags: ['think'] })
    }).not.toThrow()
  })
})
