import type { ComponentType, ReactNode } from 'react'
import React from 'react'
import {
  BLOCKED_HTML_TAGS as BLOCKED_TAGS,
  hasCustomHtmlComponents as hasCustomHtmlComponentsBase,
  isCustomHtmlComponentTag,
  sanitizeHtmlAttrs as sanitizeHtmlAttrsBase,
  tokenizeHtml as tokenizeHtmlBase,
} from 'stream-markdown-parser'

export type { HtmlToken } from 'stream-markdown-parser'

function normalizeCssPropName(prop: string) {
  if (prop.startsWith('--'))
    return prop
  return prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

function parseInlineStyle(style: string): Record<string, string> | undefined {
  const input = style.trim()
  if (!input)
    return undefined

  const out: Record<string, string> = {}
  for (const part of input.split(';')) {
    const chunk = part.trim()
    if (!chunk)
      continue
    const idx = chunk.indexOf(':')
    if (idx === -1)
      continue
    const key = normalizeCssPropName(chunk.slice(0, idx).trim())
    const value = chunk.slice(idx + 1).trim()
    if (key)
      out[key] = value
  }

  return Object.keys(out).length ? out : undefined
}

export function normalizeDomAttrs(attrs: Record<string, string>) {
  const next: Record<string, any> = { ...attrs }
  if (Object.prototype.hasOwnProperty.call(next, 'class')) {
    next.className = next.class
    delete next.class
  }
  if (Object.prototype.hasOwnProperty.call(next, 'for')) {
    next.htmlFor = next.for
    delete next.for
  }
  if (typeof next.style === 'string') {
    const parsed = parseInlineStyle(next.style)
    if (parsed)
      next.style = parsed
    else
      delete next.style
  }
  return next
}

export const tokenizeHtml = tokenizeHtmlBase
export const sanitizeHtmlAttrs = sanitizeHtmlAttrsBase

export function isCustomHtmlComponent(
  tagName: string,
  customComponents: Record<string, ComponentType<any>>,
) {
  return isCustomHtmlComponentTag(tagName, customComponents as Record<string, unknown>)
}

export function hasCustomHtmlComponents(
  content: string,
  customComponents: Record<string, ComponentType<any>>,
) {
  return hasCustomHtmlComponentsBase(content, customComponents as Record<string, unknown>)
}

export function parseHtmlToReactNodes(
  content: string,
  customComponents: Record<string, ComponentType<any>>,
): ReactNode[] | null {
  if (!content)
    return []

  try {
    const tokens = tokenizeHtml(content)
    let autoKeySeed = 0
    const stack: Array<{ tagName: string, children: ReactNode[], attrs?: Record<string, string>, blocked?: boolean }> = []
    const rootNodes: ReactNode[] = []

    for (const token of tokens) {
      if (token.type === 'text') {
        if (stack.length > 0 && stack[stack.length - 1].blocked)
          continue
        const target = stack.length > 0 ? stack[stack.length - 1].children : rootNodes
        target.push(token.content ?? '')
        continue
      }

      if (token.type === 'self_closing') {
        if (BLOCKED_TAGS.has(token.tagName.toLowerCase()))
          continue
        const attrs = sanitizeHtmlAttrs(token.attrs || {})
        const explicitKey = (attrs as any).key
        const elementKey = explicitKey != null && explicitKey !== '' ? explicitKey : `ms-html-${autoKeySeed++}`
        const Comp = isCustomHtmlComponent(token.tagName, customComponents)
          ? (customComponents[token.tagName] || customComponents[token.tagName.toLowerCase()])
          : undefined
        const target = stack.length > 0 ? stack[stack.length - 1].children : rootNodes
        if (Comp) {
          target.push(React.createElement(Comp, { ...attrs, key: elementKey }))
        }
        else {
          target.push(React.createElement(token.tagName, {
            ...normalizeDomAttrs(attrs),
            key: elementKey,
            suppressHydrationWarning: true,
          }))
        }
        continue
      }

      if (token.type === 'tag_open') {
        stack.push({
          tagName: token.tagName,
          children: [],
          attrs: token.attrs,
          blocked: BLOCKED_TAGS.has(token.tagName.toLowerCase()),
        })
        continue
      }

      const opening = stack.pop()
      if (!opening || opening.blocked)
        continue

      const attrs = sanitizeHtmlAttrs(opening.attrs || {})
      const explicitKey = (attrs as any).key
      const elementKey = explicitKey != null && explicitKey !== '' ? explicitKey : `ms-html-${autoKeySeed++}`
      const Comp = isCustomHtmlComponent(opening.tagName, customComponents)
        ? (customComponents[opening.tagName] || customComponents[opening.tagName.toLowerCase()])
        : undefined
      const element = Comp
        ? React.createElement(Comp, { ...attrs, key: elementKey }, ...opening.children)
        : React.createElement(opening.tagName, {
            ...normalizeDomAttrs(attrs),
            key: elementKey,
            suppressHydrationWarning: true,
          }, ...opening.children)

      if (stack.length > 0)
        stack[stack.length - 1].children.push(element)
      else
        rootNodes.push(element)
    }

    while (stack.length > 0) {
      const unclosed = stack.pop()
      if (!unclosed || unclosed.blocked)
        continue
      const attrs = sanitizeHtmlAttrs(unclosed.attrs || {})
      const explicitKey = (attrs as any).key
      const elementKey = explicitKey != null && explicitKey !== '' ? explicitKey : `ms-html-${autoKeySeed++}`
      const Comp = isCustomHtmlComponent(unclosed.tagName, customComponents)
        ? (customComponents[unclosed.tagName] || customComponents[unclosed.tagName.toLowerCase()])
        : undefined
      const element = Comp
        ? React.createElement(Comp, { ...attrs, key: elementKey }, ...unclosed.children)
        : React.createElement(unclosed.tagName, {
            ...normalizeDomAttrs(attrs),
            key: elementKey,
            suppressHydrationWarning: true,
          }, ...unclosed.children)
      rootNodes.push(element)
    }

    return rootNodes
  }
  catch {
    return null
  }
}
