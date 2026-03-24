<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/gameStore'
import GameCanvas from '../components/game/GameCanvas.vue'
import GameHUD from '../components/game/GameHUD.vue'
import PixelButton from '../components/ui/PixelButton.vue'
import { audioManager } from '../game/systems/audio'

const router = useRouter()
const game = useGameStore()

// ── Selection state (before game starts) ──────────────────────────────────────
type TestType = 'faction' | 'boss'
const testType = ref<TestType>('boss')
const selectedFaction = ref<'anox' | 'bnox' | 'cnox' | 'dnox'>('anox')
const selectedBoss = ref<string>('boss_stardestroyer')

const BOSSES: Array<{ kind: string; label: string; emoji: string }> = [
  { kind: 'boss_stardestroyer', label: 'Anox - Kẻ ăn sao', emoji: '🛸' },
  { kind: 'boss_invader',       label: 'Anox - Kẻ xâm lăng', emoji: '👾' },
  { kind: 'boss_tinhvan',       label: 'Bnox - Tinh vân hắc ám', emoji: '🌀' },
  { kind: 'boss_trumso',        label: 'Bnox - Trùm sò', emoji: '💀' },
  { kind: 'boss_cnox_sun',      label: 'Cnox - Mặt trời tối thượng', emoji: '☀️' },
]

// ── Game phase ─────────────────────────────────────────────────────────────────
const phase = ref<'select' | 'playing'>('select')

function startTest() {
  if (testType.value === 'boss') {
    game.testMode = { type: 'boss', bossKind: selectedBoss.value }
  } else {
    game.testMode = { type: 'faction', faction: selectedFaction.value }
  }
  game.startGame()
  phase.value = 'playing'
}

function restartTest() {
  game.startGame()
}

function backToSelect() {
  game.endGame()
  game.testMode = null
  phase.value = 'select'
}

function goHome() {
  game.endGame()
  game.testMode = null
  router.push('/')
}

onUnmounted(() => {
  audioManager.setBossActive(false)
  audioManager.setScene('none')
  game.testMode = null
  if (game.isPlaying) game.endGame()
})

onMounted(() => {
  audioManager.ensureStarted()
  audioManager.setScene('game')
  audioManager.setBossActive(false)
})
</script>

<template>
  <div class="test-view">
    <!-- Top bar -->
    <div class="test-view__bar">
      <div class="test-view__bar-title">⚙ THỬ NGHIỆM</div>
      <div class="test-view__bar-actions">
        <template v-if="phase === 'playing'">
          <PixelButton
            :label="game.isPaused ? '&#9654; Tiếp' : '&#9208; Dừng'"
            variant="secondary"
            size="sm"
            @click="game.pauseGame()"
          />
        </template>
        <PixelButton label="◀ Thoát" variant="secondary" size="sm" @click="goHome" />
      </div>
    </div>

    <!-- SELECT PHASE -->
    <div v-if="phase === 'select'" class="test-select">
      <div class="test-select__panel">
        <div class="test-select__title">CHỌN CHẾ ĐỘ THỬ</div>

        <!-- Mode toggle -->
        <div class="test-mode-toggle">
          <button
            class="test-mode-btn"
            :class="{ active: testType === 'boss' }"
            @click="testType = 'boss'"
          >BOSS</button>
          <button
            class="test-mode-btn"
            :class="{ active: testType === 'faction' }"
            @click="testType = 'faction'"
          >FACTION</button>
        </div>

        <!-- Boss selection -->
        <div v-if="testType === 'boss'" class="test-section">
          <div class="test-section__label">Chọn Boss</div>
          <div class="boss-list">
            <button
              v-for="b in BOSSES"
              :key="b.kind"
              class="boss-card"
              :class="{ active: selectedBoss === b.kind }"
              @click="selectedBoss = b.kind"
            >
              <span class="boss-card__emoji">{{ b.emoji }}</span>
              <span class="boss-card__name">{{ b.label }}</span>
            </button>
          </div>
        </div>

        <!-- Faction selection -->
        <div v-else class="test-section">
          <div class="test-section__label">Chỉ Spawn Faction</div>
          <div class="faction-list">
            <button
              class="faction-card"
              :class="{ active: selectedFaction === 'anox' }"
              @click="selectedFaction = 'anox'"
            >
              <span class="faction-card__emoji">🚀</span>
              <span class="faction-card__name">ANOX</span>
              <span class="faction-card__sub">Tiên phong · Thiện xạ · Cảm tử</span>
            </button>
            <button
              class="faction-card"
              :class="{ active: selectedFaction === 'bnox' }"
              @click="selectedFaction = 'bnox'"
            >
              <span class="faction-card__emoji">🛡</span>
              <span class="faction-card__name">BNOX</span>
              <span class="faction-card__sub">Đại liên · Thủ hộ · Thuật sĩ</span>
            </button>
            <button
              class="faction-card"
              :class="{ active: selectedFaction === 'cnox' }"
              @click="selectedFaction = 'cnox'"
            >
              <span class="faction-card__emoji">⚡</span>
              <span class="faction-card__name">CNOX</span>
              <span class="faction-card__sub">Tham lam · Lá chắn · Tia lửa</span>
            </button>
            <button
              class="faction-card"
              :class="{ active: selectedFaction === 'dnox' }"
              @click="selectedFaction = 'dnox'"
            >
              <span class="faction-card__emoji">❄️</span>
              <span class="faction-card__name">DNOX</span>
              <span class="faction-card__sub">Hoả chủng · Băng lam · Thổ nhưỡng</span>
            </button>
          </div>
        </div>

        <PixelButton label="▶ BẮT ĐẦU" size="lg" @click="startTest" />
      </div>
    </div>

    <!-- PLAYING PHASE -->
    <div v-else class="test-view__area">
      <GameCanvas />
      <GameHUD @request-go-home="backToSelect" :tour-active="false" />

      <!-- Game over overlay -->
      <Transition name="gameover">
        <div v-if="!game.isPlaying && phase === 'playing'" class="gameover-overlay">
          <div class="gameover-menu">
            <div class="gameover-title">GAME OVER</div>
            <div class="gameover-actions">
              <PixelButton label="↺ Thử Lại" size="lg" @click="restartTest" />
              <PixelButton label="◀ Đổi Chế Độ" variant="secondary" size="md" @click="backToSelect" />
              <PixelButton label="🏠 Trang Chủ" variant="secondary" size="sm" @click="goHome" />
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.test-view {
  width: 100%;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  align-items: center;
  overflow: hidden;
}

