# Monorepo 迁移（重定向）

该页面已迁移到中文指南目录：

- 新页面：`/zh/guide/monorepo-migration`

如果你的链接仍指向 `/zh/monorepo-migration`，页面将自动跳转。

<script>
  if (typeof window !== 'undefined') {
    window.location.replace('/zh/guide/monorepo-migration')
  }
</script>

<noscript>
  页面已迁移：请访问 <a href="/zh/guide/monorepo-migration">中文指南 – Monorepo 迁移</a>
</noscript>
# Monorepo 迁移指南

## 概览

为了解耦解析器与渲染器，项目将解析器抽离为独立包 `stream-markdown-parser`，以便跨框架复用和更灵活的打包策略。

## 包结构

```
markstream-vue/
├── packages/
│   └── markdown-parser/          # stream-markdown-parser
│       ├── src/
│       │   ├── index.ts          # 入口
│       │   ├── config.ts         # KaTeX 配置等
│       │   ├── types.ts
│       │   ├── parser/
│       │   └── plugins/
├── src/                          # 主 Vue 包
└── playground/
```

## 变更概览

### 1. 新增包：`stream-markdown-parser`

- 纯 JS/TS，无 Vue 依赖
- 框架无关，可用于任意 JavaScript 项目
- 单个入口导出常用函数：`getMarkdown`、`parseMarkdownToStructure` 等

### 2. 对主包的影响

`markstream-vue` 仍作为主要交付包，但现在依赖 `stream-markdown-parser`：

```json
{
  "dependencies": {
    "stream-markdown-parser": "workspace:*"
  }
}
```

### 3. 导入变更

对内部开发者：

- 旧：
```ts
import { getMarkdown } from './utils/markdown'
```

- 新：
```ts
import { getMarkdown } from 'stream-markdown-parser'
```

对外部用户：API 保持一致——更改主要是内部实现与包结构。

## 构建与测试

- 构建解析器包：

```bash
cd packages/markdown-parser
pnpm build
```

- 构建主包：

```bash
cd ../..
pnpm build
```

- 运行测试：

```bash
pnpm test
```

## 好处

- 更好的可复用性与更小的 bundle
- 清晰的边界与独立的版本策略
- 更便于单元测试与 CI 的维护

## 迁移建议

- 在代码中把 `import` 指向新的 `stream-markdown-parser`。
- 为 parser 提供单独的测试文件与基线，以便快速发现破坏性更改。
- 将 parser 的发行流程独立于主包。
