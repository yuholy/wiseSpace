import type { AngularRenderableNode, AngularRenderContext } from '../shared/node-helpers'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core'
import { ListItemNodeComponent } from '../ListItemNode/ListItemNode.component'
import { getNodeList } from '../shared/node-helpers'

@Component({
  selector: 'markstream-angular-list-node',
  standalone: true,
  imports: [CommonModule, forwardRef(() => ListItemNodeComponent)],
  template: `
    <ol *ngIf="ordered; else unorderedList" class="list-node my-5 pl-[calc(13/8*1em)]" [attr.start]="startValue || null">
      <markstream-angular-list-item-node
        *ngFor="let item of items; let idx = index; trackBy: trackByIndex"
        [node]="item"
        [value]="startValue + idx"
        [context]="context"
        [indexKey]="itemPrefix(idx)"
      />
    </ol>

    <ng-template #unorderedList>
      <ul class="list-node my-5 pl-[calc(13/8*1em)] list-disc max-lg:my-[calc(4/3*1em)] max-lg:pl-[calc(14/9*1em)]">
        <markstream-angular-list-item-node
          *ngFor="let item of items; let idx = index; trackBy: trackByIndex"
          [node]="item"
          [context]="context"
          [indexKey]="itemPrefix(idx)"
        />
      </ul>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListNodeComponent {
  @Input({ required: true }) node!: AngularRenderableNode
  @Input() context?: AngularRenderContext
  @Input() indexKey?: string

  get ordered() {
    return !!(this.node as any)?.ordered
  }

  get startValue() {
    return Number((this.node as any)?.start) || 1
  }

  get items() {
    return getNodeList((this.node as any)?.items)
  }

  trackByIndex = (index: number) => {
    return this.itemPrefix(index)
  }

  itemPrefix(index: number) {
    return `${this.indexKey || 'list'}-${index}`
  }
}
