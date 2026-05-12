import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'
import { describe, expect, it } from 'vitest'

describe('html_block split after <br/>', () => {
  it('parses <br/> as a standalone html_block and keeps following paragraph separate', () => {
    const tags = ['thinking']
    const md = getMarkdown('html-block-br-splitting', { customHtmlTags: tags })
    const markdown = `<br/>

The easiest way to start the Dify server is through [Docker Compose](docker/docker-compose.yaml). Before running Dify with the following commands, make sure that [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) are installed on your machine:`

    const nodes = parseMarkdownToStructure(markdown, md, { customHtmlTags: tags }) as any[]

    expect(nodes.length).toBeGreaterThanOrEqual(2)
    expect(nodes[0].type).toBe('html_block')
    expect(nodes[0].tag).toBe('br')
    expect(String(nodes[0].raw ?? '').trim()).toBe('<br/>')

    expect(nodes[1].type).toBe('paragraph')
    expect(String(nodes[1].raw ?? '')).toContain('The easiest way to start the Dify server')
  })
})
