# Token 扩展方案（v2）

> 状态：**经外部 review 修正后的版本**。
> 原则：保真优先，不硬归一。"基础刻度 + 语义 token + 组件私有常量"三层。

---

## 背景

当前 token 系统只覆盖了**颜色**和**圆角**。非颜色维度全部硬编码，且存在两类问题：

1. **CSS 硬编码** — 组件 `<style>` 中的固定值（间距、阴影、动画时长），无法通过 CSS 变量覆盖
2. **JS 硬编码** — props 默认值和 JS 中的 `style.transition = 'height 180ms'` 等，CSS 变量完全触达不到

> **关键约束**：JS 侧的硬编码（`360px`、`500px`、`180ms` 等）必须同步改为读取 CSS 变量
> 或 computed 值，否则密度主题只是 CSS 层面的假象，JS 控制的高度/动画不会跟随。

---

## 一、基础刻度（Scale）

只收项目里真实反复出现的值，包括半步值。

```css
.markstream-vue {
  --ms-space-1: 0.25rem;      /* 4px  */
  --ms-space-1_5: 0.375rem;   /* 6px  — ListItemNode pl */
  --ms-space-2: 0.5rem;       /* 8px  */
  --ms-space-2_5: 0.625rem;   /* 10px — header py-2.5 */
  --ms-space-3: 0.75rem;      /* 12px */
  --ms-space-4: 1rem;         /* 16px */
  --ms-space-5: 1.25rem;      /* 20px — ListNode my-5 */
  --ms-space-6: 1.5rem;       /* 24px */
  --ms-space-8: 2rem;         /* 32px */
  --ms-space-12: 3rem;        /* 48px */
}
```

---

## 二、语义 Token — 文档流间距

保留原始值和单位，不做近似归并。

```css
.markstream-vue {

  /* ── 块元素流 ── */
  --ms-flow-paragraph-y: 1.25em;                  /* ParagraphNode margin */
  --ms-flow-list-y: var(--ms-space-5);             /* ListNode my-5 = 1.25rem */
  --ms-flow-list-item-y: var(--ms-space-2);        /* ListItemNode my-2 = 0.5rem */
  --ms-flow-list-indent: calc(13 / 8 * 1em);       /* ListNode pl */
  --ms-flow-list-indent-mobile: calc(14 / 9 * 1em); /* ListNode max-lg:pl */
  --ms-flow-table-y: var(--ms-space-8);            /* TableNode my-8 = 2rem */
  --ms-flow-table-cell: calc(4 / 7 * 1em);         /* TableNode td/th padding */
  --ms-flow-blockquote-y: 1.6em;                   /* BlockquoteNode margin-top/bottom */
  --ms-flow-blockquote-indent: 1em;                /* BlockquoteNode padding-left */
  --ms-flow-admonition-y: var(--ms-space-4);       /* AdmonitionNode margin = 1rem */
  --ms-flow-footnote-y: var(--ms-space-2);         /* FootnoteNode mt-2 mb-2 */
  --ms-flow-hr-y: var(--ms-space-12);              /* ThematicBreakNode my-12 = 3rem */
  --ms-flow-diagram-y: var(--ms-space-4);          /* Mermaid/D2/Infographic my-4 = 1rem */
  --ms-flow-codeblock-y: var(--ms-space-4);        /* CodeBlockNode my-4 = 1rem */
  --ms-flow-definition-term-mt: var(--ms-space-2); /* DefinitionListNode term margin-top */
  --ms-flow-definition-desc-ml: var(--ms-space-4); /* DefinitionListNode desc margin-left */
  --ms-flow-definition-desc-mb: var(--ms-space-2); /* DefinitionListNode desc margin-bottom */

  /* ── 标题节奏（每级独立，保留原始 calc）── */
  --ms-flow-heading-1-mt: 0;
  --ms-flow-heading-1-mb: calc(8 / 9 * 1em);
  --ms-flow-heading-2-mt: var(--ms-space-8);
  --ms-flow-heading-2-mb: var(--ms-space-4);
  --ms-flow-heading-3-mt: calc(8 / 5 * 1em);
  --ms-flow-heading-3-mb: calc(3 / 5 * 1em);
  --ms-flow-heading-4-mt: var(--ms-space-6);
  --ms-flow-heading-4-mb: var(--ms-space-2);
  --ms-flow-heading-5-mt: 0;
  --ms-flow-heading-5-mb: 0;
  --ms-flow-heading-6-mt: 0;
  --ms-flow-heading-6-mb: 0;
}
```

