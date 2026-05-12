import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../src'

function collectByType(nodes: any[], type: string) {
  const out: any[] = []
  const walk = (node: any) => {
    if (!node)
      return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node.type === type)
      out.push(node)
    if (Array.isArray(node.children))
      node.children.forEach(walk)
    if (Array.isArray(node.items))
      node.items.forEach(walk)
  }
  walk(nodes)
  return out
}

function collectText(nodes: any[]) {
  return collectByType(nodes, 'text').map((node: any) => String(node.content ?? '')).join('')
}

describe('numeric reference streaming stability', () => {
  it('keeps completed numeric references stable during char-by-char chained references', () => {
    const md = getMarkdown('numeric-reference-streaming-chain')
    const full = '随便输入一些文字[1][2][3]'
    const firstReady = full.indexOf('[1]') + '[1]'.length
    const secondOpens = full.indexOf('[2]')
    const secondReady = secondOpens + '[2]'.length
    const thirdReady = full.indexOf('[3]') + '[3]'.length

    for (let i = 1; i <= full.length; i++) {
      const chunk = full.slice(0, i)
      const nodes = parseMarkdownToStructure(chunk, md, { final: false })
      const ids = collectByType(nodes, 'reference').map((node: any) => String(node.id ?? ''))

      if (i >= firstReady)
        expect(ids[0], `prefix(${i}): ${chunk}`).toBe('1')
      if (i > secondOpens)
        expect(ids[0], `prefix(${i}): ${chunk}`).toBe('1')
      if (i >= secondReady)
        expect(ids.slice(0, 2), `prefix(${i}): ${chunk}`).toEqual(['1', '2'])
      if (i >= thirdReady)
        expect(ids.slice(0, 3), `prefix(${i}): ${chunk}`).toEqual(['1', '2', '3'])
    }
  })

  it('keeps the numeric reference once an adjacent inline link becomes distinguishable', () => {
    const md = getMarkdown('numeric-reference-streaming-link')
    const full = '随便输入一些文字 [1][百度](www.baidu.com)'
    const distinguishableAt = full.indexOf('[百度](') + '[百度]('.length

    for (let i = 1; i <= full.length; i++) {
      const chunk = full.slice(0, i)
      const nodes = parseMarkdownToStructure(chunk, md, { final: false })
      const ids = collectByType(nodes, 'reference').map((node: any) => String(node.id ?? ''))
      const links = collectByType(nodes, 'link')

      if (i >= distinguishableAt) {
        expect(ids[0], `prefix(${i}): ${chunk}`).toBe('1')
        expect(collectText(nodes), `prefix(${i}): ${chunk}`).not.toContain('[1]')
        expect(links, `prefix(${i}): ${chunk}`).toHaveLength(1)
        expect(String(links[0]?.text ?? ''), `prefix(${i}): ${chunk}`).toContain('百度')
        expect(Boolean(links[0]?.loading), `prefix(${i}): ${chunk}`).toBe(i < full.length)
      }
    }

    const finalNodes = parseMarkdownToStructure(full, md, { final: true })
    const finalIds = collectByType(finalNodes, 'reference').map((node: any) => String(node.id ?? ''))
    const links = collectByType(finalNodes, 'link')

    expect(finalIds).toEqual(['1'])
    expect(links).toHaveLength(1)
    expect(String(links[0]?.href ?? '')).toBe('www.baidu.com')
  })

  it('keeps the completed numeric reference while trailing text streams in', () => {
    const md = getMarkdown('numeric-reference-streaming-suffix')
    const full = '随便输入一些文字[1]后面还有文字'
    const readyAt = full.indexOf('[1]') + '[1]'.length

    for (let i = readyAt; i <= full.length; i++) {
      const chunk = full.slice(0, i)
      const nodes = parseMarkdownToStructure(chunk, md, { final: false })
      const ids = collectByType(nodes, 'reference').map((node: any) => String(node.id ?? ''))

      expect(ids[0], `prefix(${i}): ${chunk}`).toBe('1')
    }
  })

  it('still respects validateLink when the trailing markdown link is being recovered', () => {
    const md = getMarkdown('numeric-reference-streaming-validate')
    md.set?.({ validateLink: (url: string) => !/^\s*javascript:/i.test(url.trim()) })

    const chunk = '随便输入一些文字 [1][百度](javascript:alert(1'
    const nodes = parseMarkdownToStructure(chunk, md, { final: false })
    const ids = collectByType(nodes, 'reference').map((node: any) => String(node.id ?? ''))
    const links = collectByType(nodes, 'link')

    expect(ids).toEqual(['1'])
    expect(links).toHaveLength(1)
    expect(String(links[0]?.text ?? '')).toBe('百度')
    expect(String(links[0]?.href ?? '')).not.toMatch(/javascript:/i)
    expect(Boolean(links[0]?.loading)).toBe(true)
    expect(collectText(nodes)).toContain('百度')
  })
})
