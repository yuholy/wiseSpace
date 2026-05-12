<script>
import { NestedRenderer } from 'markstream-vue2'

export default {
  name: 'ThinkingNode',
  components: {
    NestedRenderer,
  },
  props: {
    node: {
      type: Object,
      required: true,
    },
  },
}
</script>

<template>
  <div class="thinking-node">
    <div class="thinking-node__icon-wrap">
      <div class="thinking-node__icon">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 3C7.03 3 3 6.58 3 11c0 1.86.66 3.57 1.77 4.98L4 21l5.2-1.9C10.06 19.35 11 19.5 12 19.5c4.97 0 9-3.58 9-8.5S16.97 3 12 3z" stroke="currentColor" stroke-width="0.8" fill="currentColor" opacity="0.9" />
        </svg>
      </div>
    </div>
    <div class="thinking-node__body">
      <div class="thinking-node__header">
        <strong class="thinking-node__title">Thinking</strong>
        <span class="thinking-node__meta">(assistant)</span>
        <span class="thinking-node__status" aria-hidden="true">
          <span class="thinking-dots" :class="[node.loading ? 'visible' : 'hidden']" aria-hidden="true">
            <span class="dot dot-1" />
            <span class="dot dot-2" />
            <span class="dot dot-3" />
          </span>
        </span>
      </div>
      <div class="thinking-node__content">
        <span v-if="node.loading" class="thinking-node__sr-only" aria-live="polite">Thinking…</span>
        <transition name="fade" mode="out-in">
          <div :key="node.loading ? 'loading' : 'ready'" class="content-area">
            <NestedRenderer
              :node="node"
              custom-id="vue2-demo"
              :custom-html-tags="['thinking']"
              :typewriter="false"
              :batch-rendering="false"
              :viewport-priority="false"
              :defer-nodes-until-visible="false"
            />
          </div>
        </transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.thinking-node {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin: 1rem 0;
  padding: 1rem;
  border-left: 4px solid #60a5fa;
  border-radius: 0.375rem;
  background: #eff6ff;
  color: #0f172a;
}

.thinking-node__icon-wrap {
  flex-shrink: 0;
  margin-top: 0.25rem;
}

.thinking-node__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 9999px;
  background: #bfdbfe;
  color: #1d4ed8;
}

.thinking-node__icon svg {
  width: 1.25rem;
  height: 1.25rem;
}

.thinking-node__body {
  flex: 1 1 auto;
  min-width: 0;
}

.thinking-node__header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.thinking-node__title {
  font-size: 0.875rem;
}

.thinking-node__meta {
  font-size: 0.75rem;
  color: #64748b;
}

.thinking-node__status {
  margin-left: 0.5rem;
}

.thinking-node__content {
  margin-top: 0.25rem;
  font-size: 0.875rem;
  line-height: 1.7;
  color: #1e293b;
}

.thinking-node__sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.thinking-dots {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 36px;
  justify-content: flex-start;
  height: 12px;
  transition: opacity 160ms linear, transform 160ms linear;
  opacity: 0;
}
.thinking-dots .dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #1e3a8a;
  opacity: 0.25;
  transform: translateY(0);
}
.thinking-dots.visible { opacity: 1; }
.thinking-dots.hidden { opacity: 0; transform: translateY(0); }
.thinking-dots.visible .dot-1 { animation: think-bounce 1s infinite ease-in-out; animation-delay: 0s }
.thinking-dots.visible .dot-2 { animation: think-bounce 1s infinite ease-in-out; animation-delay: 0.12s }
.thinking-dots.visible .dot-3 { animation: think-bounce 1s infinite ease-in-out; animation-delay: 0.24s }
.dark .thinking-dots .dot { background: #bfdbfe; opacity: 0.28 }

@keyframes think-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.25 }
  40% { transform: translateY(-6px); opacity: 1 }
}

.content-area { min-height: 1.25rem; }
.fade-enter-from, .fade-leave-to { opacity: 0 }
.fade-enter-active, .fade-leave-active { transition: opacity 160ms ease }
.fade-enter-to, .fade-leave-from { opacity: 1 }

@media (prefers-color-scheme: dark) {
  .thinking-node {
    background: rgba(30, 64, 175, 0.18);
    color: #e6f0ff;
  }

  .thinking-node__icon {
    background: #1d4ed8;
    color: #dbeafe;
  }

  .thinking-node__meta,
  .thinking-node__content {
    color: #dbeafe;
  }

  .dark .thinking-dots .dot,
  .thinking-node .thinking-dots .dot {
    background: #bfdbfe;
    opacity: 0.28;
  }
}
</style>
