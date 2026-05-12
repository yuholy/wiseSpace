# Angular 安装

在你的 Angular 20+ 项目中安装 `markstream-angular`。

```bash
pnpm add markstream-angular @angular/core @angular/common
```

## 必需样式

在应用入口中导入一次渲染器样式：

```ts
import 'markstream-angular/index.css'
```

如果启用了数学公式渲染，还需要：

```ts
import 'katex/dist/katex.min.css'
```

## 可选对等依赖

只安装你需要的重功能：

| 功能 | 包 |
| --- | --- |
| Monaco 代码块 | `stream-monaco` |
| Mermaid 图表 | `mermaid` |
| KaTeX 数学公式 | `katex` |
| D2 图表 | `@terrastruct/d2` |
| AntV infographic block | `@antv/infographic` |

一次性安装：

```bash
pnpm add stream-monaco mermaid katex @terrastruct/d2 @antv/infographic
```

## 可选 Worker

`markstream-angular` 也导出了和 React / Vue 集成一致的 Worker 入口：

```ts
import { setKaTeXWorker, setMermaidWorker } from 'markstream-angular'
import KatexWorker from 'markstream-angular/workers/katexRenderer.worker?worker'
import MermaidWorker from 'markstream-angular/workers/mermaidParser.worker?worker'

setKaTeXWorker(new KatexWorker())
setMermaidWorker(new MermaidWorker())
```

## 本地 Playground

在这个 monorepo 里，Angular playground 有这些路由：

- `/` 主 streaming demo
- `/test` 回归实验室
- `/test-sandbox` 独立 framework/version 对照页

本地运行：

```bash
pnpm play:angular
```
