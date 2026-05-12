import { spawn } from 'node:child_process'
import net from 'node:net'
import process from 'node:process'
import { chromium } from 'playwright-core'

const host = '127.0.0.1'
const port = 4230
const playground = '/Users/Simon/Github/markstream-vue/playground'

function isOpen(portNumber) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: portNumber })
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

async function waitForPort(portNumber, timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await isOpen(portNumber))
      return
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error(`timeout waiting for ${portNumber}`)
}

async function captureStaticState(page) {
  await page.waitForSelector('.stream-monaco-diff-root', { timeout: 120000 })
  await page.waitForSelector('.stream-monaco-diff-unchanged-bridge', { timeout: 120000 })

  return page.evaluate(() => {
    function pickStyle(node) {
      if (!(node instanceof HTMLElement))
        return null
      const style = window.getComputedStyle(node)
      return {
        background: style.background,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        color: style.color,
      }
    }

    const bridge = document.querySelector('.stream-monaco-diff-unchanged-bridge')
    const rail = bridge?.querySelector('.stream-monaco-unchanged-rail')
    const summary = bridge?.querySelector('.stream-monaco-unchanged-summary')
    const count = bridge?.querySelector('.stream-monaco-unchanged-count, .stream-monaco-unchanged-metadata-label')
    const reveal = bridge?.querySelector('.stream-monaco-unchanged-reveal')
    const diffOverview = document.querySelector('.monaco-diff-editor .diffOverview')
    const decorationsOverviewRuler = document.querySelector('.decorationsOverviewRuler')
    const firstLineNumber = document.querySelector('.monaco-diff-editor .editor.modified .line-numbers')
    const firstViewLine = document.querySelector('.monaco-diff-editor .editor.modified .view-line')
    const visibleRevealDirections = Array.from(
      bridge?.querySelectorAll('.stream-monaco-unchanged-reveal') ?? [],
    )
      .filter(node => node instanceof HTMLElement && !node.hidden)
      .map(node => node.dataset.direction ?? null)

    return {
      bridge: pickStyle(bridge),
      rail: pickStyle(rail),
      railClasses: rail instanceof HTMLElement ? Array.from(rail.classList) : [],
      summary: pickStyle(summary),
      summaryPadding: summary instanceof HTMLElement
        ? {
            left: window.getComputedStyle(summary).paddingLeft,
            right: window.getComputedStyle(summary).paddingRight,
          }
        : null,
      count: count ? window.getComputedStyle(count).color : null,
      reveal: pickStyle(reveal),
      visibleRevealDirections,
      overview: pickStyle(diffOverview),
      decorationsOverviewRuler: pickStyle(decorationsOverviewRuler),
      overviewMetrics: diffOverview instanceof HTMLElement
        ? {
            width: Math.round(diffOverview.getBoundingClientRect().width),
            display: window.getComputedStyle(diffOverview).display,
          }
        : null,
      decorationsOverviewRulerMetrics: decorationsOverviewRuler instanceof HTMLElement
        ? {
            width: Math.round(decorationsOverviewRuler.getBoundingClientRect().width),
            display: window.getComputedStyle(decorationsOverviewRuler).display,
          }
        : null,
      modifiedColumn: (
        firstLineNumber instanceof HTMLElement
        && firstViewLine instanceof HTMLElement
        && rail instanceof HTMLElement
      )
        ? {
            lineNumberLeft: Math.round(firstLineNumber.getBoundingClientRect().left),
            lineNumberWidth: Math.round(firstLineNumber.getBoundingClientRect().width),
            codeLeft: Math.round(firstViewLine.getBoundingClientRect().left),
            railLeft: Math.round(rail.getBoundingClientRect().left),
            railWidth: Math.round(rail.getBoundingClientRect().width),
          }
        : null,
      text: summary?.textContent?.trim() ?? null,
      rootVars: bridge instanceof HTMLElement
        ? {
            unchangedBg: bridge.style.getPropertyValue('--stream-monaco-unchanged-bg'),
            unchangedFg: bridge.style.getPropertyValue('--stream-monaco-unchanged-fg'),
          }
        : null,
    }
  })
}

