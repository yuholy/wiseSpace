import { getMarkdown, parseMarkdownToStructure, type BaseNode } from 'stream-markdown-parser';
import { buildDisplayAttrAlternation } from './legacyCompat';

export type ChatMarkdownNode = BaseNode;

export const CHAT_CUSTOM_HTML_TAGS = ['think', 'web-search', 'knowledge-retrieval', 'memory-retrieval', 'tool-call', 'img'] as const;
const DISPLAY_ATTR_PATTERN = buildDisplayAttrAlternation('data-wisespace');

/**
 * Strip all wisespace-injected custom tags (with `data-wisespace="1"` attribute) and
 * MCP tool call fenced blocks (`:::mcp ... :::`) from content.
 * Used when copying message text so display-only tags don't pollute the clipboard.
 */
export function stripWiseSpaceTags(content: string): string {
  return content
    .replace(/<think[^>]*>[\s\S]*?<\/think>\s*/g, '')
    .replace(new RegExp(`<knowledge-retrieval [^>]*${DISPLAY_ATTR_PATTERN}=["']1["'][^>]*>[\\s\\S]*?<\\/knowledge-retrieval>\\s*`, 'g'), '')
    .replace(new RegExp(`<memory-retrieval [^>]*${DISPLAY_ATTR_PATTERN}=["']1["'][^>]*>[\\s\\S]*?<\\/memory-retrieval>\\s*`, 'g'), '')
    .replace(new RegExp(`<web-search [^>]*${DISPLAY_ATTR_PATTERN}=["']1["'][^>]*>[\\s\\S]*?<\\/web-search>\\s*`, 'g'), '')
    .replace(new RegExp(`<tool-call [^>]*${DISPLAY_ATTR_PATTERN}=["']1["'][^>]*>[\\s\\S]*?<\\/tool-call>\\s*`, 'g'), '')
    .replace(/\n*:::mcp [^\n]*\n[\s\S]*?:::\n*/g, '\n')
    .trim();
}

const chatMarkdown = getMarkdown('wisespace-chat', {
  customHtmlTags: CHAT_CUSTOM_HTML_TAGS,
});

export function parseChatMarkdown(content: string): ChatMarkdownNode[] {
  return parseMarkdownToStructure(content, chatMarkdown, {
    customHtmlTags: [...CHAT_CUSTOM_HTML_TAGS],
  });
}
