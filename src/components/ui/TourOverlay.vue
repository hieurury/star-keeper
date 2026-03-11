<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

export interface TourStep {
  target?: string   // value of data-tour attribute to spotlight
  title: string
  desc: string
}

const props = defineProps<{ steps: TourStep[] }>()
const emit = defineEmits<{ done: [] }>()

const current = ref(0)
const holeRect = ref<{ top: number; left: number; width: number; height: number } | null>(null)

const step = computed(() => props.steps[current.value])
const isLast = computed(() => current.value === props.steps.length - 1)

async function measure() {
  const s = step.value
  if (!s.target) { holeRect.value = null; return }
  const el = document.querySelector(`[data-tour="${s.target}"]`)
  if (!el) { holeRect.value = null; return }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await new Promise(r => setTimeout(r, 320))
  const r = el.getBoundingClientRect()
  holeRect.value = { top: r.top - 8, left: r.left - 8, width: r.width + 16, height: r.height + 16 }
}

const holeStyle = computed(() => {
  if (!holeRect.value) return {}
  const r = holeRect.value
  return { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px' }
})

const tooltipStyle = computed(() => {
  if (!holeRect.value) return {}
  const r = holeRect.value
  const vh = window.innerHeight
  const vw = window.innerWidth
  const w = 300
  const leftPos = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12)
  if (r.top + r.height + 210 <= vh) {
    return { top: (r.top + r.height + 16) + 'px', left: leftPos + 'px', width: w + 'px' }
  }
  return { top: Math.max(12, r.top - 210) + 'px', left: leftPos + 'px', width: w + 'px' }
})

function next() {
  if (isLast.value) { emit('done'); return }
  current.value++
}

watch(current, () => nextTick(measure))
onMounted(measure)

function onResize() { measure() }
window.addEventListener('resize', onResize)
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
</script>

<template>
  <div class="tour">
    <!-- Click blocker — prevents interaction with elements outside tooltip -->
    <div class="tour__click-blocker" />

    <!-- Visual: full dark shade (when no spotlighted element) -->
    <div v-if="!holeRect" class="tour__shade-full" />

    <!-- Visual: transparent hole with big box-shadow surround + gold ring -->
    <div v-if="holeRect" class="tour__hole" :style="holeStyle" />

    <!-- Info box -->
    <Transition name="tour-fade" mode="out-in">
      <div
        :key="current"
        class="tour__box"
        :style="holeRect ? tooltipStyle : {}"
        :class="{ 'tour__box--center': !holeRect }"
      >
        <div class="tour__progress">{{ current + 1 }} / {{ steps.length }}</div>
        <div class="tour__title">{{ step.title }}</div>
        <div class="tour__desc">{{ step.desc }}</div>
        <div class="tour__actions">
          <button class="tour__btn tour__btn--skip" @click="emit('done')">Bỏ qua</button>
          <button class="tour__btn tour__btn--next" @click="next">
            {{ isLast ? '✓ Xong' : 'Tiếp →' }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.tour {
  position: fixed;
  inset: 0;
  z-index: 9000;
  pointer-events: none;
}

/* Catches all clicks outside the tooltip so user can't interact with page */
.tour__click-blocker {
  position: fixed;
  inset: 0;
  z-index: 9000;
  pointer-events: all;
}

/* Dark overlay for steps with no target element */
.tour__shade-full {
  position: fixed;
  inset: 0;
  z-index: 9001;
  background: rgba(0, 0, 0, 0.80);
  pointer-events: none;
}

/* Transparent hole — box-shadow creates the dark surround + gold highlight ring */
.tour__hole {
  position: fixed;
  border-radius: 10px;
  z-index: 9001;
  pointer-events: none;
  box-shadow:
    0 0 0 9999px rgba(0, 0, 0, 0.80),
    0 0 0 3px rgba(255, 180, 30, 0.95),
    0 0 18px rgba(255, 180, 30, 0.35);
  transition: top 0.32s ease, left 0.32s ease, width 0.32s ease, height 0.32s ease;
}

/* Tooltip box */
.tour__box {
  position: fixed;
  background: #080d1c;
  border: 2px solid #ffb41e;
  box-shadow: 4px 4px 0 #7a5800, 0 0 30px rgba(255, 180, 30, 0.18);
  padding: 18px 20px 16px;
  z-index: 9002;
  pointer-events: all;
  font-family: var(--font-pixel, monospace);
  max-width: 300px;
}

.tour__box--center {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 300px;
}

.tour__progress {
  font-size: 9px;
  color: #ffb41e;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.tour__title {
  font-size: 12px;
  color: #ffffff;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
  line-height: 1.5;
}

.tour__desc {
  font-size: 11px;
  color: #99aabb;
  line-height: 1.7;
  margin-bottom: 18px;
  white-space: pre-wrap;
  font-family: 'Chakra Petch', sans-serif;
  letter-spacing: 0;
}

.tour__actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tour__btn {
  font-family: var(--font-pixel, monospace);
  font-size: 11px;
  letter-spacing: 0.5px;
  border: none;
  cursor: pointer;
  padding: 7px 16px;
  text-transform: uppercase;
}

.tour__btn--skip {
  background: none;
  color: #445566;
  padding-left: 0;
}
.tour__btn--skip:hover { color: #7788aa; }

.tour__btn--next {
  background: #ffb41e;
  color: #080d1c;
  box-shadow: 0 3px 0 #7a5800;
}
.tour__btn--next:hover { background: #ffc840; }
.tour__btn--next:active { transform: translateY(2px); box-shadow: none; }

/* Tooltip transition */
.tour-fade-enter-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.tour-fade-leave-active { transition: opacity 0.12s ease; }
.tour-fade-enter-from { opacity: 0; transform: translateY(6px); }
.tour-fade-leave-to { opacity: 0; }
</style>
