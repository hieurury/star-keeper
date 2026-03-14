<template>
  <RouterView />
  <LoadingOverlay />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import LoadingOverlay from './components/ui/LoadingOverlay.vue'

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
