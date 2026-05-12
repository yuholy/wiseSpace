import type { App, Component, Plugin } from 'vue'
import type { CustomComponents as MarkstreamCustomComponents } from './types'
import type { LanguageIconResolver } from './utils/languageIcon'
import { setDefaultMathOptions } from 'stream-markdown-parser'
import { defineAsyncComponent } from 'vue'
import AdmonitionNode from './components/AdmonitionNode'

import BlockquoteNode from './components/BlockquoteNode'
import CheckboxNode from './components/CheckboxNode'
import { disableD2, enableD2, isD2Enabled, setD2Loader } from './components/D2BlockNode/d2'
import DefinitionListNode from './components/DefinitionListNode'
import EmojiNode from './components/EmojiNode'
import EmphasisNode from './components/EmphasisNode'
import FootnoteAnchorNode from './components/FootnoteAnchorNode'
import FootnoteNode from './components/FootnoteNode'
import FootnoteReferenceNode from './components/FootnoteReferenceNode'
import HardBreakNode from './components/HardBreakNode'
import HeadingNode from './components/HeadingNode'
import HighlightNode from './components/HighlightNode'
import HtmlBlockNode from './components/HtmlBlockNode'
import HtmlInlineNode from './components/HtmlInlineNode'
import ImageNode from './components/ImageNode'
import InlineCodeNode from './components/InlineCodeNode'
import InsertNode from './components/InsertNode'
import LinkNode from './components/LinkNode'
import ListItemNode from './components/ListItemNode'
import ListNode from './components/ListNode'
import MarkdownCodeBlockNode from './components/MarkdownCodeBlockNode'
import { disableKatex, enableKatex, isKatexEnabled, setKatexLoader } from './components/MathInlineNode/katex'
import { disableMermaid, enableMermaid, isMermaidEnabled, setMermaidLoader } from './components/MermaidBlockNode/mermaid'
import MarkdownRender from './components/NodeRenderer'
import ParagraphNode from './components/ParagraphNode'
import PreCodeNode from './components/PreCodeNode'
import ReferenceNode from './components/ReferenceNode'
import StrikethroughNode from './components/StrikethroughNode'
import StrongNode from './components/StrongNode'
import SubscriptNode from './components/SubscriptNode'
import SuperscriptNode from './components/SuperscriptNode'
import TableNode from './components/TableNode'
import TextNode from './components/TextNode'
import ThematicBreakNode from './components/ThematicBreakNode'
import Tooltip from './components/Tooltip'
import VmrContainerNode from './components/VmrContainerNode'
import { setDefaultI18nMap } from './composables/useSafeI18n'
import { setIconTheme } from './icon-themes'
import { setLanguageIconResolver } from './utils/languageIcon'
import { clearGlobalCustomComponents, getCustomNodeComponents, removeCustomComponents, setCustomComponents } from './utils/nodeComponents'
import './index.css'
// Re-add top-level worker imports so builds emit worker bundles into `dist/`
import './workers/katexRenderer.worker?worker'
import './workers/mermaidParser.worker?worker'

const CodeBlockNode = defineAsyncComponent(() => import('./components/CodeBlockNode'))
const MathBlockNode = defineAsyncComponent(() => import('./components/MathBlockNode'))
const MathInlineNode = defineAsyncComponent(() => import('./components/MathInlineNode'))
const MermaidBlockNode = defineAsyncComponent(() => import('./components/MermaidBlockNode'))
const InfographicBlockNode = defineAsyncComponent(() => import('./components/InfographicBlockNode'))
const D2BlockNode = defineAsyncComponent(() => import('./components/D2BlockNode'))

export type { D2Loader } from './components/D2BlockNode/d2'
export type { KatexLoader } from './components/MathInlineNode/katex'

