---
description: Start rendering Markdown with markstream-vue in the smallest possible Vue example, including the default CSS behavior and next steps.
---

# Quick Start

A minimal example using the library:

```vue twoslash
<script setup lang="ts">
import MarkdownRender from 'markstream-vue'

type MarkdownRenderProps = InstanceType<typeof MarkdownRender>['$props']

const md: MarkdownRenderProps['content'] = `# Hello World\n\nThis is **bold** and this is *italic*.`
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

If you want prop-level hover, start with `MarkdownRenderProps['content']`, `MarkdownRenderProps['customId']`, `MarkdownRenderProps['isDark']`, or the matching template attributes above. Hovering the component name itself is usually less informative in Vue snippets.

Note: the packaged CSS is scoped under an internal `.markstream-vue` container to reduce global style conflicts. The main package entry already imports the default stylesheet; add `import 'markstream-vue/index.css'` only when you want explicit control over CSS order in your app shell.

For dark theme variables, either add `.dark` on an ancestor or pass `:is-dark="true"` to scope dark mode to the renderer.

Optional: wrap with `<client-only>` for Nuxt/SSR.

See `/nuxt-ssr` for Nuxt-specific instructions.

Try this quickly in your app:

```vue twoslash
<script setup lang="ts">
import MarkdownRender from 'markstream-vue'

type MarkdownRenderProps = InstanceType<typeof MarkdownRender>['$props']

const md: MarkdownRenderProps['content'] = `# Hello world\n\nTry a simple Mermaid:\n\n\`\`\`mermaid\ngraph LR\nA-->B\n\`\`\`\n\nTry a simple D2:\n\n\`\`\`d2\ndirection: right\nClient -> API: request\nAPI -> DB: query\nDB -> API: rows\nAPI -> Client: response\n\`\`\`\n`
</script>

<template>
  <MarkdownRender :content="md" />
</template>
```

Install `mermaid` or `@terrastruct/d2` to render those diagrams; without them the renderer falls back to showing source text.

For high-frequency streaming, the highest-throughput setup is usually: parse outside the component and pass `:nodes` into `MarkdownRender`, instead of reparsing the entire `content` string every token. See `/guide/usage` and `/guide/performance`.
