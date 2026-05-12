# KaTeX Worker 性能（重定向）

该页面已迁移到中文指南目录：

- 新页面：`/zh/guide/katex-worker-performance-analysis`

如果你的链接仍指向 `/zh/katex-worker-performance-analysis`，页面将自动跳转。

<script>
  if (typeof window !== 'undefined') {
    window.location.replace('/zh/guide/katex-worker-performance-analysis')
  }
</script>

<noscript>
  页面已迁移：请访问 <a href="/zh/guide/katex-worker-performance-analysis">中文指南 – KaTeX Worker 性能</a>
</noscript>
# KaTeX Worker 性能分析指南（中文）

## 问题：Worker 是否比直接渲染更合适？

本文档帮助你判断在何种场景下使用 Web Worker 会带来性能优势。

## 快速结论

**是的，Worker + Cache 架构在大多数真实场景中有显著优势。**

关键原因：
1. Cache 能消除大部分重复渲染开销（缓存命中率通常 >70%）
2. Worker 能阻止主线程被阻塞，从而保证 UI 响应
3. 内存占用极小（举例：200 个公式大约 10–50KB）

## 简要对比（场景）

- 场景：单个简单公式
  - 直接渲染：约 2–5ms
  - Worker：约 3–7ms（含通信开销）
  - 结论：Worker 略慢，但差异可以忽略

- 场景：单个复杂公式
  - 直接渲染：约 20–50ms（阻塞主线程）
  - Worker：约 22–52ms（不阻塞）
  - 结论：Worker 明显改善用户体验

- 场景：重复公式多（带缓存）
  - 直接渲染：5ms × 10 次 = 50ms
  - Worker + Cache：5ms + 0.01ms × 9 次 ≈ 5.09ms
  - 结论：Worker 快约 10 倍

- 真实文档（混合场景）
  - 50 个公式，其中 35 个重复
  - 无缓存：250ms（全部渲染）
  - 有缓存：75ms（仅渲染 15 个）
  - 缓存命中率：70%
  - 性能提升：3.3×

## 如何运行基准测试

1. 安装依赖

```bash
pnpm install
```

2. 运行 KaTeX Worker 对比测试

```bash
pnpm test test/benchmark/katex-worker-vs-direct.test.ts
```

3. 查看更详细报告

```bash
pnpm test test/benchmark/katex-worker-vs-direct.test.ts -- --reporter=verbose
```

## 如何判断是否应该启用 Worker

当一次渲染的“唯一公式数”大于阈值 N 时，使用 Worker 更安全。经验公式：

N ≈ floor(B / (R × (1 - H)))
- B：主线程预算（ms），常用 50ms（卡顿阈值）或 16.7ms（单帧预算）
- R：单个“唯一公式”的平均渲染耗时（ms）
- H：缓存命中率（0..1）

仓库中提供了一个测量脚本：

```bash
node scripts/measure-katex-threshold.mjs
```

此外，`markstream-vue` 提供了辅助函数可推荐阈值：

```ts
import { recommendNForSamples, recommendWorkerThreshold } from 'markstream-vue/utils/katex-threshold'
```

## 浏览器中实时监控性能

可以在应用中启用性能监控：

```ts
import { enablePerfMonitoring, getPerfReport } from 'markstream-vue/utils/performance-monitor'

enablePerfMonitoring()
setTimeout(() => {
  console.log(getPerfReport())
}, 30000)
```

或者在浏览器控制台运行：

```js
window.__katexPerfReport()
window.__katexPerfMonitor.exportMetrics()
```

## 使用 Chrome DevTools 分析

- Performance：录制渲染流程；查看主线程与 Worker 的时间
- Memory：检查 cache 的内存占用
- Performance Monitor：观察 CPU、JS heap、帧率等

## 决策表

推荐使用 Worker 的场景：
- 复杂公式
- 每页多个公式
- 大量重复公式（命中缓存）
- 需要流畅交互（滚动、动画）
- 移动端（CPU 弱）

适合直接渲染的场景：
- 仅简单公式（<5ms）
- SSR 或没有 Worker API 的环境
- 对包体积有严格限制

## 最佳实践

- 使用 Worker + Cache 作为默认策略，并保留主线程 fallback
- 对常见公式做预渲染或预热缓存
- 使用 requestIdleCallback 做非关键渲染
- 根据实际测量调整 `CACHE_MAX` 大小

## 测量示例与结论

- Worker+Cache 在多数混合文档场景下能将渲染时间减少到原来的约 1/3
- 内存开销很小，通常无需担心
- Worker 防止主线程阻塞，提高用户体验

## 参考

- Chrome Performance 文档：https://developer.chrome.com/docs/devtools/performance/
- Web Worker 性能说明：https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers#performance_considerations
- KaTeX 性能提示：https://katex.org/docs/performance.html