---

## 三、语义 Token — 容器内边距与布局间隙

```css
.markstream-vue {

  /* ── 面板内边距 ── */
  --ms-inset-panel-x: var(--ms-space-4);           /* code/mermaid/d2/infographic header px-4 */
  --ms-inset-panel-y: var(--ms-space-2_5);         /* header py-2.5 = 0.625rem */
  --ms-inset-panel-body-sm: var(--ms-space-2);     /* admonition header padding = 0.5rem */
  --ms-inset-panel-body: var(--ms-space-4);        /* admonition content padding-x = 1rem */
  --ms-inset-admonition-body-top: var(--ms-space-2);   /* admonition content padding-top = 0.5rem */
  --ms-inset-admonition-body-bottom: var(--ms-space-4); /* admonition content padding-bottom = 1rem */

  /* ── 布局间隙 ── */
  --ms-gap-header: var(--ms-space-4);              /* code header gap = 16px */
  --ms-gap-header-main: var(--ms-space-2_5);       /* header main section gap = 10px */
  --ms-gap-header-actions: var(--ms-space-2);      /* header actions gap = 8px */
  --ms-gap-toggle: var(--ms-space-1);              /* mode toggle内gap = 4px */
  --ms-gap-skeleton: var(--ms-space-3);            /* skeleton line gap */
}
```

---

## 四、阴影 Token

按语义角色命名，不按 Tailwind 尺寸名。避免值混淆。

```css
.markstream-vue {
  /* subtle: 卡片/容器的轻微立体感 */
  --ms-shadow-subtle: 0 1px 2px 0 hsl(var(--ms-foreground) / 0.05);

  /* popover: tooltip / 下拉 / 浮层 */
  --ms-shadow-popover: 0 4px 6px -1px hsl(var(--ms-foreground) / 0.1),
                       0 2px 4px -2px hsl(var(--ms-foreground) / 0.1);

  /* modal: 全屏弹窗 / dialog */
  --ms-shadow-modal: 0 10px 15px -3px hsl(var(--ms-foreground) / 0.1),
                     0 4px 6px -4px hsl(var(--ms-foreground) / 0.1);

  /* preview: HtmlPreviewFrame 专用，独立不混 */
  --ms-shadow-preview: 0 10px 40px hsl(var(--ms-foreground) / 0.25);
}
```

### 映射

| 当前值 | 出现位置 | 映射到 |
|---|---|---|
| Tailwind `shadow-sm` | CodeBlock, D2, Infographic, MarkdownCodeBlock | `--ms-shadow-subtle` |
| Tailwind `shadow-md` | Tooltip | `--ms-shadow-popover` |
| Tailwind `shadow-lg` | Mermaid modal, Infographic modal | `--ms-shadow-modal` |
| `0 1px 2px 0 hsl(...)` | Mermaid/Infographic action bar | `--ms-shadow-subtle` |
| `0 10px 40px hsl(...)` | HtmlPreviewFrame | `--ms-shadow-preview` |
| Diff 专用阴影 | CodeBlockNode `.is-dark` 块 | 保留组件内（Monaco 区域） |

---

## 五、动画 Token

保留 5 档时长 + `linear` 纳入缓动表。

