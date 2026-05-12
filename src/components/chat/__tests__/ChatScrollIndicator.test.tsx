import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatScrollIndicator } from '../ChatScrollIndicator';

function createScrollableBubbleList() {
  const scrollBox = document.createElement('div');
  scrollBox.className = 'ant-bubble-list-scroll-box';
  scrollBox.style.flexDirection = 'column-reverse';

  let scrollTop = 0;
  Object.defineProperties(scrollBox, {
    clientHeight: { configurable: true, value: 800 },
    scrollHeight: { configurable: true, value: 2000 },
    scrollTop: {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => {
        scrollTop = value;
        scrollBox.dispatchEvent(new Event('scroll'));
      },
    },
  });

  document.body.appendChild(scrollBox);
  return scrollBox;
}

describe('ChatScrollIndicator', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('reports user scroll intent before dragging the custom scrollbar thumb', async () => {
    createScrollableBubbleList();
    const onUserScrollIntent = vi.fn();

    render(<ChatScrollIndicator onUserScrollIntent={onUserScrollIntent} />);

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    await waitFor(() => {
      expect(document.querySelector('.chat-scroll-indicator')).toBeInTheDocument();
    });

    const thumb = document.querySelector('.chat-scroll-indicator') as HTMLElement;
    fireEvent.pointerDown(thumb, { clientY: 10 });

    expect(onUserScrollIntent).toHaveBeenCalledTimes(1);
  });

  it('reports user scroll intent before jumping from the custom scrollbar track', async () => {
    createScrollableBubbleList();
    const onUserScrollIntent = vi.fn();

    render(<ChatScrollIndicator onUserScrollIntent={onUserScrollIntent} />);

    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    await waitFor(() => {
      expect(document.querySelector('.chat-scroll-indicator-track')).toBeInTheDocument();
    });

    const track = document.querySelector('.chat-scroll-indicator-track') as HTMLElement;
    fireEvent.pointerDown(track, { clientY: 400 });

    expect(onUserScrollIntent).toHaveBeenCalledTimes(1);
  });
});
