---
description: Migrate from react-markdown to markstream-react with guidance on renderer replacement, plugin audits, and non-1:1 customization gaps.
---

# Migrate from react-markdown

If your current React Markdown renderer is `react-markdown`, moving to `markstream-react` is usually a two-step change:

1. Replace the renderer component.
2. Migrate any custom components or plugin logic that was tied to the `remark` / `rehype` pipeline.

::: warning Not Always 1:1
`markstream-react` is not a drop-in replacement for every `react-markdown` setup. The simple cases migrate quickly, but apps with a long `remarkPlugins` / `rehypePlugins` chain should review each customization before switching.
:::

::: tip See a Live Demo
Open the [React migration demo](https://markstream-react.pages.dev/migration-demo) to inspect a synthetic before/after example alongside an audit report generated in the style of the migration skill.
:::

## When to stay on `react-markdown`

- You only render completed, static Markdown.
- Your app depends heavily on the unified `remark` / `rehype` plugin ecosystem.
- You need HTML allow/deny lists as first-class component props.

## When `markstream-react` is a better fit

- You render AI/chat/SSE output while text is still arriving.
- You want progressive Mermaid, D2, KaTeX, or Monaco-backed code blocks.
- You want viewport-aware heavy-node scheduling for large documents.
- You want to move from string-in/string-out rendering to a streaming-friendly AST model.

## Smallest possible replacement

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

If that works for your current content, migrate the rest incrementally.

## Mental model shift

- `react-markdown` is HTML-tag oriented: custom rendering usually happens through `components={{ h1, a, code }}`.
- `markstream-react` is AST-node oriented: custom rendering usually happens through `setCustomComponents(...)` and node types such as `heading`, `link`, `code_block`, or `inline_code`.
- `react-markdown` centers the `remark` -> `rehype` pipeline.
- `markstream-react` centers a streaming-friendly parser AST plus node renderers.

This means `components.h1` does not become `components.h1` again. It usually becomes one `heading` renderer that branches on `node.level`.

## API mapping

| `react-markdown` | `markstream-react` | Notes |
|---|---|---|
| `children` | `content` | Pass the Markdown string through `content`. |
| `components` | `setCustomComponents(id?, mapping)` | `react-markdown` keys are HTML tags; `markstream-react` keys are node types such as `heading`, `link`, `paragraph`, `image`, `code_block`, `inline_code`. |
| `remarkPlugins` | `customMarkdownIt` | Use `markdown-it` plugins instead of `remark` plugins. Many common Markdown features already work without extra plugins. |
| `remarkPlugins={[remarkGfm]}` | Often removable | Tables, task checkboxes, strikethrough, code fences, and other common constructs are already supported by the parser. Re-check edge cases before deleting plugin code. |
| `rehypePlugins` | No direct equivalent | There is no public `rehype` stage. Use custom node renderers, `customHtmlTags`, `parseOptions`, or post-process `nodes` instead. |
| `rehypeRaw` | Usually not needed | HTML-like tags are already parsed. For custom tags, prefer `customHtmlTags={['thinking']}` plus `setCustomComponents`. |
| `skipHtml` | No direct prop | HTML nodes render by default, with built-in blocking of dangerous attributes/tags and unsafe URLs in the HTML renderers. If you must remove HTML entirely, prefilter the input or parsed nodes yourself. |
| `allowedElements` / `disallowedElements` / `allowElement` | No direct prop | Filter the parsed `nodes` tree yourself, or replace specific node renderers. |
| `unwrapDisallowed` | Manual node filtering | Implement this in your node post-processing step if you need it. |
| `urlTransform` | `parseOptions.validateLink` + custom `link` renderer | `validateLink` is for allow/deny. If you need URL rewriting, do it in a custom `link` renderer or while post-processing nodes. |

## Migrating `components`

`react-markdown` custom renderers are usually written against HTML-tag names:

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

The `markstream-react` version is node-based:

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

Useful node-type translations:

- `h1` ... `h6` -> `heading` + `node.level`
- `a` -> `link`
- `p` -> `paragraph`
- `img` -> `image`
- `code` / `pre` -> `code_block` or `inline_code`
- Custom HTML-like tags -> `customHtmlTags` + `setCustomComponents`

## Migrating code highlighting

Many `react-markdown` apps override `components.code` and wire in a third-party highlighter.

With `markstream-react`, you have three common choices:

- Keep the default `CodeBlockNode` for Monaco-powered code blocks.
- Swap `code_block` to `MarkdownCodeBlockNode` for a lighter Shiki-based renderer.
- Set `renderCodeBlocksAsPre` when you want plain `<pre><code>`.

Example: swap code blocks to Shiki:

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

## Migrating plugin logic

### `remarkPlugins`

If you used `remarkPlugins` for syntax extensions, the nearest equivalent is `customMarkdownIt`.

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

There is no direct `rehype` step in `markstream-react`.

If your old `rehype` logic was used for:

- HTML tree rewrites: move that logic into custom node renderers or node post-processing.
- Custom HTML-like blocks: prefer `customHtmlTags`.
- Security allow/deny logic: use `parseOptions.validateLink`, custom renderers, or node filtering.

## HTML, custom tags, and security

`react-markdown` usually escapes HTML unless you add something like `rehypeRaw`.

`markstream-react` already parses HTML-like nodes, and its built-in HTML renderers strip blocked tags, dangerous event-handler attributes, and unsafe URLs.

If your old `rehypeRaw` usage was mainly there to support custom tags such as `<thinking>`, this is the recommended migration path:

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

## Streaming upgrade path

You do not need to adopt streaming on day one. A practical migration path is:

1. Replace `react-markdown` with `MarkdownRender` and keep using `content`.
2. Migrate custom renderers and plugin logic.
3. If you later render SSE/chat output, parse outside the component and pass `nodes`.

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

For high-frequency streaming, this `nodes` flow is usually the biggest reason to migrate.

## Migration checklist

- Replace `<Markdown>{markdown}</Markdown>` with `<MarkdownRender content={markdown} />`.
- Import `markstream-react/index.css`.
- Move `components` overrides into `setCustomComponents(customId, mapping)`.
- Remove plugins that are now redundant before re-adding custom ones.
- Re-check any `rehype`-based HTML filtering or transformation logic.
- If your app renders incremental output, move from `content` to parsed `nodes`.

## Related docs

- [React Installation](/guide/react-installation)
- [React Components & API](/guide/react-components)
- [Parser API](/guide/parser-api)
