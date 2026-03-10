<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>

<template>
  <div class="pixel-panel">
    <div v-if="title" class="pixel-panel__title">{{ title }}</div>
    <div class="pixel-panel__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.pixel-panel {
  background: var(--color-panel);
  border: 3px solid var(--color-border);
  box-shadow:
    4px 4px 0 var(--color-border-dark),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  padding: 0;
}

.pixel-panel__title {
  font-family: var(--font-pixel);
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  background: var(--color-border);
  color: var(--color-text-dim);
  padding: 6px 14px;
  border-bottom: 2px solid var(--color-border-dark);
}

.pixel-panel__body {
  padding: 16px;
}
</style>
