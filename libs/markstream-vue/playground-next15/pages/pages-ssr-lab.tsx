import * as nextEntry from 'markstream-react/next'
import * as serverEntry from 'markstream-react/server'
import React from 'react'
import {
  createMatrixCases,
  FALLBACK_DEMOS,
  SERVER_BASIC_NODES,
  SERVER_CUSTOM_ALT_ID,
  SERVER_CUSTOM_ALT_NODES,
  SERVER_CUSTOM_ID,
  SERVER_CUSTOM_NODES,
} from '../src/ssr-lab-data'
import { SsrLabPage } from '../src/ssr-lab-page'

function readAttr(node: any, name: string) {
  if (!node?.attrs)
    return undefined
  if (Array.isArray(node.attrs))
    return node.attrs.find((item: [string, string | null]) => item[0] === name)?.[1] ?? undefined
  return node.attrs[name]
}

function renderCustomChildren(props: any) {
  if (!Array.isArray(props.node?.children) || !props.renderNode || !props.ctx)
    return null

  return props.node.children.map((child: any, idx: number) => (
    <React.Fragment key={`${String(props.indexKey ?? 'custom')}-${idx}`}>
      {props.renderNode(child, `${String(props.indexKey ?? 'custom')}-${idx}`, props.ctx)}
    </React.Fragment>
  ))
}

function ServerParagraphOverride({ node }: any) {
  return (
    <div data-ssr-status="server-paragraph-override">
      {node.raw}
    </div>
  )
}

function ServerInsightNode(props: any) {
  return (
    <section data-ssr-status="server-custom-node">
      <strong>{props.node.label}</strong>
      <div data-ssr-status="server-custom-node-children">
        {renderCustomChildren(props)}
      </div>
    </section>
  )
}

function ServerThinkingTag({ node }: any) {
  return (
    <aside
      data-ssr-status="server-thinking-tag"
      data-ssr-tone={readAttr(node, 'data-tone')}
      data-ssr-scope={readAttr(node, 'data-scope')}
    >
      {node.content}
    </aside>
  )
}

function ServerParagraphAlt({ node }: any) {
  return (
    <div data-ssr-status="server-paragraph-alt">
      {node.raw}
    </div>
  )
}

function ServerInsightAlt(props: any) {
  return (
    <section data-ssr-status="server-custom-node-alt">
      <strong>{props.node.label}</strong>
      <div data-ssr-status="server-custom-node-alt-children">
        {renderCustomChildren(props)}
      </div>
    </section>
  )
}

function ServerThinkingTagAlt({ node }: any) {
  return (
    <aside
      data-ssr-status="server-thinking-tag-alt"
      data-ssr-scope={readAttr(node, 'data-scope')}
    >
      {node.content}
    </aside>
  )
}

function renderServerFallbackHtml() {
  return (
    <>
      <div data-ssr-demo="mermaid" className="ssr-card">
        <serverEntry.MermaidBlockNode node={FALLBACK_DEMOS.mermaid as any} />
      </div>
      <div data-ssr-demo="d2" className="ssr-card">
        <serverEntry.D2BlockNode node={FALLBACK_DEMOS.d2 as any} />
      </div>
      <div data-ssr-demo="infographic" className="ssr-card">
        <serverEntry.InfographicBlockNode node={FALLBACK_DEMOS.infographic as any} />
      </div>
    </>
  )
}

function renderServerMatrixHtml() {
  const items = createMatrixCases(serverEntry, serverEntry)
  return (
    <div className="ssr-matrix">
      {items.map(item => (
        <section key={item.name} data-ssr-export={item.name} className="ssr-card">
          <h3>{item.name}</h3>
          <div className="markstream-react ssr-matrix-renderer">{item.element}</div>
        </section>
      ))}
    </div>
  )
}

function renderServerCustomHtml() {
  return (
    <>
      <section data-ssr-custom-id="server-primary" className="ssr-card">
        <serverEntry.NodeRenderer
          customId={SERVER_CUSTOM_ID}
          customHtmlTags={['thinking']}
          nodes={SERVER_CUSTOM_NODES}
          final
          showTooltips={false}
        />
      </section>
      <section data-ssr-custom-id="server-alt" className="ssr-card">
        <serverEntry.NodeRenderer
          customId={SERVER_CUSTOM_ALT_ID}
          customHtmlTags={['thinking']}
          nodes={SERVER_CUSTOM_ALT_NODES}
          final
          showTooltips={false}
        />
      </section>
    </>
  )
}

interface PagesSsrLabProps {
  serverBasicHtml: string
  serverCustomHtml: string
  serverFallbackHtml: string
  serverMatrixHtml: string
}

export default function PagesSsrLabPage({
  serverBasicHtml,
  serverCustomHtml,
  serverFallbackHtml,
  serverMatrixHtml,
}: PagesSsrLabProps) {
  return (
    <SsrLabPage
      version="next15"
      router="pages"
      nextEntry={nextEntry}
      serverEntry={serverEntry}
      serverBasicHtml={serverBasicHtml}
      serverCustomHtml={serverCustomHtml}
      serverFallbackHtml={serverFallbackHtml}
      serverMatrixHtml={serverMatrixHtml}
    />
  )
}

export async function getServerSideProps() {
  const { renderToStaticMarkup } = await import('react-dom/server')

  serverEntry.setCustomComponents(SERVER_CUSTOM_ID, {
    paragraph: ServerParagraphOverride,
    insight: ServerInsightNode,
    thinking: ServerThinkingTag,
  })
  serverEntry.setCustomComponents(SERVER_CUSTOM_ALT_ID, {
    paragraph: ServerParagraphAlt,
    insight: ServerInsightAlt,
    thinking: ServerThinkingTagAlt,
  })

  return {
    props: {
      serverBasicHtml: renderToStaticMarkup(
        <serverEntry.NodeRenderer
          customId={SERVER_CUSTOM_ID}
          nodes={SERVER_BASIC_NODES}
          final
          showTooltips={false}
        />,
      ),
      serverCustomHtml: renderToStaticMarkup(renderServerCustomHtml()),
      serverFallbackHtml: renderToStaticMarkup(renderServerFallbackHtml()),
      serverMatrixHtml: renderToStaticMarkup(renderServerMatrixHtml()),
    },
  }
}
