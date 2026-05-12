# React Next SSR

`markstream-react` now exposes two explicit SSR entrypoints for Next.js:

- `markstream-react/next`: the official Next entry. Import it from App Router server components or Pages Router SSR pages when you want real server HTML first and client enhancement after hydration.
- `markstream-react/server`: a pure server entry. Use it when you want a stable server-only render path with no client component boundary.

Import styles once from your app shell:

```tsx
// app/layout.tsx or pages/_app.tsx
import 'markstream-react/index.css'
import 'katex/dist/katex.min.css'
```

## App Router with `markstream-react/next`

```tsx
import MarkdownRender from 'markstream-react/next'

const markdown = `# Hello Next.js

This route ships real SSR HTML first.`

export default function Page() {
  return <MarkdownRender content={markdown} final />
}
```

## Pure Server Rendering with `markstream-react/server`

```tsx
import MarkdownRender from 'markstream-react/server'

const markdown = `# Server entry

This path stays fully server-rendered.`

export default function Page() {
  return <MarkdownRender content={markdown} final />
}
```

## Custom Components and Custom Tags

If you register overrides from a server file, prefer the server helpers so you avoid importing the root package side effects:

```tsx
import MarkdownRender, { setCustomComponents } from 'markstream-react/server'

setCustomComponents('next-ssr-demo', {
  thinking: ({ children }: any) => <aside data-ssr-status="thinking-tag">{children}</aside>,
})
```

Then render with `customId="next-ssr-demo"` and `customHtmlTags={['thinking']}`.

Current SSR acceptance also covers:

- `customId` scoping isolation
- custom node children rendered into the initial HTML
- `customHtmlTags` attributes preserved in the initial HTML

## TypeScript

`markstream-react/next` and `markstream-react/server` both publish standalone declaration files. You can import shared prop types directly from the entrypoint you use:

```tsx
import type {
  HtmlPreviewFrameProps,
  MarkdownCodeBlockNodeProps,
  NodeRendererProps,
  TooltipProps,
} from 'markstream-react/next'
```

## Current Verification Commands

```bash
pnpm exec vitest run test/markstream-react-next-ssr.test.tsx
pnpm --filter markstream-react build
pnpm run test:e2e:next-ssr
```
