#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const playgroundDir = path.join(repoRoot, 'playground-nuxt')
const host = '127.0.0.1'

function assert(condition, message) {
  if (!condition)
    throw new Error(message)
}

function isPortOpen(port, listenHost = host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: listenHost, port })
    socket.on('connect', () => {
      socket.end()
      resolve(true)
    })
    socket.on('error', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function findFreePort(start = 4300, end = 4360) {
  for (let port = start; port <= end; port++) {
    if (!await isPortOpen(port))
      return port
  }
  throw new Error(`No free port found in ${start}-${end}`)
}

async function waitForPort(port, timeoutMs = 90000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortOpen(port))
      return
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  throw new Error(`Timed out waiting for ${host}:${port}`)
}

async function waitForHttpReady(url, timeoutMs = 90000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok)
        return
    }
    catch {}
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for HTTP readiness: ${url}`)
}

function killProcessTree(child) {
  if (!child || child.killed)
    return
  try {
    child.kill('SIGTERM')
  }
  catch {}
  setTimeout(() => {
    try {
      if (!child.killed)
        child.kill('SIGKILL')
    }
    catch {}
  }, 3000).unref?.()
}

function resolveChromeLaunchOptions() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return {
        executablePath: candidate,
        headless: true,
      }
    }
  }

  return {
    channel: 'chrome',
    headless: true,
  }
}

function createProcessRunner(command, args, cwd, extraEnv = {}) {
  const logBuffer = []
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      CI: '1',
      NUXT_TELEMETRY_DISABLED: '1',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const appendLogs = (chunk) => {
    const text = String(chunk)
    logBuffer.push(text)
    if (logBuffer.length > 240)
      logBuffer.splice(0, logBuffer.length - 240)
  }

  child.stdout.on('data', appendLogs)
  child.stderr.on('data', appendLogs)

  return {
    child,
    getLogs() {
      return logBuffer.join('')
    },
  }
}

async function runCommand(command, args, cwd, label) {
  const runner = createProcessRunner(command, args, cwd)
  const exitCode = await new Promise((resolve, reject) => {
    runner.child.on('error', reject)
    runner.child.on('exit', resolve)
  })
  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}\n${runner.getLogs()}`)
  }
}

function startNuxtDev(port) {
  return createProcessRunner('pnpm', ['exec', 'nuxt', 'dev', '--host', host, '--port', String(port)], playgroundDir)
}

function startNuxtPreview(port) {
  return createProcessRunner(
    'pnpm',
    ['exec', 'nuxt', 'preview'],
    playgroundDir,
    {
      HOST: host,
      PORT: String(port),
      NITRO_HOST: host,
      NITRO_PORT: String(port),
    },
  )
}

async function assertRawHtml(baseUrl, mode) {
  const response = await fetch(`${baseUrl}/ssr-lab`)
  assert(response.ok, `[${mode}] raw SSR fetch failed with status ${response.status}`)
  const html = await response.text()

  const expectedSnippets = [
    'data-ssr-case="basic"',
    'data-ssr-case="enhanced"',
    'data-ssr-case="fallback"',
    'SSR Basic Coverage',
    'data-ssr-inline-html="1"',
    'data-ssr-html-block="1"',
    'data-markstream-code-block="1"',
    'data-markstream-pre="1"',
    'data-markstream-math="inline"',
    'data-markstream-mode="katex"',
    'data-markstream-mermaid="1"',
    'data-markstream-d2="1"',
    'data-markstream-infographic="1"',
    'data-ssr-fallback="math-inline"',
    'data-ssr-fallback="mermaid"',
  ]

  for (const snippet of expectedSnippets)
    assert(html.includes(snippet), `[${mode}] raw SSR HTML is missing expected snippet: ${snippet}`)
}

function collectUnexpectedIssues(entries) {
  const patterns = [
    /hydration/i,
    /window is not defined/i,
    /referenceerror/i,
    /cannot read properties/i,
    /failed to initialize mermaid renderer/i,
    /failed to render/i,
  ]

  return entries.filter(({ type, text }) => {
    if (type === 'pageerror')
      return String(text || '').trim() !== 'Event'
    if (/Could not create web worker\(s\)\./.test(text))
      return false
    return patterns.some(pattern => pattern.test(text))
  })
}

