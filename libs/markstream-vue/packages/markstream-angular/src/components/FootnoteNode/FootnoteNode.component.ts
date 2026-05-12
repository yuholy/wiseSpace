import type { AngularRenderableNode, AngularRenderContext } from '../shared/node-helpers'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core'
import { NestedRendererComponent } from '../NestedRenderer/NestedRenderer.component'
import { getNodeList, getString } from '../shared/node-helpers'

@Component({
  selector: 'markstream-angular-footnote-node',
  standalone: true,
  imports: [CommonModule, forwardRef(() => NestedRendererComponent)],
  template: `
    <div [attr.id]="footnoteId" class="markstream-nested-footnote">
      <markstream-angular-nested-renderer
        [nodes]="children"
        [context]="context"
        [indexPrefix]="nestedPrefix"
      />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FootnoteNodeComponent {
  @Input({ required: true }) node!: AngularRenderableNode
  @Input() context?: AngularRenderContext
  @Input() indexKey?: string

  get footnoteId() {
    return `fnref--${getString((this.node as any)?.id)}`
  }

  get children() {
    return getNodeList((this.node as any)?.children)
  }

  get nestedPrefix() {
    return `${this.indexKey || 'footnote'}-children`
  }
}
