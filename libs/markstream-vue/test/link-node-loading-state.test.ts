import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NodeRenderer from '../src/components/NodeRenderer'
import { flushAll } from './setup/flush-all'

describe('link loading state', () => {
  it('renders a subtle loading hint instead of an interactive anchor', async () => {
    const wrapper = mount(NodeRenderer, {
      props: {
        typewriter: false,
        batchRendering: false,
        nodes: [
          {
            type: 'paragraph',
            raw: '',
            children: [
              {
                type: 'link',
                href: 'https://example.com',
                title: null,
                text: 'Example',
                raw: '[Example](https://example.com',
                loading: true,
                children: [
                  {
                    type: 'text',
                    content: 'Example',
                    raw: 'Example',
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    await flushAll()

    expect(wrapper.find('a.link-node').exists()).toBe(false)

    const loading = wrapper.get('.link-loading')
    expect(loading.text()).toContain('Example')
    expect(loading.find('.link-loading-indicator').exists()).toBe(true)
  })

  it('replays appended-text fade while a loading link label grows', async () => {
    const wrapper = mount(NodeRenderer, {
      props: {
        batchRendering: false,
        nodes: [
          {
            type: 'paragraph',
            raw: '',
            children: [
              {
                type: 'link',
                href: 'https://example.com',
                title: null,
                text: 'Exam',
                raw: '[Exam](https://example.com',
                loading: true,
                children: [
                  {
                    type: 'text',
                    content: 'Exam',
                    raw: 'Exam',
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    await flushAll()

    await wrapper.setProps({
      nodes: [
        {
          type: 'paragraph',
          raw: '',
          children: [
            {
              type: 'link',
              href: 'https://example.com',
              title: null,
              text: 'Example',
              raw: '[Example](https://example.com',
              loading: true,
              children: [
                {
                  type: 'text',
                  content: 'Example',
                  raw: 'Example',
                },
              ],
            },
          ],
        },
      ],
    })
    await flushAll()

    const loading = wrapper.get('.link-loading')
    const delta = loading.get('.text-node-stream-delta')

    expect(delta.text()).toBe('ple')
    expect(loading.text()).toContain('Example')
  })
})
