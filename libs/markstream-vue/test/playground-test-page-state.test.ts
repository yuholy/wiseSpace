import { describe, expect, it } from 'vitest'
import { buildTestPageHref, createMarkdownHash, decodeMarkdownHash, resolveFrameworkTestHref, resolveTestPageViewMode, withMarkdownHash, withTestPageViewMode } from '../playground-shared/testPageState'
import { buildTestSandboxHref, resolveSandboxSelection } from '../playground-shared/versionSandbox'

describe('playground test page state helpers', () => {
  it('round-trips markdown through hash payloads', () => {
    const markdown = '# Hello\n\n- Vue 3\n- Vue 2\n- React'
    const hash = createMarkdownHash(markdown)

    expect(hash).toMatch(/^data=/)
    expect(decodeMarkdownHash(hash)).toBe(markdown)
    expect(decodeMarkdownHash(`#${hash}`)).toBe(markdown)
  })

  it('adds markdown hash to relative and absolute test urls', () => {
    const markdown = '## Cross framework'

    expect(withMarkdownHash('/test', markdown)).toContain('/test#data=')
    expect(withMarkdownHash('https://markstream-react.pages.dev/test', markdown)).toContain('#data=')
  })

  it('encodes preview-only mode in the shared test page url', () => {
    const href = buildTestPageHref('/test', '# Shared preview', 'preview')

    expect(href).toContain('/test?view=preview#data=')
    expect(resolveTestPageViewMode('?view=preview')).toBe('preview')
    expect(withTestPageViewMode('/test?view=preview', 'lab')).toBe('/test')
  })

  it('prefers localhost target when matching playground ports are available', () => {
    const href = resolveFrameworkTestHref(
      {
        id: 'react',
        origin: 'https://markstream-react.pages.dev',
        localPort: 4174,
      },
      'vue3',
      'same input',
      { hostname: 'localhost', protocol: 'http:' },
      'preview',
    )

    expect(href).toMatch(/^http:\/\/localhost:4174\/test\?view=preview#data=/)
  })

  it('normalizes unsupported workspace selections to npm for version sandboxes', () => {
    const selection = resolveSandboxSelection([
      {
        id: 'vue3',
        label: 'Vue 3',
        packageName: 'markstream-vue',
        defaultVersion: '0.0.9-beta.0',
        runtimeVersion: '3.5.29',
        supportsWorkspace: true,
      },
      {
        id: 'react18',
        label: 'React 18',
        packageName: 'markstream-react',
        defaultVersion: '0.0.25',
        runtimeVersion: '18.3.1',
        supportsWorkspace: false,
      },
    ], {
      frameworkId: 'react18',
      source: 'workspace',
      version: '0.0.24',
    })

    expect(selection.frameworkId).toBe('react18')
    expect(selection.source).toBe('npm')
    expect(selection.version).toBe('0.0.24')
  })

  it('builds version sandbox urls with query params and markdown hashes', () => {
    const selection = resolveSandboxSelection([
      {
        id: 'vue3',
        label: 'Vue 3',
        packageName: 'markstream-vue',
        defaultVersion: '0.0.9-beta.0',
        runtimeVersion: '3.5.29',
        supportsWorkspace: true,
      },
    ], {
      frameworkId: 'vue3',
      source: 'workspace',
      version: '0.0.9-beta.0',
    })

    const href = buildTestSandboxHref(selection, '# sandbox content')
    const url = new URL(href, 'https://markstream.local')

    expect(url.pathname).toBe('/test-sandbox')
    expect(url.searchParams.get('framework')).toBe('vue3')
    expect(url.searchParams.get('source')).toBe('workspace')
    expect(url.searchParams.get('version')).toBe('0.0.9-beta.0')
    expect(decodeMarkdownHash(url.hash)).toBe('# sandbox content')
  })

  it('keeps workspace selection for angular sandbox targets', () => {
    const selection = resolveSandboxSelection([
      {
        id: 'angular',
        label: 'Angular',
        packageName: 'markstream-angular',
        defaultVersion: '0.0.1-alpha.0',
        runtimeVersion: '20.0.0',
        supportsWorkspace: true,
      },
    ], {
      frameworkId: 'angular',
      source: 'workspace',
      version: '0.0.1-alpha.0',
    })

    expect(selection.frameworkId).toBe('angular')
    expect(selection.source).toBe('workspace')
    expect(selection.version).toBe('0.0.1-alpha.0')
  })
})
