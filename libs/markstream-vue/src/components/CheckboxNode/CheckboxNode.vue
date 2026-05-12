<script setup lang="ts">
defineProps<{
  node: {
    type: 'checkbox'
    checked: boolean
    raw: string
  }
}>()
</script>

<template>
  <span class="checkbox-node" role="img" :aria-label="node.checked ? 'checked' : 'unchecked'">
    <!-- Unchecked -->
    <svg v-if="!node.checked" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" class="checkbox-icon checkbox-unchecked">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="2" />
    </svg>
    <!-- Checked -->
    <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" class="checkbox-icon checkbox-checked">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
      <path d="M9 12l2 2 4-4" stroke="hsl(var(--ms-background))" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </span>
</template>

<style scoped>
.checkbox-node {
  display: inline-flex;
  align-items: center;
  margin-right: 0.5em;
  vertical-align: -0.15em;
}
.checkbox-icon {
  flex-shrink: 0;
}
.checkbox-unchecked {
  color: hsl(var(--ms-muted-foreground) / 0.5);
}
.checkbox-checked {
  color: hsl(var(--ms-info));
}
</style>
