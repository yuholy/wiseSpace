import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('math block with spaces between characters', () => {
  it('should parse $$ with spaced subscript as math_block', () => {
    const md = getMarkdown('test')

    const markdown = `$$
f _ { t r a n s f e r } : M _ { s }  M _ { l }
$$`

    const tokens = md.parse(markdown, {})
    console.log('=== Tokens ===')
    tokens.forEach((token, i) => {
      console.log(`  ${i}: type=${token.type} tag=${token.tag} content="${String(token.content || '').slice(0, 60)}" markup=${token.markup}`)
    })

    const mathBlocks = tokens.filter(token => token.type === 'math_block')
    console.log(`\nMath blocks found: ${mathBlocks.length}`)
    mathBlocks.forEach((block, i) => {
      console.log(`  Block ${i + 1}: content="${block.content}" markup="${block.markup}"`)
    })

    // 应该识别为 math_block
    expect(mathBlocks.length).toBeGreaterThanOrEqual(1)
    expect(mathBlocks[0].content).toContain('f _ { t r a n s f e r }')
  })

  it('should parse the spaced subscript math with parseMarkdownToStructure', () => {
    const md = getMarkdown('test')

    const markdown = `$$
f _ { t r a n s f e r } : M _ { s }  M _ { l }
$$`

    const nodes = parseMarkdownToStructure(markdown, md)
    console.log('=== Nodes ===')
    nodes.forEach((node, i) => {
      console.log(`  ${i}: type=${node.type} content="${String((node as any).content || '').slice(0, 60)}"`)
    })

    // 检查是否有 math_block 节点
    const mathBlocks = nodes.filter(node => node.type === 'math_block')
    console.log(`\nMath block nodes found: ${mathBlocks.length}`)
    mathBlocks.forEach((block, i) => {
      console.log(`  Block ${i + 1}: content="${String((block as any).content)}"`)
    })

    // 应该识别为 math_block 节点
    expect(mathBlocks.length).toBeGreaterThanOrEqual(1)
    expect(String((mathBlocks[0] as any).content)).toContain('f _ { t r a n s f e r }')
  })
})
