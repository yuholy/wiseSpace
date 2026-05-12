import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ImageNode from '../src/components/ImageNode/ImageNode.vue'

describe('image node performance defaults', () => {
  it('does not force lazy loading by default', () => {
    const wrapper = mount(ImageNode, {
      props: {
        node: {
          type: 'image',
          src: 'https://example.com/hero.png',
          alt: 'Hero',
          title: 'Hero',
          raw: '![Hero](https://example.com/hero.png)',
        },
      },
    })

    expect(wrapper.get('img').attributes('loading')).toBeUndefined()
    expect(wrapper.get('img').attributes('fetchpriority')).toBe('high')
    expect(wrapper.get('img').attributes('decoding')).toBe('sync')
    expect(wrapper.get('img').classes()).not.toContain('opacity-0')
    expect(wrapper.get('img').classes()).not.toContain('transition-opacity')
  })

  it('keeps the lower-priority async path for lazy images', () => {
    const wrapper = mount(ImageNode, {
      props: {
        lazy: true,
        node: {
          type: 'image',
          src: 'https://example.com/hero.png',
          alt: 'Hero',
          title: 'Hero',
          raw: '![Hero](https://example.com/hero.png)',
        },
      },
    })

    expect(wrapper.get('img').attributes('loading')).toBe('lazy')
    expect(wrapper.get('img').attributes('fetchpriority')).toBeUndefined()
    expect(wrapper.get('img').attributes('decoding')).toBe('async')
    expect(wrapper.get('img').classes()).toContain('is-loading')
  })
})
