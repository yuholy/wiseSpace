# 需求分析

> 来源：[Simon-He95/markstream-vue#343](https://github.com/Simon-He95/markstream-vue/issues/343)
> 标签：`enhancement` `help wanted` `pr welcome` `render`

---

## Issue 原文核心要求

**目标**：Make the streaming rendering UI look significantly better, component by component, without losing readability.

### 1. 视觉重设计（对方核心诉求）

> "the visual presentation during streaming still feels rough in places"
> "feel more intentional, attractive, and consistent"

- 重新思考流式内容的视觉设计
- 调整各组件的样式
- 改善层级（hierarchy）、间距（spacing）、节奏（rhythm）
- 整体美感提升

### 2. 流式渲染特有体验

> "Making partially streamed content feel smoother and more pleasant to read"
> "streaming-specific states or transitions that should look better"

- 部分渲染时的过渡效果
- 流式内容逐步呈现的视觉连贯性
- 打字机效果 / 骨架屏 / 渐入动画的打磨

### 3. 逐组件打磨

涉及所有渲染组件：

| 组件 | 需关注 |
|---|---|
| headings | 字号梯度、字重、间距 |
| paragraphs | 行高、段间距 |
| lists | 缩进、标记样式、嵌套 |
| blockquotes | 边框风格、斜体、配色 |
| links | 链接色、hover 效果 |
| inline code / code blocks | 背景、边框、字号、语法高亮主题 |
| tables | 表头、斑马纹、边框、溢出 |
| images | 占位、加载态、错误态 |
| separators | 分割线样式 |

### 4. 对方接受的贡献形式

- design direction proposals（设计方向提案）
- screenshots or mockups（截图或原型）
- style audits（样式审计）
- focused PRs for specific components（逐组件 PR）
- a broader visual refresh（整体视觉刷新）

---

## 我们的工作 vs 需求的映射

| 需求 | 我们的进展 | 状态 |
|---|---|---|
| 样式审计 | `design/tokens.md` + `design/components.md` + `design/themes.md` | ✅ 已完成 |
| 设计方向提案 | `design/architecture.md` token 体系 | ✅ 已完成 |
| 代码块专项设计 | `design/codeblock.md` Shell/Monaco 分离 | ✅ 已完成 |
| token 基础设施落地 | `src/index.css` Layer 1 + Layer 2，25 组件迁移 | ✅ 已完成 |
| 暗色模式修复 | Teleport dark、独立组件 dark | ✅ 已完成 |
| **视觉重设计** | 未开始 | ❌ **核心差距** |
| **流式渲染体验打磨** | 未开始 | ❌ **核心差距** |
| **逐组件视觉优化** | 未开始 | ❌ **核心差距** |
| **截图/对比** | 无 | ❌ 需要产出 |

---

## 下一步工作优先级

### P0 — 对方最想看到的

1. **逐组件视觉重设计** — 在 token 基础上调整每个组件的实际样式值（颜色搭配、间距节奏、圆角阴影、字号层级）
2. **流式渲染过渡效果** — 打字机淡入、骨架屏到内容的过渡、部分渲染时的视觉连贯性
3. **Before/After 截图** — 每个改进需要有视觉对比，这是 PR review 的关键材料

### P1 — 架构收尾

4. CodeBlock Shell/Monaco 分离实施（`design/codeblock.md` 阶段 1-11）
5. 共享 Shell 抽取（三档内置渲染器统一外壳）

### P2 — 长期改进

6. 动画时长体系统一
7. 无障碍（prefers-reduced-motion 全覆盖、focus 环统一）
8. 性能优化（content-visibility 策略审查）
