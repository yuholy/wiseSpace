import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const sourceCss = path.resolve('dist/index.css')
const targetCss = path.resolve('dist/index.px.css')
const pxPerRem = 16
const remPattern = /(-?(?:\d+(?:\.\d+)?|\.\d+))rem\b/g

function formatPx(value) {
  if (value === 0)
    return '0'

  const rounded = Math.round(value * 10000) / 10000
  return `${Number.parseFloat(rounded.toFixed(4))}px`
}

async function main() {
  let css = ''
  try {
    css = await fs.readFile(sourceCss, 'utf8')
  }
  catch (err) {
    const e = err
    throw new Error(`[generate-px-css] Missing ${sourceCss}. Did the npm build run? (${e?.message || e})`)
  }

  let replacementCount = 0
  const convertedCss = css.replace(remPattern, (_, remValue) => {
    const rem = Number(remValue)
    if (Number.isNaN(rem))
      return `${remValue}rem`

    replacementCount += 1
    return formatPx(rem * pxPerRem)
  })

  await fs.writeFile(targetCss, convertedCss, 'utf8')
  console.log(`[generate-px-css] Wrote ${targetCss} (${replacementCount} rem values converted using 1rem=${pxPerRem}px)`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
