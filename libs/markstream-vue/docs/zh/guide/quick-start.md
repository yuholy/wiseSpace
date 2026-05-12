---
description: 用最小 Vue 示例快速跑起 markstream-vue，并理解默认 CSS 行为与下一步该看哪些页面。
---

# 快速开始

示例：

```vue twoslash
<script setup lang="ts">
import MarkdownRender from 'markstream-vue'

type MarkdownRenderProps = InstanceType<typeof MarkdownRender>['$props']

const md: MarkdownRenderProps['content'] = `# Hello World\n\n这是 **加粗** 的文本。`
const customId: MarkdownRenderProps['customId'] = 'quick-start'
const isDark: MarkdownRenderProps['isDark'] = false
</script>

<template>
  <MarkdownRender
    :content="md"
    :custom-id="customId"
    :is-dark="isDark"
  />
</template>
```

如果你是为了看 props hover，优先 hover `MarkdownRenderProps['content']`、`MarkdownRenderProps['customId']`、`MarkdownRenderProps['isDark']`，或者上面模板里的对应 attribute。直接 hover 组件名在 Vue 片段里通常信息会更少。

说明：本包的 CSS 会限定在内部 `.markstream-vue` 容器下，以尽量减少对宿主应用全局样式的影响；主入口已经默认引入样式，正常使用 `MarkdownRender` 无需再额外 `import 'markstream-vue/index.css'`。只有当你需要精确控制 CSS 顺序时，才建议手动单独引入。

暗色变量支持两种方式：给祖先节点加 `.dark`，或给 `MarkdownRender` 传入 `:is-dark="true"`（仅对渲染器生效）。

如果使用 Nuxt 或 SSR，请用 `<client-only>` 包裹。

如果是高频 SSE / token 级流式输出，推荐在外部完成解析后传 `:nodes`，而不是每个 chunk 都让 `MarkdownRender` 重新解析整篇内容。

快速试一下：

```vue twoslash
<script setup lang="ts">
import MarkdownRender from 'markstream-vue'

type MarkdownRenderProps = InstanceType<typeof MarkdownRender>['$props']

const md: MarkdownRenderProps['content'] = `# Hello world

试试 Mermaid：

\`\`\`mermaid
graph LR
A-->B
\`\`\`

试试 D2：

\`\`\`d2
direction: right
Client -> API: request
API -> DB: query
DB -> API: rows
API -> Client: response
\`\`\`
`
</script>

<template>
  <MarkdownRender :content="md" />
</template>
```

安装 `mermaid` 或 `@terrastruct/d2` 才能看到图表预览；未安装时会回退为源码展示。
