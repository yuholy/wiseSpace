<script setup lang="ts">
import Icon from '@iconify/vue'
import { isDark, toggleDark } from '~/composables'
</script>

<template>
  <nav text-xl mt-6 inline-flex gap-2>
    <button class="icon-btn !outline-none" @click="toggleDark()">
      <Icon v-if="isDark" class="i-carbon-moon" />
      <Icon v-else class="i-carbon-sun" />
    </button>

    <a
      class="icon-btn"
      i-carbon-logo-github
      rel="noreferrer"
      href="https://github.com/Simon-He95/my-vitesse-app"
      target="_blank"
      title="GitHub"
    />
  </nav>
</template>
