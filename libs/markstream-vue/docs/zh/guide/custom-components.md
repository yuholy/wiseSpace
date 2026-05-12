---
description: 为 thinking 等可信标签接入自定义组件，在不改解析器的前提下扩展 markstream-vue 的高级渲染能力。
---

# 自定义标签与高级组件

当你的 Markdown 里需要出现 `thinking`、`answer-box` 之类“可信的组件式标签”时，这页就是最直接的入口。

推荐路径是：

1. 用 `custom-html-tags` 声明这个标签
2. 用 `setCustomComponents` 把它映射到自定义组件
3. 用 `custom-id` 把覆盖范围限制在当前业务区域

`custom-html-tags` 里请传标签式名字，比如 `thinking`、`answer-box`、`my_component`。
像 `foo:bar` 这种 namespaced 形式会被忽略；`code_block` 这类内置 override key 会继续保留给节点渲染器覆盖，所以可信自定义标签仍然需要显式写进 `custom-html-tags`。

只有当这条路径不够用时，再去碰解析器钩子。

如果这些标签最终是用在文档站或 VitePress 主题里，建议再配合 [文档站与 VitePress 集成](/zh/guide/vitepress-docs-integration) 一起看，把主题层注册和 CSS 顺序一次理顺。

## 1. 最简单的自定义标签接法

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

一旦这个标签被加入白名单，解析器就会直接产出 `type` 等于标签名本身的自定义节点。

## 2. 一个实用的 Vue 组件写法

自定义标签内部往往还会包含 Markdown。最稳妥的办法，就是在你的自定义组件里再嵌一层 `MarkdownRender` 来渲染内部内容。

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

这种“外层自定义组件 + 内层 MarkdownRender”的模式，也是处理重复和嵌套标签时最稳的写法。

## 3. 解析器会给你什么数据

对于可信自定义标签，产出的节点通常会包含：

- `type`：标签名本身，例如 `thinking`
- `tag`：原始标签名
- `content`：标签内部的 Markdown / 文本内容
- `attrs`：提取出来的标签属性
- `loading`：当前是否仍处在流式中间态
- `autoClosed`：流式阶段是否发生过临时自动补闭合

`attrs` 的具体形状可能会因来源而不同，所以更好的做法是把它当成“原始属性容器”，在你的组件里按需归一化。

## 4. 重复和嵌套的自定义标签

这条方案本身就是为这些情况设计的：

- 同一篇文档里多次出现相同自定义标签
- 自定义标签嵌套自定义标签
- 流式输出时，闭合标签还没到达的中间态

实战建议：

- 内层 `MarkdownRender` 继续传同样的 `custom-html-tags`
- 小型嵌套壳子里，如果你想要更稳定的流式行为，可以关闭 batching 和 viewport deferral
- 外层渲染器始终带上 `custom-id`

## 5. 什么情况下 `custom-html-tags` 已经足够

适合直接用 `custom-html-tags` + `setCustomComponents` 的情况：

- 语法本身已经是标签式的
- 内容来源是你信任的
- 你需要的是“换一种渲染方式”，而不是“改一种语法规则”

应该升级到 [高级解析](/zh/guide/advanced) 的情况：

- 标签在进入稳定节点前，还需要先做 token 改写
- 你必须在解析后合并、拆分或重塑节点
- 源格式根本不适合用标签外壳来表达

## 6. 作用域和清理依然重要

即使是自定义标签，也建议默认使用 scoped mapping：

```ts twoslash
import type { Component } from 'vue'
import { removeCustomComponents, setCustomComponents } from 'markstream-vue'

declare const ThinkingNode: Component

setCustomComponents('chat', { thinking: ThinkingNode })

// 之后如果这个作用域不再使用
removeCustomComponents('chat')
```

这样可以把自定义行为牢牢限制在当前页面、路由或业务模块里。