```css
.markstream-vue {
  /* ── 时长：5 档，不混并 ── */
  --ms-duration-fast: 120ms;         /* tooltip fade */
  --ms-duration-standard: 180ms;     /* 高度过渡、表格淡入、代码块折叠 */
  --ms-duration-overlay: 200ms;      /* dialog enter/leave、MathBlock 渲染 */
  --ms-duration-emphasis: 220ms;     /* ImageNode 切换、Tooltip 位移 */
  --ms-duration-slow: 300ms;         /* MathBlock 切换 */
  --ms-duration-stream: 900ms;       /* 流式打字机淡入 */

  /* ── 缓动 ── */
  --ms-ease-linear: linear;
  --ms-ease-standard: ease;
  --ms-ease-out: ease-out;
  --ms-ease-in-out: ease-in-out;     /* LinkNode 脉冲 */
  --ms-ease-spring: cubic-bezier(.16, 1, .3, 1);  /* Tooltip 位移 */
}
```

### 映射

| 当前值 | 出现位置 | 映射到 |
|---|---|---|
| `120ms` | Tooltip enter/leave | `--ms-duration-fast` |
| `150ms` | Mermaid 容器高度 | `--ms-duration-fast`（最近档，或保留组件私有） |
| `180ms` | CodeBlock 高度、TableNode 淡入 | `--ms-duration-standard` |
| `200ms` | Mermaid/Infographic dialog、MathBlock 渲染 | `--ms-duration-overlay` |
| `220ms` | ImageNode 切换、Tooltip 位移 | `--ms-duration-emphasis` |
| `300ms` / `0.3s` | MathBlock 切换 | `--ms-duration-slow` |
| `900ms` | InlineCodeNode 流式淡入 | `--ms-duration-stream` |
| `1.2s` | Shimmer 动画 | 不 token 化（shimmer 专用） |
| `1.6s` | LinkNode 脉冲 | 不 token 化（脉冲专用） |
| `ease` | 多处 | `--ms-ease-standard` |
| `ease-out` | Mermaid 容器、打字机 | `--ms-ease-out` |
| `linear` | Spinner 旋转、Tooltip fade | `--ms-ease-linear` |
| `ease-in-out` | LinkNode 脉冲 | `--ms-ease-in-out` |
| `cubic-bezier(.16,1,.3,1)` | Tooltip 位移 | `--ms-ease-spring` |

---

## 六、边框与焦点 Token

```css
.markstream-vue {
  --ms-border-width: 1px;              /* 标准边框 */
  --ms-border-width-strong: 4px;       /* 强调左边框（admonition、blockquote、vmr-container） */
  --ms-focus-ring-width: 2px;          /* focus outline 宽度 */
  --ms-focus-ring-offset: 2px;         /* focus outline offset */
}
```

### 映射

| 当前值 | 出现位置 | 映射到 |
|---|---|---|
| `1px solid` | InlineCodeNode, 多处 `border` | `--ms-border-width` |
| `border-left: 4px solid` | AdmonitionNode | `--ms-border-width-strong` |
| `border-left: 0.25rem solid` | BlockquoteNode (= 4px) | `--ms-border-width-strong` |
| `border-left-width: 4px` | VmrContainerNode | `--ms-border-width-strong` |
| `outline: 2px solid` | AdmonitionNode toggle focus | `--ms-focus-ring-width` |
| `outline-offset: 2px` | AdmonitionNode toggle focus | `--ms-focus-ring-offset` |
| `border: 2px solid` | Spinner (MathBlock, Table, Image) | 不 token 化（spinner 专用） |

---

## 七、容器尺寸 Token

```css
.markstream-vue {
  --ms-size-diagram-min-height: 360px;   /* Mermaid / Infographic 最小高度 */
  --ms-size-code-max-height: 500px;      /* 代码块折叠最大高度 */
  --ms-size-image-max-width: 24rem;      /* 图片最大宽度 */
  --ms-size-math-min-height: 40px;       /* MathBlock 最小高度 */
  --ms-size-skeleton-min-height: 120px;  /* 骨架屏占位最小高度 */
}
```

### JS 硬编码问题

以下值**同时存在于 CSS 和 JS 中**，只改 CSS token 不够，JS 也必须同步：

