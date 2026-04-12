<template>
  <RouterView />
  <LoadingOverlay />

  <Transition name="update-fade">
    <div v-if="showMandatoryUpdatePrompt" class="update-gate" role="dialog" aria-modal="true">
      <div class="update-gate__panel">
        <img class="update-gate__icon" src="/pwa/icon-192.svg" alt="Star Keeper icon" />
        <h2 class="update-gate__title">Co phien ban moi</h2>
        <p class="update-gate__desc">Phien ban hien tai: {{ currentVersionLabel }}</p>
        <p class="update-gate__desc">Phien ban moi: {{ latestVersionLabel }}</p>
        <p class="update-gate__desc">Dung luong can thiet: {{ requiredSizeLabel }}</p>

        <p v-if="updateNotes" class="update-gate__notes">{{ updateNotes }}</p>
        <p v-if="mandatoryUpdateError" class="update-gate__error">{{ mandatoryUpdateError }}</p>

        <div class="update-gate__actions">
          <button class="update-gate__btn update-gate__btn--primary" :disabled="isUpdating" @click="startMandatoryUpdate">
            {{ isUpdating ? 'Dang cap nhat...' : 'Cap nhat ngay' }}
          </button>
          <button class="update-gate__btn update-gate__btn--danger" :disabled="isUpdating" @click="exitGameApp">
            Thoat
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import LoadingOverlay from './components/ui/LoadingOverlay.vue'
import { useUiStore } from './stores/uiStore'
import { checkForUpdates, type UpdateCheckResult } from './lib/updateChecker'
import { installMandatoryUpdate } from './lib/updateInstaller'
import { Capacitor } from '@capacitor/core'

const ui = useUiStore()
const showMandatoryUpdatePrompt = ref(false)
const mandatoryUpdate = ref<UpdateCheckResult | null>(null)
const mandatoryUpdateError = ref('')
const isUpdating = ref(false)

const currentVersionLabel = computed(() => {
  const v = mandatoryUpdate.value?.currentVersion
  return v ? `v${v}` : 'v?'
})

const latestVersionLabel = computed(() => {
  const v = mandatoryUpdate.value?.latestVersion
  return v ? `v${v}` : 'v?'
})

const requiredSizeLabel = computed(() => {
  const manifest = mandatoryUpdate.value?.manifest
  if (!manifest) return 'Chua co thong tin'

  if (manifest.requiredSizeMb) {
    return `${manifest.requiredSizeMb.toFixed(0)} MB`
  }
  if (manifest.packageSizeBytes) {
    return `${(manifest.packageSizeBytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return 'Khoang 100 MB+'
})

const updateNotes = computed(() => mandatoryUpdate.value?.manifest?.notes ?? '')

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

async function checkMandatoryUpdateOnLaunch() {
  try {
    const result = await checkForUpdates()
    if (result.hasUpdate) {
      mandatoryUpdate.value = result
      showMandatoryUpdatePrompt.value = true
    }
  } catch (error) {
    console.warn('[Update] Khong the kiem tra cap nhat luc khoi dong:', error)
  }
}

async function startMandatoryUpdate() {
  const manifest = mandatoryUpdate.value?.manifest
  if (!manifest) return

  mandatoryUpdateError.value = ''
  isUpdating.value = true
  showMandatoryUpdatePrompt.value = false

  ui.showLoading({
    title: 'STAR KEEPER',
    subtitle: `Dang cap nhat ${mandatoryUpdate.value?.latestVersion ?? ''}...`,
    tip: 'Vui long giu ket noi mang on dinh trong qua trinh cap nhat.',
    progress: 0,
    progressLabel: '0%',
    persistent: true,
  })

  try {
    await installMandatoryUpdate(manifest, {
      onProgress: (progress) => {
        ui.setLoadingProgress(progress, `Dang cap nhat ${progress}%`)
      },
    })

    ui.setLoadingProgress(100, 'Hoan tat cap nhat')
  } catch (error) {
    mandatoryUpdateError.value = error instanceof Error
      ? error.message
      : 'Cap nhat that bai. Vui long thu lai.'
    showMandatoryUpdatePrompt.value = true
    ui.setLoadingPersistent(false)
    ui.forceHideLoading()
  } finally {
    isUpdating.value = false
  }
}

function exitGameApp() {
  if (Capacitor.isNativePlatform()) {
    const nativeNavigator = navigator as Navigator & { app?: { exitApp?: () => void } }
    nativeNavigator.app?.exitApp?.()
  }

  window.close()
}

onMounted(() => {
  if (isMobile()) {
    document.addEventListener('touchstart', tryFullscreen, { passive: true })
  }

  void checkMandatoryUpdateOnLaunch()
})
</script>

<style scoped>
.update-gate {
  position: fixed;
  inset: 0;
  z-index: 10010;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(4, 7, 15, 0.88);
}

.update-gate__panel {
  width: min(92vw, 420px);
  background: linear-gradient(180deg, rgba(15, 29, 56, 0.96), rgba(8, 17, 36, 0.98));
  padding: 20px;
  border: 2px solid rgba(90, 156, 222, 0.45);
}

.update-gate__icon {
  width: 64px;
  height: 64px;
  object-fit: contain;
  display: block;
  margin: 0 auto 12px;
}

.update-gate__title {
  margin: 0 0 10px;
  text-align: center;
  font-family: var(--font-pixel);
  font-size: 12px;
  color: #dff3ff;
  letter-spacing: 1px;
}

.update-gate__desc {
  margin: 0;
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #9eb8d7;
  line-height: 1.7;
}

.update-gate__notes {
  margin: 10px 0 0;
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #b9d6f3;
  line-height: 1.8;
}

.update-gate__error {
  margin: 10px 0 0;
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #ffacac;
}

.update-gate__actions {
  margin-top: 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.update-gate__btn {
  border: 2px solid transparent;
  padding: 10px 8px;
  font-family: var(--font-pixel);
  font-size: 8px;
  text-transform: uppercase;
  cursor: pointer;
}

.update-gate__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.update-gate__btn--primary {
  border-color: #2f82c5;
  background: #123d66;
  color: #b8e9ff;
}

.update-gate__btn--danger {
  border-color: rgba(232, 92, 92, 0.5);
  background: rgba(92, 24, 24, 0.72);
  color: #ffc3c3;
}

.update-fade-enter-active,
.update-fade-leave-active {
  transition: opacity 0.22s ease;
}

.update-fade-enter-from,
.update-fade-leave-to {
  opacity: 0;
}
</style>
