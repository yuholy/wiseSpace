# Angular 快速开始

在 Angular standalone 应用里快速跑起 `markstream-angular`。

## 基础示例

```ts
import { Component, signal } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import { MarkstreamAngularComponent } from 'markstream-angular'
import 'markstream-angular/index.css'
import 'katex/dist/katex.min.css'

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

这是 **markstream-angular**。

\`\`\`ts
export function greet(name: string) {
  return \`hello \${name}\`
}
\`\`\`

\`\`\`mermaid
flowchart LR
  输入 --> 解析 --> 渲染
\`\`\`

$E = mc^2$
`)
}

bootstrapApplication(AppComponent)
```

## 流式输出示例

```ts
import { Component, signal } from '@angular/core'
import { MarkstreamAngularComponent } from 'markstream-angular'

@Component({
  selector: 'app-streaming-demo',
  standalone: true,
  imports: [MarkstreamAngularComponent],
  template: `
    <markstream-angular
      [content]="content()"
      [final]="done()"
      [codeBlockStream]="true"
      [batchRendering]="true"
      [typewriter]="true"
    />
  `,
})
export class StreamingDemoComponent {
  readonly content = signal('# Partial output')
  readonly done = signal(false)
}
```

## TypeScript Props

```ts
import type { CodeBlockMonacoOptions, NodeRendererProps } from 'markstream-angular'

const monacoOptions: CodeBlockMonacoOptions = {
  fontSize: 13,
  wordWrap: 'on',
}

const props: NodeRendererProps = {
  content: '# Angular',
  codeBlockMonacoOptions: monacoOptions,
  final: true,
}
```

## 自定义标签

Angular 版也支持 playground 里 `thinking` 这类 custom HTML tag 流程：

```html
<markstream-angular
  [content]="markdown()"
  [customHtmlTags]="['thinking']"
  [customComponents]="customComponents"
/>
```

## 下一步

- [Angular 安装](/zh/guide/angular-installation)
- [指南首页](/zh/guide/)
- [Playground 指南](/zh/guide/playground)
