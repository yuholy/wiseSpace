import { describe, expect, it } from 'vitest'
import { contrastRatio, hslToRgb, rgbToHsl } from '../scripts/theme-gen/color.mjs'
import { generateBothSchemes, validateContrast } from '../scripts/theme-gen/dark.mjs'

interface HslColor {
  h: number
  s: number
  l: number
}

type TokenMap = Record<string, string>

const lightSemanticKeyColors = {
  info: '#1d4ed8',
  success: '#166534',
  warning: '#92400e',
}

const darkSemanticKeyColors = {
  info: '#78a9ff',
  success: '#63d29d',
  warning: '#ffbe5c',
}

function parseToken(token: string): HslColor {
  const values = token.match(/[\d.]+/g)?.map(Number)
  if (!values || values.length < 3)
    throw new Error(`Invalid token: ${token}`)
  return { h: values[0], s: values[1], l: values[2] }
}

function alphaBlend(foreground: HslColor, background: HslColor, alpha: number): HslColor {
  const fg = hslToRgb(foreground.h, foreground.s, foreground.l)
  const bg = hslToRgb(background.h, background.s, background.l)

  return rgbToHsl(
    Math.round(fg.r * alpha + bg.r * (1 - alpha)),
    Math.round(fg.g * alpha + bg.g * (1 - alpha)),
    Math.round(fg.b * alpha + bg.b * (1 - alpha)),
  )
}

function getThemeMode(tokens: TokenMap): 'light' | 'dark' {
  return parseToken(tokens.background).l > 50 ? 'light' : 'dark'
}

function getActualAdmonitionHeaderBackground(tokens: TokenMap, semanticKey: 'info' | 'success' | 'warning') {
  const mode = getThemeMode(tokens)
  const semantic = parseToken(tokens[semanticKey])
  const muted = parseToken(tokens.muted)
  const alpha = mode === 'light' ? 0.06 : 0.12
  return alphaBlend(semantic, muted, alpha)
}

describe('theme-gen regressions', () => {
  it('keeps provided semantic header colors readable on the actual admonition header background', () => {
    const cases = [
      { name: 'claude', background: '#f5f4ed', foreground: '#141413', brand: '#c96442', ...lightSemanticKeyColors },
      { name: 'green', background: '#f0fdf4', foreground: '#14532d', brand: '#16a34a', ...lightSemanticKeyColors },
      { name: 'ink', background: '#0b1020', foreground: '#e5ecff', brand: '#7c3aed', ...darkSemanticKeyColors },
    ]

    for (const { name, ...keyColors } of cases) {
      const { light, dark } = generateBothSchemes(keyColors)
      let checkedPairs = 0

      for (const [mode, tokens] of Object.entries({ light, dark })) {
        for (const semanticKey of ['info', 'success', 'warning'] as const) {
          if (!tokens[semanticKey])
            continue
          checkedPairs += 1
          const semantic = parseToken(tokens[semanticKey])
          const actualHeaderBg = getActualAdmonitionHeaderBackground(tokens, semanticKey)
          expect(
            contrastRatio(semantic, actualHeaderBg),
            `${name} ${mode} ${semanticKey} should stay readable on the real admonition header background`,
          ).toBeGreaterThanOrEqual(4.5)
        }
      }

      expect(checkedPairs, `${name} should emit semantic tokens for at least one generated scheme`).toBeGreaterThan(0)
    }
  })

  it('reports semantic header contrast using the real admonition background composition', () => {
    const { light } = generateBothSchemes({
      background: '#f5f4ed',
      foreground: '#141413',
      brand: '#c96442',
      ...lightSemanticKeyColors,
    })

    const report = validateContrast(light)

    for (const semanticKey of ['info', 'success', 'warning'] as const) {
      const entry = report.find(result => result.fg === semanticKey)
      const actualRatio = contrastRatio(
        parseToken(light[semanticKey]),
        getActualAdmonitionHeaderBackground(light, semanticKey),
      )

      expect(entry, `${semanticKey} should be included in the contrast report`).toBeTruthy()
      expect(
        Math.abs((entry?.ratio ?? 0) - actualRatio),
        `${semanticKey} report should match the real admonition header composition`,
      ).toBeLessThan(0.15)
      expect(entry?.passAA).toBe(actualRatio >= (entry?.threshold ?? 4.5))
    }
  })

  it('finds a distinguishable dark-scheme link for blue brands when a nearby valid candidate exists', () => {
    const { dark } = generateBothSchemes({
      background: '#ffffff',
      foreground: '#111111',
      brand: '#2563eb',
    })

    const background = parseToken(dark.background)
    const foreground = parseToken(dark.foreground)
    const generatedLink = parseToken(dark.link)
    const nearbyValidCandidate = { h: 228, s: 84, l: 68 }

    expect(contrastRatio(nearbyValidCandidate, background)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(nearbyValidCandidate, foreground)).toBeGreaterThanOrEqual(3)

    expect(contrastRatio(generatedLink, background)).toBeGreaterThanOrEqual(4.5)
    expect(
      contrastRatio(generatedLink, foreground),
      'generated dark link should not stay in warn territory when a nearby blue-purple candidate satisfies both constraints',
    ).toBeGreaterThanOrEqual(3)
  })
})