async function captureExpandedScrollState(page) {
  await page.click('.stream-monaco-diff-unchanged-bridge .stream-monaco-unchanged-summary')
  await page.waitForTimeout(300)

  await page.evaluate(() => {
    const scrollable = document.querySelector(
      '.monaco-diff-editor .editor.modified .monaco-scrollable-element',
    )
    if (scrollable instanceof HTMLElement)
      scrollable.scrollTop = 220
  })

  await page.waitForTimeout(300)

  return page.evaluate(() => {
    const bridges = Array.from(
      document.querySelectorAll('.stream-monaco-diff-unchanged-bridge'),
    )
      .filter(node => node instanceof HTMLElement)
      .map((node) => {
        const style = window.getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        return {
          hiddenAttr: node.hasAttribute('hidden'),
          ariaHidden: node.getAttribute('aria-hidden'),
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          height: Math.round(rect.height),
          width: Math.round(rect.width),
          text: node.textContent?.trim() ?? '',
        }
      })

    const visibleBridges = bridges.filter(bridge =>
      !bridge.hiddenAttr
      && bridge.ariaHidden !== 'true'
      && bridge.display !== 'none'
      && bridge.visibility !== 'hidden'
      && bridge.opacity !== '0'
      && bridge.height > 0
      && bridge.width > 0,
    )

    const modifiedScrollable = document.querySelector(
      '.monaco-diff-editor .editor.modified .monaco-scrollable-element',
    )

    return {
      bridgeCount: bridges.length,
      visibleBridgeCount: visibleBridges.length,
      visibleBridges,
      modifiedScrollTop:
        modifiedScrollable instanceof HTMLElement ? modifiedScrollable.scrollTop : null,
    }
  })
}

async function captureRevealStepState(page) {
  const parseCount = (text) => {
    const match = text.match(/\d+/)
    return match ? Number.parseInt(match[0], 10) : Number.NaN
  }

  const before = await page.evaluate(() => {
    const bridge = document.querySelector('.stream-monaco-diff-unchanged-bridge:not([hidden])')
    const summary = bridge?.querySelector('.stream-monaco-unchanged-summary')
    const button = bridge?.querySelector('.stream-monaco-unchanged-reveal:not([hidden])')
    return {
      label: summary?.textContent?.trim() ?? null,
      direction: button instanceof HTMLElement ? button.dataset.direction ?? null : null,
    }
  })

  await page.click('.stream-monaco-diff-unchanged-bridge .stream-monaco-unchanged-reveal:not([hidden])')
  await page.waitForTimeout(300)

  const after = await page.evaluate(() => {
    const bridge = document.querySelector('.stream-monaco-diff-unchanged-bridge:not([hidden])')
    const summary = bridge?.querySelector('.stream-monaco-unchanged-summary')
    return {
      label: summary?.textContent?.trim() ?? null,
    }
  })

  const beforeCount = parseCount(before.label ?? '')
  const afterCount = parseCount(after.label ?? '')

  return {
    before,
    after,
    beforeCount,
    afterCount,
    delta:
      Number.isFinite(beforeCount) && Number.isFinite(afterCount)
        ? beforeCount - afterCount
        : null,
  }
}

async function main() {
  const vite = spawn(
    'pnpm',
    ['-C', playground, 'dev', '--host', host, '--port', String(port), '--strictPort'],
    { stdio: ['ignore', 'pipe', 'pipe'], env: process.env },
  )

  let logs = ''
  vite.stdout.on('data', (chunk) => {
    logs += String(chunk)
  })
  vite.stderr.on('data', (chunk) => {
    logs += String(chunk)
  })

  try {
    await waitForPort(port)

    const browser = await chromium.launch({ channel: 'chrome', headless: true })
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })

    await page.addInitScript(() => {
      localStorage.setItem('vmr-test-render-mode', 'monaco')
      localStorage.setItem('vmr-test-code-stream', 'true')
      localStorage.setItem('vmr-test-viewport-priority', 'false')
      localStorage.setItem('vmr-test-batch-rendering', 'false')
      localStorage.setItem('vmr-test-typewriter', 'false')
      localStorage.setItem('vmr-test-show-settings', 'true')
      localStorage.setItem('vmr-test-stream-speed', '4')
      localStorage.setItem('vmr-test-stream-interval', '24')
    })

    console.log('goto')
    page.setDefaultNavigationTimeout(120000)
    await page.goto(`http://${host}:${port}/diff-line-info-regression`, { waitUntil: 'commit', timeout: 120000 })
    await page.waitForSelector('h1', { timeout: 120000 })
    console.log('page-loaded')

    const staticState = await captureStaticState(page)
    console.log('static-captured')
    const revealStepState = await captureRevealStepState(page)
    console.log('reveal-step-captured')
    const expandedScrollState = await captureExpandedScrollState(page)
    console.log('expanded-scroll-captured')

    console.log(JSON.stringify({ staticState, revealStepState, expandedScrollState }, null, 2))

    await browser.close()
  }
  catch (error) {
    console.error(String(error))
    console.error(logs)
    process.exitCode = 1
  }
  finally {
    try {
      vite.kill('SIGTERM')
    }
    catch {}
  }
}

await main()
