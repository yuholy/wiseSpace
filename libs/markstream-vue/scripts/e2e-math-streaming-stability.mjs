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
const playgroundDir = path.join(repoRoot, 'playground-vue2-cli')
const host = '127.0.0.1'

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

async function findFreePort(start = 3338, end = 3368) {
  for (let port = start; port <= end; port++) {
    if (!await isPortOpen(port))
      return port
  }
  throw new Error(`No free port found in ${start}-${end}`)
}

async function waitForPort(port, timeout = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await isPortOpen(port))
      return
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error(`Timed out waiting for ${host}:${port}`)
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

function startDevServer(port) {
  const logBuffer = []
  const child = spawn(
    'pnpm',
    ['exec', 'vue-cli-service', 'serve', '--port', String(port), '--host', host],
    {
      cwd: playgroundDir,
      env: {
        ...process.env,
        BROWSER: 'none',
        CI: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )

  const appendLogs = (chunk) => {
    const text = String(chunk)
    logBuffer.push(text)
    if (logBuffer.length > 120)
      logBuffer.splice(0, logBuffer.length - 120)
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

async function readProgress(page) {
  return page.evaluate(() => {
    const metaText = document.querySelector('.meta')?.textContent || ''
    const match = metaText.match(/\((\d+)%\)/)
    return match ? Number(match[1]) : null
  })
}

async function scrollFirstIntoView(page, selector, timeout = 20000) {
  await page.waitForFunction((query) => {
    const el = document.querySelector(query)
    if (!el)
      return false
    el.scrollIntoView({ block: 'center', inline: 'nearest' })
    return true
  }, selector, { timeout })
}

async function waitForRenderedMath(page) {
  await scrollFirstIntoView(page, '.math-block')
  await page.waitForFunction(() => Boolean(document.querySelector('.math-block .katex')), { timeout: 20000 })

  await scrollFirstIntoView(page, '.math-inline-wrapper')
  await page.waitForFunction(() => Boolean(document.querySelector('.math-inline-wrapper .katex')), { timeout: 20000 })
}

async function collectRegression(page) {
  await page.locator('#delay').fill('4')
  await page.locator('#chunk').fill('16')
  await page.getByRole('button', { name: 'Reset' }).click()

  await waitForRenderedMath(page)
  const progressAtMonitorStart = await readProgress(page)

  const seenRenderedBlocks = new Set()
  const seenRenderedInline = new Set()
  const regressedBlocks = new Set()
  const regressedInline = new Set()
  let maxVisibleBlockLoaders = 0
  let maxVisibleInlineLoaders = 0
  const uniqueProgress = new Set(progressAtMonitorStart == null ? [] : [progressAtMonitorStart])

  const start = Date.now()
  while (Date.now() - start < 25000) {
    const snapshot = await page.evaluate(() => {
      const isVisible = (el) => {
        if (!el)
          return false
        const style = window.getComputedStyle(el)
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity || '1') > 0.05
      }

      const blocks = Array.from(document.querySelectorAll('.math-block')).map((block, index) => ({
        index,
        hasKatex: Boolean(block.querySelector('.katex')),
        loadingVisible: isVisible(block.querySelector('.math-loading-overlay')),
        fallbackVisible: isVisible(block.querySelector('.math-block__fallback')),
      }))

      const inline = Array.from(document.querySelectorAll('.math-inline-wrapper')).map((item, index) => ({
        index,
        hasKatex: Boolean(item.querySelector('.katex')),
        loadingVisible: isVisible(item.querySelector('.math-inline__loading')),
        fallbackVisible: isVisible(item.querySelector('.math-inline--fallback')),
      }))

      const metaText = document.querySelector('.meta')?.textContent || ''
      const match = metaText.match(/\((\d+)%\)/)

      return {
        blocks,
        inline,
        progress: match ? Number(match[1]) : null,
      }
    })

    if (snapshot.progress != null)
      uniqueProgress.add(snapshot.progress)

    let visibleBlockLoaders = 0
    for (const block of snapshot.blocks) {
      if (block.hasKatex)
        seenRenderedBlocks.add(block.index)
      if (block.loadingVisible)
        visibleBlockLoaders += 1
      if (seenRenderedBlocks.has(block.index) && (block.loadingVisible || block.fallbackVisible))
        regressedBlocks.add(block.index)
    }
    maxVisibleBlockLoaders = Math.max(maxVisibleBlockLoaders, visibleBlockLoaders)

    let visibleInlineLoaders = 0
    for (const item of snapshot.inline) {
      if (item.hasKatex)
        seenRenderedInline.add(item.index)
      if (item.loadingVisible)
        visibleInlineLoaders += 1
      if (seenRenderedInline.has(item.index) && (item.loadingVisible || item.fallbackVisible))
        regressedInline.add(item.index)
    }
    maxVisibleInlineLoaders = Math.max(maxVisibleInlineLoaders, visibleInlineLoaders)

    if (snapshot.progress === 100)
      break

    await page.waitForTimeout(120)
  }

  const finalProgress = Math.max(...Array.from(uniqueProgress.values()), 0)

  return {
    progressAtMonitorStart,
    finalProgress,
    seenRenderedBlocks: Array.from(seenRenderedBlocks),
    seenRenderedInline: Array.from(seenRenderedInline),
    regressedBlocks: Array.from(regressedBlocks),
    regressedInline: Array.from(regressedInline),
    uniqueProgress: Array.from(uniqueProgress).sort((a, b) => a - b),
    maxVisibleBlockLoaders,
    maxVisibleInlineLoaders,
  }
}

async function main() {
  const port = await findFreePort()
  const server = startDevServer(port)

  try {
    await waitForPort(port)
    const browser = await chromium.launch(resolveChromeLaunchOptions())
    const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } })
    const consoleErrors = []
    const pageErrors = []

    page.on('console', (msg) => {
      if (msg.type() === 'error')
        consoleErrors.push(msg.text())
    })
    page.on('pageerror', error => pageErrors.push(String(error)))

    const url = `http://${host}:${port}/?probe=1`
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#delay', { timeout: 30000 })
    await page.waitForSelector('.meta', { timeout: 30000 })

    const regression = await collectRegression(page)
    const screenshot = '/tmp/vue2-cli-math-streaming-stability.png'
    await page.screenshot({ path: screenshot, fullPage: true })
    await browser.close()

    const result = {
      url,
      ...regression,
      consoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length,
      screenshot,
    }

    console.log(JSON.stringify(result, null, 2))

    if (result.regressedBlocks.length > 0)
      throw new Error(`Math block regressed back to loading/fallback: ${result.regressedBlocks.join(', ')}`)
    if (result.regressedInline.length > 0)
      throw new Error(`Math inline regressed back to loading/fallback: ${result.regressedInline.join(', ')}`)
    if (result.seenRenderedBlocks.length === 0)
      throw new Error('No rendered math block was observed during the run')
    if (result.seenRenderedInline.length === 0)
      throw new Error('No rendered math inline node was observed during the run')
    if (result.finalProgress !== 100)
      throw new Error(`Streaming did not finish while monitoring math nodes (ended at ${result.finalProgress}%)`)
    if (result.consoleErrorCount > 0 || result.pageErrorCount > 0)
      throw new Error(`Unexpected browser errors: console=${result.consoleErrorCount}, page=${result.pageErrorCount}`)
  }
  catch (error) {
    const recentLogs = server.getLogs().trim()
    if (recentLogs) {
      console.error('--- vue-cli recent logs ---')
      console.error(recentLogs)
      console.error('--- end vue-cli recent logs ---')
    }
    throw error
  }
  finally {
    killProcessTree(server.child)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
