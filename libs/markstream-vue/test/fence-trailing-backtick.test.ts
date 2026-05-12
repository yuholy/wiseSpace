import { parseFenceToken } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('fence parser trailing fence cleanup', () => {
  it('removes a trailing line that only contains backticks from token.content', () => {
    const token: any = {
      type: 'fence',
      info: 'ts',
      content: 'const a = 1\n```',
      map: [0, 2],
    }

    const node = parseFenceToken(token as any)
    expect(node).toBeDefined()
    expect((node as any).code).toBe('const a = 1')
    expect((node as any).raw).toBe('const a = 1')
  })

  it('keeps legitimate content that contains backticks not on their own line', () => {
    const token: any = {
      type: 'fence',
      info: 'text',
      content: 'console.log(\'`inline`)\n', // backtick inside code, not a fence line
      map: [0, 2],
    }
    const node = parseFenceToken(token as any)
    expect((node as any).code).toBe('console.log(\'`inline`)\n')
    expect((node as any).raw).toBe('console.log(\'`inline`)\n')
  })
})
