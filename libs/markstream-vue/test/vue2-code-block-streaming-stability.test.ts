import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import NodeRenderer from '../packages/markstream-vue2/src/components/NodeRenderer/NodeRenderer.vue'
import { removeCustomComponents, setCustomComponents } from '../packages/markstream-vue2/src/utils/nodeComponents'
import { flushAll } from './setup/flush-all'

const customId = 'vue2-code-block-streaming-stability'

let mountCount = 0
let unmountCount = 0
let instanceSequence = 0

const CodeBlockProbe = {
  name: 'CodeBlockProbe',
  props: {
    node: { type: Object, required: true },
  },
  data() {
    return {
      instanceId: ++instanceSequence,
      countedUnmount: false,
    }
  },
  mounted() {
    mountCount++
  },
  beforeUnmount() {
    if ((this as any).countedUnmount) {
      return
    }
    ;(this as any).countedUnmount = true
    unmountCount++
  },
  beforeDestroy() {
    if ((this as any).countedUnmount) {
      return
    }
    ;(this as any).countedUnmount = true
    unmountCount++
  },
  render() {
    return h('div', {
      'class': 'code-block-probe',
      'data-instance-id': String((this as any).instanceId),
      'data-code': String((this as any).node?.code ?? ''),
    })
  },
}

describe('markstream-vue2 code block streaming stability', () => {
  let warnSpy: ReturnType<typeof vi.spyOn> | null = null
  let errorSpy: ReturnType<typeof vi.spyOn> | null = null
  const originalWarn = console.warn
  const originalError = console.error

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation((message?: any, ...args: any[]) => {
      const text = String(message ?? '')
      if (
        text.includes('provide() can only be used inside setup().')
        || text.includes('onMounted is called when there is no active component instance')
        || text.includes('onBeforeUnmount is called when there is no active component instance')
      ) {
        return
      }
      originalWarn.call(console, message, ...args)
    })
    errorSpy = vi.spyOn(console, 'error').mockImplementation((message?: any, ...args: any[]) => {
      const text = String(message ?? '')
      if (
        text.includes('provide() can only be used inside setup().')
        || text.includes('onMounted is called when there is no active component instance')
        || text.includes('onBeforeUnmount is called when there is no active component instance')
      ) {
        return
      }
      originalError.call(console, message, ...args)
    })
  })

  afterEach(() => {
    removeCustomComponents(customId)
    warnSpy?.mockRestore()
    errorSpy?.mockRestore()
    mountCount = 0
    unmountCount = 0
    instanceSequence = 0
  })

  it('keeps the same code_block instance while streamed content grows', async () => {
    setCustomComponents(customId, { code_block: CodeBlockProbe as any })

    const wrapper = mount(NodeRenderer as any, {
      props: {
        customId,
        nodes: [
          {
            type: 'code_block',
            language: 'ts',
            code: 'export const a = 1',
            raw: '```ts\nexport const a = 1',
            loading: true,
          },
        ],
      },
    })

    await flushAll()

    const initialProbe = wrapper.get('.code-block-probe')
    const initialInstanceId = initialProbe.attributes('data-instance-id')
    const initialCode = String(wrapper.props('nodes')?.[0]?.code ?? '')

    expect(initialCode).toBe('export const a = 1')
    expect(mountCount).toBe(1)
    expect(unmountCount).toBe(0)

    await wrapper.setProps({
      nodes: [
        {
          type: 'code_block',
          language: 'ts',
          code: 'export const a = 1\nexport const b = 2',
          raw: '```ts\nexport const a = 1\nexport const b = 2',
          loading: true,
        },
      ],
    })

    await flushAll()

    const updatedProbe = wrapper.get('.code-block-probe')
    const updatedCode = String(wrapper.props('nodes')?.[0]?.code ?? '')

    expect(updatedCode).toBe('export const a = 1\nexport const b = 2')
    expect(updatedProbe.attributes('data-instance-id')).toBe(initialInstanceId)
    expect(mountCount).toBe(1)
    expect(unmountCount).toBe(0)
  })
})
