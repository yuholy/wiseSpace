# React Next SSR

`markstream-react` 现在提供两条明确的 Next.js SSR 入口：

- `markstream-react/next`：Next 官方接入入口。适合 App Router 的 Server Component 和 Pages Router 的 SSR 页面。首包先输出真实服务端 HTML，重节点在 hydration 后再增强。
- `markstream-react/server`：纯 server 入口。适合完全不进入 client component 边界、只输出稳定 fallback HTML 的路径。

样式只需要在应用壳层引入一次：

```tsx
// app/layout.tsx 或 pages/_app.tsx
import 'markstream-react/index.css'
import 'katex/dist/katex.min.css'
```

## 在 App Router 中使用 `markstream-react/next`

```tsx
import MarkdownRender from 'markstream-react/next'

const markdown = `# Hello Next.js

这个路由会先返回真实 SSR HTML。`

export default function Page() {
  return <MarkdownRender content={markdown} final />
}
```

## 使用 `markstream-react/server` 做纯服务端渲染

```tsx
import MarkdownRender from 'markstream-react/server'

const markdown = `# Server entry

这条路径保持纯服务端渲染。`

export default function Page() {
  return <MarkdownRender content={markdown} final />
}
```

## 自定义组件与自定义标签

如果你在服务端文件里注册 override，优先从 server 入口拿 helper，避免引入 root 入口副作用：

```tsx
import MarkdownRender, { setCustomComponents } from 'markstream-react/server'

setCustomComponents('next-ssr-demo', {
  thinking: ({ children }: any) => <aside data-ssr-status="thinking-tag">{children}</aside>,
})
```

然后配合 `customId="next-ssr-demo"` 和 `customHtmlTags={['thinking']}` 渲染。

当前 SSR 验收还会显式检查：

- `customId` 作用域隔离
- custom node 的 `children` 是否进入首包 HTML
- `customHtmlTags` 的 attrs 是否保留在首包 HTML

## TypeScript

`markstream-react/next` 和 `markstream-react/server` 都会发布独立声明文件。公共 props 类型可以直接从你实际使用的入口导入：

```tsx
import type {
  HtmlPreviewFrameProps,
  MarkdownCodeBlockNodeProps,
  NodeRendererProps,
  TooltipProps,
} from 'markstream-react/next'
```

## 当前验证命令

```bash
pnpm exec vitest run test/markstream-react-next-ssr.test.tsx
pnpm --filter markstream-react build
pnpm run test:e2e:next-ssr
```
