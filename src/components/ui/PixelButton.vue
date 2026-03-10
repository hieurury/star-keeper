<script setup lang="ts">
defineProps<{
  label: string
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    class="pixel-btn"
    :class="[`pixel-btn--${variant ?? 'primary'}`, `pixel-btn--${size ?? 'md'}`, { disabled }]"
    :disabled="disabled"
    @click="$emit('click')"
  >
    {{ label }}
  </button>
</template>

<style scoped>
.pixel-btn {
  font-family: var(--font-pixel);
  letter-spacing: 1px;
  cursor: pointer;
  border: none;
  outline: none;
  position: relative;
  text-transform: uppercase;
  user-select: none;
  transition: transform 0.05s, box-shadow 0.05s;
}

.pixel-btn--sm  { font-size: 10px; padding: 6px 14px; }
.pixel-btn--md  { font-size: 13px; padding: 10px 22px; }
.pixel-btn--lg  { font-size: 16px; padding: 14px 30px; }

.pixel-btn--primary {
  background: var(--color-accent);
  color: #fff;
  box-shadow: 0 4px 0 var(--color-accent-dark), inset 0 1px 0 rgba(255,255,255,0.25);
}
.pixel-btn--primary:hover:not(.disabled) {
  background: var(--color-accent-light);
}

.pixel-btn--secondary {
  background: var(--color-panel-light);
  color: var(--color-text);
  box-shadow: 0 4px 0 var(--color-border-dark), inset 0 1px 0 rgba(255,255,255,0.1);
}
.pixel-btn--secondary:hover:not(.disabled) {
  background: var(--color-panel);
}

.pixel-btn--danger {
  background: #c0392b;
  color: #fff;
  box-shadow: 0 4px 0 #7b241c, inset 0 1px 0 rgba(255,255,255,0.2);
}
.pixel-btn--danger:hover:not(.disabled) {
  background: #e74c3c;
}

.pixel-btn:active:not(.disabled) {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--color-accent-dark);
}

.pixel-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
