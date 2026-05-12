# Legacy 构建与兼容性指南（Vite 与 Webpack）

目的
- 当你遇到旧浏览器（例如低版本 iOS / Safari）导致页面白屏或运行时报错的兼容性问题时，应考虑两类方案：
  1. 在源码层修复（首选，必要时必须做的，比如 RegExp 语法不可能被 polyfill）
  2. 在构建/部署层使用 legacy 构建（为旧浏览器生成降级 bundle + polyfills）

重要提醒（核心）
- 一些问题（例如使用正则 lookbehind `(?<!...)`）是 JS 引擎级语法问题：无法用 polyfill 在旧引擎中“添加”正则语法支持。换言之，legacy 构建能转换语法和注入 API polyfill，但不能把运行时未实现的正则语法自动转换为等价旧写法。遇到这类问题，应在源码层重写或在运行时做特性检测并 fallback（参见 `docs/IOS-regex-compat.md`）。

下面文档提供：
- Vite 的 `@vitejs/plugin-legacy` 用法与 caveats
- Webpack 下实现 modern/legacy 差异化构建的常见模式
- polyfills 管理（`core-js` / `regenerator-runtime` / 浏览器目标）
- 测试与 CI 建议

1) Vite（推荐用于 Vite 项目）

- 安装（项目根）：

```bash
pnpm add -D @vitejs/plugin-legacy
```

- 最简单的配置（vite.config.ts）

```ts
import legacy from '@vitejs/plugin-legacy'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'iOS >= 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      // modern polyfilled bundle + legacy (nomodule) bundle -> differential serving
      renderLegacyChunks: true,
    })
  ]
})
```

- 解释与建议：
  - `targets` 使用浏览器目标来决定哪些语法/transform 需要降级；根据你需要支持的最低版本设置（例如 `iOS >= 11`）。
  - `additionalLegacyPolyfills` 可以把某些运行时库插入 legacy bundle；但大多数 API polyfill（例如 `Promise` / `fetch`）应通过 `core-js` 或手动引入更精细地控制。
  - `renderLegacyChunks: true` 会生成兼容旧浏览器的 chunk（按需 polyfill 注入），并配合 `<script type="module">` / `<script nomodule>` 差异化加载。
  - plugin-legacy 使用 Babel 来转换语法，但**无法**把正则 lookbehind 之类的引擎级语法“改写”为等价旧写法：如果源码里有不支持的正则语法，仍可能在打包时或运行时报错（取决于是否把该正则放到运行时构造）。因此仍要在源码层修复正则语法。

- 使用建议流程：
  1. 尝试用 runtime feature detection（例如 `new RegExp('(?<!a)b')`）判断是否需要改写/延迟构造正则字面量。
  2. 为支持低版本平台保留 legacy 构建（plugin-legacy）以覆盖大多数语法 / API 差异。
  3. 在 QA/CI 上用旧 iOS Safari（或 BrowserStack）验证构建产物。查看是否有 `SyntaxError: Invalid regular expression` 类型错误（若有，说明源码中有不兼容的正则字面量仍需改写）。

2) Webpack（适用于基于 Webpack 的项目）

Webpack 没有像 Vite 那样开箱即用的单一插件来生成 differential bundles，但常见方案是：使用 Babel 对代码做两套构建（modern + legacy），并用 `type="module"` / `nomodule` 或不同 HTML 输出来差异化服务。

- 关键依赖

```bash
pnpm add -D @babel/core babel-loader @babel/preset-env core-js regenerator-runtime webpack webpack-cli
```

- 简单思路（多配置/多构建）
  - 配置 A（modern）：目标现代浏览器（browserslist 可设置），输出 `module` bundle
  - 配置 B（legacy）：目标旧浏览器，开启更激进的 `@babel/preset-env` 转换与 `useBuiltIns: 'usage'`，并注入 `core-js` polyfills

示例 `babel.config.js`（用于 legacy 构建）

```js
module.exports = function (api) {
  const isLegacy = api.env('legacy')
  return {
    presets: [
      [
        '@babel/preset-env',
        {
          targets: isLegacy ? { ie: '11', ios: '10' } : { esmodules: true },
          useBuiltIns: isLegacy ? 'usage' : false,
          corejs: isLegacy ? { version: 3, proposals: false } : undefined,
        },
      ],
    ],
  }
}
```

然后在 package.json 中定义两个构建命令（分别以不同的 NODE_ENV/env 来调用 babel）：

