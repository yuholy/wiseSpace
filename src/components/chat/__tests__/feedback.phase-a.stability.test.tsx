import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function readSource(...segments: string[]) {
  return fs.readFileSync(path.resolve(process.cwd(), ...segments), 'utf8');
}

describe('Phase A feedback regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps chat scroll handling aligned with the shared Bubble.List scroll mode', () => {
    const chatViewSource = readSource('src/components/chat/ChatView.tsx');
    const chatScrollSource = readSource('src/components/chat/chatScroll.ts');

    expect(chatScrollSource).toContain('CHAT_SCROLL_IS_REVERSED = false');
    expect(chatViewSource).toContain('CHAT_SCROLL_IS_REVERSED');
    expect(chatViewSource).not.toContain('shouldShowScrollToBottom(\n      target.scrollHeight,\n      target.scrollTop,\n      target.clientHeight,\n      false,');
    expect(chatViewSource).not.toContain('shouldKeepAutoScroll(\n      target.scrollHeight,\n      target.scrollTop,\n      target.clientHeight,\n      false,');
    expect(chatViewSource).not.toContain('getDistanceToHistoryTop(\n      target.scrollHeight,\n      target.scrollTop,\n      target.clientHeight,\n      false,');
  });

  it('gives the chat textarea a dedicated visible-scrollbar hook instead of relying on globally hidden scrollbars', () => {
    const inputAreaSource = readSource('src/components/chat/InputArea.tsx');
    const cssSource = readSource('src/index.css');

    expect(inputAreaSource).toContain('className="wisespace-input-textarea"');
    expect(cssSource).toContain('.wisespace-input-textarea');
    expect(cssSource).toMatch(/\.wisespace-input-textarea[\s\S]*scrollbar-width:\s*thin/i);
  });

  it('keeps a null conversation max tokens override visually off instead of hydrating it from the global default', () => {
    const modalSource = readSource('src/components/chat/ConversationSettingsModal.tsx');

    expect(modalSource).toContain('setMaxTokens(conversation.max_tokens ?? null)');
    expect(modalSource).not.toContain('setMaxTokens(conversation.max_tokens ?? settings.default_max_tokens ?? 4096)');
  });

  it('treats max tokens clearing as an explicit nullable contract from modal to TypeScript types to Rust persistence', () => {
    const modalSource = readSource('src/components/chat/ConversationSettingsModal.tsx');
    const typeSource = readSource('src/types/index.ts');
    const rustTypeSource = readSource('src-tauri/crates/core/src/types.rs');
    const repoSource = readSource('src-tauri/crates/core/src/repo/conversation.rs');

    expect(modalSource).toContain('max_tokens: maxTokens,');
    expect(typeSource).toMatch(/max_tokens\?: number \| null;/);
    expect(rustTypeSource).toMatch(/deserialize_double_option"\)\]\s*pub max_tokens: Option<Option<i64>>/);
    expect(repoSource).toContain('if let Some(max_tokens) = input.max_tokens {');
    expect(repoSource).toContain('am.max_tokens = Set(max_tokens);');
  });

  it('reuses cached heavy assistant renders so revisiting a conversation does not flash between preview and full content', () => {
    const chatViewSource = readSource('src/components/chat/ChatView.tsx');

    expect(chatViewSource).toContain('const renderedHeavyContentCacheKeys = new Set<string>()');
    expect(chatViewSource).toContain('deferredRenderCacheKey');
    expect(chatViewSource).toContain('renderedHeavyContentCacheKeys.has(deferredRenderCacheKey)');
    expect(chatViewSource).toContain('renderedHeavyContentCacheKeys.add(deferredRenderCacheKey)');
  });

  it('does not treat inline tool-call traces as deferred heavy content during conversation switches', () => {
    const chatViewSource = readSource('src/components/chat/ChatView.tsx');

    expect(chatViewSource).not.toContain("if (content.includes('<tool-call')) return false;");
    expect(chatViewSource).not.toContain("|| content.includes('<tool-call')");
  });

  it('keeps the latest agent reply non-actionable while its run is still active after switching conversations', () => {
    const chatViewSource = readSource('src/components/chat/ChatView.tsx');

    expect(chatViewSource).toContain('const ACTIVE_AGENT_FOOTER_BLOCKING_STATUSES = new Set([');
    expect(chatViewSource).toContain('const latestAssistantMessageId = useMemo(() => {');
    expect(chatViewSource).toContain('const shouldBlockActiveAgentFooter = Boolean(');
    expect(chatViewSource).toContain("msg.id === latestAssistantMessageId");
    expect(chatViewSource).toContain('ACTIVE_AGENT_FOOTER_BLOCKING_STATUSES.has(activeAgentRunStatus)');
    expect(chatViewSource).toContain('const canShowAssistantFooter = Boolean(');
  });

  it('keeps streamed think content visible in lightweight agent rendering instead of stripping it until completion', () => {
    const chatViewSource = readSource('src/components/chat/ChatView.tsx');

    expect(chatViewSource).toContain('function getLightweightStreamingPreview(content: string): string {');
    expect(chatViewSource).toContain(".replace(/<think[^>]*>/g, '')");
    expect(chatViewSource).toContain(".replace(/<\\/think>\\s*/g, '\\n')");
    expect(chatViewSource).toContain('return getLightweightStreamingPreview(joinedContent);');
  });
});
