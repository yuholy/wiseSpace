function extractThinkingAttrs(rawContent: string) {
  const match = rawContent.match(/<thinking([^>]*)>/i)
  if (!match)
    return []

  const attrString = match[1] || ''
  const attrs: Array<{ name: string, value: string | boolean }> = []
  const attrRegex = /([^\s=]+)(?:="([^"]*)")?/g
  let nextMatch: RegExpExecArray | null

  while ((nextMatch = attrRegex.exec(attrString)) !== null) {
    const attrName = nextMatch[1]
    const attrValue = nextMatch[2] || true
    attrs.push({ name: attrName, value: attrValue })
  }

  return attrs
}

function stripThinkingWrapper(rawContent: string) {
  return rawContent
    .replace(/<thinking[^>]*>/i, '')
    .replace(/<\/thinking>\s*$/i, '')
}

export const THINKING_PARSE_OPTIONS = {
  preTransformTokens(tokens: any[]) {
    return tokens.map((token) => {
      if (token?.type !== 'inline' || typeof token.content !== 'string' || !token.content.includes('<thinking'))
        return token

      const children = Array.isArray(token.children) ? token.children : []
      token.children = children.map((child) => {
        if (child?.type !== 'html_block' || child?.tag !== 'thinking')
          return child

        return {
          type: 'thinking',
          loading: child.loading,
          attrs: extractThinkingAttrs(String(child.content || '')),
          content: stripThinkingWrapper(String(child.content || '')),
        }
      })

      return token
    })
  },
} as const
