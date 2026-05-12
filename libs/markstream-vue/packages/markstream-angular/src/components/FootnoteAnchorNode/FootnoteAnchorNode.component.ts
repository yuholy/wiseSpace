import type { AngularRenderableNode } from '../shared/node-helpers'
import { ChangeDetectionStrategy, Component, Input } from '@angular/core'
import { getString } from '../shared/node-helpers'

@Component({
  selector: 'markstream-angular-footnote-anchor-node',
  standalone: true,
  template: `
    <a
      class="footnote-anchor text-sm text-[#0366d6] hover:underline cursor-pointer"
      [attr.href]="href"
      [attr.title]="title"
    >
      ↩︎
    </a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FootnoteAnchorNodeComponent {
  @Input({ required: true }) node!: AngularRenderableNode

  get id() {
    return getString((this.node as any)?.id)
  }

  get href() {
    return `#fnref-${this.id}`
  }

  get title() {
    return `Back to reference ${this.id}`
  }
}
