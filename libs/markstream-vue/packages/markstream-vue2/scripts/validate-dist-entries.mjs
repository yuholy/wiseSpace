import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const distDir = resolve(rootDir, 'dist')
const esmEntry = resolve(distDir, 'index.js')
const cjsEntry = resolve(distDir, 'index.cjs')

function assert(condition, message) {
  if (!condition)
    throw new Error(message)
}

function read(file) {
  return readFileSync(file, 'utf8')
}

assert(existsSync(esmEntry), `[validate-dist] Missing ESM entry: ${esmEntry}`)
assert(existsSync(cjsEntry), `[validate-dist] Missing CJS entry: ${cjsEntry}`)

const esmSource = read(esmEntry)
const cjsSource = read(cjsEntry)

function collectFiles(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const fullPath = resolve(dir, name)
    const stat = statSync(fullPath)
    if (stat.isDirectory())
      collectFiles(fullPath, files)
    else
      files.push(fullPath)
  }
  return files
}

assert(
  !/\bObject\.defineProperty\(exports\b|\bexports\./.test(esmSource),
  '[validate-dist] dist/index.js still contains CommonJS export markers.',
)

await import(pathToFileURL(esmEntry).href)
console.log('[validate-dist] ESM entry loaded successfully.')

const cjsFiles = collectFiles(distDir).filter(file => file.endsWith('.cjs'))
const localRequirePattern = /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g

for (const file of cjsFiles) {
  const source = file === cjsEntry ? cjsSource : read(file)
  assert(
    !/\brequire\(\s*['"]\.{1,2}\/[^'"]+\.js['"]\s*\)/.test(source),
    `[validate-dist] ${file} still requires local .js chunks under a type=module package.`,
  )

  for (const match of source.matchAll(localRequirePattern)) {
    const requiredPath = resolve(dirname(file), match[1])
    assert(
      existsSync(requiredPath),
      `[validate-dist] Missing local CJS dependency ${match[1]} referenced from ${file}.`,
    )
  }
}

console.log('[validate-dist] CJS entries reference only local .cjs dependencies that exist.')
