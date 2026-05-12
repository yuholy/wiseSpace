import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('markstream-angular link loading defaults', () => {
  it('keeps the subtle loading hint template and CSS tokens in sync', () => {
    const componentSource = readFileSync(resolve(process.cwd(), 'packages/markstream-angular/src/components/LinkNode/LinkNode.component.ts'), 'utf8')
    const cssSource = readFileSync(resolve(process.cwd(), 'packages/markstream-angular/src/index.css'), 'utf8')

    expect(componentSource).toContain('link-loading-indicator')
    expect(componentSource).toContain('\'--underline-opacity\': \'0.35\'')
    expect(componentSource).toContain('\'--underline-rest-opacity\': \'0.175\'')
    expect(componentSource).toContain('\'--underline-duration\': \'1.6s\'')
    expect(componentSource).toContain('\'--underline-timing\': \'ease-in-out\'')

    expect(cssSource).toContain('.markstream-angular .link-loading-indicator')
    expect(cssSource).toContain('markstream-angular-link-loading-pulse')
    expect(cssSource).toContain('opacity: var(--underline-rest-opacity, 0.18);')
  })
})
