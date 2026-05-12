import type { AngularRenderableNode, AngularRenderContext } from '../shared/node-helpers'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core'
import { NestedRendererComponent } from '../NestedRenderer/NestedRenderer.component'
import { getNodeList } from '../shared/node-helpers'

@Component({
  selector: 'markstream-angular-superscript-node',
  standalone: true,
  imports: [CommonModule, forwardRef(() => NestedRendererComponent)],
  template: `
    <sup>
      <markstream-angular-nested-renderer
        [nodes]="children"
        [context]="context"
        [indexPrefix]="nestedPrefix"
      />
    </sup>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuperscriptNodeComponent {
  @Input({ required: true }) node!: AngularRenderableNode
  @Input() context?: AngularRenderContext
  @Input() indexKey?: string

  get children() {
    return getNodeList((this.node as any)?.children)
  }

  get nestedPrefix() {
    return `${this.indexKey || 'superscript'}-sup`
  }
}