```json
{
  "scripts": {
    "build:modern": "cross-env BABEL_ENV=modern webpack --config webpack.modern.config.js",
    "build:legacy": "cross-env BABEL_ENV=legacy webpack --config webpack.legacy.config.js",
    "build": "pnpm run build:modern && pnpm run build:legacy"
  }
}
```

- HTML 部署时使用 `type="module"` / `nomodule`：

```html
<script type="module" src="/assets/app.modern.js"></script>
<script nomodule src="/assets/app.legacy.js"></script>
```

- 注意事项：
  - 两套构建会增加构建复杂度与 CI 时间；但可以确保对旧浏览器的兼容性控制更粒度。
  - 同样强调：如果源码中包含引擎级不支持的正则字面量（例如 lookbehind），在构建阶段仍可能失败或在旧浏览器上报错 —— 这些必须在源码层修复或用运行时延迟构造。

3) polyfills 管理建议
- 使用 `core-js`（v3）做标准 API polyfill，结合 Babel 的 `useBuiltIns: 'usage'` 自动注入，或手动在入口文件按需 `import 'core-js/stable'`。
- 对于 async/await：`regenerator-runtime/runtime`。
- 注意不要把不必要的 polyfill注入到 modern bundle；使用 differential serving（或 plugin-legacy）确保最小现代 bundle。

4) 正则（RegExp）与引擎级语法的特殊说明
- 正则语法（例如 lookbehind）是 JS 引擎实现的语言特性，无法用 runtime polyfill 修复。解决办法：
  - 在源码中改写为兼容写法（例如把 `(?<!a)b` 改为 `(^|[^a])b` 或使用字符串检查回调），或
  - 把潜在会抛错的正则延迟为运行时构造（`new RegExp(...)`）并在运行时做 feature-detection（参考 `docs/IOS-regex-compat.md`），以避免模块加载解析时报错。

5) 测试与 CI / 预提交检查
- 在 CI 中加入：
  - `pnpm run build`（确保 modern+legacy 构建在 CI 执行无异常）
  - 旧版浏览器 smoke tests（可选）：用 BrowserStack / SauceLabs 在 iOS 16.2 / Safari 等上做速测，或在 Xcode Simulator 上跑关键页面。
  - 静态检测脚本：阻止新提交引入诸如 `(?<!` / `(?<=` 的字面量正则（示例脚本见下）。把脚本加入 `package.json` 并在 CI/预提交钩子里运行。

示例检查脚本（package.json -> scripts）

```json
{
  "scripts": {
    "check:regex-advanced": "rg --hidden --glob '!node_modules' --glob '!dist' -n --glob '**/*.{js,ts,vue,jsx,tsx,mjs,cjs}' '\\(\\?<!|\\(\\?<=|\\(\\?<[^=]|\\\\p\\{' || true"
  }
}
```

6) 快速排错清单（当你看到旧设备白屏或控制台有错误时）
- 打开控制台，查找 `SyntaxError: Invalid regular expression` 或语法错误；如果是 RegExp 报错，优先检查源码是否含 lookbehind 等高级特性。
- 用 `rg '\\(\\?<!|\\(\\?<=|\\\\p\\{'` 在源码中搜索（排除缓存文件与 node_modules）。
- 若查明是正则语法导致：在源码中改写或延迟构造；不要仅依赖 legacy 构建来修复此类问题。
- 若是其它语法/API：确保 legacy 构建或 Babel preset-env 的 targets 包含你需要支持的版本，并把 polyfill 策略设置为 `usage`（或按需引入）。

7) 总结要点（简短）
- legacy 构建（Vite plugin-legacy / Webpack + Babel 两套构建）能解决大量语法与 API 的兼容问题，但不能修复 JS 引擎本身不支持的正则语法（如 lookbehind）。遇到这类问题，必须在源码层改写或使用运行时检测与 fallback。
- 推荐流程：优先源码兼容 -> 在构建中添加 legacy 支持 -> 在 CI/QA 上验证旧设备的真实表现 -> 在项目中加入静态检查以防回归。

附录：参考命令

```bash
# Vite 本地打包 (含 legacy)
pnpm build

# Webpack 两套构建 (示例)
pnpm run build:modern
pnpm run build:legacy

# 静态检查（本地快速跑）
pnpm dlx rg "\\(\\?<!|\\(\\?<=|\\\\p\\{" --glob "**/*.{js,ts,vue,jsx,tsx,mjs,cjs}" -n
```
