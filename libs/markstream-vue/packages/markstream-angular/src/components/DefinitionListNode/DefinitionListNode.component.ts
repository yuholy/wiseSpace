import type { AngularRenderableNode, AngularRenderContext } from '../shared/node-helpers'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core'
import { NestedRendererComponent } from '../NestedRenderer/NestedRenderer.component'
import { getNodeList } from '../shared/node-helpers'

@Component({
  selector: 'markstream-angular-definition-list-node',
  standalone: true,
  imports: [CommonModule, forwardRef(() => NestedRendererComponent)],
  template: `
    <dl>
      <ng-container *ngFor="let item of items; let idx = index; trackBy: trackByIndex">
        <dt>
          <markstream-angular-nested-renderer
            [nodes]="termFor(item)"
            [context]="context"
            [indexPrefix]="itemPrefix(idx, 'term')"
          />
        </dt>
        <dd>
          <markstream-angular-nested-renderer
            [nodes]="definitionFor(item)"
            [context]="context"
            [indexPrefix]="itemPrefix(idx, 'definition')"
          />
        </dd>
      </ng-container>
    </dl>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DefinitionListNodeComponent {
  @Input({ required: true }) node!: AngularRenderableNode
  @Input() context?: AngularRenderContext
  @Input() indexKey?: string

  get items() {
    return getNodeList((this.node as any)?.items)
  }

  termFor(item: AngularRenderableNode) {
    return getNodeList((item as any)?.term)
  }

  definitionFor(item: AngularRenderableNode) {
    return getNodeList((item as any)?.definition)
  }

  trackByIndex = (index: number) => {
    return `${this.indexKey || 'definition-list'}-${index}`
  }

  itemPrefix(index: number, part: string) {
    return `${this.indexKey || 'definition-list'}-${index}-${part}`
  }
}
