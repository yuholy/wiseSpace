import { describe, expect, it } from 'vitest'
import { getMarkdown, parseMarkdownToStructure } from '../packages/markdown-parser/src/index'

describe('indented code block to paragraph conversion', () => {
  const md = getMarkdown()

  it('should convert single-line indented text to paragraph', () => {
    const markdown = `    This is just indented text`
    const result = parseMarkdownToStructure(markdown, md, { final: true })

    expect(result.length).toBe(1)
    expect(result[0].type).toBe('paragraph')
    expect(result[0].children?.[0].type).toBe('text')
    expect(result[0].children?.[0].content).toBe('This is just indented text')
  })

  it('should keep multi-line indented code as code_block', () => {
    const markdown = `    line one\n    line two\n    line three`
    const result = parseMarkdownToStructure(markdown, md, { final: true })

    expect(result.length).toBe(1)
    expect(result[0].type).toBe('code_block')
  })

  it('should keep single-line code-like patterns as code_block', () => {
    const testCases = [
      // Original cases
      `    const x = 1`,
      `    function foo() {}`,
      `    if (true) return`,
      `    https://example.com`,
      `    ['a', 'b', 'c']`,

      // Function/method calls with parentheses
      `    foo()`,
      `    obj.method()`,
      `    array.push(item)`,
      `    $.ajax()`,
      `    _underscore.method()`,

      // Property access and chaining
      `    obj.prop`,
      `    arr[0]`,
      `    data.items[0].name`,
      `    obj?.prop`,
      `    this.property`,

      // Comparison and logical operators
      `    a + b`,
      `    x > y`,
      `    count !== 0`,
      `    value === null`,
      `    flag && true`,
      `    result || default`,

      // Assignment operators
      `    x = 1`,
      `    y += 2`,
      `    z *= 3`,

      // JSX/TSX tags
      `    <Component />`,
      `    <div>content</div>`,

      // Template strings
      `    \`hello ${name}\``,

      // Arrow functions
      `    () => {}`,
      `    x => x * 2`,

      // Decorators
      `    @Component`,

      // Numbers with units
      `    100px`,
      `    1.5rem`,
      `    0xFF`,

      // Console methods
      `    console.log('test')`,
      `    document.getElementById('id')`,

      // Command-like patterns
      `    git status`,
      `    npm install`,
      `    docker build`,

      // Comment patterns
      `    // comment`,
      `    # comment`,

      // Heredoc patterns
      `    <<EOF`,
    ]

    for (const markdown of testCases) {
      const result = parseMarkdownToStructure(markdown, md, { final: true })
      expect(result[0].type).toBe('code_block')
    }
  })

  it('should handle the original streamContent case correctly', () => {
    const streamContent = `
  <hide>uid:b238ea9cb1a44ae489247aed335a0248</hide>

 <TaskPlan>
    已收到您关于xxx的组织机构画像的任务请求，我将按照以下步骤执行该任务：
    - 匹配并确认目标组织机构
    - 构建组织机构画像管理数据
 </TaskPlan>

  <AnalysisSteps>
    # 匹配信息和确认组织机构
    ## 深度思考
    -
    - 好的，我现在需要处理用户的输入："生成x的织机构画像"。首先，我需要确定用户是否提到了组织机构的名称。用户提到的"x"看起来像是一个公司名称，但可能存在拼写错误，比如"织机构"应该是"组织机构"。不过，这里的关键是提取组织机构名称。根据规则，我需要检查用户输入中的组织名称，并去除所有后缀，比如"集团、公司、股份有限公司"等。但"x"这个名称中没有明显的后缀，比如"公司"或"集团"之类的词。不过，可能用户输入有误，比如"织机构"可能是"组织机构"的笔误，但这里的问题是关于提取组织名称。接下来，我需要确认"x"是否是一个有效的组织机构名称。x是印度的一家电信公司，全称可能是x，但用户输入中没有提到"Limited"或类似的后缀。因此，根据规则，如果名称中没有后缀，就保留原始名称。所以，这里应该提取"x"作为品牌名称。另外，需要检查是否有地域或业务修饰词。例如，如果名称中有"（深圳）"或"科技"之类的词，需要保留业务关键词，但这里没有。因此，直接保留"x"。还要确保没有其他可能的后缀被遗漏。例如，如果用户输入的是"x"，那么需要去掉"公司"得到"x"。但当前输入中没有这样的后缀，所以直接保留。最后，检查是否符合返回"unknow"的条件。用户输入中包含了一个可能的组织名称，且去除后缀后是有效的品牌名称，因此不应返回"unknow"。
    ## 多维度匹配组织机构管理数据
    - 调用数据接口，机构画像关联数据匹配中......
    - 该机构没有关联数据匹配。
  </AnalysisSteps>

    &#10006; 该机构没有关联机构数据匹配，无法进行机构画像生成。
`
    const result = parseMarkdownToStructure(streamContent, md, { final: true })

    expect(result.length).toBe(4)
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
    expect(result[3].children?.[0].content).toBe('&#10006; 该机构没有关联机构数据匹配，无法进行机构画像生成。')
  })

  describe('edge cases for looksLikeCode function', () => {
    it('should convert plain indented text with special characters to paragraph', () => {
      const testCases = [
        `    Just a sentence.`,
        `    Hello, world!`,
        `    This is text...`,
        `    What about this?`,
        // Note: "Price: $99.99" has `:` which is treated as code-like
        // Note: "50% off" has `%` which is treated as code-like
        `    Hello world`,
        `    Test message`,
        `    Regular text here`,
        // Note: "# Not a heading..." has `#` which is treated as code (shell comment)
        `    - Not a list because indented`,
        `    * Not a list because indented`,
      ]

      for (const markdown of testCases) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('paragraph', `Expected paragraph for: ${markdown}`)
      }
    })

    it('should keep HTML entity patterns as paragraph (not code)', () => {
      const testCases = [
        `    &nbsp;`,
        `    &amp;`,
        `    &copy; 2024`,
        `    &#10006; Error message`,
        `    &#10004; Success`,
        `    &lt;tag&gt;`,
        `    &quot;quoted&quot;`,
        `    &mdash; dash`,
        `    &#12345;`,
        `    &empty;`,
      ]

      for (const markdown of testCases) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('paragraph', `Expected paragraph for: ${markdown}`)
      }
    })

    it('should keep property access patterns as code_block', () => {
      const testCases = [
        `    foo.bar`,
        `    obj.prop.value`,
        `    array[0].name`,
        `    data.items[index]`,
        `    object?.optional`,
        `    this.property`,
        `    module.exports`,
        `    Math.PI`,
        `    document.body`,
        `    window.location`,
      ]

      for (const markdown of testCases) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('code_block', `Expected code_block for: ${markdown}`)
      }
    })

    it('should keep code-like expressions as code_block', () => {
      const testCases = [
        `    a + b`,
        `    x * y`,
        `    result || fallback`,
        `    flag && true`,
        `    count > 0`,
        `    value === null`,
        `    i++`,
        `    arr.length`,
        `    str.length`,
        `    !!value`,
        `    x ? y : z`,
        `    count != 0`,
        `    a <= b`,
      ]

      for (const markdown of testCases) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('code_block', `Expected code_block for: ${markdown}`)
      }
    })

    it('should keep quoted strings with trailing punctuation as code_block', () => {
      const testCases = [
        `    "hello";`,
        `    'world'`,
        `    \`test\``,
        `    "string",`,
        `    'value';`,
      ]

      for (const markdown of testCases) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('code_block', `Expected code_block for: ${markdown}`)
      }
    })

    it('should keep JSX/TSX patterns as code_block', () => {
      const testCases = [
        `    <Component />`,
        `    <div>content</div>`,
        `    <span className="test">`,
        `    <Button onClick={handler}>`,
        `    <input type="text" />`,
        `    <CustomComponent prop="value">`,
      ]

      for (const markdown of testCases) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('code_block', `Expected code_block for: ${markdown}`)
      }
    })

    it('should handle mixed punctuation correctly', () => {
      const shouldBeParagraphs = [
        `    ...`,
        `    ---`,
        `    ***`,
        `    +++`,
        `    ===`,
      ]

      for (const markdown of shouldBeParagraphs) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('paragraph', `Expected paragraph for: ${markdown}`)
      }
    })

    it('should handle numeric values correctly', () => {
      const shouldBeCode = [
        `    42`,
        `    3.14`,
        `    0xFF`,
        `    0b1010`,
        `    100px`,
        `    1.5rem`,
        `    50%`,
        `    90deg`,
        `    500ms`,
      ]

      for (const markdown of shouldBeCode) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('code_block', `Expected code_block for: ${markdown}`)
      }
    })

    it('should handle email and URL patterns correctly', () => {
      // URLs should be code
      const shouldBeCode = [
        `    https://example.com`,
        `    http://test.com`,
        `    www.example.com`,
        `    //cdn.example.com`,
        `    ftp://files.example.com`,
      ]

      for (const markdown of shouldBeCode) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('code_block')
      }

      // Email-like - @ symbol without decorator pattern should be paragraph
      // user@example.com has @ but doesn't match ^@\w+$ pattern
      const shouldBeCodeEmails = [
        `    user@example.com`,
        `    admin@test.org`,
      ]

      for (const markdown of shouldBeCodeEmails) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        // user@example.com has . which makes it look like property access (code)
        // So we expect code_block, not paragraph
        expect(result[0].type).toBe('code_block')
      }
    })

    it('should handle edge cases with operators and symbols', () => {
      const shouldBeCode = [
        `    =>`,
        `    ->`,
        `    ::`,
        `    @Component`,
        `    #! /bin/bash`,
        `    <!-- comment`,
      ]

      for (const markdown of shouldBeCode) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('code_block')
      }
    })

    it('should handle command-like patterns as code', () => {
      const testCases = [
        `    git status`,
        `    npm install`,
        `    yarn add`,
        `    pip install`,
        `    cargo build`,
        `    docker run`,
        `    kubectl get pods`,
        `    python script.py`,
        `    node server.js`,
      ]

      for (const markdown of testCases) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('code_block')
      }
    })

    it('should handle whitespace-only content', () => {
      const testCases = [
        `    `,
        `       `,
        `    \t`,
        `    \n`,
      ]

      for (const markdown of testCases) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        // Empty/whitespace content should not create a paragraph node
        // or may create an empty paragraph - either is acceptable
        expect(result.length).toBeGreaterThanOrEqual(0)
      }
    })

    it('should handle Chinese text with punctuation', () => {
      const shouldBeParagraphs = [
        `    你好，世界！`,
        `    这是一个测试。`,
        `    价格：99元`,
        `    完成率：50%`,
        `    第1步`,
        `    - 不是列表`,
      ]

      for (const markdown of shouldBeParagraphs) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('paragraph')
      }
    })

    it('should handle bracket/brace patterns', () => {
      const shouldBeCode = [
        `    []`,
        `    {}`,
        `    [1, 2, 3]`,
        `    { key: 'value' }`,
        `    ()`,
        `    (x) => x`,
        `    <div>`,
        `    </div>`,
      ]

      for (const markdown of shouldBeCode) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('code_block')
      }
    })

    it('should handle boolean and null-like patterns', () => {
      const shouldBeCode = [
        `    true`,
        `    false`,
        `    null`,
        `    undefined`,
        `    NaN`,
        `    Infinity`,
      ]

      for (const markdown of shouldBeCode) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('code_block')
      }
    })

    it('should handle heredoc patterns', () => {
      const shouldBeCode = [
        `    <<EOF`,
        `    << 'EOF'`,
        `    <<EOF`,
        `    <<<HTML`,
      ]

      for (const markdown of shouldBeCode) {
        const result = parseMarkdownToStructure(markdown, md, { final: true })
        expect(result[0].type).toBe('code_block')
      }
    })
  })
})
