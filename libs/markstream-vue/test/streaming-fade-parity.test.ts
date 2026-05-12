import { describe, expect, it } from 'vitest'
import { resolveStreamingTextState as resolveAngularStreamingTextState } from '../packages/markstream-angular/src/components/TextNode/streamingTextState'
import { resolveStreamingTextState, resolveStreamingTextUpdate } from '../packages/markstream-react/src/utils/streamingTextState'
import { resolveStreamingTextState as resolveVue2StreamingTextState } from '../packages/markstream-vue2/src/components/TextNode/streamingTextState'

describe('streaming fade parity', () => {
  it('replays appended-text fade in markstream-vue2 as a pure appended suffix', () => {
    expect(resolveVue2StreamingTextState({
      nextContent: 'Hello',
      previousContent: 'Hello',
      typewriterEnabled: true,
    })).toEqual({
      settledContent: 'Hello',
      streamedDelta: '',
      appended: false,
    })

    expect(resolveVue2StreamingTextState({
      nextContent: 'HelloWorld',
      previousContent: 'Hello',
      typewriterEnabled: true,
    })).toEqual({
      settledContent: 'Hello',
      streamedDelta: 'World',
      appended: true,
    })

    expect(resolveVue2StreamingTextState({
      nextContent: 'HelloWorldAgain',
      previousContent: 'HelloWorld',
      typewriterEnabled: true,
    })).toEqual({
      settledContent: 'HelloWorld',
      streamedDelta: 'Again',
      appended: true,
    })
  })

  it('replays appended-text fade in markstream-react as a pure appended suffix', () => {
    expect(resolveStreamingTextState({
      nextContent: 'Hello',
      previousContent: 'Hello',
      typewriterEnabled: true,
    })).toEqual({
      settledContent: 'Hello',
      streamedDelta: '',
      appended: false,
    })

    expect(resolveStreamingTextState({
      nextContent: 'HelloWorld',
      previousContent: 'Hello',
      typewriterEnabled: true,
    })).toEqual({
      settledContent: 'Hello',
      streamedDelta: 'World',
      appended: true,
    })

    expect(resolveStreamingTextState({
      nextContent: 'HelloWorldAgain',
      previousContent: 'HelloWorld',
      typewriterEnabled: true,
    })).toEqual({
      settledContent: 'HelloWorld',
      streamedDelta: 'Again',
      appended: true,
    })

    expect(resolveStreamingTextUpdate({
      nextContent: 'HelloWorld',
      persistedContent: 'Hello',
      currentState: {
        settledContent: 'Hello',
        streamedDelta: '',
      },
      typewriterEnabled: true,
    })).toEqual({
      settledContent: 'Hello',
      streamedDelta: 'World',
      appended: true,
    })

    expect(resolveStreamingTextUpdate({
      nextContent: 'HelloWorld',
      persistedContent: 'HelloWorld',
      currentState: {
        settledContent: 'Hello',
        streamedDelta: 'World',
      },
      typewriterEnabled: true,
    })).toEqual({
      settledContent: 'Hello',
      streamedDelta: 'World',
      appended: false,
    })

    expect(resolveStreamingTextUpdate({
      nextContent: 'HelloWorld',
      persistedContent: 'HelloWorld',
      currentState: {
        settledContent: 'Hello',
        streamedDelta: 'World',
      },
      typewriterEnabled: true,
      streamRenderVersionChanged: true,
    })).toEqual({
      settledContent: 'HelloWorld',
      streamedDelta: '',
      appended: false,
    })

    expect(resolveStreamingTextUpdate({
      nextContent: 'HelloWorldAgain',
      persistedContent: 'HelloWorld',
      currentState: {
        settledContent: 'Hello',
        streamedDelta: 'World',
      },
      typewriterEnabled: true,
    })).toEqual({
      settledContent: 'HelloWorld',
      streamedDelta: 'Again',
      appended: true,
    })
  })

  it('replays appended-text fade in markstream-angular as a pure appended suffix', () => {
    expect(resolveAngularStreamingTextState({
      nextContent: 'Hello',
      previousContent: 'Hello',
      typewriterEnabled: true,
    })).toEqual({
      settledContent: 'Hello',
      streamedDelta: '',
      appended: false,
    })

    expect(resolveAngularStreamingTextState({
      nextContent: 'HelloWorld',
      previousContent: 'Hello',
      typewriterEnabled: true,
    })).toEqual({
      settledContent: 'Hello',
      streamedDelta: 'World',
      appended: true,
    })

    expect(resolveAngularStreamingTextState({
      nextContent: 'HelloWorldAgain',
      previousContent: 'HelloWorld',
      typewriterEnabled: true,
    })).toEqual({
      settledContent: 'HelloWorld',
      streamedDelta: 'Again',
      appended: true,
    })
  })
})
