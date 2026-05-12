import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('custom html nested same-tag regression', () => {
  it('keeps the outer custom tag intact when the same tag is nested inside it', () => {
    const markdown = `<think>outer start

<think>inner done</think>

outer end</think>`

    const tags = ['think']
    const md = getMarkdown('custom-html-nested-same-tag-regression', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags, final: true }) as any[]

    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type).toBe('think')
    expect(nodes[0]?.loading).toBe(false)
    expect(String(nodes[0]?.content ?? '')).toBe('outer start\n\n<think>inner done</think>\n\nouter end')
    expect(String(nodes[0]?.raw ?? '')).toContain('</think>')
  })

  it('keeps an unknown html-like tag as one html_block even without customHtmlTags', () => {
    const markdown = `<think>
嗯，用户让我用50字介绍Golang的优缺点。首先，我需要明确Golang是什么，它又被称为Go，是由Google开发的一种静态类型编程语言。我得想它的主要优势和劣势。


优点方面，Golang简单直接，这可能是因为语法简洁，容易学习。高性能也是一个重点，因为它编译成机器码，运行速度快。另外，Golang有内置的并发支持，比如goroutine和channel，这对于处理多任务非常方便，同时还自带了垃圾回收，减少了内存管理的负担。


缺点的话，语法虽然简单，但功能相对有限，可能不适合需要复杂表达式的场景。另外，对于一些高级特性，比如泛型，直到1.18才引入，之前的版本可能不够完善。此外，第三方库的数量和成熟度可能没有其他语言如Python或Java丰富，这对某些项目来说可能是个限制。
</think>`

    const md = getMarkdown('custom-html-unknown-block-regression')
    const nodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type).toBe('html_block')
    expect(nodes[0]?.loading).toBe(false)
    expect(String(nodes[0]?.content ?? '')).toContain('优点方面')
    expect(String(nodes[0]?.content ?? '')).toContain('缺点的话')
    expect(String(nodes[0]?.content ?? '')).toContain('</think>')
  })

  it('keeps the pancreatic-cancer think block as one html_block without customHtmlTags', () => {
    const markdown = `<think>
胰腺癌是一种恶性程度很高的消化系统肿瘤，早期症状隐匿，常见表现包括腹痛、黄疸、消瘦和食欲下降。由于发现时多已属中晚期，治疗难度较大，预后相对较差。

目前主要治疗方式包括手术、化疗、放疗及靶向/免疫治疗，但具体方案需结合分期和患者情况综合判断。
</think>`

    for (const final of [false, true]) {
      const md = getMarkdown(`custom-html-pancreatic-unknown-${final}`)
      const nodes = parseMarkdownToStructure(markdown, md, { final }) as any[]

      expect(nodes).toHaveLength(1)
      expect(nodes[0]?.type).toBe('html_block')
      expect(nodes[0]?.tag).toBe('think')
      expect(nodes[0]?.loading).toBe(false)
      expect(String(nodes[0]?.content ?? '')).toContain('胰腺癌是一种恶性程度很高的消化系统肿瘤')
      expect(String(nodes[0]?.content ?? '')).toContain('目前主要治疗方式包括手术')
      expect(String(nodes[0]?.content ?? '')).toContain('</think>')
    }
  })

  it('forces loading=false at final=true for an unclosed pancreatic-cancer think block without customHtmlTags', () => {
    const markdown = `<think>
胰腺癌是一种恶性程度很高的消化系统肿瘤，早期症状隐匿，常见表现包括腹痛、黄疸、消瘦和食欲下降。

目前主要治疗方式包括手术、化疗、放疗及靶向/免疫治疗，但具体方案需结合分期和患者情况综合判断。`

    const md = getMarkdown('custom-html-pancreatic-unknown-open')
    const streamingNodes = parseMarkdownToStructure(markdown, md, { final: false }) as any[]
    const finalNodes = parseMarkdownToStructure(markdown, md, { final: true }) as any[]

    expect(streamingNodes).toHaveLength(1)
    expect(streamingNodes[0]?.type).toBe('html_block')
    expect(streamingNodes[0]?.loading).toBe(true)

    expect(finalNodes).toHaveLength(1)
    expect(finalNodes[0]?.type).toBe('html_block')
    expect(finalNodes[0]?.loading).toBe(false)
    expect(String(finalNodes[0]?.content ?? '')).toContain('胰腺癌是一种恶性程度很高的消化系统肿瘤')
  })

  it('keeps custom html blocks intact when attribute values contain ">"', () => {
    const markdown = `<think data-x="a>b">
outer start

<think data-y="c>d">inner done</think>

outer end</think>`

    const tags = ['think']
    const md = getMarkdown('custom-html-quoted-gt-regression', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags, final: true }) as any[]

    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type).toBe('think')
    expect(nodes[0]?.loading).toBe(false)
    expect(nodes[0]?.attrs).toEqual([['data-x', 'a>b']])
    expect(String(nodes[0]?.content ?? '')).toContain('<think data-y="c>d">inner done</think>')
    expect(String(nodes[0]?.content ?? '')).toContain('outer end')
  })

  it('keeps the outer custom tag loading in streaming mode when only the nested same tag is closed', () => {
    const markdown = `<think>outer start

<think>inner done</think>

outer end`

    const tags = ['think']
    const md = getMarkdown('custom-html-nested-same-tag-streaming', { customHtmlTags: tags })
    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags, final: false }) as any[]

    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type).toBe('think')
    expect(nodes[0]?.loading).toBe(true)
    expect(String(nodes[0]?.content ?? '')).toBe('outer start\n\n<think>inner done</think>\n\nouter end')
  })
})
