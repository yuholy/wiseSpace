/**
 * Example: How to monitor KaTeX Worker performance in your application
 *
 * NOTE: This is a reference/example file, not meant to be executed directly.
 * Copy relevant snippets into your application code.
 */

import { createApp } from 'vue'
import { enablePerfMonitoring, getPerfReport, perfMonitor } from '../../src/utils/performance-monitor'

// Example 1: Enable monitoring on app start
// Placeholder root component for example purposes
const YourApp = {} as any
const app = createApp(YourApp)

// Enable performance monitoring in development
const __isDev = typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV
if (__isDev) {
  enablePerfMonitoring()

  // Get report after 30 seconds
  setTimeout(() => {
    const report = getPerfReport()
    console.table(report)
  }, 30000)
}

app.mount('#app')

// Example 2: Conditional monitoring based on query param
const url = new URLSearchParams(window.location.search)
if (url.get('perf') === '1') {
  enablePerfMonitoring()

  // Make report available in console
  ; (window as any).getReport = getPerfReport
  console.log('📊 Performance monitoring enabled. Type getReport() to see stats.')
}

// Example 4: Export data for analysis
function exportPerformanceData() {
  const data = perfMonitor.exportMetrics()

  // Send to analytics service
  fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  // Or download locally
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `katex-perf-${Date.now()}.json`
  a.click()
}

// Example 5: Automated performance regression testing
async function runPerformanceTest() {
  perfMonitor.enable()
  perfMonitor.reset()

  // Render test formulas

  const stats = perfMonitor.getStats()

  // Assertions
  const cacheHitRate = Number.parseFloat(String(stats.cacheHitRate))
  const avgWorkerTime = Number.parseFloat(String(stats.averageWorkerTime))

  if (cacheHitRate < 60) {
    console.warn('⚠️ Cache hit rate below 60%:', cacheHitRate)
  }

  if (avgWorkerTime > 100) {
    console.warn('⚠️ Average worker time too high:', avgWorkerTime)
  }

  console.log('✅ Performance test passed:', stats.recommendation)

  perfMonitor.disable()

  return stats
}

// Example 6: Real-time monitoring dashboard (in DevTools)
function setupRealtimeMonitoring() {
  enablePerfMonitoring()

  // Update stats every 5 seconds
  setInterval(() => {
    const stats = perfMonitor.getStats()
    console.clear()
    console.log('📊 KaTeX Performance (last 5s)')
    console.table({
      'Total Renders': stats.totalRenders,
      'Cache Hit Rate': `${stats.cacheHitRate}%`,
      'Avg Worker Time': `${stats.averageWorkerTime}ms`,
      'Avg Cache Hit': `${stats.averageCacheHitTime}ms`,
      'Time Saved': `${stats.workerSavings}ms`,
    })
    console.log(stats.recommendation)
  }, 5000)
}

// Browser console utilities
if (typeof window !== 'undefined') {
  ; (window as any).__katexPerf = {
    enable: () => enablePerfMonitoring(),
    getReport: () => getPerfReport(),
    export: () => exportPerformanceData(),
    test: () => runPerformanceTest(),
    monitor: () => setupRealtimeMonitoring(),
  }

  console.log(`
📊 KaTeX Performance Monitoring Available!

Commands:
  __katexPerf.enable()      - Enable monitoring
  __katexPerf.getReport()   - Get current report
  __katexPerf.export()      - Export data as JSON
  __katexPerf.test()        - Run performance test
  __katexPerf.monitor()     - Real-time monitoring

Or use:
  window.__katexPerfReport()
  `)
}
