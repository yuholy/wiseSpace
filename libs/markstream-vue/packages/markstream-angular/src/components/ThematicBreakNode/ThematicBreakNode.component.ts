import { ChangeDetectionStrategy, Component } from '@angular/core'

@Component({
  selector: 'markstream-angular-thematic-break-node',
  standalone: true,
  template: '<hr>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThematicBreakNodeComponent {}
