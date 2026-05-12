#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import typescript from '@rollup/plugin-typescript'
import { rollup } from 'rollup'

const root = path.resolve(new URL(import.meta.url).pathname, '..', '..')
const outdir = path.resolve(root, 'dist', 'workers')

async function buildWorker(entry, outName) {
  const bundle = await rollup({
    input: entry,
    external: ['mermaid', 'katex'],
    plugins: [
      typescript({ tsconfig: path.resolve(root, 'tsconfig.json'), sourceMap: false }),
    ],
  })

  await bundle.write({
    dir: outdir,
    format: 'es',
    entryFileNames: outName,
    chunkFileNames: '[name].js',
    sourcemap: false,
  })

  await bundle.close()
}

async function run() {
  try {
    if (!fs.existsSync(outdir))
      fs.mkdirSync(outdir, { recursive: true })

    await buildWorker(path.resolve(root, 'src/workers/katexRenderer.worker.ts'), 'katexRenderer.worker.js')
    await buildWorker(path.resolve(root, 'src/workers/mermaidParser.worker.ts'), 'mermaidParser.worker.js')

    console.log('Workers written to', outdir)
  }
  catch (err) {
    console.error('Failed to build workers with rollup', err)
    process.exit(1)
  }
}

run()
