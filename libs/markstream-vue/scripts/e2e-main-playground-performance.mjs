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

async function findFreePort(start = 4321, end = 4360) {
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
      && visibleMermaids.every(element => element.querySelector('svg'))
      && visibleInfographics.every(element => element.querySelector('svg'))
  }, rootSelector, { timeout: 30000 })
}

async function waitForAllD2Ready(page, timeout = 15000) {
  await page.waitForFunction(() => {
    const d2Blocks = Array.from(document.querySelectorAll('[data-markstream-d2="1"]'))
    return d2Blocks.every(element => element.querySelector('.d2-svg svg'))
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

async function collectMetrics(page) {
  const rootSelector = '.chatbot-messages'
  await page.goto('/', { waitUntil: 'load' })
  await page.locator('.chatbot-container').waitFor({ state: 'visible', timeout: 15000 })
  await waitForVisibleBlocksReady(page, rootSelector)
  await page.waitForTimeout(250)

  const initial = await page.evaluate(() => {
    const state = window.__mainPlaygroundPerf ?? {}
    const longTasks = Array.isArray(state.longTasks) ? state.longTasks : []
    const mermaids = Array.from(document.querySelectorAll('[data-markstream-mermaid="1"]'))
    const infographics = Array.from(document.querySelectorAll('[data-markstream-infographic="1"]'))
    const d2Blocks = Array.from(document.querySelectorAll('[data-markstream-d2="1"]'))
    const root = document.querySelector('.chatbot-messages')
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
    const visibleCodeBlocks = Array.from(document.querySelectorAll('.code-block-container')).filter(isVisible)
    return {
      lcpMs: Number(state.lcpMs ?? 0),
      lcpElement: state.lcpElement ?? null,
      cls: Number(state.cls ?? 0),
      firstPaintMs: Number(state.paints?.paint ?? 0),
      firstContentfulPaintMs: Number(state.paints?.['first-contentful-paint'] ?? 0),
      longTaskCount: longTasks.length,
      longTaskTotalMs: longTasks.reduce((sum, duration) => sum + Number(duration || 0), 0),
      longTaskMaxMs: longTasks.length ? Math.max(...longTasks) : 0,
      settleTimeMs: performance.now() - Number(state.startedAt ?? 0),
      codeBlockCount: document.querySelectorAll('.code-block-container').length,
      fallbackCount: document.querySelectorAll('.code-fallback-plain, .code-pre-fallback').length,
      visibleCodeBlockCount: visibleCodeBlocks.length,
      visibleFallbackCount: visibleCodeBlocks.filter(element => element.querySelector('.code-fallback-plain, .code-pre-fallback')).length,
      mermaidCount: mermaids.length,
      renderedMermaidCount: mermaids.filter(element => element.querySelector('svg')).length,
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
      topLayoutShifts: Array.isArray(state.layoutShifts)
        ? [...state.layoutShifts]
            .sort((a, b) => Number(b?.value || 0) - Number(a?.value || 0))
            .slice(0, 5)
        : [],
    }
  })

  await scrollThroughRoot(page, rootSelector)
  await waitForAllD2Ready(page)
  await page.waitForTimeout(250)

  const fullScroll = await page.evaluate(() => {
    const state = window.__mainPlaygroundPerf ?? {}
    const longTasks = Array.isArray(state.longTasks) ? state.longTasks : []
    const mermaids = Array.from(document.querySelectorAll('[data-markstream-mermaid="1"]'))
    const infographics = Array.from(document.querySelectorAll('[data-markstream-infographic="1"]'))
    const d2Blocks = Array.from(document.querySelectorAll('[data-markstream-d2="1"]'))
    return {
      settleTimeMs: performance.now() - Number(state.startedAt ?? 0),
      codeBlockCount: document.querySelectorAll('.code-block-container').length,
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

  const replayButton = page.locator('button[title="Pause streaming"], button[title="Resume streaming"]')
  await replayButton.waitFor({ state: 'visible', timeout: 5000 })
  if ((await replayButton.getAttribute('title')) === 'Pause streaming') {
    await replayButton.click()
    await page.waitForFunction(() => {
      const button = document.querySelector('button[title="Resume streaming"]')
      return Boolean(button)
    }, null, { timeout: 5000 })
  }
  await page.evaluate(() => {
    const state = window.__mainPlaygroundPerf
    if (state) {
      state.replayStartedAt = performance.now()
      state.replayLongTaskCountBaseline = state.longTasks.length
      state.replayLongTaskTotalBaseline = state.longTasks.reduce((sum, duration) => sum + Number(duration || 0), 0)
    }
  })
  await page.locator('button[title="Resume streaming"]').click()
  await waitForVisibleBlocksReady(page, rootSelector)
  await page.waitForTimeout(250)

  const replay = await page.evaluate(() => {
    const state = window.__mainPlaygroundPerf ?? {}
    const longTasks = Array.isArray(state.longTasks) ? state.longTasks : []
    const totalLongTaskMs = longTasks.reduce((sum, duration) => sum + Number(duration || 0), 0)
    return {
      settleTimeMs: performance.now() - Number(state.replayStartedAt ?? performance.now()),
      longTaskCount: longTasks.length - Number(state.replayLongTaskCountBaseline ?? 0),
      longTaskTotalMs: totalLongTaskMs - Number(state.replayLongTaskTotalBaseline ?? 0),
    }
  })

  return { initial, fullScroll, replay }
}

function assertScenario(result) {
  if (!(result.initial.visibleFallbackCount === 0))
    throw new Error(`Visible code block fallbacks should be gone after initial settle. Got ${result.initial.visibleFallbackCount}.`)
  if (result.initial.visibleRenderedMermaidCount !== result.initial.visibleMermaidCount)
    throw new Error('Visible mermaid blocks should finish in preview mode after initial settle.')
  if (result.initial.visibleRenderedInfographicCount !== result.initial.visibleInfographicCount)
    throw new Error('Visible infographic blocks should finish after initial settle.')
  if (!(result.initial.lcpMs > 0))
    throw new Error('Expected a positive LCP measurement.')
  if (!(result.initial.lcpMs <= 4000))
    throw new Error(`LCP should stay within 4000ms. Got ${result.initial.lcpMs}.`)
  if (!(result.initial.cls <= 0.05))
    throw new Error(`CLS should stay within 0.05. Got ${result.initial.cls}.`)
  if (!(result.initial.longTaskMaxMs <= 500))
    throw new Error(`Max long task should stay within 500ms. Got ${result.initial.longTaskMaxMs}.`)
  if (!(result.initial.longTaskTotalMs <= 1400))
    throw new Error(`Total long task time should stay within 1400ms. Got ${result.initial.longTaskTotalMs}.`)
  if (!(result.initial.settleTimeMs <= 7000))
    throw new Error(`Initial settle should stay within 7000ms. Got ${result.initial.settleTimeMs}.`)
  if (result.fullScroll.fallbackCount !== 0)
    throw new Error('Code block fallbacks should be gone after full scroll settle.')
  if (result.fullScroll.renderedMermaidCount !== result.fullScroll.mermaidCount)
    throw new Error('All mermaid blocks should finish after full scroll settle.')
  if (result.fullScroll.renderedInfographicCount !== result.fullScroll.infographicCount)
    throw new Error('All infographic blocks should finish after full scroll settle.')
  if (result.fullScroll.d2Count > 0 && result.fullScroll.renderedD2Count !== result.fullScroll.d2Count)
    throw new Error('All d2 blocks should finish after full scroll settle.')
  if (!(result.replay.settleTimeMs <= 5000))
    throw new Error(`Replay settle should stay within 5000ms. Got ${result.replay.settleTimeMs}.`)
}

async function run() {
  const port = process.env.PORT ? Number(process.env.PORT) : await findFreePort()
  const server = startDevServer(port)
  let result = null
  const cleanup = () => killProcessTree(server.child)
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)
  process.on('exit', cleanup)

  try {
    await waitForPort(port)
    const browser = await chromium.launch(resolveChromeLaunchOptions())
    const warmupContext = await browser.newContext({
      viewport: { width: 1600, height: 1200 },
      baseURL: `http://${host}:${port}`,
    })
    const warmupPage = await warmupContext.newPage()
    await warmupPage.goto('/', { waitUntil: 'load' })
    await warmupPage.locator('.chatbot-container').waitFor({ state: 'visible', timeout: 15000 })
    await warmupContext.close()
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1200 },
      baseURL: `http://${host}:${port}`,
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
        pauseEnabledSeen: false,
      }

      window.__mainPlaygroundPerf = state

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
    result = await collectMetrics(page)
    assertScenario(result)
    console.log(JSON.stringify(result, null, 2))

    await context.close()
    await browser.close()
  }
  catch (error) {
    console.error('[e2e-main-playground-performance] failed')
    console.error(error)
    if (result)
      console.error(JSON.stringify(result, null, 2))
    console.error(server.getLogs())
    process.exitCode = 1
  }
  finally {
    cleanup()
  }
}

run()
