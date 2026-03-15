<script setup lang="ts">
import type { EnemyKind } from '../../game/types'
import PixiEnemyArt from './PixiEnemyArt.vue'

const props = withDefaults(defineProps<{
  kind: EnemyKind
  size?: number
  locked?: boolean
}>(), {
  size: 82,
  locked: false,
})
</script>

<template>
  <div class="enemy-art-wrapper" :class="{ 'enemy-art-wrapper--locked': locked }">
    <PixiEnemyArt :kind="kind" :size="size" />
    <div v-if="locked" class="lock-overlay">
      <span class="lock-text">?</span>
    </div>
  </div>
</template>

<style scoped>
.enemy-art-wrapper {
  position: relative;
  display: inline-block;
}

.enemy-art-wrapper--locked :deep(.pixi-enemy-art) {
  filter: grayscale(1) brightness(0.4);
}

.lock-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
}

.lock-text {
  font-size: 28px;
  font-weight: bold;
  color: #707070;
  font-family: 'Chakra Petch', sans-serif;
}

.enemy-art-wrapper:not(.enemy-art-wrapper--locked) .lock-overlay {
  display: none;
}
</style>
