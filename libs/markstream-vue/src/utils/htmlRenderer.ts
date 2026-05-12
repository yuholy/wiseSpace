import type { HtmlToken } from 'stream-markdown-parser'
import type { Component } from 'vue'
import {
  BLOCKED_HTML_TAGS as BLOCKED_TAGS,
  convertHtmlAttrsToProps,
  convertHtmlPropValue,
  getHtmlTagFromContent,
  hasCompleteHtmlTagContent,
  hasCustomHtmlComponents,
  isCustomHtmlComponentTag,
  sanitizeHtmlAttrs,
  shouldRenderUnknownHtmlTagAsText,
  stripCustomHtmlWrapper,
  tokenizeHtml,
} from 'stream-markdown-parser'
import { h } from 'vue'

export {
  getHtmlTagFromContent,
  hasCompleteHtmlTagContent,
  shouldRenderUnknownHtmlTagAsText,
  stripCustomHtmlWrapper,
  tokenizeHtml,
}

export type { HtmlToken } from 'stream-markdown-parser'

const SHOULD_LOG = (() => {
  try {
    return Boolean((import.meta as any).env?.DEV)
  }
  catch {}
  return false
})()

function warn(message: string) {
  if (SHOULD_LOG)
    console.warn(message)
}

function logError(message: string, err: unknown) {
  if (SHOULD_LOG)
    console.error(message, err)
}

export function isCustomComponent(
  tagName: string,
  customComponents: Record<string, Component>,
): boolean {
  return isCustomHtmlComponentTag(tagName, customComponents as Record<string, unknown>)
}

export function sanitizeAttrs(attrs: Record<string, string>): Record<string, string> {
  return sanitizeHtmlAttrs(attrs)
}

export function convertPropValue(value: string, key: string): any {
  return convertHtmlPropValue(value, key)
}

export function convertAttrsToProps(attrs: Record<string, string>): Record<string, any> {
  return convertHtmlAttrsToProps(attrs)
}

/**
 * Build VNode tree from tokens
 */
export function buildVNodeTree(
  tokens: HtmlToken[],
  customComponents: Record<string, Component>,
): any[] {
  let autoKeySeed = 0
  const stack: Array<{ tagName: string, children: any[], attrs?: Record<string, string>, autoKey: string }> = []
  const rootNodes: any[] = []

  for (const token of tokens) {
    if (token.type === 'text') {
      const target = stack.length > 0 ? stack[stack.length - 1].children : rootNodes
      target.push(token.content!)
    }
    else if (token.type === 'self_closing') {
      const vnode = createVNode(token.tagName!, token.attrs || {}, [], customComponents, `ms-html-${autoKeySeed++}`)
      const target = stack.length > 0 ? stack[stack.length - 1].children : rootNodes
      vnode != null && target.push(vnode)
    }
    else if (token.type === 'tag_open') {
      // Assign an auto-key at open time so outer node keys stay stable while
      // streaming content grows (otherwise keys shift based on close order).
      stack.push({
        tagName: token.tagName!,
        children: [],
        attrs: token.attrs,
        autoKey: `ms-html-${autoKeySeed++}`,
      })
    }
    else if (token.type === 'tag_close') {
      const closingTag = token.tagName!.toLowerCase()

      // Find matching opening tag (handle nested same tags)
      let matchedIndex = -1
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tagName.toLowerCase() === closingTag) {
          matchedIndex = i
          break
        }
      }

      if (matchedIndex !== -1) {
        // Pop all tags until the matched one (auto-closing intermediate tags)
        while (stack.length > matchedIndex) {
          const opening = stack.pop()!
          const vnode = createVNode(opening.tagName, opening.attrs || {}, opening.children, customComponents, opening.autoKey)

          if (stack.length > 0)
            vnode != null && stack[stack.length - 1].children.push(vnode)
          else
            vnode != null && rootNodes.push(vnode)

          // Warn if auto-closing tags
          if (opening.tagName.toLowerCase() !== closingTag && stack.length > matchedIndex) {
            warn(`Auto-closing unclosed tag: <${opening.tagName}>`)
          }
        }
      }
      else {
        // No matching opening tag, warn and ignore
        warn(`Ignoring closing tag with no matching opening tag: </${token.tagName}>`)
      }
    }
  }

  // Handle any remaining unclosed tags
  while (stack.length > 0) {
    const unclosed = stack.pop()!
    const vnode = createVNode(unclosed.tagName, unclosed.attrs || {}, unclosed.children, customComponents, unclosed.autoKey)
    if (stack.length > 0)
      vnode != null && stack[stack.length - 1].children.push(vnode)
    else
      vnode != null && rootNodes.push(vnode)
    warn(`Auto-closing unclosed tag: <${unclosed.tagName}>`)
  }

  return rootNodes
}

/**
 * Create VNode for a tag
 */
function createVNode(
  tagName: string,
  attrs: Record<string, string>,
  children: any[],
  customComponents: Record<string, Component>,
  autoKey: string,
): any {
  if (BLOCKED_TAGS.has(tagName.toLowerCase()))
    return null

  const sanitizedAttrs = sanitizeAttrs(attrs)
  const explicitKey = (sanitizedAttrs as any).key
  const vnodeKey = explicitKey != null && explicitKey !== '' ? explicitKey : autoKey

  if (isCustomComponent(tagName, customComponents)) {
    // It's a custom Vue component
    const component = customComponents[tagName] || customComponents[tagName.toLowerCase()]
    const convertedAttrs = convertAttrsToProps(sanitizedAttrs)
    return h(component as Component, { ...convertedAttrs, key: vnodeKey }, children.length > 0 ? children : undefined)
  }
  else {
    // It's a standard HTML element
    return h(tagName, { ...sanitizedAttrs, innerHTML: undefined, key: vnodeKey }, children.length > 0 ? children : undefined)
  }
}

/**
 * Check if HTML content contains custom components
 */
export function hasCustomComponents(
  content: string,
  customComponents: Record<string, Component>,
): boolean {
  return hasCustomHtmlComponents(content, customComponents as Record<string, unknown>)
}

/**
 * Parse HTML content to VNodes
 */
export function parseHtmlToVNodes(
  content: string,
  customComponents: Record<string, Component>,
): any[] | null {
  if (!content)
    return []

  try {
    const tokens = tokenizeHtml(content)
    const nodes = buildVNodeTree(tokens, customComponents)
    return nodes
  }
  catch (error) {
    logError('Failed to parse HTML to VNodes:', error)
    return null
  }
}