| 值 | CSS 位置 | JS 位置 | 解决方案 |
|---|---|---|---|
| `360px` | `min-h-[360px]` | MermaidBlockNode props default、`contain-intrinsic-size` | JS 读取 `getComputedStyle` 或改为 CSS-only 控制 |
| `500px` | `max-height` | MarkdownCodeBlock/CodeBlock 折叠逻辑 | 同上 |
| `180ms` | `transition: height 180ms` | MermaidBlockNode `el.style.transition = 'height 180ms'` | JS 读取 `var(--ms-duration-standard)` |
| `120px` | skeleton 高度 | CodeBlockNode loading 占位 | 改用 CSS var |

---

## 八、不 token 化的项

| 项 | 原因 |
|---|---|
| 标题 calc 表达式（`calc(8/9*1em)` 等） | 已作为 `--ms-flow-heading-*` token 的值保留原始表达式 |
| z-index (`z-50`, `z-[9999]`) | 内部层叠实现，对外无意义 |
| icon 尺寸 (`w-4 h-4`, `w-3 h-3`) | 过于细碎，改了破坏对齐 |
| Spinner border-width (`2px`) | 极少定制需求 |
| Shimmer 时长 (`1.2s`) / 脉冲时长 (`1.6s`) | 单一用途，不值得抽象 |
| viewport 相对值 (`70vh`, `80vw`) | 运行时响应式，不适合固定 token |
| Tooltip offset (`8px`) / shift padding (`8px`) | Floating-UI 配置，非视觉 token |

---

## 九、密度主题示例

```css
/* 舒适模式（默认） */
.markstream-vue {
  /* 使用上述所有默认值 */
}

/* 紧凑模式 */
.markstream-vue.compact {
  --ms-flow-paragraph-y: 1em;
  --ms-flow-list-y: var(--ms-space-4);
  --ms-flow-list-item-y: var(--ms-space-1_5);
  --ms-flow-table-y: var(--ms-space-6);
  --ms-flow-admonition-y: 0.75rem;

  --ms-flow-heading-2-mt: var(--ms-space-6);
  --ms-flow-heading-2-mb: 0.75rem;
  --ms-flow-heading-4-mt: var(--ms-space-4);
  --ms-flow-heading-4-mb: 0.375rem;

  --ms-inset-panel-x: 0.75rem;
  --ms-inset-panel-y: 0.5rem;
  --ms-inset-panel-body-sm: 0.5rem;
  --ms-inset-panel-body: 0.75rem;

  --ms-gap-header-main: 0.5rem;
  --ms-gap-header-actions: 0.375rem;

  --ms-size-diagram-min-height: 280px;   /* 不要太激进，280 比 240 稳 */
  --ms-size-code-max-height: 420px;

  --ms-duration-standard: 160ms;
  --ms-duration-overlay: 180ms;
}
```

---

## 十、实施注意事项

### "等值映射" vs "设计归一"

本文档的所有映射都是**严格等值**——token 的默认值就是当前代码里的实际值。
如果后续视觉重设计需要调整值（如 `1.6em` → `1.5rem`），应在单独的 PR 中进行，
并明确标注为"设计归一"，不要混在 token 提取中。

### JS 硬编码必须同步

仅在 CSS 中定义 token 是不够的。所有在 JS 中硬编码的尺寸/时长值必须改为
通过 `getComputedStyle` 读取 CSS 变量值，或通过 props/computed 传递 token 值。
否则 compact 主题只影响 CSS 层面，JS 控制的高度/动画不会跟随。

### 保真优先

- `1.25rem`（ListNode my-5）和 `1.25em`（ParagraphNode margin）是**不同单位**，不要混成同一个 token
- `padding-left: 1em`（BlockquoteNode）不等于 `--ms-space-4`（1rem），单位不同
- `py-2.5 = 0.625rem` 不等于 `0.5rem`
- Admonition content 的 `padding: 0.5rem 1rem 1rem` 是三值（上 ≠ 下），不能和 header 共用
