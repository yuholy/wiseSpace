import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const fromDir = path.resolve('dist-tw')
const toDir = path.resolve('dist')

const fromCss = path.join(fromDir, 'index.tailwind.css')
const toCss = path.join(toDir, 'index.tailwind.css')
const primaryCss = path.join(toDir, 'index.css')
const fallbackPrimaryCss = path.join(toDir, 'markstream-react.css')

function stripTailwindDirectives(css) {
  return css
    .replace(/@tailwind\s+base\s*;?\s*/g, '')
    .replace(/@tailwind\s+components\s*;?\s*/g, '')
    .replace(/@tailwind\s+utilities\s*;?\s*/g, '')
    .trimStart()
}

async function main() {
  await fs.mkdir(toDir, { recursive: true })

  try {
    await fs.access(primaryCss)
  }
  catch {
    try {
      const css = await fs.readFile(fallbackPrimaryCss, 'utf8')
      await fs.writeFile(primaryCss, css)
    }
    catch (err) {
      const e = err
      throw new Error(`[copy-tailwind-css] Missing ${primaryCss} and ${fallbackPrimaryCss}. Did the main npm build run? (${e?.message || e})`)
    }
  }

  try {
    const css = await fs.readFile(fromCss, 'utf8')
    await fs.writeFile(toCss, stripTailwindDirectives(css))
  }
  catch (err) {
    const e = err
    throw new Error(`[copy-tailwind-css] Missing ${fromCss}. Did the tailwind build run? (${e?.message || e})`)
  }

  await fs.rm(fromDir, { recursive: true, force: true })
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
