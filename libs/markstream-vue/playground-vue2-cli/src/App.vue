<script>
/* global __MARKSTREAM_VUE2_CLI_DEMO_MD__ */

import MarkdownRender, { setCustomComponents } from 'markstream-vue2'
import ThinkingNode from './components/ThinkingNode.vue'

const markdownSource = typeof __MARKSTREAM_VUE2_CLI_DEMO_MD__ === 'string'
  ? __MARKSTREAM_VUE2_CLI_DEMO_MD__
  : String(__MARKSTREAM_VUE2_CLI_DEMO_MD__ || '')
const customHtmlTags = Object.freeze(['thinking'])
const codeBlockProps = Object.freeze({ isDark: true })
const probeMode = typeof window !== 'undefined'
  && typeof window.location !== 'undefined'
  && /(?:^|[?&])probe=1(?:&|$)/.test(window.location.search)

setCustomComponents('vue2-demo', { thinking: ThinkingNode })

export default {
  name: 'Vue2CliPlayground',
  components: {
    MarkdownRender,
  },
  data() {
    return {
      content: '',
      delay: 24,
      chunkSize: 2,
      timer: null,
      running: true,
      customHtmlTags,
      codeBlockProps,
    }
  },
  computed: {
    totalLength() {
      return markdownSource.length
    },
    progress() {
      if (!this.totalLength)
        return 0
      return Math.min(100, Math.round((this.content.length / this.totalLength) * 100))
    },
    normalizedChunkSize() {
      const n = Math.floor(Number(this.chunkSize) || 1)
      return Math.max(1, n)
    },
    isDone() {
      return this.content.length >= this.totalLength
    },
  },
  watch: {
    delay() {
      if (this.running)
        this.restartStream()
    },
  },
  mounted() {
    if (!probeMode)
      this.startStream()
  },
  beforeUnmount() {
    this.stopStream()
  },
  methods: {
    scheduleNextTick(previousElapsed = 0) {
      if (!this.running || this.isDone)
        return

      if (this.timer != null)
        window.clearTimeout(this.timer)

      const wait = Math.max(
        0,
        Math.max(Number(this.delay) || 0, Math.ceil(Number(previousElapsed) || 0)),
      )
      this.timer = window.setTimeout(() => {
        this.timer = null
        this.tick()
      }, wait)
    },
    tick() {
      if (!this.running)
        return

      if (this.isDone) {
        this.stopStream()
        return
      }

      const start = this.content.length
      const nextChunk = markdownSource.slice(start, start + this.normalizedChunkSize)
      const tickStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
      this.content += nextChunk

      this.$nextTick(() => {
        const schedule = () => {
          if (!this.running)
            return
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
          this.scheduleNextTick(now - tickStartedAt)
        }
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
          window.requestAnimationFrame(() => schedule())
        else
          schedule()
      })
    },
    startStream() {
      this.stopStream()
      this.running = true
      this.scheduleNextTick()
    },
    stopStream() {
      if (this.timer != null) {
        window.clearTimeout(this.timer)
        this.timer = null
      }
      this.running = false
    },
    toggleStream() {
      if (this.running)
        this.stopStream()
      else
        this.startStream()
    },
    restartStream() {
      if (!this.running)
        return
      this.startStream()
    },
    resetStream() {
      this.content = ''
      this.startStream()
    },
    fillAll() {
      this.content = markdownSource
      this.stopStream()
    },
  },
}
</script>

<template>
  <div class="page">
    <header class="header">
      <div class="title">
        markstream-vue2 playground
      </div>
      <div class="sub">
        Vue CLI 4 demo: streaming markdown into the renderer with CDN workers
      </div>
    </header>

    <div class="layout">
      <section class="panel controls">
        <h2>Stream controls</h2>
        <div class="field">
          <label for="delay">Delay (ms)</label>
          <input id="delay" v-model.number="delay" type="number" min="4" max="200">
        </div>
        <div class="field">
          <label for="chunk">Chunk size</label>
          <input id="chunk" v-model.number="chunkSize" type="number" min="1" max="16">
        </div>
        <div class="actions">
          <button type="button" class="btn" @click="toggleStream">
            {{ running ? 'Pause' : 'Resume' }}
          </button>
          <button type="button" class="btn" @click="resetStream">
            Reset
          </button>
          <button type="button" class="btn ghost" @click="fillAll">
            Render all
          </button>
        </div>
        <div class="status">
          <div class="progress">
            <div class="bar" :style="{ width: `${progress}%` }" />
          </div>
          <div class="meta">
            {{ content.length }} / {{ totalLength }} ({{ progress }}%)
          </div>
        </div>
        <p class="note">
          This Webpack 4 playground uses CDN workers for KaTeX and Mermaid. D2 remains optional and falls back to source mode here.
        </p>
      </section>

      <section class="panel preview">
        <MarkdownRender
          :content="content"
          :final="isDone"
          :typewriter="false"
          :code-block-stream="true"
          code-block-dark-theme="vitesse-dark"
          code-block-light-theme="vitesse-dark"
          :code-block-props="codeBlockProps"
          :viewport-priority="false"
          :defer-nodes-until-visible="false"
          :batch-rendering="false"
          custom-id="vue2-demo"
          :custom-html-tags="customHtmlTags"
        />
      </section>
    </div>
  </div>
</template>

<style>
html,
body,
#app {
  margin: 0;
  min-height: 100%;
}

.page {
  min-height: 100vh;
  padding: 1.5rem 2rem 2.5rem;
  background: #f7f7fb;
  color: #111827;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
}

.header {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1.5rem;
}

.title {
  font-size: 1.6rem;
  font-weight: 700;
}

.sub {
  color: #4b5563;
}

.layout {
  display: grid;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
  gap: 1.5rem;
  align-items: start;
}

.panel {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
  padding: 1.25rem 1.5rem;
}

.controls h2 {
  margin: 0 0 1rem;
  font-size: 1.05rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.9rem;
}

.field label {
  font-size: 0.9rem;
  color: #374151;
}

.field input {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.5rem 0.7rem;
  font-size: 0.95rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.btn {
  border: none;
  background: #111827;
  color: #fff;
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  font-size: 0.9rem;
  cursor: pointer;
}

.btn.ghost {
  background: #e5e7eb;
  color: #111827;
}

.status {
  margin-top: 1rem;
}

.progress {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #6366f1);
}

.meta {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #6b7280;
}

.note {
  margin-top: 0.9rem;
  font-size: 0.85rem;
  line-height: 1.5;
  color: #6b7280;
}

.preview {
  min-height: 70vh;
  overflow: auto;
}

@media (max-width: 960px) {
  .page {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
