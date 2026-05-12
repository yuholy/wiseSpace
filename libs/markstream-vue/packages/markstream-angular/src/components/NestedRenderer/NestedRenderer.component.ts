import type { OnChanges } from '@angular/core'
import type { MarkdownIt, ParseOptions } from 'stream-markdown-parser'
import type { AngularRenderableNode, AngularRenderContext } from '../shared/node-helpers'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core'
import { mergeCustomHtmlTags } from 'stream-markdown-parser'
import { parseNestedMarkdownToNodes } from '../../parseNestedMarkdownToNodes'
import { NodeOutletComponent } from '../NodeOutlet/NodeOutlet.component'
import { normalizeTokenAttrs } from '../shared/node-helpers'
import { SafeAttrsDirective } from '../shared/safe-attrs.directive'

type NestedRenderItem
  = | { kind: 'label', attrs: Record<string, string | true> | null, children: AngularRenderableNode[] }
    | { kind: 'node', node: AngularRenderableNode }

@Component({
  selector: 'markstream-angular-nested-renderer',
  standalone: true,
  imports: [
    CommonModule,
    SafeAttrsDirective,
    forwardRef(() => NestedRendererComponent),
    forwardRef(() => NodeOutletComponent),
  ],
  template: `
    <ng-container *ngFor="let item of items; let idx = index; trackBy: trackByIndex">
      <label *ngIf="item.kind === 'label'; else nodeTemplate" [markstreamSafeAttrs]="item.attrs">
        <markstream-angular-nested-renderer
          [nodes]="item.children"
          [context]="context"
          [indexPrefix]="childPrefix(idx)"
        />
      </label>

      <ng-template #nodeTemplate>
        <markstream-angular-node-outlet
          [node]="$any(item).node"
          [context]="context"
          [indexKey]="childPrefix(idx)"
        />
      </ng-template>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NestedRendererComponent implements OnChanges {
  @Input() node?: AngularRenderableNode | null
  @Input() nodes: readonly AngularRenderableNode[] | null | undefined
  @Input() content?: string | null
  @Input() loading?: boolean
  @Input() final?: boolean
  @Input() cacheKey?: string
  @Input() parseOptions?: ParseOptions
  @Input() customHtmlTags?: readonly string[]
  @Input() customMarkdownIt?: (markdown: MarkdownIt) => MarkdownIt
  @Input() context?: AngularRenderContext
  @Input() indexPrefix = 'nested'

  items: NestedRenderItem[] = []

  ngOnChanges() {
    this.items = this.buildItems(this.resolvedNodes)
  }

  trackByIndex = (index: number) => {
    return `${this.indexPrefix}-${index}`
  }

  childPrefix(index: number) {
    return `${this.indexPrefix}-${index}`
  }

  private get resolvedNodes() {
    return parseNestedMarkdownToNodes(
      {
        node: this.node as any,
        nodes: this.nodes as any,
        content: this.content,
      },
      {
        cacheKey: this.cacheKey,
        final: this.resolveFinal(),
        parseOptions: this.parseOptions ?? this.context?.parseOptions,
        customHtmlTags: this.resolveCustomHtmlTags(),
        customMarkdownIt: this.customMarkdownIt ?? this.context?.customMarkdownIt,
      },
    ) as AngularRenderableNode[]
  }

  private buildItems(nodes: readonly AngularRenderableNode[] | null | undefined) {
    const source = Array.isArray(nodes) ? nodes : []
    const items: NestedRenderItem[] = []

    for (let index = 0; index < source.length; index += 1) {
      const node = source[index]
      if (!node)
        continue

      if (node.type === 'label_open') {
        const children: AngularRenderableNode[] = []
        let cursor = index + 1
        for (; cursor < source.length; cursor += 1) {
          const segment = source[cursor]
          if (segment?.type === 'label_close')
            break
          if (segment)
            children.push(segment)
        }

        items.push({
          kind: 'label',
          attrs: normalizeTokenAttrs((node as any)?.attrs),
          children,
        })
        index = cursor
        continue
      }

      if (node.type === 'label_close')
        continue

      items.push({ kind: 'node', node })
    }

    return items
  }

  private resolveFinal() {
    if (typeof this.final === 'boolean')
      return this.final
    if (typeof this.loading === 'boolean')
      return !this.loading
    if (typeof (this.node as any)?.loading === 'boolean')
      return !(this.node as any).loading
    return this.context?.final
  }

  private resolveCustomHtmlTags() {
    return mergeCustomHtmlTags(this.context?.customHtmlTags, this.customHtmlTags)
  }
}
