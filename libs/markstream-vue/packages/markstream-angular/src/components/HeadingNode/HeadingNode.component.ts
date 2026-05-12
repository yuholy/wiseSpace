import type { AngularRenderableNode, AngularRenderContext } from '../shared/node-helpers'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core'
import { NestedRendererComponent } from '../NestedRenderer/NestedRenderer.component'
import { clampHeadingLevel, getNodeList } from '../shared/node-helpers'
import { SafeAttrsDirective } from '../shared/safe-attrs.directive'

@Component({
  selector: 'markstream-angular-heading-node',
  standalone: true,
  imports: [CommonModule, SafeAttrsDirective, forwardRef(() => NestedRendererComponent)],
  template: `
    <h1 *ngIf="level === 1" dir="auto" class="heading-node heading-1" [markstreamSafeAttrs]="attrs">
      <markstream-angular-nested-renderer [nodes]="children" [context]="context" [indexPrefix]="nestedPrefix" />
    </h1>
    <h2 *ngIf="level === 2" dir="auto" class="heading-node heading-2" [markstreamSafeAttrs]="attrs">
      <markstream-angular-nested-renderer [nodes]="children" [context]="context" [indexPrefix]="nestedPrefix" />
    </h2>
    <h3 *ngIf="level === 3" dir="auto" class="heading-node heading-3" [markstreamSafeAttrs]="attrs">
      <markstream-angular-nested-renderer [nodes]="children" [context]="context" [indexPrefix]="nestedPrefix" />
    </h3>
    <h4 *ngIf="level === 4" dir="auto" class="heading-node heading-4" [markstreamSafeAttrs]="attrs">
      <markstream-angular-nested-renderer [nodes]="children" [context]="context" [indexPrefix]="nestedPrefix" />
    </h4>
    <h5 *ngIf="level === 5" dir="auto" class="heading-node heading-5" [markstreamSafeAttrs]="attrs">
      <markstream-angular-nested-renderer [nodes]="children" [context]="context" [indexPrefix]="nestedPrefix" />
    </h5>
    <h6 *ngIf="level === 6" dir="auto" class="heading-node heading-6" [markstreamSafeAttrs]="attrs">
      <markstream-angular-nested-renderer [nodes]="children" [context]="context" [indexPrefix]="nestedPrefix" />
    </h6>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeadingNodeComponent {
  @Input({ required: true }) node!: AngularRenderableNode
  @Input() context?: AngularRenderContext
  @Input() indexKey?: string

  get level() {
    return clampHeadingLevel((this.node as any)?.level)
  }

  get attrs() {
    const raw = (this.node as any)?.attrs
    return raw && typeof raw === 'object' ? raw : null
  }

  get children() {
    return getNodeList((this.node as any)?.children)
  }

  get nestedPrefix() {
    return `${this.indexKey || 'heading'}-${this.level}`
  }
}
