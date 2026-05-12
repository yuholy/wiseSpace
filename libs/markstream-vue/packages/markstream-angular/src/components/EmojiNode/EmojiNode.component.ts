import type { AngularRenderableNode } from '../shared/node-helpers'
import { ChangeDetectionStrategy, Component, Input } from '@angular/core'
import { getString } from '../shared/node-helpers'

@Component({
  selector: 'markstream-angular-emoji-node',
  standalone: true,
  template: '<span class="markstream-angular-emoji">{{ text }}</span>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmojiNodeComponent {
  @Input({ required: true }) node!: AngularRenderableNode

  get text() {
    return getString((this.node as any)?.raw || (this.node as any)?.markup || (this.node as any)?.content || (this.node as any)?.name)
  }
}
