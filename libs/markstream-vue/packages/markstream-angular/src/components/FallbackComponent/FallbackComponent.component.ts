import type { AngularRenderableNode, AngularRenderContext } from '../shared/node-helpers'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core'
import { NestedRendererComponent } from '../NestedRenderer/NestedRenderer.component'
import {
  escapeHtml,
  getNodeList,
  getString,
  sanitizeClassToken,
} from '../shared/node-helpers'

@Component({
  selector: 'markstream-angular-fallback-node',
  standalone: true,
  imports: [CommonModule, forwardRef(() => NestedRendererComponent)],
  template: `
    <div
      class="markstream-nested-custom"
      [class]="customClassName"
      [attr.data-markstream-custom-tag]="customTag"
    >
      <markstream-angular-nested-renderer
        *ngIf="hasNestedContent; else fallbackBody"
        [node]="node"
        [context]="context"
        [indexPrefix]="nestedPrefix"
        [final]="resolvedFinal"
        [customHtmlTags]="context?.customHtmlTags"
        [parseOptions]="context?.parseOptions"
        [customMarkdownIt]="context?.customMarkdownIt"
      />

      <ng-template #fallbackBody>
        <div [innerHTML]="rawBodyHtml"></div>
      </ng-template>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FallbackComponent {
  @Input({ required: true }) node!: AngularRenderableNode
  @Input() context?: AngularRenderContext
  @Input() indexKey?: string

  get children() {
    return getNodeList((this.node as any)?.children)
  }

  get hasChildren() {
    return this.children.length > 0
  }

  get hasNestedContent() {
    return this.hasChildren || !!getString((this.node as any)?.content)
  }

  get customTag() {
    return getString((this.node as any)?.tag || (this.node as any)?.type)
  }

  get customClassName() {
    const tag = sanitizeClassToken(this.customTag) || 'node'
    return `markstream-nested-custom--${tag}`
  }

  get rawBodyHtml() {
    return escapeHtml(getString((this.node as any)?.raw))
  }

  get nestedPrefix() {
    return `${this.indexKey || 'fallback'}-children`
  }

  get resolvedFinal() {
    if (typeof (this.node as any)?.loading === 'boolean')
      return !(this.node as any).loading
    return this.context?.final
  }
}