async function waitForEnhancedWidgets(page) {
  await page.locator('[data-ssr-case="enhanced"]').scrollIntoViewIfNeeded()
  await page.waitForSelector('[data-ssr-case="hydration"][data-ssr-hydrated="true"]', { timeout: 90000 })
  await page.waitForSelector('[data-ssr-case="enhanced"] [data-markstream-code-block="1"][data-markstream-enhanced="true"]', { timeout: 90000 })
  await page.waitForSelector('[data-ssr-case="enhanced"] [data-markstream-math="inline"][data-markstream-mode="katex"] .katex', { timeout: 90000 })
  await page.waitForSelector('[data-ssr-case="enhanced"] [data-markstream-math="block"][data-markstream-mode="katex"] .katex-display', { timeout: 90000 })
  await page.waitForSelector('[data-ssr-case="enhanced"] [data-markstream-mermaid="1"][data-markstream-mode="preview"] ._mermaid svg', { timeout: 90000 })
  await page.waitForSelector('[data-ssr-case="enhanced"] [data-markstream-d2="1"][data-markstream-mode="preview"] svg.markstream-d2-root-svg', { timeout: 90000 })
  await page.waitForSelector('[data-ssr-case="enhanced"] [data-markstream-infographic="1"][data-markstream-mode="preview"] svg', { timeout: 90000 })
  await page.waitForFunction(() => {
    const readyCount = document.querySelector('[data-ssr-status="ready-count"]')?.textContent?.trim()
    return readyCount === '5'
  }, { timeout: 90000 })
}

async function assertFallbackSection(page, mode) {
  const fallbackState = await page.evaluate(() => {
    const section = document.querySelector('[data-ssr-case="fallback"]')
    return {
      mathInline: !!section?.querySelector('[data-ssr-fallback="math-inline"]'),
      mathBlock: !!section?.querySelector('[data-ssr-fallback="math-block"]'),
      mermaid: !!section?.querySelector('[data-ssr-fallback="mermaid"]'),
      d2: !!section?.querySelector('[data-ssr-fallback="d2"]'),
      infographic: !!section?.querySelector('[data-ssr-fallback="infographic"]'),
      previewLeak: !!section?.querySelector('[data-markstream-mode="preview"]'),
    }
  })

  assert(fallbackState.mathInline, `[${mode}] fallback section lost inline math fallback`)
  assert(fallbackState.mathBlock, `[${mode}] fallback section lost block math fallback`)
  assert(fallbackState.mermaid, `[${mode}] fallback section lost mermaid fallback`)
  assert(fallbackState.d2, `[${mode}] fallback section lost d2 fallback`)
  assert(fallbackState.infographic, `[${mode}] fallback section lost infographic fallback`)
  assert(!fallbackState.previewLeak, `[${mode}] fallback section unexpectedly switched to preview mode`)
}

async function assertBrowserBehavior(baseUrl, mode) {
  const browser = await chromium.launch(resolveChromeLaunchOptions())
  const page = await browser.newPage()
  const issues = []

  page.on('console', (msg) => {
    const type = msg.type()
    if (type === 'error' || type === 'warning')
      issues.push({ type, text: msg.text() })
  })
  page.on('pageerror', (error) => {
    issues.push({ type: 'pageerror', text: String(error?.message ?? error) })
  })

  try {
    await page.goto(`${baseUrl}/ssr-lab`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await waitForEnhancedWidgets(page, mode)
    await assertFallbackSection(page, mode)

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 })
    await waitForEnhancedWidgets(page, `${mode} reload`)
    await assertFallbackSection(page, `${mode} reload`)

    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.goto(`${baseUrl}/ssr-lab`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await waitForEnhancedWidgets(page, `${mode} route`)
    await assertFallbackSection(page, `${mode} route`)
  }
  finally {
    await browser.close()
  }

  const unexpectedIssues = collectUnexpectedIssues(issues)
  assert(unexpectedIssues.length === 0, `[${mode}] browser reported unexpected issues:\n${unexpectedIssues.map(issue => `${issue.type}: ${issue.text}`).join('\n')}`)
}

async function runDevMode() {
  const port = await findFreePort(4300, 4330)
  const runner = startNuxtDev(port)
  const baseUrl = `http://${host}:${port}`

  try {
    await waitForPort(port)
    await waitForHttpReady(`${baseUrl}/ssr-lab`)
    await assertRawHtml(baseUrl, 'nuxt dev')
    await assertBrowserBehavior(baseUrl, 'nuxt dev')
  }
  catch (error) {
    throw new Error(`${error.message}\n\nNuxt dev logs:\n${runner.getLogs()}`)
  }
  finally {
    killProcessTree(runner.child)
  }
}

async function runPreviewMode() {
  await runCommand('pnpm', ['exec', 'nuxt', 'build'], playgroundDir, 'Nuxt build')

  const port = await findFreePort(4331, 4360)
  const runner = startNuxtPreview(port)
  const baseUrl = `http://${host}:${port}`

  try {
    await waitForPort(port)
    await waitForHttpReady(`${baseUrl}/ssr-lab`)
    await assertRawHtml(baseUrl, 'nuxt preview')
    await assertBrowserBehavior(baseUrl, 'nuxt preview')
  }
  catch (error) {
    throw new Error(`${error.message}\n\nNuxt preview logs:\n${runner.getLogs()}`)
  }
  finally {
    killProcessTree(runner.child)
  }
}

async function main() {
  await runCommand('pnpm', ['build'], repoRoot, 'Library build')
  await runDevMode()
  await runPreviewMode()
  console.log('Nuxt SSR e2e passed in dev and preview modes.')
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
