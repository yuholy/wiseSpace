import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('playground-angular thinking node', () => {
  it('uses a full nested NodeRenderer so typewriter enter and streamed fade stay enabled', () => {
    const componentSource = readFileSync(resolve(process.cwd(), 'playground-angular/src/thinking-node.component.ts'), 'utf8')

    expect(componentSource).toContain('import { NodeRenderer } from \'markstream-angular\'')
    expect(componentSource).toContain('imports: [CommonModule, NodeRenderer]')
    expect(componentSource).toContain(':host {')
    expect(componentSource).toContain('<markstream-angular')
    expect(componentSource).toContain('[typewriter]="resolvedTypewriter"')
    expect(componentSource).toContain('thinking-node__content-shell')
    expect(componentSource).toContain('thinking-content-fade')
    expect(componentSource).toContain('[customComponents]="context?.customComponents"')
    expect(componentSource).toContain('content-visibility: visible;')
    expect(componentSource).toContain('contain: content;')
    expect(componentSource).not.toContain('<markstream-angular-nested-renderer')
  })
})
