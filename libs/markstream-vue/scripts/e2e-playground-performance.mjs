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
const playgroundDir = path.join(repoRoot, 'playground')
const host = '127.0.0.1'

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
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

async function findFreePort(start = 4250, end = 4290) {
  for (let port = start; port <= end; port++) {
    if (!await isPortOpen(port))
      return port
  }
  throw new Error(`No free port found in ${start}-${end}`)
}

async function waitForPort(port, timeoutMs = 60000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
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
  const logs = []
  const child = spawn(
    'pnpm',
    ['-C', playgroundDir, 'exec', 'vite', '--host', host, '--port', String(port), '--strictPort'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CI: '1',
      },
    },
  )

  child.stdout.on('data', chunk => logs.push(String(chunk)))
  child.stderr.on('data', chunk => logs.push(String(chunk)))

  return {
    child,
    getLogs() {
      return logs.join('')
    },
  }
}

async function waitForVisibleBlocksReady(page, rootSelector) {
  await page.waitForFunction((selector) => {
    const root = document.querySelector(selector)
    if (!root)
      return false
    const rootRect = root.getBoundingClientRect()
    const isVisible = (element) => {
      const rect = element.getBoundingClientRect()
      return rect.bottom > rootRect.top && rect.top < rootRect.bottom
    }
    const visibleCodeBlocks = Array.from(document.querySelectorAll('.code-block-container')).filter(isVisible)
    const visibleMermaids = Array.from(document.querySelectorAll('[data-markstream-mermaid="1"]')).filter(isVisible)
    const visibleInfographics = Array.from(document.querySelectorAll('[data-markstream-infographic="1"]')).filter(isVisible)
    return visibleCodeBlocks.every(element => !element.querySelector('.code-fallback-plain, .code-pre-fallback'))
      && visibleMermaids.every(element => Boolean(element.querySelector('svg')))
      && visibleInfographics.every(element => Boolean(element.querySelector('svg')))
  }, rootSelector, { timeout: 30000 })
}

async function waitForAllD2Ready(page, timeout = 15000) {
  await page.waitForFunction(() => {
    const d2Blocks = Array.from(document.querySelectorAll('[data-markstream-d2="1"]'))
    return d2Blocks.every(element => Boolean(element.querySelector('.d2-svg svg')))
  }, null, { timeout })
}

async function scrollThroughRoot(page, rootSelector) {
  while (true) {
    await waitForVisibleBlocksReady(page, rootSelector)
    const state = await page.evaluate((selector) => {
      const root = document.querySelector(selector)
      if (!root)
        return { done: true }
      root.style.scrollBehavior = 'auto'
      const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight)
      const step = Math.max(320, Math.round(root.clientHeight * 0.85))
      const nextScrollTop = Math.min(maxScrollTop, root.scrollTop + step)
      const done = nextScrollTop <= root.scrollTop + 1
      if (!done)
        root.scrollTop = nextScrollTop
      return { done }
    }, rootSelector)
    if (state.done)
      break
    await page.waitForTimeout(180)
  }
  await waitForVisibleBlocksReady(page, rootSelector)
}

