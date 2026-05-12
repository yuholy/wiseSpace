import type { AfterViewInit, ElementRef, OnDestroy } from '@angular/core'
import type { SandboxSelection } from '../../playground-shared/versionSandbox'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, computed, signal, ViewChild } from '@angular/core'
import { decodeMarkdownHash } from '../../playground-shared/testPageState'
import { parseSandboxSelection } from '../../playground-shared/versionSandbox'
import {
  TEST_SANDBOX_KATEX_VERSION,
  TEST_SANDBOX_MERMAID_VERSION,
  testSandboxFrameworks,
} from './testSandboxConfig'

type SandboxStatus = 'idle' | 'loading' | 'ready' | 'error'

function setHeadLink(id: string, href: string | null) {
  const existing = document.head.querySelector<HTMLLinkElement>(`link[data-sandbox-style="${id}"]`)
  if (!href) {
    existing?.remove()
    return
  }
  if (existing) {
    if (existing.href !== href)
      existing.href = href
    return
  }

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.dataset.sandboxStyle = id
  document.head.appendChild(link)
}

function encodeNpmVersion(version: string) {
  return encodeURIComponent(version.trim() || 'latest')
}

function createEsmPackageUrl(packageName: string, version: string, deps: string[] = []) {
  const query = new URLSearchParams()
  if (deps.length)
    query.set('deps', deps.join(','))
  const suffix = query.toString()
  return `https://esm.sh/${packageName}@${encodeNpmVersion(version)}${suffix ? `?${suffix}` : ''}`
}

function createEsmPackageSubpathUrl(
  packageName: string,
  version: string,
  subpath: string,
  deps: string[] = [],
) {
  const base = createEsmPackageUrl(packageName, version, deps)
  const [prefix, query] = base.split('?')
  return `${prefix}/${subpath}${query ? `?${query}` : ''}`
}

function createJsDelivrCssUrl(packageName: string, version: string) {
  return `https://cdn.jsdelivr.net/npm/${packageName}@${encodeNpmVersion(version)}/dist/index.css`
}

function applySandboxStyles(current: SandboxSelection) {
  setHeadLink(
    'renderer',
    current.source === 'npm'
      ? createJsDelivrCssUrl(current.framework.packageName, current.version)
      : null,
  )
  setHeadLink(
    'katex',
    `https://cdn.jsdelivr.net/npm/katex@${TEST_SANDBOX_KATEX_VERSION}/dist/katex.min.css`,
  )
}

async function importRemote<T = any>(url: string): Promise<T> {
  return await import(/* @vite-ignore */ url) as T
}

function setupCommonRendererRuntime(rendererModule: Record<string, any>) {
  rendererModule.enableKatex?.()
  rendererModule.enableMermaid?.()

  const katexHandle = rendererModule.createKaTeXWorkerFromCDN?.({
    mode: 'classic',
    katexUrl: `https://cdn.jsdelivr.net/npm/katex@${TEST_SANDBOX_KATEX_VERSION}/dist/katex.min.js`,
    mhchemUrl: `https://cdn.jsdelivr.net/npm/katex@${TEST_SANDBOX_KATEX_VERSION}/dist/contrib/mhchem.min.js`,
  })
  if (katexHandle?.worker)
    rendererModule.setKaTeXWorker?.(katexHandle.worker)

  const mermaidHandle = rendererModule.createMermaidWorkerFromCDN?.({
    mode: 'module',
    workerOptions: { type: 'module' },
    mermaidUrl: `https://cdn.jsdelivr.net/npm/mermaid@${TEST_SANDBOX_MERMAID_VERSION}/dist/mermaid.esm.min.mjs`,
  })
  if (mermaidHandle?.worker)
    rendererModule.setMermaidWorker?.(mermaidHandle.worker)

  return () => {
    rendererModule.clearKaTeXWorker?.()
    rendererModule.clearMermaidWorker?.()
    katexHandle?.dispose?.()
    mermaidHandle?.dispose?.()
  }
}

async function mountVue3Sandbox(current: SandboxSelection, content: string, mountPoint: HTMLElement) {
  const rendererModule = current.source === 'workspace'
    ? await import('markstream-vue')
    : await importRemote(createEsmPackageUrl(
        current.framework.packageName,
        current.version,
        [`vue@${current.framework.runtimeVersion}`],
      ))
  const vueModule = current.source === 'workspace'
    ? null
    : await importRemote<any>(createEsmPackageUrl('vue', current.framework.runtimeVersion))

  const teardownRuntime = setupCommonRendererRuntime(rendererModule)
  const MarkdownRender = rendererModule.default || rendererModule.MarkdownRender
  const createApp = current.source === 'workspace'
    ? vueModule?.createApp ?? (await import('vue')).createApp
    : (vueModule?.createApp || vueModule?.default?.createApp)
  const h = current.source === 'workspace'
    ? vueModule?.h ?? (await import('vue')).h
    : (vueModule?.h || vueModule?.default?.h)

  if (!MarkdownRender || !createApp || !h)
    throw new Error('无法找到 Vue 3 渲染器入口。')

  const host = document.createElement('div')
  host.className = 'sandbox-canvas__host'
  mountPoint.replaceChildren(host)

  const app = createApp({
    render() {
      return h(MarkdownRender, {
        content,
        batchRendering: false,
        typewriter: false,
        viewportPriority: false,
      })
    },
  })

  app.mount(host)

  return () => {
    app.unmount()
    teardownRuntime()
  }
}

