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
    radial-gradient(circle at 15% 20%, rgba(0, 228, 255, 0.22), transparent 40%),
    radial-gradient(circle at 85% 75%, rgba(255, 152, 0, 0.18), transparent 42%),
    linear-gradient(145deg, #060d1f 0%, #08152b 55%, #060913 100%);
}

.loading-card {
  width: min(92vw, 460px);
  border: 2px solid #274866;
  border-radius: 18px;
  padding: 22px 18px 16px;
  background:
    linear-gradient(180deg, rgba(14, 30, 52, 0.95), rgba(7, 16, 29, 0.94));
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(176, 231, 255, 0.25);
  color: #d9f0ff;
}

.loading-logo-wrap {
  width: 86px;
  height: 86px;
  margin: 0 auto 10px;
  position: relative;
  display: grid;
  place-items: center;
}

.loading-core {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-family: var(--font-pixel);
  font-size: 20px;
  font-weight: 700;
  color: #05223f;
  background: linear-gradient(150deg, #8ef0ff, #2fd0ff 60%, #00a7d8);
  border: 2px solid rgba(217, 247, 255, 0.75);
  box-shadow: 0 0 24px rgba(0, 211, 255, 0.42);
}

.loading-orbit {
  position: absolute;
  width: 86px;
  height: 86px;
  border-radius: 50%;
  border: 2px dashed rgba(133, 208, 255, 0.7);
  animation: spin 2.2s linear infinite;
}

.loading-title {
  font-family: var(--font-pixel);
  text-align: center;
  letter-spacing: 0.08em;
  font-size: clamp(20px, 4.8vw, 28px);
  color: #f1f8ff;
  margin-bottom: 6px;
}

.loading-subtitle {
  text-align: center;
  font-family: var(--font-pixel);
  color: #94b5d1;
  font-size: 12px;
  margin-bottom: 14px;
  letter-spacing: 0.02em;
}

.loading-progress {
  height: 10px;
  border: 1px solid #1d3a5a;
  border-radius: 999px;
  padding: 2px;
  background: #081628;
  overflow: hidden;
  margin-bottom: 14px;
}

.loading-progress__bar {
  display: block;
  height: 100%;
  width: 42%;
  border-radius: 999px;
  background: linear-gradient(90deg, #32dcff, #9bf2ff, #32dcff);
  box-shadow: 0 0 18px rgba(102, 231, 255, 0.7);
  animation: loading-slide 1.2s ease-in-out infinite;
}

.loading-tip {
  border: 1px solid #29425c;
  border-radius: 12px;
  padding: 10px 12px;
  background: rgba(7, 18, 32, 0.9);
}

.loading-tip__label {
  font-family: var(--font-pixel);
  color: #69d9ff;
  font-size: 12px;
  margin-bottom: 6px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.loading-tip__text {
  font-family: var(--font-pixel);
  color: #deecf8;
  font-size: 12px;
  line-height: 1.45;
  min-height: 34px;
}

.loading-fade-enter-active,
.loading-fade-leave-active {
  transition: opacity 0.3s ease;
}

.loading-fade-enter-from,
.loading-fade-leave-to {
  opacity: 0;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes loading-slide {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(360%); }
}
</style>
