<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps<{
  repo: string
}>()

const stars = ref<number | null>(null)
const isLoading = ref(true)

onMounted(async () => {
  try {
    const response = await fetch(`https://api.github.com/repos/${props.repo}`)
    if (response.ok) {
      const data = await response.json()
      stars.value = data.stargazers_count
    }
  }
  catch {
    // Silently fail if API request fails
  }
  finally {
    isLoading.value = false
  }
})

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}
</script>

<template>
  <a
    :href="`https://github.com/${repo}`"
    target="_blank"
    rel="noopener noreferrer"
    class="github-star-badge"
    aria-label="Star on GitHub"
  >
    <svg
      class="star-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path
        d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"
      />
    </svg>
    <span v-if="isLoading" class="stars-count">...</span>
    <span v-else-if="stars !== null" class="stars-count">{{ formatNumber(stars) }}</span>
    <span v-else class="stars-count">Star</span>
  </a>
</template>

<style scoped>
.github-star-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.875rem;
  background: linear-gradient(135deg, #f6f8fa 0%, #f1f3f5 100%);
  border: 1px solid #d0d7de;
  border-radius: 24px;
  color: #24292f;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
}

.github-star-badge:hover {
  background: linear-gradient(135deg, #ffffff 0%, #f6f8fa 100%);
  border-color: var(--vp-c-brand);
  color: var(--vp-c-brand);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12), 0 3px 6px rgba(0, 0, 0, 0.08);
}

.github-star-badge:active {
  transform: translateY(0);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
}

@media (prefers-color-scheme: dark) {
  .github-star-badge {
    background: linear-gradient(135deg, #161b22 0%, #0d1117 100%);
    border-color: #30363d;
    color: #c9d1d9;
  }

  .github-star-badge:hover {
    background: linear-gradient(135deg, #21262d 0%, #161b22 100%);
    border-color: var(--vp-c-brand);
    color: var(--vp-c-brand);
  }
}

.star-icon {
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
  transition: transform 0.25s ease;
}

.github-star-badge:hover .star-icon {
  transform: scale(1.15) rotate(8deg);
}

.stars-count {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.025em;
  min-width: 2ch;
  text-align: center;
}

.stars-count:empty::before {
  content: '...';
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
