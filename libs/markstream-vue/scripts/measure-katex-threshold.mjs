#!/usr/bin/env node
/**
 * Measure KaTeX render time and recommend a worker threshold N
 * N ≈ B / (R × (1 - H))
 * - B: main-thread budget (ms) — defaults to 50ms and 16.7ms
 * - R: avg render time per unique formula (ms)
 * - H: cache hit rate (0~1). For first paint assume H=0
 */

import { performance } from 'node:perf_hooks'
import process from 'node:process'

async function getKatex() {
  try {
    const k = await import('katex')
    return k.default || k
  }
  catch {
    console.error('[measure-katex-threshold] KaTeX not installed. pnpm add katex -D')
    process.exit(1)
  }
}

const FORMULAS = {
  simple: [
    'x',
    'a + b',
    'E = mc^2',
  ],
  medium: [
    '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
    '\\frac{a}{b} + \\sqrt{x}',
    '\\lim_{x \\to 0} \\frac{\\sin x}{x}',
  ],
  complex: [
    '\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}',
    '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
    '\\frac{d}{dx}\\left(\\int_{a}^{x} f(t)\\,dt\\right) = f(x)',
  ],
}

function bench(katex, formulas, iterations = 50) {
  // warm-up
  for (let i = 0; i < 10; i++) {
    for (const f of formulas) katex.renderToString(f, { throwOnError: false, displayMode: true })
  }
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    for (const f of formulas) katex.renderToString(f, { throwOnError: false, displayMode: true })
  }
  const end = performance.now()
  const total = end - start
  const renders = iterations * formulas.length
  return { avg: total / renders, total, renders }
}

function recommend({ R, H = 0, B = 50 }) {
  const denom = R * (1 - H) || 1e-6
  const N = B / denom
  return Math.max(1, Math.floor(N))
}

function fmt(n, digits = 2) {
  return Number(n).toFixed(digits)
}

(async () => {
  const katex = await getKatex()

  const s = bench(katex, FORMULAS.simple)
  const m = bench(katex, FORMULAS.medium)
  const c = bench(katex, FORMULAS.complex)

  const rec50 = {
    simple: recommend({ R: s.avg, B: 50 }),
    medium: recommend({ R: m.avg, B: 50 }),
    complex: recommend({ R: c.avg, B: 50 }),
  }
  const rec16 = {
    simple: recommend({ R: s.avg, B: 16.7 }),
    medium: recommend({ R: m.avg, B: 16.7 }),
    complex: recommend({ R: c.avg, B: 16.7 }),
  }

  console.log('\nKaTeX Rendering Benchmark (ms per render)')
  console.table({
    simple: fmt(s.avg),
    medium: fmt(m.avg),
    complex: fmt(c.avg),
  })

  console.log('\nRecommended worker thresholds (N = floor(B / R))')
  console.table({
    'B=50ms (no cache)': rec50,
    'B=16.7ms (no cache)': rec16,
  })

  console.log('\nNotes:')
  console.log('- Thresholds are for first paint (H=0). With cache, N increases roughly by 1/(1-H).')
  console.log('- Use medium thresholds as default. Drop to complex thresholds if many matrices/integrals.')
  console.log('- If your content is very simple, you can raise the threshold accordingly.')
})()
