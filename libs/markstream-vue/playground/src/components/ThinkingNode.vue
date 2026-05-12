<script setup lang="ts">
defineProps<{
  node: {
    type: 'thinking'
    content: string
    children: any[]
    loading?: boolean
  }
  isDark?: boolean
}>()
</script>

<template>
  <div class="thinking-node">
    {{ node.content }}
  </div>
</template>

<style scoped>
.thinking-node {
  margin: 1em 0;
  padding: 0.75em 1em;
  font-size: 0.8125rem;
  color: hsl(var(--ms-muted-foreground));
  border-left: 2px solid hsl(var(--ms-border));
  white-space: pre-wrap;
}
</style>
