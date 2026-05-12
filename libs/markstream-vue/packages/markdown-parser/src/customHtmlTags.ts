import { STANDARD_HTML_TAGS } from './htmlTags'
import { escapeTagForRegExp } from './htmlTagUtils'

const HTML_LIKE_TAG_NAME_RE = /^[a-z][a-z0-9_-]*$/

export function isHtmlLikeTagName(tag: string) {
  return HTML_LIKE_TAG_NAME_RE.test(String(tag ?? '').trim().toLowerCase())
}

export function normalizeCustomHtmlTagName(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw)
    return ''

  if (!raw.startsWith('<'))
    return isHtmlLikeTagName(raw) ? raw.toLowerCase() : ''

  let index = 1
  while (index < raw.length && /\s/.test(raw[index]))
    index++
  if (raw[index] === '/') {
    index++
    while (index < raw.length && /\s/.test(raw[index]))
      index++
  }

  const start = index
  while (index < raw.length && /[\w-]/.test(raw[index]))
    index++

  const normalized = raw.slice(start, index).toLowerCase()
  const next = raw[index] ?? ''
  if (next && !/[\s/>]/.test(next))
    return ''
  return isHtmlLikeTagName(normalized) ? normalized : ''
}

export function normalizeCustomHtmlTags(tags?: readonly string[]) {
  if (!tags || tags.length === 0)
    return []

  const seen = new Set<string>()
  const normalized: string[] = []
  for (const tag of tags) {
    const value = normalizeCustomHtmlTagName(tag)
    if (!value || seen.has(value))
      continue
    seen.add(value)
    normalized.push(value)
  }
  return normalized
}

export function mergeCustomHtmlTags(...lists: Array<readonly string[] | undefined>) {
  const seen = new Set<string>()
  const normalized: string[] = []

  for (const list of lists) {
    for (const tag of normalizeCustomHtmlTags(list)) {
      if (seen.has(tag))
        continue
      seen.add(tag)
      normalized.push(tag)
    }
  }

  return normalized
}

export function resolveCustomHtmlTags(tags?: readonly string[]) {
  const normalized = normalizeCustomHtmlTags(tags)
  return {
    key: normalized.join(','),
    tags: normalized,
  }
}

export function getHtmlTagFromContent(html: unknown) {
  return normalizeCustomHtmlTagName(html)
}

export function hasCompleteHtmlTagContent(html: unknown, tag: string) {
  const raw = String(html ?? '')
  const normalizedTag = normalizeCustomHtmlTagName(tag)
  if (!normalizedTag)
    return false

  const escaped = escapeTagForRegExp(normalizedTag)
  const openMatch = raw.match(new RegExp(String.raw`^\s*<\s*${escaped}(?:\s[^>]*)?(\s*\/)?>`, 'i'))
  if (!openMatch)
    return false
  if (openMatch[1])
    return true

  return new RegExp(String.raw`<\s*\/\s*${escaped}\s*>`, 'i').test(raw)
}

export function shouldRenderUnknownHtmlTagAsText(html: unknown, tag: string) {
  const normalizedTag = normalizeCustomHtmlTagName(tag)
  return Boolean(normalizedTag)
    && !STANDARD_HTML_TAGS.has(normalizedTag)
    && !hasCompleteHtmlTagContent(html, normalizedTag)
}

export function stripCustomHtmlWrapper(html: unknown, tag: string) {
  const raw = String(html ?? '')
  const normalizedTag = normalizeCustomHtmlTagName(tag)
  if (!normalizedTag)
    return raw

  const escaped = escapeTagForRegExp(normalizedTag)
  const openRe = new RegExp(String.raw`^\s*<\s*${escaped}(?:\s[^>]*)?>\s*`, 'i')
  const closeRe = new RegExp(String.raw`\s*<\s*\/\s*${escaped}\s*>\s*$`, 'i')
  return raw.replace(openRe, '').replace(closeRe, '')
}
