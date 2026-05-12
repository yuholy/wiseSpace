---
description: 从 react-markdown 迁移到 markstream-react，并了解渲染器替换、插件审计与非 1:1 定制差异。
---

# 从 react-markdown 迁移

如果你当前使用 `react-markdown` 渲染 Markdown，迁移到 `markstream-react` 通常分两步：

1. 先替换渲染组件。
2. 再迁移原来依赖 `remark` / `rehype` 的自定义组件和插件逻辑。

::: warning 不一定是 1:1 替换
`markstream-react` 并不是所有 `react-markdown` 场景下的无脑直替。简单场景迁移很快，但如果你的项目挂了较长的 `remarkPlugins` / `rehypePlugins` 链，建议逐项审视后再切换。
:::

::: tip 查看在线演示
可以直接打开 [React migration demo](https://markstream-react.pages.dev/migration-demo)，查看一套合成的 before / after 示例，以及一份按迁移 Skill 风格生成的审计报告。
:::

## 什么情况下继续使用 `react-markdown`

- 你只渲染完整、静态的 Markdown。
- 你的项目高度依赖 unified 生态里的 `remark` / `rehype` 插件链。
- 你需要开箱即用的 HTML allow/deny list 组件 props。

## 什么情况下更适合 `markstream-react`

- 你在渲染 AI / 聊天 / SSE 这种“内容边到边显示”的流式输出。
- 你需要渐进式 Mermaid、D2、KaTeX 或 Monaco 代码块体验。
- 你需要针对大文档做视口优先的重节点调度。
- 你希望从“字符串进、元素出”的模型升级到更适合流式更新的 AST 模型。

## 最小替换示例

```tsx
// before
import Markdown from 'react-markdown'

export function Article({ markdown }: { markdown: string }) {
  return <Markdown>{markdown}</Markdown>
}
```

```tsx
// after
import MarkdownRender from 'markstream-react'
import 'markstream-react/index.css'

export function Article({ markdown }: { markdown: string }) {
  return <MarkdownRender content={markdown} />
}
```

如果这一步就已经能正常渲染你的内容，后续迁移可以按需逐步做。

## 心智模型变化

- `react-markdown` 更偏 HTML tag 视角：自定义渲染通常通过 `components={{ h1, a, code }}` 完成。
- `markstream-react` 更偏 AST node 视角：自定义渲染通常通过 `setCustomComponents(...)` 和 `heading`、`link`、`code_block`、`inline_code` 这类节点类型完成。
- `react-markdown` 的核心是 `remark` -> `rehype` 流水线。
- `markstream-react` 的核心是面向流式场景的 parser AST + node renderer。

这意味着 `components.h1` 迁过来后通常不会还是 `h1`，而是变成一个 `heading` 渲染器，再根据 `node.level` 判断具体级别。

## API 对照表

| `react-markdown` | `markstream-react` | 说明 |
|---|---|---|
| `children` | `content` | Markdown 字符串通过 `content` 传入。 |
| `components` | `setCustomComponents(id?, mapping)` | `react-markdown` 的 key 是 HTML tag；`markstream-react` 的 key 是节点类型，如 `heading`、`link`、`paragraph`、`image`、`code_block`、`inline_code`。 |
| `remarkPlugins` | `customMarkdownIt` | 改用 `markdown-it` 插件，而不是 `remark` 插件。很多常见 Markdown 能力本身已经内建。 |
| `remarkPlugins={[remarkGfm]}` | 很多时候可以删掉 | 表格、任务列表、删除线、代码围栏等常见语法解析器本身已经支持。若你依赖某些边缘行为，删掉前请回归验证。 |
| `rehypePlugins` | 没有直接等价物 | `markstream-react` 没有公开的 `rehype` 阶段。请改用自定义节点渲染器、`customHtmlTags`、`parseOptions` 或对 `nodes` 做后处理。 |
| `rehypeRaw` | 通常不再需要 | HTML-like 标签本来就会被解析。如果是自定义标签，优先使用 `customHtmlTags={['thinking']}` + `setCustomComponents`。 |
| `skipHtml` | 没有直接 prop | HTML 节点默认会渲染，但内置 HTML 渲染器会拦截危险标签/属性和不安全 URL。如果你必须彻底禁用 HTML，请自行在输入阶段或节点阶段过滤。 |
| `allowedElements` / `disallowedElements` / `allowElement` | 没有直接 prop | 需要你自己过滤 `nodes` 树，或者替换指定节点的渲染器。 |
| `unwrapDisallowed` | 手动做节点过滤 | 如果你需要“去掉外层标签但保留子节点”的行为，需要在节点后处理阶段自己实现。 |
| `urlTransform` | `parseOptions.validateLink` + 自定义 `link` 渲染器 | `validateLink` 适合做放行/拦截；如果你要改写 URL，请在自定义 `link` 渲染器或节点后处理里完成。 |

## 迁移 `components`

`react-markdown` 里的自定义渲染，一般是围绕 HTML tag 写的：

```tsx
import Markdown from 'react-markdown'

<Markdown
  components={{
    h1({ children }) {
      return <h1 className="docs-heading">{children}</h1>
    },
    a({ href, children }) {
      return <a href={href} target="_blank" rel="noreferrer">{children}</a>
    },
  }}
>
  {markdown}
</Markdown>
```

在 `markstream-react` 里，对应思路是按节点类型改写：

```tsx
import type { NodeComponentProps } from 'markstream-react'
import MarkdownRender, { setCustomComponents } from 'markstream-react'
import 'markstream-react/index.css'

function CustomHeading({ node, ctx, renderNode, indexKey }: NodeComponentProps<any>) {
  const Tag = `h${node.level || 1}` as keyof JSX.IntrinsicElements

  return (
    <Tag className="docs-heading">
      {node.children?.map((child: any, i: number) =>
        renderNode && ctx
          ? renderNode(child, `${String(indexKey)}-heading-${i}`, ctx)
          : null,
      )}
    </Tag>
  )
}

function CustomLink({ node, ctx, renderNode, indexKey }: NodeComponentProps<any>) {
  return (
    <a href={node.href} target="_blank" rel="noreferrer">
      {node.children?.map((child: any, i: number) =>
        renderNode && ctx
          ? renderNode(child, `${String(indexKey)}-link-${i}`, ctx)
          : null,
      )}
    </a>
  )
}

setCustomComponents('docs', {
  heading: CustomHeading,
  link: CustomLink,
})

export function Article({ markdown }: { markdown: string }) {
  return <MarkdownRender customId="docs" content={markdown} />
}
```

常见映射可以这样理解：

- `h1` ... `h6` -> `heading` + `node.level`
- `a` -> `link`
- `p` -> `paragraph`
- `img` -> `image`
- `code` / `pre` -> `code_block` 或 `inline_code`
- 自定义 HTML-like 标签 -> `customHtmlTags` + `setCustomComponents`

## 迁移代码高亮

很多 `react-markdown` 项目会通过覆盖 `components.code` 接第三方高亮器。

到了 `markstream-react`，一般有三种选择：

- 继续使用默认 `CodeBlockNode`，拿到 Monaco 驱动的代码块体验。
- 把 `code_block` 切到 `MarkdownCodeBlockNode`，使用更轻量的 Shiki 方案。
- 设置 `renderCodeBlocksAsPre`，直接回退到普通 `<pre><code>`。

下面是切到 Shiki 的例子：

```tsx
import MarkdownRender, { MarkdownCodeBlockNode, setCustomComponents } from 'markstream-react'

setCustomComponents('docs', {
  code_block: ({ node, isDark, ctx }: any) => (
    <MarkdownCodeBlockNode
      node={node}
      isDark={isDark}
      stream={ctx?.codeBlockStream}
      {...(ctx?.codeBlockProps || {})}
    />
  ),
})

export function Article({ markdown }: { markdown: string }) {
  return <MarkdownRender customId="docs" content={markdown} />
}
```

## 迁移插件逻辑

### `remarkPlugins`

如果你之前用 `remarkPlugins` 做语法扩展，最接近的迁移点是 `customMarkdownIt`。

```tsx
import type { MarkdownIt } from 'markdown-it-ts'
import { full as markdownItEmoji } from 'markdown-it-emoji'
import MarkdownRender from 'markstream-react'

function withEmoji(md: MarkdownIt) {
  md.use(markdownItEmoji)
  return md
}

export function Article({ markdown }: { markdown: string }) {
  return <MarkdownRender content={markdown} customMarkdownIt={withEmoji} />
}
```

### `rehypePlugins`

`markstream-react` 里没有直接对等的 `rehype` 阶段。

如果你原来的 `rehype` 逻辑是为了做这些事：

- HTML 树重写：迁到自定义节点渲染器或节点后处理。
- 自定义 HTML-like block：优先改成 `customHtmlTags`。
- 安全过滤：改用 `parseOptions.validateLink`、自定义渲染器或节点过滤。

## HTML、自定义标签与安全

`react-markdown` 默认通常会转义 HTML，除非你显式加上 `rehypeRaw`。

`markstream-react` 会直接解析 HTML-like 节点，而且内置 HTML 渲染器会去掉被拦截的标签、危险事件属性以及不安全的 URL。

如果你以前接 `rehypeRaw` 主要是为了支持 `<thinking>` 这类自定义标签，推荐迁移方式如下：

```tsx
import type { NodeComponentProps } from 'markstream-react'
import MarkdownRender, { setCustomComponents } from 'markstream-react'

function ThinkingNode({ node }: NodeComponentProps<any>) {
  return <aside className="thinking-box">{node.content}</aside>
}

setCustomComponents('chat', { thinking: ThinkingNode })

export function Message({ markdown }: { markdown: string }) {
  return (
    <MarkdownRender
      customId="chat"
      content={markdown}
      customHtmlTags={['thinking']}
    />
  )
}
```

## 流式升级路径

你不需要第一天就把流式能力全部接上。比较实用的迁移路径是：

1. 先把 `react-markdown` 换成 `MarkdownRender`，继续使用 `content`。
2. 再迁移自定义渲染器和插件逻辑。
3. 如果后面要接 SSE / 聊天流输出，再把解析挪到组件外，改传 `nodes`。

```tsx
import MarkdownRender from 'markstream-react'
import { getMarkdown, parseMarkdownToStructure } from 'stream-markdown-parser'

const md = getMarkdown('chat')
const nodes = parseMarkdownToStructure(buffer, md, { final: done })

export function Message() {
  return (
    <MarkdownRender
      nodes={nodes}
      viewportPriority
      deferNodesUntilVisible
    />
  )
}
```

对于高频流式输出来说，这个 `nodes` 方案通常就是迁移到 `markstream-react` 的最大价值之一。

## 迁移检查清单

- 把 `<Markdown>{markdown}</Markdown>` 改成 `<MarkdownRender content={markdown} />`
- 引入 `markstream-react/index.css`
- 把 `components` 覆盖迁到 `setCustomComponents(customId, mapping)`
- 先删除已经冗余的插件，再按需补回真正还需要的能力
- 重新检查任何依赖 `rehype` 的 HTML 过滤或变换逻辑
- 如果你的应用要渲染增量输出，进一步从 `content` 升级到解析后的 `nodes`

## 相关文档

- [React 安装](/zh/guide/react-installation)
- [React 组件与 API](/zh/guide/react-components)
- [解析器 API](/zh/guide/parser-api)
