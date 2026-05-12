import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../src'

function walk(node: any, visit: (n: any) => void) {
  if (!node)
    return
  if (Array.isArray(node)) {
    for (const n of node)
      walk(n, visit)
    return
  }
  visit(node)
  if (Array.isArray(node.children))
    walk(node.children, visit)
  if (Array.isArray(node.items))
    walk(node.items, visit)
}

describe('streaming ordered list - avoid transient gaps', () => {
  it('suppresses transient nested lists and leaked newlines while streaming', () => {
    const md = getMarkdown()
    const full = `法：

1. **递归实现**：直接

2. **记忆化递归（动态规划）**：使
`

    const marker1 = full.indexOf('1.')
    const marker2 = full.indexOf('\n\n2.')
    const cuts = [
      marker1 + 2, // "1."
      marker1 + 3, // "1. "
      marker1 + 4, // "1. *"
      marker1 + 5, // "1. **"
      full.indexOf('直接') + '直接'.length + 1, // right after item 1
      marker2 + 3, // "\n\n2"
      marker2 + 4, // "\n\n2."
    ]
      .filter(n => Number.isFinite(n) && n > 0 && n <= full.length)
      .filter((n, i, arr) => arr.indexOf(n) === i)
      .sort((a, b) => a - b)

    for (const cut of cuts) {
      const chunk = full.slice(0, cut)
      const nodes = parseMarkdownToStructure(chunk, md, { final: false })

      const unorderedLists: any[] = []
      const newlineTextNodes: string[] = []
      const markerParagraphs: string[] = []
      walk(nodes, (n) => {
        if (n?.type === 'list' && n.ordered === false)
          unorderedLists.push(n)
        if (n?.type === 'text' && typeof n.content === 'string' && /[\r\n]/.test(n.content))
          newlineTextNodes.push(n.content)
        if (n?.type === 'paragraph' && typeof n.raw === 'string' && /^\s*\d+[.)]?\s*$/.test(n.raw))
          markerParagraphs.push(n.raw)
      })

      expect(unorderedLists, `unexpected unordered list at cut=${cut}`).toHaveLength(0)
      expect(newlineTextNodes, `unexpected newline text nodes at cut=${cut}`).toHaveLength(0)
      expect(markerParagraphs, `unexpected marker paragraph at cut=${cut}`).toHaveLength(0)
    }
  })
})