async function runScenario(browser, port, mode) {
  const rootSelector = '.preview-surface'
  const sample = process.env.PLAYGROUND_SAMPLE || 'baseline'
  const warmupContext = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://${host}:${port}`,
          localStorage: [
            { name: 'vmr-test-sample', value: sample },
            { name: 'vmr-test-render-mode', value: mode },
          ],
        },
      ],
    },
  })
  const warmupPage = await warmupContext.newPage()
  await warmupPage.goto(`http://${host}:${port}/test`, { waitUntil: 'load' })
  await warmupPage.locator('.workspace-card--preview').waitFor({ state: 'visible', timeout: 15000 })
  await warmupContext.close()

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1200 },
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://${host}:${port}`,
          localStorage: [
            { name: 'vmr-test-sample', value: sample },
            { name: 'vmr-test-render-mode', value: mode },
          ],
        },
      ],
    },
  })

  await context.addInitScript(() => {
    const state = {
      startedAt: performance.now(),
      cls: 0,
      lcpMs: 0,
      lcpElement: null,
      longTasks: [],
      paints: {},
      layoutShifts: [],
    }

    window.__playgroundPerfState = state

    const describeElement = (element) => {
      if (!element)
        return null
      const tag = element.tagName ? element.tagName.toLowerCase() : 'unknown'
      const id = element.id ? `#${element.id}` : ''
      const className = typeof element.className === 'string'
        ? element.className.trim().split(/\s+/).filter(Boolean).join('.')
        : ''
      return `${tag}${id}${className ? `.${className}` : ''}`
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.startTime > state.lcpMs) {
            state.lcpMs = entry.startTime
            state.lcpElement = describeElement(entry.element)
          }
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true })
    }
    catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            state.cls += entry.value
            state.layoutShifts.push({
              value: entry.value,
              sources: Array.isArray(entry.sources)
                ? entry.sources
                    .map(source => describeElement(source?.node))
                    .filter(Boolean)
                    .slice(0, 4)
                : [],
            })
          }
        }
      }).observe({ type: 'layout-shift', buffered: true })
    }
    catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          state.longTasks.push(entry.duration)
      }).observe({ type: 'longtask', buffered: true })
    }
    catch {}

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          state.paints[entry.name] = entry.startTime
      }).observe({ type: 'paint', buffered: true })
    }
    catch {}
  })

  const page = await context.newPage()
  await page.goto(`http://${host}:${port}/test`, { waitUntil: 'load' })

  await page.locator('.workspace-card--preview').waitFor({ state: 'visible', timeout: 15000 })
  await waitForVisibleBlocksReady(page, rootSelector)
  await page.waitForTimeout(200)

  const result = await page.evaluate(() => {
    const state = window.__playgroundPerfState ?? {}
    const longTasks = Array.isArray(state.longTasks) ? state.longTasks : []
    const mermaids = Array.from(document.querySelectorAll('[data-markstream-mermaid="1"]'))
    const infographics = Array.from(document.querySelectorAll('[data-markstream-infographic="1"]'))
    const d2Blocks = Array.from(document.querySelectorAll('[data-markstream-d2="1"]'))
    const root = document.querySelector('.preview-surface')
    const rootRect = root?.getBoundingClientRect()
    const isVisible = (element) => {
      if (!rootRect)
        return false
      const rect = element.getBoundingClientRect()
      return rect.bottom > rootRect.top && rect.top < rootRect.bottom
    }
    const visibleMermaids = mermaids.filter(isVisible)
    const visibleInfographics = infographics.filter(isVisible)
    const visibleD2Blocks = d2Blocks.filter(isVisible)
    const allCodeBlocks = Array.from(document.querySelectorAll('.code-block-container'))
    const visibleCodeBlocks = allCodeBlocks.filter(isVisible)
    const diffCodeBlocks = allCodeBlocks.filter(element =>
      element.classList.contains('is-diff') || Boolean(element.querySelector('.monaco-diff-editor')),
    )
    const visibleDiffCodeBlocks = diffCodeBlocks.filter(isVisible)
    const renderedMermaidCount = mermaids.filter(element => element.querySelector('svg')).length
    return {
      sample: localStorage.getItem('vmr-test-sample') ?? 'unknown',
      mode: localStorage.getItem('vmr-test-render-mode') ?? 'unknown',
      lcpMs: Number(state.lcpMs ?? 0),
      lcpElement: state.lcpElement ?? null,
      cls: Number(state.cls ?? 0),
      firstPaintMs: Number(state.paints?.paint ?? 0),
      firstContentfulPaintMs: Number(state.paints?.['first-contentful-paint'] ?? 0),
      longTaskCount: longTasks.length,
      longTaskTotalMs: longTasks.reduce((sum, duration) => sum + Number(duration || 0), 0),
      longTaskMaxMs: longTasks.length ? Math.max(...longTasks) : 0,
      settleTimeMs: performance.now() - Number(state.startedAt ?? 0),
      codeBlockCount: allCodeBlocks.length,
      diffCodeBlockCount: diffCodeBlocks.length,
      fallbackCount: document.querySelectorAll('.code-fallback-plain, .code-pre-fallback').length,
      visibleCodeBlockCount: visibleCodeBlocks.length,
      visibleFallbackCount: visibleCodeBlocks.filter(element => element.querySelector('.code-fallback-plain, .code-pre-fallback')).length,
      visibleDiffCodeBlockCount: visibleDiffCodeBlocks.length,
      visibleDiffFallbackCount: visibleDiffCodeBlocks.filter(element => element.querySelector('.code-fallback-plain, .code-pre-fallback')).length,
      mermaidCount: mermaids.length,
      renderedMermaidCount,
      visibleMermaidCount: visibleMermaids.length,
      visibleRenderedMermaidCount: visibleMermaids.filter(element => element.querySelector('svg')).length,
      infographicCount: infographics.length,
      renderedInfographicCount: infographics.filter(element => element.querySelector('svg')).length,
      visibleInfographicCount: visibleInfographics.length,
      visibleRenderedInfographicCount: visibleInfographics.filter(element => element.querySelector('svg')).length,
      d2Count: d2Blocks.length,
      renderedD2Count: d2Blocks.filter(element => element.querySelector('.d2-svg svg')).length,
      visibleD2Count: visibleD2Blocks.length,
      visibleRenderedD2Count: visibleD2Blocks.filter(element => element.querySelector('.d2-svg svg')).length,
      sandboxFrameMounted: Boolean(document.querySelector('.sandbox-frame')),
      topLayoutShifts: Array.isArray(state.layoutShifts)
        ? [...state.layoutShifts]
            .sort((a, b) => Number(b?.value || 0) - Number(a?.value || 0))
            .slice(0, 5)
        : [],
    }
  })

  await scrollThroughRoot(page, rootSelector)
  await waitForAllD2Ready(page)
  await page.waitForTimeout(200)

  result.fullScroll = await page.evaluate(() => {
    const state = window.__playgroundPerfState ?? {}
    const longTasks = Array.isArray(state.longTasks) ? state.longTasks : []
    const mermaids = Array.from(document.querySelectorAll('[data-markstream-mermaid="1"]'))
    const infographics = Array.from(document.querySelectorAll('[data-markstream-infographic="1"]'))
    const d2Blocks = Array.from(document.querySelectorAll('[data-markstream-d2="1"]'))
    return {
      settleTimeMs: performance.now() - Number(state.startedAt ?? 0),
      fallbackCount: document.querySelectorAll('.code-fallback-plain, .code-pre-fallback').length,
      mermaidCount: mermaids.length,
      renderedMermaidCount: mermaids.filter(element => element.querySelector('svg')).length,
      infographicCount: infographics.length,
      renderedInfographicCount: infographics.filter(element => element.querySelector('svg')).length,
      d2Count: d2Blocks.length,
      renderedD2Count: d2Blocks.filter(element => element.querySelector('.d2-svg svg')).length,
      longTaskTotalMs: longTasks.reduce((sum, duration) => sum + Number(duration || 0), 0),
    }
  })

  await context.close()
  return result
}

