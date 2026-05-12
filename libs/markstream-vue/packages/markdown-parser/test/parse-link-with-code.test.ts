import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../src'

describe('parseMarkdownToStructure with code in link text', () => {
  it('should parse links with inline code correctly', () => {
    const md = getMarkdown()

    const mdText1 = `the [\`npm init\` command](https://docs.npmjs.com/creating-a-package-json-file).`
    const result1 = parseMarkdownToStructure(mdText1, md, { final: true })
    // 验证结果的基本结构
    expect(result1).toBeDefined()
    expect(result1.length).toBe(1)
    expect(result1[0].type).toBe('paragraph')
    expect(result1[0].children.length).toBe(3)

    // 验证链接节点
    const linkNode1 = result1[0].children[1]
    expect(linkNode1.type).toBe('link')
    expect(linkNode1.href).toBe('https://docs.npmjs.com/creating-a-package-json-file')
    expect(linkNode1.text).toBe('npm init command')
    expect(linkNode1.children.length).toBe(2)

    // 验证链接中的内联代码节点
    expect(linkNode1.children[0].type).toBe('inline_code')
    expect(linkNode1.children[0].code).toBe('npm init')
    expect(linkNode1.children[1].type).toBe('text')
    expect(linkNode1.children[1].content).toBe(' command')

    // 验证第二个链接
    const mdText2 = `[\`npm install\` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):`
    const result2 = parseMarkdownToStructure(mdText2, md, { final: true })

    expect(result2.length).toBe(1)
    const linkNode2 = result2[0].children[0]
    expect(linkNode2.type).toBe('link')
    expect(linkNode2.href).toBe('https://docs.npmjs.com/getting-started/installing-npm-packages-locally')
    expect(linkNode2.text).toBe('npm install command')
    expect(linkNode2.children.length).toBe(2)

    expect(linkNode2.children[0].type).toBe('inline_code')
    expect(linkNode2.children[0].code).toBe('npm install')
    expect(linkNode2.children[1].type).toBe('text')
    expect(linkNode2.children[1].content).toBe(' command')
  })
})
