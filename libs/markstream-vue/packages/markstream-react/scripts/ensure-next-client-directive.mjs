import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const nextEntryPath = path.resolve(__dirname, '../dist/next.js')
const source = readFileSync(nextEntryPath, 'utf8')

if (!source.startsWith('\'use client\';')) {
  writeFileSync(nextEntryPath, `'use client';\n${source}`)
}
