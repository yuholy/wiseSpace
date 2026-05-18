import type { Message } from '@/types';

const THINK_OPEN_RE = /<think\b[^>]*>/gi;
const THINK_CLOSE_RE = /<\/think>/gi;
const COMPLETE_THINK_BLOCK_RE = /<think\b[^>]*>[\s\S]*?<\/think>/gi;

function closeDanglingThinkBlocks(content: string): string {
  const openCount = content.match(THINK_OPEN_RE)?.length ?? 0;
  const closeCount = content.match(THINK_CLOSE_RE)?.length ?? 0;
  if (openCount <= closeCount) {
    return content;
  }

  return `${content}${'\n</think>'.repeat(openCount - closeCount)}`;
}

function collapseCompletedThinkBlocks(content: string): string {
  const matches = Array.from(content.matchAll(COMPLETE_THINK_BLOCK_RE));
  if (matches.length <= 1) {
    return content;
  }

  const keepIndex = matches.length - 1;
  let cursor = 0;
  let nextContent = '';

  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    nextContent += content.slice(cursor, start);
    if (index === keepIndex) {
      nextContent += match[0];
    }
    cursor = end;
  });

  nextContent += content.slice(cursor);
  return nextContent.replace(/\n{3,}/g, '\n\n').trim();
}

export function buildAssistantDisplayContent(message: Message, _messages: Message[]): string {
  if (message.role !== 'assistant') {
    return message.content;
  }

  let content = message.content;
  if (!content.includes('<think')) {
    return content;
  }

  content = closeDanglingThinkBlocks(content);
  if (message.status === 'complete') {
    content = collapseCompletedThinkBlocks(content);
  }

  return content;
}

export function shouldHideAssistantBubble(message: Message, displayContent: string): boolean {
  if (message.role !== 'assistant') {
    return false;
  }

  if (displayContent.trim()) {
    return false;
  }

  return !message.content.trim() && Boolean(message.tool_calls_json);
}
