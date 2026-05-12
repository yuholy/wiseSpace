import type { OnChanges } from '@angular/core'
import type { AngularRenderableNode, AngularRenderContext } from '../shared/node-helpers'
import { CommonModule } from '@angular/common'
import { ChangeDetectionStrategy, Component, forwardRef, Input } from '@angular/core'
import { NestedRendererComponent } from '../NestedRenderer/NestedRenderer.component'
import { NodeOutletComponent } from '../NodeOutlet/NodeOutlet.component'
import {
  getNodeList,
  getString,
  isMediaOnlyParagraphNodes,
  isWhitespaceTextNode,
  normalizeMediaOnlyParagraphNodes,
  splitParagraphChildren,
} from '../shared/node-helpers'

type ParagraphSegment
  = | { kind: 'inline', nodes: AngularRenderableNode[], mediaOnly: boolean }
    | { kind: 'block', node: AngularRenderableNode }

@Component({
  selector: 'markstream-angular-paragraph-node',
  standalone: true,
  imports: [
    CommonModule,
    forwardRef(() => NestedRendererComponent),
    forwardRef(() => NodeOutletComponent),
  ],
  template: `
    <ng-container *ngIf="segments.length > 0; else simpleParagraph">
      <ng-container *ngFor="let segment of segments; let idx = index; trackBy: trackByIndex">
        <p *ngIf="segment.kind === 'inline'; else blockSegment" dir="auto" class="paragraph-node">
          <ng-container *ngIf="$any(segment).mediaOnly; else nestedInline">
            <ng-container *ngFor="let child of $any(segment).nodes; let childIdx = index; trackBy: trackByChildIndex">
              <ng-container *ngIf="isWhitespaceText(child); else inlineNode">{{ getTextContent(child) }}</ng-container>

              <ng-template #inlineNode>
                <markstream-angular-node-outlet
                  [node]="child"
                  [context]="context"
                  [indexKey]="childPrefix(idx, childIdx)"
                />
              </ng-template>
            </ng-container>
          </ng-container>

          <ng-template #nestedInline>
            <markstream-angular-nested-renderer
              [nodes]="$any(segment).nodes"
              [context]="context"
              [indexPrefix]="segmentPrefix(idx)"
            />
          </ng-template>
        </p>

        <ng-template #blockSegment>
          <markstream-angular-node-outlet
            [node]="$any(segment).node"
            [context]="context"
            [indexKey]="segmentPrefix(idx)"
          />
        </ng-template>
      </ng-container>
    </ng-container>

    <ng-template #simpleParagraph>
      <p dir="auto" class="paragraph-node">
        <markstream-angular-nested-renderer
          [nodes]="children"
          [context]="context"
          [indexPrefix]="indexKey || 'paragraph'"
        />
      </p>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParagraphNodeComponent implements OnChanges {
  @Input({ required: true }) node!: AngularRenderableNode
  @Input() context?: AngularRenderContext
  @Input() indexKey?: string

  segments: ParagraphSegment[] = []

  get children() {
    return getNodeList((this.node as any)?.children)
  }

  ngOnChanges() {
    this.segments = splitParagraphChildren(this.children).map((segment) => {
      if (segment.kind === 'block')
        return segment

      const mediaOnly = isMediaOnlyParagraphNodes(segment.nodes)
      return {
        kind: 'inline',
        nodes: mediaOnly ? normalizeMediaOnlyParagraphNodes(segment.nodes) : segment.nodes,
        mediaOnly,
      }
    })
  }

  trackByIndex = (index: number) => {
    return `${this.indexKey || 'paragraph'}-${index}`
  }

  trackByChildIndex = (index: number) => {
    return index
  }

  segmentPrefix(index: number) {
    return `${this.indexKey || 'paragraph'}-${index}`
  }

  childPrefix(segmentIndex: number, childIndex: number) {
    return `${this.segmentPrefix(segmentIndex)}-${childIndex}`
  }

  isWhitespaceText(node: AngularRenderableNode) {
    return isWhitespaceTextNode(node)
  }

  getTextContent(node: AngularRenderableNode) {
    return getString((node as any)?.content)
  }
}
