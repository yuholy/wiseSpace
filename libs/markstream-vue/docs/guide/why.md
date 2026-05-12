# Why use markstream-vue

- Progressive Mermaid: diagrams render incrementally so users see results earlier.
- Streaming diff code blocks: show diffs as they arrive for instant feedback.
- Built for scale: optimized DOM updates and memory use for very large documents.

This library is especially suited for real-time, AI-driven, and large-document scenarios where a conventional, static Markdown pipeline would cause lag or break UX.

Try this — test the renderer quickly in a browser component:

```vue
<script setup>
import MarkdownRender from 'markstream-vue'

const md = '# Why test\n\nStreaming works well in large docs'
</script>

<template>
  <MarkdownRender :content="md" />
</template>
```
