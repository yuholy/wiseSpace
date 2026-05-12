import { ChangeDetectionStrategy, Component } from '@angular/core'

@Component({
  selector: 'markstream-angular-hardbreak-node',
  standalone: true,
  template: '<br>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HardBreakNodeComponent {}
