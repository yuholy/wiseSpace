<script setup lang="ts">
defineProps<{
  html?: string
}>()
</script>

<template>
  <div
    class="markstream-vue2-legacy-node-html"
    v-html="html || ''"
  />
</template>

<style scoped>
.markstream-vue2-legacy-node-html {
  display: block;
}
</style>
