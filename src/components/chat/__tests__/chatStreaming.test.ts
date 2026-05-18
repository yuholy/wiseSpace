import { describe, expect, it } from 'vitest';
import {
  getStreamingLoadingState,
  hasWiseSpaceDisplayContent,
  hasModelVisibleContent,
  shouldRenderAssistantMarkdownFromContent,
  splitLeadingWiseSpaceDisplayContent,
  stripLeadingWiseSpaceDisplayTags,
} from '../chatStreaming';

describe('chat streaming helpers', () => {
  it('derives bubble and footer loading state from stream progress and content presence', () => {
    expect(getStreamingLoadingState(true, '')).toEqual({
      bubbleLoading: true,
      footerLoading: false,
    });

    expect(getStreamingLoadingState(true, 'hello')).toEqual({
      bubbleLoading: false,
      footerLoading: true,
    });

    expect(getStreamingLoadingState(false, 'hello')).toEqual({
      bubbleLoading: false,
      footerLoading: false,
    });
  });

  it('keeps streamed assistant messages on the content renderer after completion', () => {
    expect(shouldRenderAssistantMarkdownFromContent(true, false)).toBe(true);
    expect(shouldRenderAssistantMarkdownFromContent(false, true)).toBe(true);
    expect(shouldRenderAssistantMarkdownFromContent(false, false)).toBe(false);
  });

  it('ignores display-only tags when deciding whether model text exists', () => {
    const stripDisplayTags = (content: string) => content
      .replace(/<knowledge-retrieval [^>]*data-wisespace="1"[^>]*>[\s\S]*?<\/knowledge-retrieval>\s*/g, '')
      .replace(/<vision-fallback [^>]*data-wisespace="1"[^>]*>[\s\S]*?<\/vision-fallback>\s*/g, '')
      .replace(/<think[^>]*>[\s\S]*?<\/think>\s*/g, '')
      .trim();

    expect(hasModelVisibleContent(
      '<knowledge-retrieval status="done" data-wisespace="1">[]</knowledge-retrieval>',
      stripDisplayTags,
    )).toBe(false);
    expect(hasModelVisibleContent(
      '<knowledge-retrieval status="done" data-wisespace="1">[]</knowledge-retrieval>\n\nanswer',
      stripDisplayTags,
    )).toBe(true);
  });

  it('detects wiseSpace display tags independently from model text', () => {
    expect(hasWiseSpaceDisplayContent(
      '<knowledge-retrieval status="done" data-wisespace="1">[]</knowledge-retrieval>',
    )).toBe(true);
    expect(hasWiseSpaceDisplayContent(
      '<vision-fallback data-wisespace="1" provider="Vision" model="MiniMax-VL-01"></vision-fallback>',
    )).toBe(true);
    expect(hasWiseSpaceDisplayContent('answer')).toBe(false);
  });

  it('splits leading wiseSpace display tags from streamed model text', () => {
    const knowledge = '<knowledge-retrieval status="done" data-wisespace="1">[]</knowledge-retrieval>\n\n';
    const memory = '<memory-retrieval status="done" data-wisespace="1">[]</memory-retrieval>\n\n';

    expect(splitLeadingWiseSpaceDisplayContent(`${knowledge}${memory}answer`)).toEqual({
      prefix: `${knowledge}${memory}`,
      body: 'answer',
    });
    expect(splitLeadingWiseSpaceDisplayContent(`answer\n${knowledge}`)).toEqual({
      prefix: '',
      body: `answer\n${knowledge}`,
    });
  });

  it('strips selected leading display tags while preserving other display prefixes', () => {
    const web = '<web-search status="done" data-wisespace="1">[]</web-search>\n\n';
    const knowledge = '<knowledge-retrieval status="done" data-wisespace="1">[]</knowledge-retrieval>\n\n';
    const vision = '<vision-fallback data-wisespace="1" model="MiniMax-VL-01"></vision-fallback>\n\n';

    expect(stripLeadingWiseSpaceDisplayTags(
      `${vision}${web}${knowledge}answer`,
      ['knowledge-retrieval', 'memory-retrieval', 'vision-fallback'],
    )).toBe(`${web}answer`);
  });
});