function assertScenario(result) {
  if (!(result.codeBlockCount > 0))
    throw new Error(`[${result.mode}] Expected at least one rendered code block.`)
  if (result.visibleFallbackCount !== 0)
    throw new Error(`[${result.mode}] Visible code fallback should be gone after initial settle.`)
  if (result.sample === 'diff' && result.mode === 'monaco' && !(result.diffCodeBlockCount > 0))
    throw new Error('[monaco] Diff sample should render at least one Monaco diff block.')
  if (result.sample === 'diff' && result.mode === 'monaco' && result.visibleDiffFallbackCount !== 0)
    throw new Error('[monaco] Visible diff fallback should be gone after initial settle.')
  if (result.visibleRenderedMermaidCount !== result.visibleMermaidCount)
    throw new Error(`[${result.mode}] Visible mermaid blocks should finish in preview mode after initial settle.`)
  if (result.visibleRenderedInfographicCount !== result.visibleInfographicCount)
    throw new Error(`[${result.mode}] Visible infographic blocks should finish after initial settle.`)
  if (!(result.lcpMs > 0 && result.lcpMs <= 5000))
    throw new Error(`[${result.mode}] LCP should stay within 5000ms. Got ${result.lcpMs}.`)
  if (!(result.cls <= 0.05))
    throw new Error(`[${result.mode}] CLS should stay within 0.05. Got ${result.cls}.`)
  if (!(result.settleTimeMs <= 6000))
    throw new Error(`[${result.mode}] Settle time should stay within 6000ms. Got ${result.settleTimeMs}.`)
  if (!(result.longTaskMaxMs <= 700))
    throw new Error(`[${result.mode}] Max long task should stay within 700ms. Got ${result.longTaskMaxMs}.`)
  if (!(result.longTaskTotalMs <= 1800))
    throw new Error(`[${result.mode}] Total long task time should stay within 1800ms. Got ${result.longTaskTotalMs}.`)
  if (result.fullScroll.fallbackCount !== 0)
    throw new Error(`[${result.mode}] Code fallback should be gone after full scroll settle.`)
  if (result.fullScroll.renderedMermaidCount !== result.fullScroll.mermaidCount)
    throw new Error(`[${result.mode}] Mermaid blocks should all finish after full scroll settle.`)
  if (result.fullScroll.renderedInfographicCount !== result.fullScroll.infographicCount)
    throw new Error(`[${result.mode}] Infographic blocks should all finish after full scroll settle.`)
  if (result.fullScroll.renderedD2Count !== result.fullScroll.d2Count)
    throw new Error(`[${result.mode}] D2 blocks should all finish after full scroll settle.`)
}

async function run() {
  const port = process.env.PORT ? Number(process.env.PORT) : await findFreePort()
  const server = startDevServer(port)
  let results = null
  const cleanup = () => killProcessTree(server.child)
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('exit', cleanup)

  try {
    await waitForPort(port)
    const browser = await chromium.launch(resolveChromeLaunchOptions())

    const markdownResult = await runScenario(browser, port, 'markdown')
    const monacoResult = await runScenario(browser, port, 'monaco')
    results = {
      markdown: markdownResult,
      monaco: monacoResult,
    }

    assertScenario(markdownResult)
    assertScenario(monacoResult)

    console.log(JSON.stringify(results, null, 2))

    await browser.close()
  }
  catch (error) {
    console.error('[e2e-playground-performance] failed')
    console.error(error)
    if (results)
      console.error(JSON.stringify(results, null, 2))
    console.error(server.getLogs())
    process.exitCode = 1
  }
  finally {
    cleanup()
  }
}

run()
