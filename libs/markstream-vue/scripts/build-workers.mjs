#!/usr/bin/env node
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const outdir = path.resolve(__dirname, '../dist/workers')

async function run() {
  try {
    await build({
      entryPoints: [
        path.resolve(__dirname, '../src/workers/katexRenderer.worker.ts'),
        path.resolve(__dirname, '../src/workers/mermaidParser.worker.ts'),
      ],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      outdir,
      sourcemap: false,
      minify: true,
      external: ['mermaid', 'katex'],
      target: ['es2017'],
    })
    console.log('Workers built to', outdir)
  }
  catch (err) {
    console.error('Failed to build workers', err)
    process.exit(1)
  }
}

run()
