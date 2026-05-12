import type { MathBlockNodeProps, MathInlineNodeProps } from '../../types/component-props'
import { defineAsyncComponent, h } from 'vue'
import { getKatex } from '../MathInlineNode/katex'
import TextNode from '../TextNode'

interface ProcessLike {
  env?: {
    NODE_ENV?: string
  }
}

type MathInlineFallbackProps = MathInlineNodeProps & Record<string, unknown>
type MathBlockFallbackProps = MathBlockNodeProps & Record<string, unknown>

function getProcessEnv() {
  const processValue = Reflect.get(globalThis, 'process') as ProcessLike | undefined
  return processValue?.env
}

export const MathInlineNodeAsync = defineAsyncComponent(async () => {
  // In test environment prefer the simple text fallback to avoid
  // race conditions with workers/KaTeX rendering.
  const isTestEnv = getProcessEnv()?.NODE_ENV === 'test'
  if (isTestEnv && typeof window !== 'undefined') {
    return (props: MathInlineFallbackProps) => {
      // test fallback should be deterministic and minimal
      return h(TextNode, {
        ...props,
        node: {
          type: 'text',
          content: props.node.raw ?? `$${props.node.content ?? ''}$`,
          raw: props.node.raw ?? `$${props.node.content ?? ''}$`,
        },
      })
    }
  }

  try {
    const katex = await getKatex()
    if (katex) {
      const mod = await import('../../components/MathInlineNode')
      return mod.default
    }
  }
  catch (e) {
    console.warn(
      '[markstream-vue] Optional peer dependencies for MathInlineNode are missing. Falling back to text rendering. To enable full math rendering features, please install "katex".',
      e,
    )
  }
  return (props: MathInlineFallbackProps) => {
    return h(TextNode, {
      ...props,
      node: {
        type: 'text',
        content: props.node.raw ?? `$${props.node.content ?? ''}$`,
        raw: props.node.raw ?? `$${props.node.content ?? ''}$`,
      },
    })
  }
})

export const MathBlockNodeAsync = defineAsyncComponent(async () => {
  try {
    const katex = await getKatex()
    if (katex) {
      const mod = await import('../../components/MathBlockNode')
      return mod.default
    }
  }
  catch (e) {
    console.warn(
      '[markstream-vue] Optional peer dependencies for MathBlockNode are missing. Falling back to text rendering. To enable full math rendering features, please install "katex".',
      e,
    )
  }
  return (props: MathBlockFallbackProps) => {
    return h(TextNode, {
      ...props,
      node: {
        type: 'text',
        content: props.node.raw ?? `$$${props.node.content ?? ''}$$`,
        raw: props.node.raw ?? `$$${props.node.content ?? ''}$$`,
      },
    })
  }
})
