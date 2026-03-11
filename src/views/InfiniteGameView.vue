<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { useGameStore } from '../stores/gameStore'
import GameCanvas from '../components/game/GameCanvas.vue'
import GameHUD from '../components/game/GameHUD.vue'
import PixelButton from '../components/ui/PixelButton.vue'

const router = useRouter()
const game = useGameStore()

const showExitWarning = ref(false)
const exitConfirmed = ref(false)
let pausedForDialog = false

function goHome() {
  game.endGame()
  router.push('/')
}

function requestGoHome() {
  if (game.isPlaying) {
    if (!game.isPaused && !game.isLevelUpPending) {
      game.isPaused = true
      pausedForDialog = true
    }
    showExitWarning.value = true
  } else {
    goHome()
  }
}

function confirmExit() {
  exitConfirmed.value = true
  showExitWarning.value = false
  pausedForDialog = false
  game.endGame()
  router.push('/')
}

function cancelExit() {
  showExitWarning.value = false
  if (pausedForDialog) {
    game.isPaused = false
    pausedForDialog = false
  }
}

function restartGame() {
  exitConfirmed.value = false
  game.startGame()
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (game.isPlaying) {
    e.preventDefault()
    return ''
  }
}

onBeforeRouteLeave(() => {
  if (game.isPlaying && !exitConfirmed.value) {
    requestGoHome()
    return false
  }
})

onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', handleBeforeUnload))
</script>

<template>
  <div class="game-view">
    <!-- Top control bar -->
    <div class="game-view__bar">
      <PixelButton label="◀ Menu" variant="secondary" size="sm" @click="requestGoHome" />
      <div class="game-view__bar-title">CHẾ ĐỘ VÔ TẬN</div>
      <PixelButton
        :label="game.isPaused ? '▶ Tiếp' : '⏸ Dừng'"
        variant="secondary"
        size="sm"
        @click="game.pauseGame()"
      />
    </div>

    <!-- Game area -->
    <div class="game-view__area">
      <GameCanvas />
      <GameHUD />

      <!-- Game over menu (slides up after 2s death sequence) -->
      <Transition name="gameover">
        <div v-if="!game.isPlaying" class="gameover-overlay">
          <div class="gameover-menu">
            <div class="gameover-title">GAME OVER</div>
            <div class="gameover-stats">
              <div class="gameover-stat-row">
                <span class="gameover-stat-label">ĐIỂM</span>
                <span class="gameover-stat-value accent">{{ game.currentScore }}</span>
              </div>
              <div v-if="game.currentScore > 0 && game.currentScore >= game.highScore" class="gameover-record">
                ★ KỶ LỤC MỚI ★
              </div>
              <div class="gameover-stat-row">
                <span class="gameover-stat-label">KỶ LỤC</span>
                <span class="gameover-stat-value">{{ game.highScore }}</span>
              </div>
              <div class="gameover-stat-row">
                <span class="gameover-stat-label">STAGE ĐẠT</span>
                <span class="gameover-stat-value">{{ game.currentStage }}</span>
              </div>
              <div class="gameover-stat-row gold-row">
                <span class="gameover-stat-label">VÀNG NHẬN</span>
                <span class="gameover-stat-value gold">+{{ game.goldEarnedThisRun }} 🪙</span>
              </div>
            </div>
            <div class="gameover-actions">
              <PixelButton label="↺ Chơi Lại" size="lg" @click="restartGame" />
              <PixelButton label="◀ Trang Chủ" variant="secondary" size="md" @click="goHome" />
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Exit confirmation dialog -->
    <div v-if="showExitWarning" class="exit-overlay">
      <div class="exit-dialog">
        <div class="exit-dialog__title">⚠ THOÁT GAME?</div>
        <div class="exit-dialog__body">Tiến trình hiện tại sẽ bị mất.<br>Bạn có chắc muốn thoát không?</div>
        <div class="exit-dialog__actions">
          <PixelButton label="✗ Hủy" variant="secondary" size="md" @click="cancelExit" />
          <PixelButton label="✓ Thoát" variant="danger" size="md" @click="confirmExit" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game-view {
  width: 100%;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  align-items: center;
}

/* Top bar */
.game-view__bar {
  width: 100%;
  max-width: 420px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--color-panel);
  border-bottom: 3px solid var(--color-border-dark);
}
.game-view__bar-title {
  font-family: var(--font-pixel);
  font-size: 10px;
  color: var(--color-accent);
  letter-spacing: 1px;
}

/* Game area */
.game-view__area {
  position: relative;
  width: 100%;
  max-width: 420px;
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
}

/* Game over overlay */
.gameover-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(5px);
  z-index: 20;
  pointer-events: all;
}
.gameover-menu {
  width: 300px;
  max-width: 88vw;
  background: var(--color-panel);
  border: 3px solid #e74c3c;
  box-shadow: 6px 6px 0 #7b241c, 0 0 40px rgba(231, 76, 60, 0.25);
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
  text-shadow: 3px 3px 0 #7b241c, 0 0 20px rgba(231,76,60,0.5);
}
.gameover-stats {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gameover-stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid var(--color-border-dark);
}
.gameover-stat-label {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  letter-spacing: 1px;
}
.gameover-stat-value {
  font-family: var(--font-pixel);
  font-size: 14px;
  color: var(--color-text);
}
.gameover-stat-value.accent { color: var(--color-accent); }
.gameover-stat-value.gold   { color: #f1c40f; font-size: 15px; }
.gold-row { border-bottom: none; padding-top: 8px; }
.gameover-record {
  font-family: var(--font-pixel);
  font-size: 10px;
  color: #f1c40f;
  text-align: center;
  letter-spacing: 2px;
  animation: blink-gold 0.8s step-start infinite;
}
@keyframes blink-gold { 50% { opacity: 0; } }
.gameover-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  align-items: center;
}

/* Vue Transition for game-over slide-up */
.gameover-enter-active {
  animation: gameover-slide-up 0.4s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.gameover-leave-active {
  animation: gameover-slide-up 0.2s reverse both;
}
@keyframes gameover-slide-up {
  from {
    opacity: 0;
    transform: translateY(48px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Exit dialog */
.exit-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.exit-dialog {
  background: var(--color-panel);
  border: 3px solid #ff4444;
  padding: 28px 24px 20px;
  max-width: 300px;
  width: 90%;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.exit-dialog__title {
  font-family: var(--font-pixel);
  font-size: 14px;
  font-weight: 700;
  color: #ff4444;
  letter-spacing: 1px;
}
.exit-dialog__body {
  font-family: var(--font-pixel);
  font-size: 11px;
  color: var(--color-text);
  line-height: 1.8;
}
.exit-dialog__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
