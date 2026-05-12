import type { ParsedNode } from 'stream-markdown-parser'
import type { NodeComponentProps } from '../../types/node-component'
import clsx from 'clsx'
import React from 'react'
import { renderNodeChildren } from '../../renderers/renderChildren'

export function HeadingNode(props: NodeComponentProps<{ type: 'heading', level?: number, children?: ParsedNode[], attrs?: Record<string, string | boolean> }>) {
  const { node, ctx, renderNode, indexKey, children } = props
  const level = Math.min(6, Math.max(1, Number(node.level) || 1))
  type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  const Tag = (`h${level}`) as HeadingTag
  const attrs = (node as any)?.attrs as Record<string, unknown> | undefined
  const { class: classAttr, className: classNameAttr, style: styleAttr, ...restAttrs } = attrs ?? {}

  return (
    <Tag
      dir="auto"
      className={clsx('heading-node font-semibold', `heading-${level}`, classAttr as any, classNameAttr as any)}
      {...(typeof styleAttr === 'object' && styleAttr != null ? { style: styleAttr as any } : {})}
      {...(restAttrs as React.HTMLAttributes<HTMLHeadingElement>)}
    >
      {children ?? (ctx && renderNode
        ? renderNodeChildren(node.children, ctx, String(indexKey ?? `heading-${level}`), renderNode)
        : null)}
    </Tag>
  )
}

export default HeadingNode