.test-view__bar {
  width: 100%;
  max-width: 420px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--color-panel);
  border-bottom: 3px solid var(--color-border-dark);
}
.test-view__bar-title {
  font-family: var(--font-pixel);
  font-size: 10px;
  color: var(--color-accent);
  letter-spacing: 1px;
}
.test-view__bar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* ── Select panel ─────────────────────────────────────────────────────────── */
.test-select {
  flex: 1;
  width: 100%;
  max-width: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.test-select__panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
}
.test-select__title {
  font-family: var(--font-pixel);
  font-size: 14px;
  color: var(--color-accent);
  letter-spacing: 3px;
}

/* Mode toggle */
.test-mode-toggle {
  display: flex;
  gap: 0;
  border: 2px solid var(--color-border-dark);
  overflow: hidden;
}
.test-mode-btn {
  font-family: var(--font-pixel);
  font-size: 10px;
  padding: 8px 24px;
  background: var(--color-panel-dark, #161b22);
  color: var(--color-text-dim);
  border: none;
  cursor: pointer;
  letter-spacing: 1px;
  transition: background 0.15s, color 0.15s;
}
.test-mode-btn.active {
  background: var(--color-accent);
  color: #000;
}

/* Section */
.test-section { width: 100%; display: flex; flex-direction: column; gap: 10px; }
.test-section__label {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  letter-spacing: 2px;
  text-align: center;
}

/* Boss cards */
.boss-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.boss-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  background: var(--color-panel);
  border: 2px solid var(--color-border-dark);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.boss-card.active {
  border-color: var(--color-accent);
  background: rgba(88, 166, 255, 0.12);
}
.boss-card__emoji { font-size: 28px; }
.boss-card__name {
  font-family: var(--font-pixel);
  font-size: 7px;
  color: var(--color-text);
  text-align: center;
  letter-spacing: 0.5px;
}

/* Faction cards */
.faction-list { display: flex; flex-direction: column; gap: 10px; }
.faction-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--color-panel);
  border: 2px solid var(--color-border-dark);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}
.faction-card.active {
  border-color: var(--color-accent);
  background: rgba(88, 166, 255, 0.12);
}
.faction-card__emoji { font-size: 24px; flex-shrink: 0; }
.faction-card__name {
  font-family: var(--font-pixel);
  font-size: 12px;
  color: var(--color-accent);
  letter-spacing: 2px;
}
.faction-card__sub {
  font-family: var(--font-pixel);
  font-size: 7px;
  color: var(--color-text-dim);
  letter-spacing: 0.5px;
  display: block;
}
.faction-card > div, .faction-card > span:not(.faction-card__emoji) {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/* ── Playing area ─────────────────────────────────────────────────────────── */
.test-view__area {
  position: relative;
  width: 100%;
  max-width: 420px;
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
}

/* Game over */
.gameover-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(5px);
  z-index: 20;
}
.gameover-menu {
  width: 280px;
  max-width: 88vw;
  background: var(--color-panel);
  border: 3px solid #e74c3c;
  box-shadow: 6px 6px 0 #7b241c;
  padding: 24px 20px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}
.gameover-title {
  font-family: var(--font-pixel);
  font-size: 28px;
  color: #e74c3c;
  letter-spacing: 4px;
}
.gameover-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  align-items: center;
}

.gameover-enter-active { animation: go-up 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
.gameover-leave-active { animation: go-up 0.2s reverse both; }
@keyframes go-up { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
</style>
