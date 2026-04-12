<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useUiStore } from '../../stores/uiStore'

const ui = useUiStore()
const isVisible = computed(() => ui.loadingVisible)
const progressValue = computed(() => ui.loadingProgress)
const isIndeterminate = computed(() => progressValue.value === null)
const progressStyle = computed(() => {
  if (progressValue.value === null) return undefined
  return { width: `${progressValue.value}%` }
})
const progressText = computed(() => {
  if (ui.loadingProgressLabel) return ui.loadingProgressLabel
  if (progressValue.value === null) return 'Dang tai...'
  return `${progressValue.value}%`
})

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
      <div class="loading-shell">
        <img class="loading-icon" src="/pwa/icon-192.svg" alt="Star Keeper icon" />
        <h1 class="loading-title">{{ ui.loadingTitle }}</h1>
        <p class="loading-subtitle">{{ ui.loadingSubtitle }}</p>

        <div
          class="loading-progress"
          role="progressbar"
          :aria-valuenow="progressValue === null ? undefined : progressValue"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuetext="progressText"
        >
          <span
            class="loading-progress__fill"
            :class="{ 'loading-progress__fill--indeterminate': isIndeterminate }"
            :style="progressStyle"
          />
        </div>
        <div class="loading-progress__text">{{ progressText }}</div>

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
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 15% 20%, rgba(0, 160, 255, 0.18), transparent 45%),
    radial-gradient(circle at 85% 82%, rgba(255, 120, 0, 0.12), transparent 45%),
    linear-gradient(165deg, #050b18 0%, #060f1f 55%, #08172f 100%);
}

.loading-shell {
  width: 100%;
  height: 100%;
  padding: clamp(24px, 5vw, 48px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: #e2f1ff;
}

.loading-icon {
  width: clamp(84px, 14vw, 110px);
  height: clamp(84px, 14vw, 110px);
  object-fit: contain;
  margin-bottom: 18px;
}

.loading-title {
  font-family: var(--font-pixel);
  text-align: center;
  letter-spacing: 0.1em;
  font-size: clamp(22px, 4vw, 30px);
  background: linear-gradient(to right, #ffffff, #88c0ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 8px;
}

.loading-subtitle {
  text-align: center;
  font-family: var(--font-pixel);
  color: #8da9c4;
  font-size: clamp(12px, 2.2vw, 14px);
  margin-bottom: 24px;
  letter-spacing: 0.04em;
}

.loading-progress {
  width: min(620px, 92vw);
  height: 10px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin-bottom: 8px;
}

.loading-progress__fill {
  display: block;
  height: 100%;
  width: 0;
  background: linear-gradient(90deg, #00c8ff, #6fb8ff);
  transition: width 0.22s ease;
}

.loading-progress__fill--indeterminate {
  width: 42%;
  background: linear-gradient(90deg, transparent, #00d4ff, transparent);
  animation: loading-slide 1.5s ease-in-out infinite;
}

.loading-progress__text {
  width: min(620px, 92vw);
  text-align: right;
  font-family: var(--font-pixel);
  font-size: 10px;
  color: #8eb8dd;
  letter-spacing: 0.06em;
  margin-bottom: 20px;
}

.loading-tip {
  text-align: center;
  width: min(620px, 92vw);
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
  font-size: clamp(12px, 2vw, 14px);
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
}

@keyframes loading-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
</style>
