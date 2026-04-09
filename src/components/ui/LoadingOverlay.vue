<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useUiStore } from '../../stores/uiStore'

const ui = useUiStore()
const isVisible = computed(() => ui.loadingVisible)

let tipTimer: ReturnType<typeof setInterval> | null = null

function startTipTimer() {
  if (tipTimer) return
  tipTimer = setInterval(() => {
    ui.nextLoadingTip()
  }, 4200)
}

function stopTipTimer() {
  if (!tipTimer) return
  clearInterval(tipTimer)
  tipTimer = null
}

watch(isVisible, (visible) => {
  if (visible) startTipTimer()
  else stopTipTimer()
}, { immediate: true })

onBeforeUnmount(() => {
  stopTipTimer()
})
</script>

<template>
  <Transition name="loading-fade">
    <div v-if="isVisible" class="loading-overlay" aria-live="polite" aria-busy="true">
      <div class="loading-card">
        <div class="loading-logo-wrap">
          <div class="loading-orbit" />
          <div class="loading-core">SK</div>
        </div>
        <h1 class="loading-title">{{ ui.loadingTitle }}</h1>
        <p class="loading-subtitle">{{ ui.loadingSubtitle }}</p>

        <div class="loading-progress" role="progressbar" aria-valuetext="Dang tai">
          <span class="loading-progress__bar" />
        </div>

        <div class="loading-tip">
          <div class="loading-tip__label">Mẹo</div>
          <div class="loading-tip__text">{{ ui.loadingTip }}</div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background:
    radial-gradient(circle at 50% 0%, rgba(0, 160, 255, 0.15), transparent 60%),
    radial-gradient(circle at 80% 80%, rgba(255, 120, 0, 0.08), transparent 50%),
    rgba(4, 8, 16, 0.85);
  backdrop-filter: blur(12px);
}

.loading-card {
  width: min(90vw, 420px);
  border-radius: 24px;
  padding: 32px 24px;
  background: linear-gradient(135deg, rgba(20, 30, 50, 0.4), rgba(10, 15, 25, 0.6));
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #e2f1ff;
  border: none;
}

.loading-logo-wrap {
  width: 90px;
  height: 90px;
  margin-bottom: 16px;
  position: relative;
  display: grid;
  place-items: center;
}

.loading-core {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-family: var(--font-pixel);
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #00d2ff, #0a4bf8);
  box-shadow: 0 10px 24px rgba(0, 162, 255, 0.4);
  border: none;
}

.loading-orbit {
  position: absolute;
  width: 90px;
  height: 90px;
  border-radius: 50%;
  border: 1.5px dashed rgba(0, 212, 255, 0.5);
  animation: spin 3s linear infinite;
}

.loading-title {
  font-family: var(--font-pixel);
  text-align: center;
  letter-spacing: 0.1em;
  font-size: clamp(22px, 5vw, 26px);
  background: linear-gradient(to right, #ffffff, #88c0ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
}

.loading-subtitle {
  text-align: center;
  font-family: var(--font-pixel);
  color: #8da9c4;
  font-size: 13px;
  margin-bottom: 24px;
  letter-spacing: 0.04em;
}

.loading-progress {
  width: 100%;
  height: 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  overflow: hidden;
  margin-bottom: 24px;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.5);
}

.loading-progress__bar {
  display: block;
  height: 100%;
  width: 50%;
  border-radius: 6px;
  background: linear-gradient(90deg, transparent, #00d4ff, transparent);
  animation: loading-slide 1.5s ease-in-out infinite;
}

.loading-tip {
  text-align: center;
  width: 100%;
  padding: 0 12px;
}

.loading-tip__label {
  font-family: var(--font-pixel);
  color: #00d4ff;
  font-size: 12px;
  margin-bottom: 8px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.8;
}

.loading-tip__text {
  font-family: var(--font-pixel);
  color: #a4bed8;
  font-size: 13px;
  line-height: 1.5;
  min-height: 38px;
}

.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.4s ease, backdrop-filter 0.4s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
  backdrop-filter: blur(0px);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes loading-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
</style>
