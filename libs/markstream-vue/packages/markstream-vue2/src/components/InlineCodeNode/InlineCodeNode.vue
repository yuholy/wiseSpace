<script setup lang="ts">
import { computed, getCurrentInstance, inject, ref, watch } from 'vue-demi'
import { resolveStreamingTextState } from '../TextNode/streamingTextState'

const props = defineProps<{
  node: {
    type: 'inline_code'
    code: string
    raw: string
  }
}>()

const instance = getCurrentInstance()
const attrs = computed<Record<string, unknown>>(() => ((instance?.proxy as any)?.$attrs ?? {}) as Record<string, unknown>)
const inheritedTypewriter = inject<{ value?: boolean } | undefined>('markstreamTypewriter', undefined)
const inheritedTextStreamState = inject<Map<string, string> | undefined>('markstreamTextStreamState', undefined)
const explicitTypewriter = computed<boolean | undefined>(() => {
  const raw = attrs.value.typewriter
  if (raw === '' || raw === true || raw === 'true')
    return true
  if (raw === false || raw === 'false')
    return false
  return undefined
})
const typewriterEnabled = computed(() => {
  if (typeof explicitTypewriter.value === 'boolean')
    return explicitTypewriter.value
  if (typeof inheritedTypewriter?.value === 'boolean')
    return inheritedTypewriter.value
  return true
})
const streamStateKey = computed(() => {
  const raw = attrs.value['index-key'] ?? attrs.value.indexKey
  if (raw == null || raw === '')
    return ''
  return String(raw)
})
const settledCode = ref(props.node.code)
const streamedDelta = ref('')
const streamFadeVersion = ref(0)

function getRenderedContent() {
  return settledCode.value + streamedDelta.value
}

function setFullContent(next: string) {
  settledCode.value = next
  streamedDelta.value = ''
}

function settleStreamedDelta() {
  if (!streamedDelta.value)
    return
  settledCode.value = getRenderedContent()
  streamedDelta.value = ''
}

watch(
  [() => props.node.code, streamStateKey, typewriterEnabled],
  ([next]) => {
    const normalized = String(next ?? '')
    const rendered = getRenderedContent()
    const key = streamStateKey.value
    const previousPersisted = key
      ? inheritedTextStreamState?.get(key)
      : undefined
    const previousContent = previousPersisted ?? rendered

    const nextState = resolveStreamingTextState({
      nextContent: normalized,
      previousContent,
      typewriterEnabled: typewriterEnabled.value,
    })

    settledCode.value = nextState.settledContent
    streamedDelta.value = nextState.streamedDelta
    if (nextState.appended)
      streamFadeVersion.value += 1
    if (key)
      inheritedTextStreamState?.set(key, normalized)
  },
  { immediate: true },
)

watch(
  typewriterEnabled,
  (enabled) => {
    if (enabled)
      return
    setFullContent(getRenderedContent())
  },
)

const streamedDeltaClass = computed(() => (
  streamFadeVersion.value % 2 === 0
    ? 'inline-code-stream-delta--a'
    : 'inline-code-stream-delta--b'
))
</script>

<template>
  <code
    class="inline text-[85%] px-1 py-0.5 rounded font-mono bg-[hsl(var(--secondary))] whitespace-normal break-words max-w-full before:content-[''] after:content-['']"
  >
    <span v-if="settledCode">{{ settledCode }}</span>
    <span
      v-if="streamedDelta"
      class="inline-code-stream-delta" :class="[streamedDeltaClass]"
      @animationend="settleStreamedDelta"
    >
      {{ streamedDelta }}
    </span>
  </code>
</template>

<style scoped>
.inline-code-stream-delta {
  animation-duration: var(--stream-update-fade-duration, var(--typewriter-fade-duration, 900ms));
  animation-timing-function: var(--stream-update-fade-ease, var(--typewriter-fade-ease, ease-out));
  animation-fill-mode: both;
  will-change: opacity;
}
.inline-code-stream-delta--a {
  animation-name: inline-code-stream-update-fade-a;
}
.inline-code-stream-delta--b {
  animation-name: inline-code-stream-update-fade-b;
}

@keyframes inline-code-stream-update-fade-a {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes inline-code-stream-update-fade-b {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .inline-code-stream-delta {
    animation: none !important;
  }
}
</style>
