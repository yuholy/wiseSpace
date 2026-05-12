/**
 * @vitest-environment jsdom
 */

/* eslint-disable antfu/no-import-node-modules-by-path */
import { afterEach, describe, expect, it } from 'vitest'
import React, { act } from '../packages/markstream-react/node_modules/react'
import { createRoot } from '../packages/markstream-react/node_modules/react-dom/client'
import { LinkNode } from '../packages/markstream-react/src/components/LinkNode/LinkNode'

async function flushReact() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

afterEach(() => {
  document.body.innerHTML = ''
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false
})

describe('markstream-react link loading state', () => {
  it('renders a subtle loading hint instead of an anchor', async () => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)

    await act(async () => {
      root.render(React.createElement(LinkNode as any, {
        node: {
          type: 'link',
          href: 'https://example.com',
          title: null,
          text: 'Example',
          raw: '[Example](https://example.com',
          loading: true,
          children: [],
        },
        indexKey: 'react-link-loading',
        ctx: {
          typewriter: false,
          codeBlockProps: {},
          mermaidProps: {},
          d2Props: {},
          infographicProps: {},
          showTooltips: true,
          codeBlockStream: true,
          renderCodeBlocksAsPre: false,
          events: {},
        },
      }))
    })
    await flushReact()

    expect(host.querySelector('a.link-node')).toBeNull()
    const loading = host.querySelector('.link-loading') as HTMLElement | null
    expect(loading).toBeTruthy()
    expect(loading?.textContent).toContain('Example')
    expect(host.querySelector('.link-loading-indicator')).toBeTruthy()
    expect(loading?.getAttribute('style')).toContain('--underline-duration: 1.6s')

    await act(async () => {
      root.unmount()
    })
  })
})
