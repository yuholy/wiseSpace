import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const enDir = path.join(root, 'docs', 'guide')
const zhDir = path.join(root, 'docs', 'zh', 'guide')

async function main() {
  const files = await fs.readdir(enDir)
  const mdFiles = files.filter(f => f.endsWith('.md'))
  const missing = []
  for (const f of mdFiles) {
    const zhPath = path.join(zhDir, f)
    try {
      await fs.access(zhPath)
    }
    catch {
      missing.push(f)
    }
  }

  if (missing.length) {
    console.error('Missing zh translations for the following docs:')
    missing.forEach(m => console.error(' -', m))
    console.error('\nHint: run `pnpm docs:sync-zh` to create placeholders.')
    process.exit(1)
  }
  else {
    console.log('All docs/guide pages have a corresponding docs/zh/guide placeholder.')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
