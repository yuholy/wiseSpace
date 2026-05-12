<script setup lang="ts">
// 定义图片节点类型
import type { ImageNodeProps } from '../../types/component-props'
import { computed, ref, watch } from 'vue'
import { useSafeI18n } from '../../composables/useSafeI18n'

// 接收 props：node 是必须，其他为可选配置（fallback、是否启用 lazy）
const props = withDefaults(defineProps<ImageNodeProps>(), {
  fallbackSrc: '',
  lazy: false,
  usePlaceholder: true,
})

// 事件：load / error / click（click 用于外部处理图片预览）
const emit = defineEmits<{ (e: 'load', src: string): void, (e: 'error', src: string): void, (e: 'click', payload: [Event, string]): void }>()

// 图片加载状态
const imageLoaded = ref(false)
const hasError = ref(false)
const fallbackTried = ref(false)

// 计算当前用于渲染的 src（当有 error 且提供 fallback 时使用 fallback）
const displaySrc = computed(() => hasError.value && props.fallbackSrc ? props.fallbackSrc : props.node.src)
const useEagerImagePath = computed(() => !props.lazy)

// 处理图片加载错误：尝试一次 fallback，否则保留错误状态
function handleImageError() {
  if (props.fallbackSrc && !fallbackTried.value) {
    fallbackTried.value = true
    hasError.value = true
  }
  else {
    hasError.value = true
    emit('error', props.node.src)
  }
}

// 处理图片加载完成
function handleImageLoad() {
  imageLoaded.value = true
  hasError.value = false
  emit('load', displaySrc.value)
}

// 当用户点击/触摸图片时（仅对已成功加载的图片有效），向外发出 click 事件（用于图片 preview）
function handleClick(e: Event) {
  e.preventDefault()
  if (!imageLoaded.value || hasError.value)
    return
  emit('click', [e, displaySrc.value])
}

const { t } = useSafeI18n()

// When the src changes (displaySrc), reset imageLoaded so the new image can fade in
watch(displaySrc, () => {
  imageLoaded.value = false
  hasError.value = false
})
</script>

<template>
  <span class="image-node-container">
    <transition name="img-switch" mode="out-in">
      <!-- Loaded image -->
      <img
        v-if="!node.loading && !hasError"
        key="image"
        :src="displaySrc"
        :alt="String(props.node.alt ?? props.node.title ?? '')"
        :title="String(props.node.title ?? props.node.alt ?? '')"
        class="image-node__img"
        :class="{
          'is-loading': !useEagerImagePath && !imageLoaded,
          'is-loaded': useEagerImagePath || imageLoaded,
          'cursor-pointer': imageLoaded,
        }"
        :loading="props.lazy ? 'lazy' : undefined"
        :fetchpriority="useEagerImagePath ? 'high' : undefined"
        :decoding="useEagerImagePath ? 'sync' : 'async'"
        :tabindex="imageLoaded ? 0 : -1"
        :aria-label="props.node.alt ?? t('image.preview')"
        @error="handleImageError"
        @load="handleImageLoad"
        @click="handleClick"
      >

      <!-- Loading placeholder — shimmer skeleton -->
      <span
        v-else-if="!hasError"
        key="placeholder"
        class="image-placeholder"
      >
        <template v-if="props.usePlaceholder">
          <slot name="placeholder" :node="props.node" :display-src="displaySrc" :image-loaded="imageLoaded" :has-error="hasError" :fallback-src="props.fallbackSrc" :lazy="props.lazy">
            <span class="image-shimmer" />
          </slot>
        </template>
        <template v-else>
          <span class="image-node__raw-text">{{ node.raw }}</span>
        </template>
      </span>

      <!-- Error state -->
      <span v-else-if="!node.loading && !props.fallbackSrc" key="error" class="image-error">
        <slot name="error" :node="props.node" :display-src="displaySrc" :image-loaded="imageLoaded" :has-error="hasError" :fallback-src="props.fallbackSrc" :lazy="props.lazy">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M2 2h20v10h-2V4H4v9.586l5-5L14.414 14L13 15.414l-4-4l-5 5V20h8v2H2zm13.547 5a1 1 0 1 0 0 2a1 1 0 0 0 0-2m-3 1a3 3 0 1 1 6 0a3 3 0 0 1-6 0m3.625 6.757L19 17.586l2.828-2.829l1.415 1.415L20.414 19l2.829 2.828l-1.415 1.415L19 20.414l-2.828 2.829l-1.415-1.415L17.586 19l-2.829-2.828z" /></svg>
          <span>{{ t('image.loadError') }}</span>
        </slot>
      </span>
    </transition>
  </span>
</template>

<style scoped>
/* ── Container ── */
.image-node-container {
  display: inline-block;
  vertical-align: middle;
  max-width: var(--ms-size-image-max-width);
}

/* ── Image ── */
.image-node__img {
  display: inline-block;
  max-width: 100%;
  height: auto;
  vertical-align: middle;
  transition: opacity var(--ms-duration-emphasis) var(--ms-ease-standard);
}

.image-node__img.is-loading {
  opacity: 0;
}

.image-node__img.is-loaded {
  opacity: 1;
}

/* ── Placeholder — shimmer skeleton ── */
.image-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 8rem;
  max-width: var(--ms-size-image-max-width);
  background: hsl(var(--ms-muted));
  overflow: hidden;
  vertical-align: middle;
}

.image-shimmer {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 8rem;
  background: linear-gradient(
    90deg,
    hsl(var(--ms-muted)) 0%,
    hsl(var(--ms-muted-foreground) / 0.06) 50%,
    hsl(var(--ms-muted)) 100%
  );
  background-size: 200% 100%;
  animation: image-shimmer 1.5s ease-in-out infinite;
}

@keyframes image-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

/* ── Error ── */
.image-error {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  min-height: 4rem;
  max-width: var(--ms-size-image-max-width);
  background: hsl(var(--ms-muted));
  color: hsl(var(--ms-muted-foreground));
  font-size: var(--ms-text-label);
  vertical-align: middle;
}

/* ── Raw text fallback ── */
.image-node__raw-text {
  font-size: var(--ms-text-label);
  color: hsl(var(--ms-muted-foreground));
}

/* ── Transition ── */
.img-switch-enter-active, .img-switch-leave-active {
  transition: opacity var(--ms-duration-emphasis) var(--ms-ease-standard),
              transform var(--ms-duration-emphasis) var(--ms-ease-standard);
}
.img-switch-enter-from, .img-switch-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
.img-switch-enter-to, .img-switch-leave-from {
  opacity: 1;
  transform: translateY(0);
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .image-shimmer { animation: none !important; }
  .img-switch-enter-active, .img-switch-leave-active { transition: none !important; }
}
</style>
