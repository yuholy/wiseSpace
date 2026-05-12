# CodeBlockNode (component)

`CodeBlockNode` renders rich interactive code blocks. It supports Monaco streaming integration (optional), Markdown mode, and a flexible header API with slots and events.

Quick example — inline usage (fallback to a simple rendering if Monaco not installed):

```vue
<CodeBlockNode :node="{ type: 'code_block', language: 'js', code: 'console.log(1)', raw: 'console.log(1)' }" />
```

Header override example:

```vue
<CodeBlockNode :node="node" :showCopyButton="false">
  <template #header-left>
    <div class="text-sm font-medium">My snippet</div>
  </template>
  <template #header-right>
    <button @click="run">Run</button>
  </template>
</CodeBlockNode>
```

Docs and usage examples:
- Docs: /guide/code-block-node
- Header API: /guide/codeblock-header

Monaco diff notes:

- `monacoOptions` is typed as `CodeBlockMonacoOptions`
- diff-friendly options such as `diffHideUnchangedRegions`, `diffLineStyle`, `diffAppearance`, `diffUnchangedRegionStyle`, `diffHunkActionsOnHover`, `diffHunkHoverHideDelayMs`, and `onDiffHunkAction` belong there
- when `node.diff === true`, `CodeBlockNode` now defaults to:
  - `diffHideUnchangedRegions: { enabled: true, contextLineCount: 2, minimumLineCount: 4, revealLineCount: 5 }`
  - `diffLineStyle: 'background'`
  - `diffAppearance: 'auto'`
  - `diffUnchangedRegionStyle: 'line-info'`
  - `diffHunkActionsOnHover: true`
  - `diffHunkHoverHideDelayMs: 160`
- runtime note: `diffAppearance: 'auto'` resolves to the current light/dark surface before it is passed to `stream-monaco`
- the header also shows `- / +` line counts for diff blocks
