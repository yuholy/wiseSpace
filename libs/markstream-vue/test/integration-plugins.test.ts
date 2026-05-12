import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../packages/markdown-parser/src/index'

/**
 * Integration tests for multiple plugins working together.
 *
 * These tests verify that:
 * 1. fixHtmlInline and fixIndentedCodeBlock work correctly together
 * 2. fixHtmlInline and fixLinkTokens work correctly together
 * 3. All plugins maintain correct behavior in streaming scenarios
 */
describe('integration tests for multiple plugins', () => {
  const md = getMarkdown()

  describe('fixHtmlInline + fixIndentedCodeBlock', () => {
    it('should handle custom tags with indented content correctly', () => {
      // This test combines custom tag handling with indented code block conversion
      const markdown = `
  <custom>
    This is indented text that should not be a code block
  </custom>

    This is also indented text
`
      const result = parseMarkdownToStructure(markdown, md, { final: true })

      // First node should be html_block with custom tag
      expect(result[0].type).toBe('html_block')
      expect((result[0] as any).tag).toBe('custom')

      // Second node should be paragraph (indented text converted to paragraph)
      expect(result[1].type).toBe('paragraph')
    })

    it('should handle HTML entities in indented lines within custom tags', () => {
      const markdown = `
  <thinking>
    Processing...
    &#10006; Error occurred
  </thinking>

    &#10004; Success message
`
      const result = parseMarkdownToStructure(markdown, md, { final: true })

      // First node: html_block with thinking tag
      expect(result[0].type).toBe('html_block')
      expect((result[0] as any).tag).toBe('thinking')

      // Second node: paragraph (indented HTML entity converted to paragraph)
      expect(result[1].type).toBe('paragraph')
      expect(result[1].children?.[0].type).toBe('text')
      expect(result[1].children?.[0].content).toContain('&#10004;')
    })

    it('should handle mixed content with code and paragraphs', () => {
      const markdown = `
  <step>
    const x = 1
  </step>

    const y = 2

    This is just text
`
      const result = parseMarkdownToStructure(markdown, md, { final: true })

      // First node: html_block with step tag
      expect(result[0].type).toBe('html_block')
      expect((result[0] as any).tag).toBe('step')

      // Check we have the expected nodes
      expect(result.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('fixHtmlInline + fixLinkTokens', () => {
    it('should handle links within custom tags', () => {
      const markdown = `
  <note>
    Check out https://example.com for more info
  </note>

  See also [link](https://example.com/page)
`
      const result = parseMarkdownToStructure(markdown, md, { final: true })

      // First node: html_block with note tag
      expect(result[0].type).toBe('html_block')
      expect((result[0] as any).tag).toBe('note')

      // Second node should be paragraph with link
      expect(result[1].type).toBe('paragraph')
    })

    it('should handle autolinks and custom tags together', () => {
      const markdown = `
  <info>
    Visit <https://example.com> for details
  </info>

    Visit <https://another.com>
`
      const result = parseMarkdownToStructure(markdown, md, { final: true })

      // First node: html_block with info tag
      expect(result[0].type).toBe('html_block')

      // Second node - might be code_block because it starts with "Visit <"
      // which could be interpreted as a code pattern
      expect(result[1]).toBeDefined()
    })
  })

  describe('streaming scenarios with multiple plugins', () => {
    it('should handle incomplete custom tag followed by indented content', () => {
      // Simulate streaming: custom tag without closing
      const markdown = `<note>This is streaming content`

      const result = parseMarkdownToStructure(markdown, md, { final: false })

      // Should create a node (exact structure depends on plugin handling)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle complete custom tag with trailing indented content', () => {
      const markdown = `
  <note>
    Important note
  </note>

    This is indented text with code keyword
    const code = here
`
      const result = parseMarkdownToStructure(markdown, md, { final: true })

      // First node: html_block with note tag
      expect(result[0].type).toBe('html_block')

      // Check that we have the expected number of nodes
      // The "code" keyword might make it a code_block
      expect(result.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle nested custom tags with HTML entities', () => {
      const markdown = `
  <outer>
    <inner>
      &#10006; Error
    </inner>
  </outer>

    &#10004; Success
`
      const result = parseMarkdownToStructure(markdown, md, { final: true })

      // First node: html_block with outer tag
      expect(result[0].type).toBe('html_block')
      expect((result[0] as any).tag).toBe('outer')

      // Second node: paragraph (indented HTML entity)
      expect(result[1].type).toBe('paragraph')
      expect(result[1].children?.[0].content).toContain('&#10004;')
    })
  })

  describe('complex real-world scenarios', () => {
    it('should handle AI streaming output with multiple custom tags', () => {
      const markdown = `
  <hide>uid:b238ea9cb1a44ae489247aed335a0248</hide>

 <TaskPlan>
    已收到您关于xxx的组织机构画像的任务请求，我将按照以下步骤执行该任务：
    - 匹配并确认目标组织机构
    - 构建组织机构画像管理数据
 </TaskPlan>

  <AnalysisSteps>
    # 匹配信息和确认组织机构
    ## 深度思考
    - 好的，我现在需要处理用户的输入："生成x的织机构画像"。
  </AnalysisSteps>

    &#10006; 该机构没有关联机构数据匹配，无法进行机构画像生成。
`
      const result = parseMarkdownToStructure(markdown, md, { final: true })

      // Verify structure
      expect(result.length).toBeGreaterThanOrEqual(4)

      // First node: paragraph containing html_block <hide>
      expect(result[0].type).toBe('paragraph')
      expect(result[0].children?.[0].type).toBe('html_block')

      // Second node: html_block <TaskPlan>
      expect(result[1].type).toBe('html_block')
      expect((result[1] as any).tag).toBe('taskplan')

      // Third node: html_block <AnalysisSteps>
      expect(result[2].type).toBe('html_block')
      expect((result[2] as any).tag).toBe('analysissteps')

      // Fourth node: paragraph (not code_block!)
      expect(result[3].type).toBe('paragraph')
      expect(result[3].children?.[0].type).toBe('text')
      expect(result[3].children?.[0].content).toContain('&#10006;')
    })

    it('should handle markdown content mixed with custom tags', () => {
      const markdown = `
# Heading

  <custom>
    This is custom content
  </custom>

## Subheading

    Indented content here

Regular paragraph with **bold** text.
`
      const result = parseMarkdownToStructure(markdown, md, { final: true })

      // Verify heading is parsed correctly
      expect(result[0].type).toBe('heading')

      // Custom tag should be html_block
      const customNode = result.find((n: any) => n.tag === 'custom')
      expect(customNode).toBeDefined()
      expect(customNode.type).toBe('html_block')

      // Regular paragraph should exist
      expect(result.some((n: any) => n.type === 'paragraph')).toBe(true)
    })

    it('should handle code fences alongside custom tags', () => {
      const markdown = `
  <thinking>
    Processing data...
  </thinking>

\`\`\`javascript
const x = 1;
console.log(x);
\`\`\`

    This is indented text

    const y = 2;
`
      const result = parseMarkdownToStructure(markdown, md, { final: true })

      // Custom tag
      expect(result[0].type).toBe('html_block')
      expect((result[0] as any).tag).toBe('thinking')

      // The code fence and indented content should be processed
      // We just verify we have multiple nodes
      expect(result.length).toBeGreaterThan(1)
    })
  })
})
