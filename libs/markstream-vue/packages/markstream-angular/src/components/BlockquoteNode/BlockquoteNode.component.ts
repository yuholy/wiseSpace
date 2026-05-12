import type { AngularRenderableNode, AngularRenderContext } from '../shared/node-helpers'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core'
import { NestedRendererComponent } from '../NestedRenderer/NestedRenderer.component'
import { getNodeList } from '../shared/node-helpers'

@Component({
  selector: 'markstream-angular-blockquote-node',
  standalone: true,
  imports: [CommonModule, forwardRef(() => NestedRendererComponent)],
  template: `
    <blockquote class="blockquote-node" dir="auto" [attr.cite]="cite">
      <markstream-angular-nested-renderer
        [nodes]="children"
        [context]="context"
        [indexPrefix]="nestedPrefix"
      />
    </blockquote>
  `,
  styles: [`
    .blockquote-node :where(.markstream-angular) {
      content-visibility: visible;
      contain: content;
      contain-intrinsic-size: 0 0;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockquoteNodeComponent {
  @Input({ required: true }) node!: AngularRenderableNode
  @Input() context?: AngularRenderContext
  @Input() indexKey?: string

  get children() {
    return getNodeList((this.node as any)?.children)
  }

  get cite() {
    const value = (this.node as any)?.cite
    return typeof value === 'string' && value.trim() ? value : null
  }

  get nestedPrefix() {
    return `${this.indexKey || 'blockquote'}-quote`
  }
}
