<script setup lang="ts">
import { computed, inject, ref, useAttrs, watch } from 'vue'
import { useKatexReady } from '../../composables/useKatexReady'

const props = defineProps<{
  node: {
    type: 'text'
    content: string
    raw: string
    center?: boolean
  }
}>()
defineEmits(['copy'])
const katexReady = useKatexReady()
const attrs = useAttrs()
const inheritedTypewriter = inject<{ value?: boolean } | undefined>('markstreamTypewriter', undefined)
const inheritedTextStreamState = inject<Map<string, string> | undefined>('markstreamTextStreamState', undefined)
const inheritedStreamVersion = inject<{ value?: number } | undefined>('markstreamStreamVersion', undefined)
const explicitTypewriter = computed<boolean | undefined>(() => {
  const raw = attrs.typewriter
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
  const raw = attrs['index-key'] ?? attrs.indexKey
  if (raw == null || raw === '')
    return ''
  return String(raw)
})
const settledContent = ref(props.node.content)
const streamedDelta = ref('')
const streamFadeVersion = ref(0)

function getRenderedContent() {
  return settledContent.value + streamedDelta.value
}

function setFullContent(next: string) {
  settledContent.value = next
  streamedDelta.value = ''
}

function settleStreamedDelta() {
  if (!streamedDelta.value)
    return
  settledContent.value = getRenderedContent()
  streamedDelta.value = ''
}

watch(
  [() => props.node.content, streamStateKey, typewriterEnabled, () => inheritedStreamVersion?.value],
  ([next]) => {
    const normalized = String(next ?? '')
    const rendered = getRenderedContent()
    const key = streamStateKey.value
    const previousPersisted = key
      ? inheritedTextStreamState?.get(key)
      : undefined
    const previousContent = previousPersisted ?? rendered

    if (!typewriterEnabled.value) {
      setFullContent(normalized)
      if (key)
        inheritedTextStreamState?.set(key, normalized)
      return
    }

    if (normalized === previousContent) {
      if (streamedDelta.value)
        settleStreamedDelta()
      else if (rendered !== normalized)
        setFullContent(normalized)
      if (key)
        inheritedTextStreamState?.set(key, normalized)
      return
    }

    if (previousContent && normalized.startsWith(previousContent) && normalized.length > previousContent.length) {
      settledContent.value = previousContent
      streamedDelta.value = normalized.slice(previousContent.length)
      streamFadeVersion.value += 1
      if (key)
        inheritedTextStreamState?.set(key, normalized)
      return
    }

    setFullContent(normalized)
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
    ? 'text-node-stream-delta--a'
    : 'text-node-stream-delta--b'
))
</script>

<template>
  <span
    :class="[katexReady && node.center ? 'text-node-center' : '']"
    class="whitespace-pre-wrap break-words text-node"
  >
    <span v-if="settledContent">{{ settledContent }}</span>
    <span
      v-if="streamedDelta"
      class="text-node-stream-delta" :class="[streamedDeltaClass]"
      @animationend="settleStreamedDelta"
    >
      {{ streamedDelta }}
    </span>
  </span>
</template>

<style scoped>
.text-node {
  display: inline;
  font-weight: inherit;
  vertical-align: baseline;
}
.text-node-center {
  display: inline-flex;
  justify-content: center;
  width: 100%;
}
.text-node-stream-delta {
  animation-duration: var(--stream-update-fade-duration, var(--typewriter-fade-duration, 900ms));
  animation-timing-function: var(--stream-update-fade-ease, var(--typewriter-fade-ease, ease-out));
  animation-fill-mode: both;
  will-change: opacity;
}
.text-node-stream-delta--a {
  animation-name: text-node-stream-update-fade-a;
}
.text-node-stream-delta--b {
  animation-name: text-node-stream-update-fade-b;
}

@keyframes text-node-stream-update-fade-a {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes text-node-stream-update-fade-b {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .text-node-stream-delta {
    animation: none !important;
  }
}
</style>
