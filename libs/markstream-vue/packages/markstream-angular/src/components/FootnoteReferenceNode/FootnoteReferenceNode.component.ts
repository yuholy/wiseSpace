import type { AngularRenderableNode } from '../shared/node-helpers'
import { ChangeDetectionStrategy, Component, Input } from '@angular/core'
import { getString } from '../shared/node-helpers'

@Component({
  selector: 'markstream-angular-footnote-reference-node',
  standalone: true,
  template: `
    <sup class="markstream-nested-footnote-ref">
      <a [attr.href]="href">[{{ id }}]</a>
    </sup>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FootnoteReferenceNodeComponent {
  @Input({ required: true }) node!: AngularRenderableNode

  get id() {
    return getString((this.node as any)?.id)
  }

  get href() {
    return `#fnref--${this.id}`
  }
}