async function mountVue2Sandbox(current: SandboxSelection, content: string, mountPoint: HTMLElement) {
  const [vueModule, rendererModule] = await Promise.all([
    importRemote<any>(createEsmPackageUrl('vue', current.framework.runtimeVersion)),
    importRemote<any>(createEsmPackageUrl(
      current.framework.packageName,
      current.version,
      [
        `vue@${current.framework.runtimeVersion}`,
        '@vue/composition-api@1.7.2',
      ],
    )),
  ])

  const Vue2 = vueModule.default || vueModule
  const MarkdownRender = rendererModule.default || rendererModule.MarkdownRender
  const teardownRuntime = setupCommonRendererRuntime(rendererModule)

  if (!Vue2 || !MarkdownRender)
    throw new Error('无法找到 Vue 2 渲染器入口。')

  const host = document.createElement('div')
  host.className = 'sandbox-canvas__host'
  mountPoint.replaceChildren(host)

  const app = new Vue2({
    render(createElement: (component: any, data?: any) => any) {
      return createElement(MarkdownRender, {
        props: {
          content,
          batchRendering: false,
          typewriter: false,
          viewportPriority: false,
        },
      })
    },
  })

  app.$mount(host)

  return () => {
    app.$destroy()
    teardownRuntime()
  }
}

async function mountReactSandbox(current: SandboxSelection, content: string, mountPoint: HTMLElement) {
  const runtimeVersion = current.framework.runtimeVersion
  const [reactModule, reactDomModule, rendererModule] = await Promise.all([
    importRemote<any>(createEsmPackageUrl('react', runtimeVersion)),
    importRemote<any>(createEsmPackageSubpathUrl(
      'react-dom',
      runtimeVersion,
      'client',
      [`react@${runtimeVersion}`],
    )),
    importRemote<any>(createEsmPackageUrl(
      current.framework.packageName,
      current.version,
      [`react@${runtimeVersion}`, `react-dom@${runtimeVersion}`],
    )),
  ])

  const React = reactModule.default || reactModule
  const ReactDOMClient = reactDomModule.default || reactDomModule
  const MarkdownRender = rendererModule.default || rendererModule.NodeRenderer

  if (!React?.createElement || !ReactDOMClient?.createRoot || !MarkdownRender)
    throw new Error('无法找到 React 渲染器入口。')

  const host = document.createElement('div')
  host.className = 'sandbox-canvas__host'
  mountPoint.replaceChildren(host)

  const root = ReactDOMClient.createRoot(host)
  root.render(
    React.createElement(MarkdownRender, {
      content,
      batchRendering: false,
      typewriter: false,
      viewportPriority: false,
    }),
  )

  return () => {
    root.unmount()
  }
}

async function mountAngularSandbox(current: SandboxSelection, content: string, mountPoint: HTMLElement) {
  const runtimeVersion = current.framework.runtimeVersion
  const rendererModule = current.source === 'workspace'
    ? await import('markstream-angular')
    : await importRemote<any>(createEsmPackageUrl(
        current.framework.packageName,
        current.version,
        [`@angular/common@${runtimeVersion}`, `@angular/core@${runtimeVersion}`],
      ))

  const renderMarkdownToHtml = rendererModule.renderMarkdownToHtml
  const enhanceRenderedHtml = rendererModule.enhanceRenderedHtml
  if (typeof renderMarkdownToHtml !== 'function')
    throw new Error('无法找到 Angular 渲染器入口。')

  const host = document.createElement('div')
  host.className = 'sandbox-canvas__host'

  const shell = document.createElement('div')
  shell.className = 'markstream-angular markdown-renderer'
  shell.innerHTML = renderMarkdownToHtml({
    content,
    final: true,
    allowHtml: true,
  })
  const enhancementHandle = await enhanceRenderedHtml?.(shell, { final: true })

  host.replaceChildren(shell)
  mountPoint.replaceChildren(host)

  return () => {
    enhancementHandle?.dispose?.()
    mountPoint.replaceChildren()
  }
}

