import type React from 'react'
import type { BaseNode, MarkdownIt, ParsedNode, ParseOptions } from 'stream-markdown-parser'
import type {
  CodeBlockMonacoOptions,
  CodeBlockMonacoTheme,
  CodeBlockNodeProps,
  D2BlockNodeProps,
  InfographicBlockNodeProps,
  MermaidBlockNodeProps,
} from './types/component-props'

export type NodeRendererCodeBlockProps = Partial<Omit<CodeBlockNodeProps, 'node'>> & Record<string, unknown>

export interface NodeRendererProps {
  content?: string
  nodes?: readonly BaseNode[] | null
  /**
   * Whether the input stream is complete (end-of-stream). When true, the parser
   * can stop emitting streaming "loading" nodes for unfinished constructs.
   */
  final?: boolean
  parseOptions?: ParseOptions
  customMarkdownIt?: (md: MarkdownIt) => MarkdownIt
  /** Log parse/render timing stats (dev only). */
  debugPerformance?: boolean
  /**
   * Custom HTML-like tags that should be emitted as custom nodes (e.g. ['thinking']).
   * Forwarded to `getMarkdown()` and merged into parseOptions.
   */
  customHtmlTags?: readonly string[]
  viewportPriority?: boolean
  codeBlockStream?: boolean
  codeBlockDarkTheme?: CodeBlockMonacoTheme
  codeBlockLightTheme?: CodeBlockMonacoTheme
  codeBlockMonacoOptions?: CodeBlockMonacoOptions
  renderCodeBlocksAsPre?: boolean
  codeBlockMinWidth?: string | number
  codeBlockMaxWidth?: string | number
  codeBlockProps?: NodeRendererCodeBlockProps
  mermaidProps?: Partial<Omit<MermaidBlockNodeProps, 'node' | 'loading' | 'isDark'>>
  d2Props?: Partial<Omit<D2BlockNodeProps, 'node' | 'loading' | 'isDark'>>
  infographicProps?: Partial<Omit<InfographicBlockNodeProps, 'node' | 'loading' | 'isDark'>>
  showTooltips?: boolean
  themes?: CodeBlockMonacoTheme[]
  isDark?: boolean
  customId?: string
  indexKey?: number | string
  typewriter?: boolean
  batchRendering?: boolean
  initialRenderBatchSize?: number
  renderBatchSize?: number
  renderBatchDelay?: number
  renderBatchBudgetMs?: number
  renderBatchIdleTimeoutMs?: number
  deferNodesUntilVisible?: boolean
  maxLiveNodes?: number
  liveNodeBuffer?: number
  onCopy?: (code: string) => void
  onHandleArtifactClick?: (payload: any) => void
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void
  onMouseOver?: (event: React.MouseEvent<HTMLElement>) => void
  onMouseOut?: (event: React.MouseEvent<HTMLElement>) => void
}

export interface RenderContext {
  customId?: string
  isDark?: boolean
  indexKey?: string
  typewriter?: boolean
  textStreamState?: Map<string, string>
  streamRenderVersion?: number
  customComponents?: Record<string, React.ComponentType<any>>
  customHtmlTags?: readonly string[]
  codeBlockProps?: NodeRendererCodeBlockProps
  mermaidProps?: Partial<Omit<MermaidBlockNodeProps, 'node' | 'loading' | 'isDark'>>
  d2Props?: Partial<Omit<D2BlockNodeProps, 'node' | 'loading' | 'isDark'>>
  infographicProps?: Partial<Omit<InfographicBlockNodeProps, 'node' | 'loading' | 'isDark'>>
  showTooltips?: boolean
  codeBlockStream?: boolean
  renderCodeBlocksAsPre?: boolean
  codeBlockThemes?: {
    themes?: CodeBlockMonacoTheme[]
    darkTheme?: CodeBlockMonacoTheme
    lightTheme?: CodeBlockMonacoTheme
    monacoOptions?: CodeBlockMonacoOptions
    minWidth?: string | number
    maxWidth?: string | number
  }
  events: {
    onCopy?: (code: string) => void
    onHandleArtifactClick?: (payload: any) => void
  }
}

export type RenderNodeFn = (node: ParsedNode, key: React.Key, ctx: RenderContext) => React.ReactNode
