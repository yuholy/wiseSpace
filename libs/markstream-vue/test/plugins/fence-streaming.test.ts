import { getMarkdown } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

function extractFenceTokens(md: ReturnType<typeof getMarkdown>, src: string) {
  const tokens = md.parse(src, {}) as any[]
  return tokens.filter((t: any) => t.type === 'fence')
}

describe('fence streaming plugin', () => {
  it('sets closed=true for closed ``` fences', () => {
    const md = getMarkdown('t')
    const src = '```ts\nconst a=1\n```\n'
    const [f] = extractFenceTokens(md, src)
    expect(f?.meta?.closed).toBe(true)
  })

  it('sets closed=false for unclosed ``` fences', () => {
    const md = getMarkdown('t')
    const src = '```ts\nconst a=1\n' // no closing fence
    const [f] = extractFenceTokens(md, src)
    expect(f?.meta?.closed).toBe(false)
  })

  it('supports ~~~ fences and closed detection', () => {
    const md = getMarkdown('t')
    const src = '~~~js\nlet x=1\n~~~\n'
    const [f] = extractFenceTokens(md, src)
    expect(f?.meta?.closed).toBe(true)
  })
})
