# 贡献指南

欢迎贡献！

常用开发命令：

- `pnpm dev` / `pnpm play` — 启动 playground
- `pnpm build` — 构建库
- `pnpm build:analyze` — 生成 bundle 可视化报告
- `pnpm size:check` — 执行包体积预算检查
- `pnpm test` — 运行测试
- `pnpm docs:dev` — 启动文档站点

体积预算环境变量（可选）：

- `MAX_DIST_BYTES`
- `MAX_JS_CHUNK_BYTES`
- `MAX_PACK_TGZ_BYTES`
- `MAX_PACK_UNPACKED_BYTES`

文档贡献：

1. 新页面写入 `docs/` 或 `docs/zh/`
2. 更新 `docs/.vitepress/config.ts` 的侧边栏
3. 运行 `pnpm docs:dev` 预览
4. 提交 PR 并等待审阅