async function mountSandbox(current: SandboxSelection, content: string, mountPoint: HTMLElement) {
  if (current.frameworkId === 'vue3')
    return await mountVue3Sandbox(current, content, mountPoint)
  if (current.frameworkId === 'vue2')
    return await mountVue2Sandbox(current, content, mountPoint)
  if (current.frameworkId === 'angular')
    return await mountAngularSandbox(current, content, mountPoint)
  return await mountReactSandbox(current, content, mountPoint)
}

@Component({
  selector: 'app-angular-test-sandbox',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sandbox-page">
      <header class="sandbox-hero">
        <div>
          <span class="sandbox-eyebrow">Version sandbox</span>
          <h1>Isolated Renderer</h1>
          <p>当前 iframe 正在独立加载对应 framework 与包版本，用于和左侧 workspace 预览做对照。</p>
        </div>

        <div class="sandbox-summary">
          <div class="sandbox-summary__item">
            <span>选择</span>
            <strong>{{ selectionSummary() }}</strong>
          </div>
          <div class="sandbox-summary__item">
            <span>状态</span>
            <strong>{{ statusLabel() }}</strong>
          </div>
          <div class="sandbox-summary__item">
            <span>字符数</span>
            <strong>{{ markdown().length }}</strong>
          </div>
        </div>
      </header>

      <div *ngIf="status() === 'error'" class="sandbox-banner sandbox-banner--error">
        <strong>沙箱加载失败。</strong>
        <span>{{ errorMessage() || '请检查版本号是否存在，或稍后重试。' }}</span>
      </div>
      <div *ngIf="status() !== 'error' && selection().source === 'workspace' && !selection().framework.supportsWorkspace" class="sandbox-banner sandbox-banner--warning">
        当前框架不支持在这个 iframe 中直接跑 workspace 源码，已自动回退到 npm 包模式。
      </div>
      <div *ngIf="status() === 'loading'" class="sandbox-banner sandbox-banner--info">
        正在加载隔离渲染器与对应版本资源...
      </div>

      <section class="sandbox-canvas">
        <div #canvasRef class="sandbox-canvas__mount"></div>
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TestSandboxComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasRef', { static: true }) private canvasRef?: ElementRef<HTMLElement>

  readonly status = signal<SandboxStatus>('idle')
  readonly selection = signal<SandboxSelection>(parseSandboxSelection(
    typeof window === 'undefined' ? '' : window.location.search,
    testSandboxFrameworks,
  ))

  readonly markdown = signal(typeof window === 'undefined' ? '' : (decodeMarkdownHash(window.location.hash || '') ?? ''))
  readonly errorMessage = signal('')
  readonly statusLabel = computed(() => {
    if (this.status() === 'loading')
      return '加载中'
    if (this.status() === 'error')
      return '加载失败'
    if (this.status() === 'ready')
      return 'Ready'
    return '待命'
  })

  readonly selectionSummary = computed(() => {
    const current = this.selection()
    return `${current.framework.label} / ${current.source === 'workspace' ? 'workspace' : 'npm'} / ${current.version}`
  })

  private cleanupMountedRuntime: (() => void) | null = null
  private renderToken = 0

  ngAfterViewInit() {
    void this.renderSandbox()
    if (typeof window !== 'undefined')
      window.addEventListener('hashchange', this.handleHashChange)
  }

  ngOnDestroy() {
    if (typeof window !== 'undefined')
      window.removeEventListener('hashchange', this.handleHashChange)
    this.cleanupRuntime()
  }

  private readonly handleHashChange = () => {
    void this.renderSandbox()
  }

  private cleanupRuntime() {
    this.cleanupMountedRuntime?.()
    this.cleanupMountedRuntime = null
    if (this.canvasRef?.nativeElement)
      this.canvasRef.nativeElement.innerHTML = ''
  }

  private async renderSandbox() {
    const mountPoint = this.canvasRef?.nativeElement
    if (!mountPoint)
      return

    this.renderToken += 1
    const activeToken = this.renderToken

    this.cleanupRuntime()
    this.selection.set(parseSandboxSelection(window.location.search, testSandboxFrameworks))
    this.markdown.set(decodeMarkdownHash(window.location.hash || '') ?? '')
    this.errorMessage.set('')
    this.status.set('loading')
    applySandboxStyles(this.selection())

    try {
      const teardown = await mountSandbox(this.selection(), this.markdown(), mountPoint)
      if (activeToken !== this.renderToken) {
        teardown()
        return
      }
      this.cleanupMountedRuntime = teardown
      this.status.set('ready')
    }
    catch (error) {
      console.error('[test-sandbox] failed to render sandbox', error)
      this.cleanupRuntime()
      this.status.set('error')
      this.errorMessage.set(error instanceof Error ? error.message : String(error))
    }
  }
}
