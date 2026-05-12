import type { AfterViewInit, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core'
import type { RenderedHtmlEnhancementHandle } from '../../enhanceRenderedHtml'
import type {
  AngularRenderableNode,
  AngularRenderContext,
  NodeRendererEvents,
  NodeRendererProps,
} from '../shared/node-helpers'
import { CommonModule } from '@angular/common'
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  Output,
  ViewChild,
} from '@angular/core'
import { getCustomNodeComponents, subscribeCustomComponents } from '../../customComponents'
import { disposeRenderedHtmlEnhancements, enhanceRenderedHtml } from '../../enhanceRenderedHtml'
import { NodeOutletComponent } from '../NodeOutlet/NodeOutlet.component'
import {
  buildRenderContext,
  resolveParsedNodes,
} from '../shared/node-helpers'
import {
  computeLiveRange,
  estimateHeightRange,
  resolveAverageNodeHeight,
  resolveDeferNodes,
  resolveVirtualizationEnabled,
} from '../shared/render-window'

interface VisibleNodeEntry {
  node: AngularRenderableNode
  index: number
  render: boolean
  animate: boolean
  placeholderHeight: number
}

interface ObserverConfig {
  root: Element | null
  rootMargin: string
  threshold: number
}

interface IdleDeadlineLike {
  timeRemaining?: () => number
}

const SCROLL_PARENT_OVERFLOW_RE = /auto|scroll|overlay/i

