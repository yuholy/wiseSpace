<script lang="ts">
import type { BaseNode, MarkdownIt, ParseOptions } from 'stream-markdown-parser'
import { computed, defineComponent, getCurrentInstance } from 'vue-demi'
import { parseNestedMarkdownToNodes } from '../../utils/nestedNodes'
import { resolveVueListeners } from '../../utils/vue26'
import MarkdownRender from '../MarkdownRenderCompat.vue'

export default defineComponent({
  name: 'NestedRenderer',
  components: {
    MarkdownRender,
  },
  inheritAttrs: false,
  props: {
    node: Object as unknown as () => (BaseNode & Record<string, any>) | undefined,
    nodes: Array as unknown as () => BaseNode[] | undefined,
    content: String,
    loading: Boolean,
    final: Boolean,
    cacheKey: String,
    parseOptions: Object as unknown as () => ParseOptions | undefined,
    customHtmlTags: Array as unknown as () => readonly string[] | undefined,
    customMarkdownIt: Function as unknown as () => ((md: MarkdownIt) => MarkdownIt) | undefined,
  },
  setup(props) {
    const instance = getCurrentInstance()
    const resolvedFinal = computed(() => {
      if (props.final != null)
        return props.final
      if (typeof props.loading === 'boolean')
        return !props.loading
      if (typeof props.node?.loading === 'boolean')
        return !props.node.loading
      return undefined
    })

    const resolvedNodes = computed(() => {
      return parseNestedMarkdownToNodes(
        {
          node: props.node,
          nodes: props.nodes,
          content: props.content,
        },
        {
          cacheKey: props.cacheKey,
          final: resolvedFinal.value,
          parseOptions: props.parseOptions,
          customHtmlTags: props.customHtmlTags,
          customMarkdownIt: props.customMarkdownIt,
        },
      )
    })

    const forwardedListeners = computed(() => {
      return resolveVueListeners(instance?.proxy)
    })

    return {
      forwardedListeners,
      resolvedFinal,
      resolvedNodes,
    }
  },
})
</script>

<template>
  <MarkdownRender
    v-bind="$attrs"
    :nodes="resolvedNodes"
    :final="resolvedFinal"
    :custom-html-tags="customHtmlTags"
    v-on="forwardedListeners"
  />
</template>
