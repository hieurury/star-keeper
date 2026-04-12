<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PhCompass, PhCpu, PhBookOpen, PhGear } from '@phosphor-icons/vue'

type LobbyTab = 'sortie' | 'technology' | 'codex' | 'settings'

const route = useRoute()
const router = useRouter()

const activeTab = computed<LobbyTab>(() => {
  if (route.path === '/technology') return 'technology'
  if (route.path === '/codex') return 'codex'
  if (route.path === '/settings') return 'settings'
  return 'sortie'
})

function navigate(tab: LobbyTab) {
  if (tab === activeTab.value) return
  if (tab === 'sortie') {
    router.push('/')
    return
  }
  if (tab === 'technology') {
    router.push('/technology')
    return
  }
  if (tab === 'codex') {
    router.push('/codex')
    return
  }
  router.push('/settings')
}
</script>

<template>
  <div class="lobby-nav-wrap">
    <nav class="lobby-nav" data-tour="bottom-nav" aria-label="Điều hướng khu trạm chỉ huy">
      <button class="lobby-nav__item" :class="{ 'lobby-nav__item--active': activeTab === 'sortie' }" @click="navigate('sortie')">
        <PhCompass :size="16" weight="bold" />
        <span>Xuất Trinh</span>
      </button>
      <button class="lobby-nav__item" :class="{ 'lobby-nav__item--active': activeTab === 'technology' }" @click="navigate('technology')">
        <PhCpu :size="16" weight="bold" />
        <span>Công Nghệ</span>
      </button>
      <button class="lobby-nav__item" :class="{ 'lobby-nav__item--active': activeTab === 'codex' }" @click="navigate('codex')">
        <PhBookOpen :size="16" weight="bold" />
        <span>Bách Khoa</span>
      </button>
      <button class="lobby-nav__item" :class="{ 'lobby-nav__item--active': activeTab === 'settings' }" @click="navigate('settings')">
        <PhGear :size="16" weight="bold" />
        <span>Cài Đặt</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.lobby-nav-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 40;
}

.lobby-nav {
  pointer-events: auto;
  width: 100%;
  max-width: 420px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, rgba(6, 14, 34, 0.88), rgba(3, 8, 22, 0.96));
  border-top: 2px solid rgba(98, 161, 238, 0.25);
  box-shadow: 0 -8px 20px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
}

.lobby-nav__item {
  border: 1px solid rgba(113, 156, 214, 0.18);
  background: rgba(15, 28, 56, 0.78);
  color: #8fb1d8;
  min-height: 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  font-family: var(--font-pixel);
  font-size: 8px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.lobby-nav__item:hover {
  color: #d6ebff;
  border-color: rgba(134, 196, 255, 0.5);
}

.lobby-nav__item--active {
  color: #7ed6ff;
  border-color: rgba(80, 202, 255, 0.7);
  background: linear-gradient(180deg, rgba(22, 61, 115, 0.75), rgba(12, 37, 82, 0.78));
  box-shadow: inset 0 0 0 1px rgba(90, 210, 255, 0.28);
}
</style>
