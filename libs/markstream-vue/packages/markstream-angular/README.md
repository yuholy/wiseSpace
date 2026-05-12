# markstream-angular

Angular version of Markstream: a streaming-friendly Markdown renderer with KaTeX, Mermaid, Monaco code blocks, D2, infographic blocks, custom HTML tags, and cross-framework playground parity.

## Install

```bash
pnpm add markstream-angular @angular/core @angular/common
```

Optional peer dependencies:

- `stream-monaco` for Monaco-powered code blocks
- `mermaid` for Mermaid diagrams
- `katex` for math rendering
- `@terrastruct/d2` for D2 diagrams
- `@antv/infographic` for infographic blocks

Example:

```bash
pnpm add stream-monaco mermaid katex @terrastruct/d2 @antv/infographic
```

## Quick Start

Import the stylesheet once in your Angular app entry:

```ts
import 'markstream-angular/index.css'
import 'katex/dist/katex.min.css'
```

Use the standalone component directly:

```ts
import { Component, signal } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { MarkstreamAngularComponent } from 'markstream-angular'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MarkstreamAngularComponent],
  template: `
    <markstream-angular
      [content]="markdown()"
      [final]="true"
      [codeBlockStream]="true"
    />
  `,
})
class AppComponent {
  readonly markdown = signal(`# Hello Angular

- streaming markdown
- code blocks
- Mermaid / KaTeX / D2`)
}

bootstrapApplication(AppComponent)
```

## TypeScript

`markstream-angular` exports the same public props/context helpers you use at runtime:

```ts
import type {
  AngularRenderContext,
  CodeBlockMonacoOptions,
  CustomComponentMap,
  MarkstreamAngularComponentProps,
  NodeRendererProps,
} from 'markstream-angular'
```

## Workers

KaTeX and Mermaid can use the same off-thread worker path as the React/Vue packages:

```ts
import { setKaTeXWorker, setMermaidWorker } from 'markstream-angular'
import KatexWorker from 'markstream-angular/workers/katexRenderer.worker?worker'
import MermaidWorker from 'markstream-angular/workers/mermaidParser.worker?worker'

setKaTeXWorker(new KatexWorker())
setMermaidWorker(new MermaidWorker())
```

## Playground

In this monorepo:

- Angular playground: `pnpm play:angular`
- Angular regression lab: `http://127.0.0.1:4175/test`
- Angular version sandbox: `http://127.0.0.1:4175/test-sandbox`

## Status

This package is still tagged `alpha`, but the current direction is already aligned with `markstream-react` / `markstream-vue2` for:

- node-component renderer structure
- streaming code block behavior
- shared `/test` fixtures and cross-framework comparison
- KaTeX / Mermaid worker integration

Issue tracker and source: [Simon-He95/markstream-vue](https://github.com/Simon-He95/markstream-vue)
