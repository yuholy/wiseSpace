import type { AngularRenderableNode, AngularRenderContext } from '../shared/node-helpers'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core'
import { NestedRendererComponent } from '../NestedRenderer/NestedRenderer.component'
import { capitalize, getNodeList, getString, sanitizeClassToken } from '../shared/node-helpers'

@Component({
  selector: 'markstream-angular-admonition-node',
  standalone: true,
  imports: [CommonModule, forwardRef(() => NestedRendererComponent)],
  template: `
    <div class="markstream-nested-admonition" [class]="kindClass">
      <div class="markstream-nested-admonition__title">{{ resolvedTitle }}</div>
      <div class="markstream-nested-admonition__content">
        <markstream-angular-nested-renderer
          [nodes]="children"
          [context]="context"
          [indexPrefix]="nestedPrefix"
        />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmonitionNodeComponent {
  @Input({ required: true }) node!: AngularRenderableNode
  @Input() context?: AngularRenderContext
  @Input() indexKey?: string

  get kind() {
    return sanitizeClassToken(getString((this.node as any)?.kind || 'note')) || 'note'
  }

  get kindClass() {
    return `markstream-nested-admonition--${this.kind}`
  }

  get resolvedTitle() {
    return getString((this.node as any)?.title) || capitalize(this.kind)
  }

  get children() {
    return getNodeList((this.node as any)?.children)
  }

  get nestedPrefix() {
    return `${this.indexKey || 'admonition'}-children`
  }
}