@Component({
  selector: 'markstream-angular',
  standalone: true,
  imports: [CommonModule, NodeOutletComponent],
  template: `
    <div
      #root
      class="markstream-angular markdown-renderer"
      [class.dark]="isDark"
      [class.virtualized]="virtualizationEnabled"
      (click)="click.emit($event)"
      (mouseover)="handleMouseOver($event)"
      (mouseout)="handleMouseOut($event)"
    >
      <div
        *ngIf="topSpacerHeight > 0"
        class="node-spacer"
        [style.height.px]="topSpacerHeight"
        aria-hidden="true"
      ></div>

      <div
        *ngFor="let entry of visibleEntries; trackBy: trackByEntry"
        class="node-slot"
        [attr.data-node-index]="entry.index"
        [attr.data-node-type]="entry.node.type"
      >
        <div
          *ngIf="entry.render; else nodePlaceholder"
          class="node-content"
          [class.typewriter-node]="entry.animate"
          [attr.data-node-index]="entry.index"
        >
          <markstream-angular-node-outlet
            [node]="entry.node"
            [context]="renderContext"
            [indexKey]="entryIndexKey(entry.index)"
          />
        </div>

        <ng-template #nodePlaceholder>
          <div class="node-placeholder" [style.height.px]="entry.placeholderHeight"></div>
        </ng-template>
      </div>

      <div
        *ngIf="bottomSpacerHeight > 0"
        class="node-spacer"
        [style.height.px]="bottomSpacerHeight"
        aria-hidden="true"
      ></div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeRendererComponent implements NodeRendererProps, OnChanges, OnInit, AfterViewInit, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef)
  private readonly hostRef = inject(ElementRef<HTMLElement>)

  @ViewChild('root') private rootRef?: ElementRef<HTMLElement>

  @Input() content = ''
  @Input() nodes?: readonly AngularRenderableNode[] | null
  @Input() final?: boolean
  @Input() parseOptions?: NodeRendererProps['parseOptions']
  @Input() customMarkdownIt?: NodeRendererProps['customMarkdownIt']
  @Input() debugPerformance?: boolean
  @Input() customHtmlTags?: readonly string[]
  @Input() viewportPriority?: boolean
  @Input() codeBlockStream = true
  @Input() codeBlockDarkTheme?: any
  @Input() codeBlockLightTheme?: any
  @Input() codeBlockMonacoOptions?: Record<string, any>
  @Input() renderCodeBlocksAsPre = false
  @Input() codeBlockMinWidth?: string | number
  @Input() codeBlockMaxWidth?: string | number
  @Input() codeBlockProps?: Record<string, any>
  @Input() mermaidProps?: Record<string, any>
  @Input() d2Props?: Record<string, any>
  @Input() infographicProps?: Record<string, any>
  @Input() customComponents?: NodeRendererProps['customComponents']
  @Input() showTooltips = true
  @Input() themes?: string[]
  @Input() isDark = false
  @Input() customId?: string
  @Input() indexKey?: number | string
  @Input() typewriter = true
  @Input() batchRendering = true
  @Input() initialRenderBatchSize = 40
  @Input() renderBatchSize = 80
  @Input() renderBatchDelay = 16
  @Input() renderBatchBudgetMs = 6
  @Input() renderBatchIdleTimeoutMs = 120
  @Input() deferNodesUntilVisible = true
  @Input() maxLiveNodes = 320
  @Input() liveNodeBuffer = 60
  @Input() allowHtml = true

  @Output() copy = new EventEmitter<string>()
  @Output() handleArtifactClick = new EventEmitter<any>()
  @Output() click = new EventEmitter<MouseEvent>()
  @Output() mouseover = new EventEmitter<MouseEvent>()
  @Output() mouseout = new EventEmitter<MouseEvent>()

  parsedNodes: AngularRenderableNode[] = []
  visibleEntries: VisibleNodeEntry[] = []
  renderContext: AngularRenderContext = { events: {} }
  topSpacerHeight = 0
  bottomSpacerHeight = 0

  private renderedCount = 0
  private focusIndex = 0
  private liveRange = { start: 0, end: 0 }
  private readonly nodeHeights = new Map<number, number>()
  private readonly nodeVisibility = new Set<number>()
  private readonly nodeSeen = new Set<number>()
  private readonly textStreamState = new Map<string, string>()
  private streamRenderVersion = 0
  private readonly slotElements = new Map<number, HTMLElement>()
  private readonly observedElements = new Map<number, HTMLElement>()
  private observer: IntersectionObserver | null = null
  private observerConfig: ObserverConfig | null = null
  private readonly observerIndexByElement = new Map<Element, number>()

  private batchTimer: number | null = null
  private batchRaf: number | null = null
  private batchIdle: number | null = null
  private batchPending = false
  private enhancementToken = 0
  private enhancementTimer: number | null = null
  private enhancementHandle: RenderedHtmlEnhancementHandle | null = null
  private postRenderTimer: number | null = null
  private unsubscribeCustomComponents?: () => void

  get resolvedIndexPrefix() {
    return this.indexKey != null ? String(this.indexKey) : 'renderer'
  }

  get resolvedInitialBatchSize() {
    return Math.max(1, Math.trunc(this.initialRenderBatchSize || 40))
  }

  get resolvedRenderBatchSize() {
    return Math.max(1, Math.trunc(this.renderBatchSize || 80))
  }

  get resolvedMaxLiveNodes() {
    return Math.max(1, Math.trunc(this.maxLiveNodes ?? 320))
  }

  get resolvedLiveNodeBuffer() {
    return Math.max(0, Math.trunc(this.liveNodeBuffer ?? 60))
  }

  get liveWindowEnabled() {
    const configuredMaxLiveNodes = Math.trunc(this.maxLiveNodes ?? 320)
    return Number.isFinite(configuredMaxLiveNodes) && configuredMaxLiveNodes > 0
  }

  get viewportPriorityEnabled() {
    return this.viewportPriority !== false
  }

  get virtualizationEnabled() {
    return resolveVirtualizationEnabled(this.parsedNodes.length, this.maxLiveNodes)
  }

  get incrementalRenderingActive() {
    return this.batchRendering !== false
      && typeof window !== 'undefined'
      && !this.liveWindowEnabled
      && !this.virtualizationEnabled
      && this.parsedNodes.length > this.resolvedInitialBatchSize
  }

  get deferNodesActive() {
    return resolveDeferNodes({
      deferNodesUntilVisible: this.deferNodesUntilVisible,
      maxLiveNodes: this.maxLiveNodes,
      parsedNodeCount: this.parsedNodes.length,
      viewportPriority: this.viewportPriorityEnabled,
      virtualizationEnabled: this.virtualizationEnabled,
    })
  }

  get shouldObserveSlots() {
    return this.deferNodesActive || this.virtualizationEnabled
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.content || changes.nodes)
      this.streamRenderVersion += 1
    this.rebuild()
  }

  ngOnInit() {
    this.unsubscribeCustomComponents = subscribeCustomComponents(() => {
      this.rebuild()
    })
  }

  ngAfterViewInit() {
    this.schedulePostRenderWork()
  }

  ngOnDestroy() {
    this.stopBatching()
    this.clearPostRenderWork()
    this.enhancementToken += 1
    this.disposeEnhancements()
    this.unsubscribeCustomComponents?.()
    this.unsubscribeCustomComponents = undefined
    this.disconnectObserver()
    if (this.enhancementTimer != null && typeof window !== 'undefined') {
      window.clearTimeout(this.enhancementTimer)
      this.enhancementTimer = null
    }
  }

  trackByEntry = (_index: number, entry: VisibleNodeEntry) => {
    return `${this.resolvedIndexPrefix}-${entry.index}`
  }

  entryIndexKey(index: number) {
    return `${this.resolvedIndexPrefix}-${index}`
  }

  handleMouseOver(event: MouseEvent) {
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-node-index]'))
      this.mouseover.emit(event)
  }

  handleMouseOut(event: MouseEvent) {
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-node-index]'))
      this.mouseout.emit(event)
  }

  private rebuild() {
    this.stopBatching()
    this.disposeEnhancements()
    this.cleanupTransientState()

    const scopedCustomComponents = getCustomNodeComponents(this.customId)
    const mergedCustomComponents = this.customComponents
      ? {
          ...scopedCustomComponents,
          ...this.customComponents,
        }
      : scopedCustomComponents

    const events: NodeRendererEvents = {
      onCopy: code => this.copy.emit(code),
      onHandleArtifactClick: payload => this.handleArtifactClick.emit(payload),
    }

    this.renderContext = buildRenderContext(
      {
        ...this,
        customComponents: mergedCustomComponents,
      },
      events,
      this.textStreamState,
      this.streamRenderVersion,
    )
    this.parsedNodes = resolveParsedNodes(this)
    this.trimMeasuredState()

    const total = this.parsedNodes.length
    this.focusIndex = Math.max(0, Math.min(this.focusIndex, Math.max(0, total - 1)))
    if (this.virtualizationEnabled) {
      this.renderedCount = total
      this.liveRange = computeLiveRange(total, this.focusIndex, this.resolvedMaxLiveNodes, this.resolvedLiveNodeBuffer)
    }
    else {
      this.liveRange = { start: 0, end: total }
      this.renderedCount = this.incrementalRenderingActive
        ? Math.min(total, this.resolvedInitialBatchSize)
        : total
    }

    if (!this.deferNodesActive)
      this.nodeVisibility.clear()

    this.refreshVisibleEntries()
    this.cdr.markForCheck()
    this.schedulePostRenderWork()

    if (this.incrementalRenderingActive && this.renderedCount < total)
      this.scheduleBatchStep()
  }

  private cleanupTransientState() {
    this.slotElements.clear()
    this.disconnectObserver()
  }

  private trimMeasuredState() {
    const total = this.parsedNodes.length
    for (const index of Array.from(this.nodeHeights.keys())) {
      if (index >= total)
        this.nodeHeights.delete(index)
    }
    for (const index of Array.from(this.nodeSeen)) {
      if (index >= total)
        this.nodeSeen.delete(index)
    }
    for (const index of Array.from(this.nodeVisibility)) {
      if (index >= total)
        this.nodeVisibility.delete(index)
    }
  }

  private refreshVisibleEntries() {
    const averageNodeHeight = resolveAverageNodeHeight(this.nodeHeights)
    const total = this.parsedNodes.length
    const source = this.virtualizationEnabled
      ? this.parsedNodes.slice(this.liveRange.start, this.liveRange.end).map((node, offset) => ({
          node,
          index: this.liveRange.start + offset,
        }))
      : this.parsedNodes.map((node, index) => ({ node, index }))

    this.topSpacerHeight = this.virtualizationEnabled
      ? estimateHeightRange(0, Math.min(this.liveRange.start, total), this.nodeHeights, averageNodeHeight)
      : 0
    this.bottomSpacerHeight = this.virtualizationEnabled
      ? estimateHeightRange(Math.min(this.liveRange.end, total), total, this.nodeHeights, averageNodeHeight)
      : 0

    this.visibleEntries = source.map(({ node, index }) => {
      const render = this.shouldRenderNode(index)
      let animate = false
      if (
        render
        && this.typewriter !== false
        && String((node as any)?.type || '') !== 'code_block'
        && !this.nodeSeen.has(index)
      ) {
        animate = true
        this.nodeSeen.add(index)
      }

      return {
        node,
        index,
        render,
        animate,
        placeholderHeight: this.nodeHeights.get(index) ?? averageNodeHeight,
      }
    })
  }

  private shouldRenderNode(index: number) {
    if (this.incrementalRenderingActive && index >= this.renderedCount)
      return false
    if (!this.deferNodesActive)
      return true
    if (index < this.resolvedInitialBatchSize)
      return true
    return this.nodeVisibility.has(index)
  }

  private scheduleBatchStep() {
    if (!this.incrementalRenderingActive || typeof window === 'undefined')
      return
    if (this.batchPending || this.renderedCount >= this.parsedNodes.length)
      return

    this.batchPending = true
    const run = (deadline?: IdleDeadlineLike) => {
      this.batchPending = false
      this.batchTimer = null
      this.batchRaf = null
      this.batchIdle = null

      const budget = Math.max(2, Math.trunc(this.renderBatchBudgetMs || 6))
      let nextCount = this.renderedCount
      do {
        nextCount = Math.min(this.parsedNodes.length, nextCount + this.resolvedRenderBatchSize)
        if (!deadline)
          break
        const remaining = typeof deadline.timeRemaining === 'function' ? deadline.timeRemaining() : 0
        if (remaining <= budget * 0.5)
          break
      } while (nextCount < this.parsedNodes.length)

      if (nextCount !== this.renderedCount) {
        this.renderedCount = nextCount
        this.refreshVisibleEntries()
        this.cdr.markForCheck()
        this.schedulePostRenderWork()
      }

      if (this.renderedCount < this.parsedNodes.length)
        this.scheduleBatchStep()
    }

    const idleCallback = (window as any).requestIdleCallback as ((cb: (deadline: IdleDeadlineLike) => void, opts?: { timeout?: number }) => number) | undefined
    const delay = Math.max(0, Math.trunc(this.renderBatchDelay || 0))
    if (idleCallback) {
      this.batchIdle = idleCallback(run, { timeout: Math.max(0, Math.trunc(this.renderBatchIdleTimeoutMs || 120)) })
      return
    }

    if (typeof window.requestAnimationFrame === 'function') {
      this.batchRaf = window.requestAnimationFrame(() => {
        if (delay === 0) {
          run()
          return
        }
        this.batchTimer = window.setTimeout(() => run(), delay)
      })
      return
    }

    this.batchTimer = window.setTimeout(() => run(), delay)
  }

  private stopBatching() {
    this.batchPending = false
    if (this.batchTimer != null && typeof window !== 'undefined') {
      window.clearTimeout(this.batchTimer)
      this.batchTimer = null
    }
    if (this.batchRaf != null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(this.batchRaf)
      this.batchRaf = null
    }
    const cancelIdle = (typeof window !== 'undefined' ? (window as any).cancelIdleCallback : null) as ((id: number) => void) | null
    if (this.batchIdle != null && cancelIdle) {
      cancelIdle(this.batchIdle)
      this.batchIdle = null
    }
  }

  private schedulePostRenderWork() {
    if (typeof window === 'undefined')
      return
    this.clearPostRenderWork()
    this.postRenderTimer = window.setTimeout(() => {
      this.postRenderTimer = null
      this.syncSlotObservers()
      this.measureNodeHeights()
      this.scheduleEnhancements()
    }, 0)
  }

  private clearPostRenderWork() {
    if (this.postRenderTimer != null && typeof window !== 'undefined') {
      window.clearTimeout(this.postRenderTimer)
      this.postRenderTimer = null
    }
  }

  private syncSlotObservers() {
    const root = this.rootRef?.nativeElement
    if (!root)
      return

    const currentIndices = new Set<number>()
    const slots = Array.from(root.querySelectorAll<HTMLElement>('.node-slot[data-node-index]'))
    for (const slot of slots) {
      const index = Number(slot.dataset.nodeIndex)
      if (!Number.isFinite(index))
        continue
      currentIndices.add(index)
      this.slotElements.set(index, slot)
      this.observeSlot(index, slot)
    }

    for (const [index] of Array.from(this.slotElements.entries())) {
      if (currentIndices.has(index))
        continue
      this.slotElements.delete(index)
      this.unobserveIndex(index)
    }
  }

  private observeSlot(index: number, slot: HTMLElement) {
    if (!this.shouldObserveSlots) {
      this.unobserveIndex(index)
      this.markNodeVisible(index)
      return
    }

    if (index < this.resolvedInitialBatchSize && !this.virtualizationEnabled) {
      this.unobserveIndex(index)
      this.markNodeVisible(index)
      return
    }

    const existing = this.observedElements.get(index)
    if (existing === slot)
      return

    this.unobserveIndex(index)
    const observer = this.ensureObserver('400px', 0)
    if (!observer) {
      this.markNodeVisible(index)
      return
    }

    this.observedElements.set(index, slot)
    this.observerIndexByElement.set(slot, index)
    observer.observe(slot)
  }

  private ensureObserver(rootMargin: string, threshold: number) {
    if (typeof window === 'undefined')
      return null
    if (typeof IntersectionObserver === 'undefined')
      return null
    if (!this.viewportPriorityEnabled && !this.virtualizationEnabled)
      return null

    const nextConfig: ObserverConfig = {
      root: this.resolveViewportRoot(),
      rootMargin,
      threshold,
    }

    if (
      this.observer
      && this.observerConfig
      && this.observerConfig.root === nextConfig.root
      && this.observerConfig.rootMargin === nextConfig.rootMargin
      && this.observerConfig.threshold === nextConfig.threshold
    ) {
      return this.observer
    }

    this.disconnectObserver()
    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!(entry.isIntersecting || entry.intersectionRatio > 0))
          continue
        const index = this.observerIndexByElement.get(entry.target)
        if (index == null)
          continue
        this.unobserveIndex(index)
        this.markNodeVisible(index)
      }
    }, nextConfig)
    this.observerConfig = nextConfig
    return this.observer
  }

  private resolveViewportRoot() {
    const base = this.rootRef?.nativeElement || this.hostRef.nativeElement
    if (!base || typeof window === 'undefined')
      return null

    const doc = base.ownerDocument || document
    const rootScrollable = doc.scrollingElement || doc.documentElement
    let current = base.parentElement
    while (current) {
      if (current === doc.body || current === rootScrollable)
        break
      const style = window.getComputedStyle(current)
      const overflowY = (style.overflowY || '').toLowerCase()
      const overflow = (style.overflow || '').toLowerCase()
      if (SCROLL_PARENT_OVERFLOW_RE.test(overflowY) || SCROLL_PARENT_OVERFLOW_RE.test(overflow))
        return current
      current = current.parentElement
    }

    return null
  }

  private markNodeVisible(index: number) {
    let changed = false
    if (this.deferNodesActive && !this.nodeVisibility.has(index)) {
      this.nodeVisibility.add(index)
      changed = true
    }

    if (this.virtualizationEnabled && index > this.focusIndex) {
      this.focusIndex = index
      this.liveRange = computeLiveRange(
        this.parsedNodes.length,
        this.focusIndex,
        this.resolvedMaxLiveNodes,
        this.resolvedLiveNodeBuffer,
      )
      changed = true
    }

    if (!changed)
      return

    this.refreshVisibleEntries()
    this.cdr.markForCheck()
    this.schedulePostRenderWork()
  }

  private unobserveIndex(index: number) {
    const element = this.observedElements.get(index)
    if (!element)
      return
    try {
      this.observer?.unobserve(element)
    }
    catch {
      // Ignore observer cleanup failures.
    }
    this.observerIndexByElement.delete(element)
    this.observedElements.delete(index)
  }

  private disconnectObserver() {
    try {
      this.observer?.disconnect()
    }
    catch {
      // Ignore observer cleanup failures.
    }
    this.observer = null
    this.observerConfig = null
    this.observerIndexByElement.clear()
    this.observedElements.clear()
  }

  private measureNodeHeights() {
    const root = this.rootRef?.nativeElement
    if (!root)
      return

    let changed = false
    const contentNodes = Array.from(root.querySelectorAll<HTMLElement>('.node-content[data-node-index]'))
    for (const element of contentNodes) {
      const index = Number(element.dataset.nodeIndex)
      if (!Number.isFinite(index))
        continue
      const height = element.offsetHeight
      if (!height)
        continue
      if (this.nodeHeights.get(index) !== height) {
        this.nodeHeights.set(index, height)
        changed = true
      }
    }

    if (!changed)
      return

    this.refreshVisibleEntries()
    this.cdr.markForCheck()
  }

  private scheduleEnhancements() {
    if (typeof window === 'undefined')
      return

    const token = ++this.enhancementToken
    if (this.enhancementTimer != null)
      window.clearTimeout(this.enhancementTimer)

    this.enhancementTimer = window.setTimeout(() => {
      this.enhancementTimer = null
      void this.applyEnhancements(token)
    }, 0)
  }

  private async applyEnhancements(token: number) {
    if (token !== this.enhancementToken)
      return

    const root = this.rootRef?.nativeElement || this.hostRef.nativeElement.querySelector('.markstream-angular') as HTMLElement | null
    if (!root)
      return

    const handle = await enhanceRenderedHtml(root, {
      final: this.final,
      isDark: this.isDark,
      renderCodeBlocksAsPre: this.renderCodeBlocksAsPre,
      monacoOptions: this.codeBlockMonacoOptions,
      d2ThemeId: this.d2Props?.themeId ?? null,
      d2DarkThemeId: this.d2Props?.darkThemeId ?? null,
      showTooltips: this.showTooltips,
      codeBlockProps: this.codeBlockProps,
      mermaidProps: this.mermaidProps,
      d2Props: this.d2Props,
      infographicProps: this.infographicProps,
      onCopy: code => this.copy.emit(code),
      isCancelled: () => token !== this.enhancementToken,
    })

    if (token !== this.enhancementToken) {
      handle.dispose()
      return
    }

    this.enhancementHandle = handle
    this.measureNodeHeights()
  }

  private disposeEnhancements() {
    this.enhancementHandle?.dispose()
    this.enhancementHandle = null

    const root = this.rootRef?.nativeElement || this.hostRef.nativeElement.querySelector('.markstream-angular') as HTMLElement | null
    if (root)
      disposeRenderedHtmlEnhancements(root)
  }
}
