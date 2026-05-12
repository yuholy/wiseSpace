import type { OnChanges } from '@angular/core'
import { Directive, ElementRef, inject, Input, Renderer2 } from '@angular/core'
import { isSafeAttrName } from './node-helpers'

@Directive({
  selector: '[markstreamSafeAttrs]',
  standalone: true,
})
export class SafeAttrsDirective implements OnChanges {
  private readonly elementRef = inject(ElementRef<HTMLElement>)
  private readonly renderer = inject(Renderer2)
  private readonly appliedAttrs = new Set<string>()
  private readonly appliedClasses = new Set<string>()
  private readonly appliedStyles = new Set<string>()

  @Input() markstreamSafeAttrs?: Record<string, unknown> | null

  ngOnChanges() {
    this.clearAppliedState()

    const attrs = this.markstreamSafeAttrs
    if (!attrs)
      return

    for (const [name, rawValue] of Object.entries(attrs)) {
      if (!isSafeAttrName(name))
        continue
      if (name === 'class' || name === 'className') {
        for (const token of String(rawValue || '').split(/\s+/g).map(item => item.trim()).filter(Boolean)) {
          this.renderer.addClass(this.elementRef.nativeElement, token)
          this.appliedClasses.add(token)
        }
        continue
      }
      if (name === 'style' && rawValue && typeof rawValue === 'object') {
        for (const [styleName, styleValue] of Object.entries(rawValue as Record<string, unknown>)) {
          this.renderer.setStyle(this.elementRef.nativeElement, styleName, styleValue as any)
          this.appliedStyles.add(styleName)
        }
        continue
      }

      if (rawValue === false || rawValue == null)
        continue

      this.renderer.setAttribute(
        this.elementRef.nativeElement,
        name,
        rawValue === true ? '' : String(rawValue),
      )
      this.appliedAttrs.add(name)
    }
  }

  private clearAppliedState() {
    for (const name of this.appliedAttrs)
      this.renderer.removeAttribute(this.elementRef.nativeElement, name)
    for (const token of this.appliedClasses)
      this.renderer.removeClass(this.elementRef.nativeElement, token)
    for (const name of this.appliedStyles)
      this.renderer.removeStyle(this.elementRef.nativeElement, name)

    this.appliedAttrs.clear()
    this.appliedClasses.clear()
    this.appliedStyles.clear()
  }
}
