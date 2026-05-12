#!/usr/bin/env node

import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const checks = [
  {
    name: 'codeblock-highlight-stability',
    script: path.join(repoRoot, 'scripts/e2e-codeblock-highlight-stability.mjs'),
  },
  {
    name: 'link-tooltip-streaming',
    script: path.join(repoRoot, 'scripts/e2e-link-tooltip-streaming.mjs'),
  },
  {
    name: 'math-streaming-stability',
    script: path.join(repoRoot, 'scripts/e2e-math-streaming-stability.mjs'),
  },
]

function runCheck(check) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const child = spawn(process.execPath, [check.script], {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      const durationMs = Date.now() - startedAt
      if (code === 0) {
        resolve({
          ...check,
          durationMs,
          ok: true,
        })
        return
      }

      reject(new Error(`${check.name} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`))
    })
  })
}

async function main() {
  const results = []

  for (const check of checks) {
    console.log(`\n=== Running ${check.name} ===`)
    const result = await runCheck(check)
    results.push(result)
  }

  console.log('\n=== Vue2 CLI smoke summary ===')
  console.log(JSON.stringify({
    checks: results.map(result => ({
      name: result.name,
      durationMs: result.durationMs,
      ok: result.ok,
    })),
  }, null, 2))
}

main().catch((error) => {
  console.error('\n=== Vue2 CLI smoke failed ===')
  console.error(error)
  process.exit(1)
})
