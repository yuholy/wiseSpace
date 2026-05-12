---
description: Add trusted custom tags such as thinking and map them to advanced markstream-vue components without rewriting the parser.
---

# Custom Tags & Advanced Components

Use this page when Markdown needs to contain trusted, component-like tags such as `thinking`, `answer-box`, or other domain-specific blocks.

The recommended path is:

1. register the tag with `custom-html-tags`
2. map the resulting node type with `setCustomComponents`
3. keep the mapping scoped with `custom-id`

Use tag-like names in `custom-html-tags`, for example `thinking`, `answer-box`, or `my_component`.
Namespaced forms like `foo:bar` are ignored. Built-in override keys such as `code_block` stay reserved for node renderer overrides, so trusted custom tags should still be declared explicitly via `custom-html-tags`.

Reach for parser hooks only after this flow stops being enough.

If these tags live inside a docs site or VitePress theme, pair this page with [Docs Site & VitePress](/guide/vitepress-docs-integration) so the theme-level registration and CSS order stay in one place.

## 1. The simplest custom-tag setup

```ts twoslash
import type { Component } from 'vue'
import { setCustomComponents } from 'markstream-vue'

declare const ThinkingNode: Component

setCustomComponents('chat', {
  thinking: ThinkingNode,
})
```

```vue twoslash
<script setup lang="ts">
import MarkdownRender from 'markstream-vue'

const markdown = '<thinking>Step by step</thinking>'
</script>

<template>
  <MarkdownRender
    custom-id="chat"
    :custom-html-tags="['thinking']"
    :content="markdown"
  />
</template>
```

Once the tag is allowlisted, the parser emits a custom node whose `type` is the tag name itself.

## 2. A practical Vue component for nested content

Custom tags usually contain Markdown inside them. The easiest way to preserve that nested Markdown is to render the tag body with another `MarkdownRender`.

```vue twoslash
<script setup lang="ts">
import MarkdownRender from 'markstream-vue'

const props = defineProps<{
  node: {
    type: 'thinking'
    content?: string
    loading?: boolean
  }
  customId?: string
  isDark?: boolean
}>()
</script>

<template>
  <section class="thinking-box" :data-loading="props.node.loading || undefined">
    <header class="thinking-box__title">
      Thinking
    </header>

    <MarkdownRender
      :content="String(props.node.content ?? '')"
      :custom-id="props.customId"
      :is-dark="props.isDark"
      :custom-html-tags="['thinking']"
      :typewriter="false"
      :viewport-priority="false"
      :defer-nodes-until-visible="false"
      :max-live-nodes="0"
      :batch-rendering="false"
    />
  </section>
</template>
```

That nested-renderer pattern is also what keeps repeated and nested custom tags predictable.

## 3. What the parser gives you

For a trusted custom tag, the emitted node typically includes:

- `type`: the tag name, for example `thinking`
- `tag`: the original tag name
- `content`: the inner Markdown or text content
- `attrs`: extracted tag attributes when available
- `loading`: whether the tag is still in a streaming mid-state
- `autoClosed`: whether the parser temporarily auto-closed the tag during streaming

The exact `attrs` shape can vary, so treat it as raw attribute data that your component normalizes for its own needs.

## 4. Repeated and nested custom tags

This flow is designed to support:

- repeated tags in the same document
- nested custom tags
- streaming mid-states while the closing tag has not arrived yet

Tips that help in practice:

- pass the same `custom-html-tags` list into nested renderers
- disable batching and viewport deferral inside small nested shells when you want the most predictable streaming behavior
- keep the outer renderer scoped with `custom-id`

## 5. When `custom-html-tags` is enough, and when it is not

Use `custom-html-tags` plus `setCustomComponents` when:

- the syntax is already tag-like
- you trust the source
- you mainly need a different renderer, not a different grammar

Move to [Advanced Parser Hooks](/guide/advanced) when:

- tags need token rewriting before they become stable nodes
- you must merge, split, or reshape nodes after parsing
- the source format is not well represented by a tag-like wrapper

## 6. Scope and cleanup still matter

Even for custom tags, prefer scoped mappings:

```ts twoslash
import type { Component } from 'vue'
import { removeCustomComponents, setCustomComponents } from 'markstream-vue'

declare const ThinkingNode: Component

setCustomComponents('chat', { thinking: ThinkingNode })

// later, when the scoped renderer is no longer needed
removeCustomComponents('chat')
```

This keeps custom behavior local to the page, route, or app surface that actually needs it.