export type { MermaidLoader } from './components/MermaidBlockNode/mermaid'
export type {
  CodeBlockDiffAppearance,
  CodeBlockDiffHideUnchangedRegions,
  CodeBlockDiffHideUnchangedRegionsOptions,
  CodeBlockDiffHunkActionContext,
  CodeBlockDiffHunkActionKind,
  CodeBlockDiffHunkSide,
  CodeBlockDiffLineStyle,
  CodeBlockDiffUnchangedRegionStyle,
  CodeBlockMonacoLanguage,
  CodeBlockMonacoOptions,
  CodeBlockMonacoTheme,
  CodeBlockMonacoThemeObject,
  CodeBlockNodeProps,
  CodeBlockThemeProp,
  D2BlockNodeProps,
  ImageNodeProps,
  InfographicBlockNodeProps,
  LinkNodeProps,
  MathBlockNodeProps,
  MathInlineNodeProps,
  MermaidBlockEvent,
  MermaidBlockNodeProps,
  PreCodeNodeProps,
} from './types/component-props'
export type { NodeRendererProps } from './types/node-renderer-props'
// Export centralized props interfaces so they appear in package d.ts
export * from './utils'
export * from './workers/katexCdnWorker'
export * from './workers/katexWorkerClient'
export * from './workers/mermaidCdnWorker'
export * from './workers/mermaidWorkerClient'
export { KATEX_COMMANDS, normalizeStandaloneBackslashT, setDefaultMathOptions } from 'stream-markdown-parser'
export type { MathOptions } from 'stream-markdown-parser'

export interface CustomComponents extends MarkstreamCustomComponents {}

export {
  AdmonitionNode,
  BlockquoteNode,
  CheckboxNode,
  clearGlobalCustomComponents,
  CodeBlockNode,
  D2BlockNode,
  DefinitionListNode,
  disableD2,
  disableKatex,
  disableMermaid,
  EmojiNode,
  EmphasisNode,
  enableD2,
  enableKatex,
  enableMermaid,
  FootnoteAnchorNode,
  FootnoteNode,
  FootnoteReferenceNode,
  getCustomNodeComponents,
  HardBreakNode,
  HeadingNode,
  HighlightNode,
  HtmlBlockNode,
  HtmlInlineNode,
  ImageNode,
  InfographicBlockNode,
  InlineCodeNode,
  InsertNode,
  isD2Enabled,
  isKatexEnabled,
  isMermaidEnabled,
  LinkNode,
  ListItemNode,
  ListNode,
  MarkdownCodeBlockNode,
  MarkdownRender,
  MathBlockNode,
  MathInlineNode,
  MermaidBlockNode,
  ParagraphNode,
  PreCodeNode,
  ReferenceNode,
  removeCustomComponents,
  setCustomComponents,
  setD2Loader,
  setDefaultI18nMap,
  setKatexLoader,
  setMermaidLoader,
  StrikethroughNode,
  StrongNode,
  SubscriptNode,
  SuperscriptNode,
  TableNode,
  TextNode,
  ThematicBreakNode,
  Tooltip,
  VmrContainerNode,
}

export default MarkdownRender

const componentMap: Record<string, Component> = {
  AdmonitionNode,
  BlockquoteNode,
  CheckboxNode,
  CodeBlockNode,
  DefinitionListNode,
  EmojiNode,
  EmphasisNode,
  FootnoteNode,
  FootnoteReferenceNode,
  FootnoteAnchorNode,
  HardBreakNode,
  HeadingNode,
  HtmlBlockNode,
  HtmlInlineNode,
  HighlightNode,
  ImageNode,
  D2BlockNode,
  InfographicBlockNode,
  InlineCodeNode,
  PreCodeNode,
  InsertNode,
  LinkNode,
  ListItemNode,
  ListNode,
  MathBlockNode,
  MathInlineNode,
  MermaidBlockNode,
  ParagraphNode,
  StrikethroughNode,
  StrongNode,
  SubscriptNode,
  SuperscriptNode,
  TableNode,
  TextNode,
  ThematicBreakNode,
  VmrContainerNode,
  ReferenceNode,
  MarkdownCodeBlockNode,
}

export const VueRendererMarkdown: Plugin = {
  install(app: App, options?: { getLanguageIcon?: LanguageIconResolver, iconTheme?: string, mathOptions?: any }) {
    Object.entries(componentMap).forEach(([name, component]) => {
      app.component(name, component)
    })
    // Theme is set first, then user resolver is applied on top (resolver takes priority)
    if (options?.iconTheme)
      setIconTheme(options.iconTheme)
    if (options?.getLanguageIcon)
      setLanguageIconResolver(options.getLanguageIcon)
    // optional global math options
    // avoid importing inside module scope to keep SSR safe
    if (options?.mathOptions)
      setDefaultMathOptions(options.mathOptions)
  },
}
