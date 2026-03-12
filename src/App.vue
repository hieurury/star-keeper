<template>
  <RouterView />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

function isMobile(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

function tryFullscreen() {
  if (document.fullscreenElement) return
  const el = document.documentElement
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => {})
  } else if ((el as any).webkitRequestFullscreen) {
    ;(el as any).webkitRequestFullscreen()
  }
}

onMounted(() => {
  if (isMobile()) {
    document.addEventListener('touchstart', tryFullscreen, { passive: true })
  }
})
</script>
