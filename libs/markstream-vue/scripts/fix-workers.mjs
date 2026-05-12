#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const dist = path.resolve(root, 'dist')
const assetsDir = path.resolve(dist, 'assets')
const indexFile = path.resolve(dist, 'index.js')

// Remove any hashed worker files that might be left in dist root or dist/assets
function removeHashedWorkers() {
  const candidates = [dist, path.resolve(dist, 'assets')]
  for (const dir of candidates) {
    if (!fs.existsSync(dir))
      continue
    const files = fs.readdirSync(dir)
    for (const f of files) {
      if (/katexRenderer\.worker[-_.].*\.js$/.test(f) || /mermaidParser\.worker[-_.].*\.js$/.test(f)) {
        try {
          fs.unlinkSync(path.resolve(dir, f))
          console.log('Removed hashed worker file:', path.resolve(dir, f))
        }
        catch (e) {
          console.warn('Failed to remove hashed worker file:', f, e)
        }
      }
    }
  }
}

removeHashedWorkers()

// Now flatten remaining assets from dist/assets into dist root (if any)
function flattenAssets() {
  if (!fs.existsSync(assetsDir))
    return
  const files = fs.readdirSync(assetsDir)
  for (const f of files) {
    // skip the worker files we've already handled
    if (/^katexRenderer\\.worker|^mermaidParser\\.worker/.test(f))
      continue
    const src = path.resolve(assetsDir, f)
    const dest = path.resolve(dist, f)
    // avoid overwriting existing file
    if (fs.existsSync(dest)) {
      console.log('Skipping move because destination exists:', dest)
      continue
    }
    fs.renameSync(src, dest)
    console.log('Moved asset', src, '->', dest)
    // patch index.js references from assets/<f> to <f>
    if (fs.existsSync(indexFile)) {
      let content = fs.readFileSync(indexFile, 'utf8')
      const oldRef = `assets/${f}`
      if (content.includes(oldRef)) {
        content = content.split(oldRef).join(f)
        fs.writeFileSync(indexFile, content, 'utf8')
        console.log('Patched index.js reference', oldRef, '->', f)
      }
    }
  }
  // remove assetsDir if empty
  try {
    const remaining = fs.readdirSync(assetsDir)
    if (remaining.length === 0)
      fs.rmdirSync(assetsDir)
  }
  catch {
    // ignore
  }
}

flattenAssets()
