---
description: 在 content 与 nodes 之间做出正确选择，并理解 markstream-vue 在 Vite、VitePress、Nuxt 与流式界面中的接入方式。
---

# 使用示例与 API

本页聚焦三个问题：如何在 Vite/VitePress/Nuxt 中集成、解析器如何配合渲染器、样式出错时去哪查看 reset 与 Tailwind/UnoCSS 排障指南。

## 先决定用 `content` 还是 `nodes`

| 场景 | 推荐输入 |
|------|---------|
| 文档页、静态文章、低频更新 | `content` |
| SSE、token 流式输出、AI Chat、高频增量更新 | `nodes` + `final` |
| SSR 或 Worker 里预解析完成 | `nodes` |

如果你只是在调现有能力，继续看本页和 [Props 与选项](/zh/guide/props) 就够了。只有在你要改变渲染行为时，再跳去看 [覆盖内置组件](/zh/guide/component-overrides)。

如果需要在既有设计系统里覆盖样式，务必传入 `custom-id` 并阅读 [样式排查清单](/zh/guide/troubleshooting#css-looks-wrong-start-here)。

如果你真正要做的是 AI Chat、逐 token 输出或 SSE 响应预览，建议直接走专门的 [AI 聊天与流式输出](/zh/guide/ai-chat-streaming) 路径，不用自己拼这些页面。

如果你真正要做的是文档站或 VitePress 主题接入，建议改走 [文档站与 VitePress 集成](/zh/guide/vitepress-docs-integration)，那里会把 `content`、`enhanceApp` 和 CSS 顺序串成一条路径。

## 最小渲染示例

```vue twoslash
<script setup lang="ts">
import MarkdownRender from 'markstream-vue'

const doc = '# 使用示例\n\n支持 **streaming** 渲染。'
</script>

<template>
  <MarkdownRender custom-id="docs" :content="doc" />
</template>
```

```css
@import 'modern-css-reset';

@layer components {
  @import 'markstream-vue/index.css';
}
```

## VitePress + 自定义标签

如果这不是一个零散示例，而是你的主要落地场景，看完这里后直接继续 [文档站与 VitePress 集成](/zh/guide/vitepress-docs-integration)。

在 VitePress 中，你只需要在 `enhanceApp` 里注册一次自定义节点组件，然后在 `MarkdownRender` 上使用 `custom-html-tags`，解析器就会自动输出对应的自定义节点。

```ts twoslash
import type { Component } from 'vue'
import MarkdownRender, { setCustomComponents } from 'markstream-vue'
// docs/.vitepress/theme/index.ts
import DefaultTheme from 'vitepress/theme'
import 'markstream-vue/index.css'

declare const ThinkingNode: Component

export default {
  extends: DefaultTheme,
  enhanceApp() {
    setCustomComponents('docs', { thinking: ThinkingNode })
  },
}
```

```md
<!-- 在 VitePress 页面里 -->
<MarkdownRender
  custom-id="docs"
  :custom-html-tags="['thinking']"
  :content="source"
/>
```

提示：像 `<question>` 这类未知的 HTML 类标签在完整闭合后会按原生 HTML 渲染。未闭合或格式不完整的片段会保持为纯文本，避免吞掉附近的 Markdown。只有当你希望它参与解析并产出自定义节点（type + attrs/content）时，才需要加入 `custom-html-tags`。

## 解析流程

```ts twoslash
import { getMarkdown, parseMarkdownToStructure } from 'markstream-vue'

const md = getMarkdown()

const nodes = parseMarkdownToStructure('# 标题', md)
// 将 nodes 传入 <MarkdownRender :nodes="nodes" />
```

- `getMarkdown(msgId?, options?)` 返回预设配置的 `markdown-it-ts`。
- `parseMarkdownToStructure(content, md)` 将 Markdown 字符串转为渲染器使用的 AST。
- 可搭配 `setCustomComponents(id?, mapping)` 为特定 `custom-id` 替换节点渲染器。

## 流式推荐用法

`content` 模式适合低频更新或一次性渲染；如果你在做 AI Chat、SSE、逐 token 输出，推荐把解析放到外部，然后用 `:nodes` + `:final` 驱动渲染器。这样可以减少整篇重解析、降低重绘次数，也更容易把解析工作放到 Worker 或独立状态层。

```ts twoslash
import { getMarkdown, parseMarkdownToStructure } from 'markstream-vue'

const md = getMarkdown('chat-message')
declare const streamedText: string
declare const final: boolean
const nodes = parseMarkdownToStructure(streamedText, md, { final })
```

```vue twoslash
<script setup lang="ts">
import type { BaseNode } from 'markstream-vue'
import MarkdownRender from 'markstream-vue'

const nodes: BaseNode[] = []
const final = false
</script>

<template>
  <MarkdownRender :nodes="nodes" :final="final" />
</template>
```

如果你想要一条从安装、接法、性能到排障都串好的完整路径，继续看 [AI 聊天与流式输出](/zh/guide/ai-chat-streaming)。

## 组件速览

完整说明参考 [组件与节点渲染器](/zh/guide/components)：

- `CodeBlockNode` — Monaco 代码块（需要安装 `stream-monaco`）。
- `MarkdownCodeBlockNode` — 基于 Shiki，适合轻量场景。
- `MermaidBlockNode` — 需要 `mermaid` ≥ 11（无需额外 CSS）。
- `D2BlockNode` — 需要 `@terrastruct/d2`（无需额外 CSS）。
- `ImageNode` — 通过 `click`/`load`/`error` 事件接管图片预览。

## 样式提醒

1. **先 reset** —— `modern-css-reset`、`@tailwind base` 或 `@unocss/reset`，之后再导入库的 CSS。
2. **使用 CSS layer** —— Tailwind/UnoCSS 项目请在 `@layer components { ... }` 中导入 `markstream-vue/index.css`。
3. **处理 Uno/Tailwind 冲突** —— 参见 [Tailwind 指南](/zh/guide/tailwind)（包含 UnoCSS 示例）。
4. **同伴 CSS** —— KaTeX 需要对应的 CSS；Mermaid/D2 不需要。Monaco 不需要额外导入 CSS。

## CSS 作用域（重要）

本包打包出来的 CSS 会限定在内部 `.markstream-vue` 容器下（包含 Tailwind 工具类与主题变量），以尽量降低全局冲突风险。

- 使用 `MarkdownRender` 时会自动包含该容器，无需额外处理。
- 如果你单独使用导出的节点组件（例如 `PreCodeNode`、`FootnoteNode`），请在外层包一层容器：

```vue twoslash
<script setup lang="ts">
import type { PreCodeNodeProps } from 'markstream-vue'
import { PreCodeNode } from 'markstream-vue'

const node = {
  type: 'code_block',
  language: 'ts',
  code: 'console.log(1)',
  raw: 'console.log(1)',
} satisfies PreCodeNodeProps['node']
</script>

<template>
  <div class="markstream-vue">
    <PreCodeNode :node="node" />
  </div>
</template>
```

若仍无法解决，请运行 `pnpm play` 在 playground 中复现，并附带链接到 issue 中。
