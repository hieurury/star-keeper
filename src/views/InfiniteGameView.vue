<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { useGameStore } from '../stores/gameStore'
import { useUiStore } from '../stores/uiStore'
import GameCanvas from '../components/game/GameCanvas.vue'
import GameHUD from '../components/game/GameHUD.vue'
import PixelButton from '../components/ui/PixelButton.vue'
import TourOverlay, { type TourStep } from '../components/ui/TourOverlay.vue'

const router = useRouter()
const game = useGameStore()
const ui = useUiStore()

// Prevent gameover overlay from flashing before the canvas initialises and
// calls startGame() (which sets isPlaying = true).
const isInitializing = ref(true)
watch(() => game.isPlaying, (val) => { if (val) isInitializing.value = false }, { immediate: true })

const showExitWarning = ref(false)
const exitConfirmed = ref(false)
let pausedForDialog = false

const showGameTour = ref(false)

const isTouchDevice = 'ontouchstart' in window

const GAME_TOUR_STEPS: TourStep[] = [
  {
    title: '✈ THÀNH CHIẾN ĐẤU!',
    desc: 'Hãy làm quen với màn hình chiến đấu trong vài giây.',
  },
  {
    target: 'hud-hp',
    title: 'Máu (HP)',
    desc: 'Thanh máu hiện tại của phi cơ. Khi về 0 — game over. Tránh đạn và không để kẻ địch đâm thẳng.',
  },
  {
    target: 'hud-score',
    title: 'Điểm Số',
    desc: 'Mỗi kẻ địch tiêu diệt cộng điểm. Boss cho nhiều điểm hơn. Phá kỷ lục cao nhất để được ghi danh!',
  },
  {
    target: 'hud-enemies',
    title: 'Tiến Độ Stage',
    desc: 'Thanh này cho biết bạn đã tiêu diệt bao nhiêu kẻ địch. Diệt hết để qua stage mới với kế địch mạnh hơn.',
  },
  {
    target: 'hud-exp',
    title: 'Kinh Nghiệm (EXP)',
    desc: 'Khi lên cấp, bạn được chọn 1 trong 3 thẻ kỹ năng ngẫu nhiên. Kết hợp đúng thẻ sẽ mở khóa được thẻ TỐI THƯỢNG cực mạnh!',
  },
  {
    target: 'hud-skill',
    title: 'Kỹ Năng — Sóng Tầm Nhiệt',
    desc: (isTouchDevice
      ? 'Chạm đôi (2× TAP) màn hình để kích hoạt.'
      : 'Nhấn chuột phải (RMB) để kích hoạt.'
    ) + '\n\nGiải phóng sóng nhiệt hủy diệt toàn màn hình và phá sạch đạn kẻ địch. Hồi chiêu 30 giây.',
  },
  {
    target: 'game-bar',
    title: 'Dừng / Tiếp Tục',
    desc: 'Nhấn nút Dừng để tạm nghỉ. Trong màn hình dừng bạn có thể xem các thẻ kỹ năng đang có và thoát về trang chủ.',
  },
  {
    title: 'SẸN SÀNG!',
    desc: 'Di chuyển: ' + (isTouchDevice ? 'chạm và trượt ngón tay' : 'kéo chuột') + '\nKỹ năng: ' + (isTouchDevice ? 'chạm đôi' : 'chuột phải') + '\n\nTiêu diệt kẻ địch, lên cấp, tồn tại càng lâu càng tốt. Chúc mừng chiến đấu! ⚡',
  },
]

function startGameTour() {
  game.isPaused = true
  showGameTour.value = true
}
function onGameTourDone() {
  showGameTour.value = false
  game.isPaused = false
  localStorage.setItem('hasSeenGameTour', '1')
}

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

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  // Request fullscreen on mobile to hide browser bars
  if (isTouchDevice) {
    const el = document.documentElement as any
    const req = el.requestFullscreen ?? el.webkitRequestFullscreen ?? el.mozRequestFullScreen
    if (req) req.call(el).catch(() => {})
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  // Exit fullscreen when leaving game
  const exit = (document as any).exitFullscreen ?? (document as any).webkitExitFullscreen
  if (exit && document.fullscreenElement) exit.call(document).catch(() => {})
})

// Show in-game tour the first time the game starts
watch(() => game.isPlaying, (val) => {
  if (val && !localStorage.getItem('hasSeenGameTour')) {
    // Small delay so the canvas finishes intro animation first
    setTimeout(startGameTour, 1800)
  }
}, { once: true })

watch(() => game.currentStage, (nextStage, prevStage) => {
  if (!game.isPlaying || nextStage <= 1 || nextStage <= prevStage) return
  const token = ui.showLoading({
    title: `Stage ${nextStage}`,
    subtitle: 'Đang tải đội hình kẻ địch...',
  })
  setTimeout(() => ui.hideLoading(token), 900)
})
</script>

<template>
  <div class="game-view">
    <!-- Top control bar -->
    <div class="game-view__bar" data-tour="game-bar">
      <div class="game-view__bar-title">CHẾ ĐỘ VÔ TẬN</div>
      <PixelButton
        :label="game.isPaused ? '&#9654; Tiếp' : '&#9208; Dừng'"
        variant="secondary"
        size="sm"
        @click="game.pauseGame()"
      />
    </div>

    <!-- Game area -->
    <div class="game-view__area">
      <GameCanvas />
      <GameHUD @request-go-home="requestGoHome" @request-tour="startGameTour" :tour-active="showGameTour" />

      <!-- Game over menu (slides up after 2s death sequence) -->
      <Transition name="gameover">
        <div v-if="!game.isPlaying && !isInitializing" class="gameover-overlay">
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
        <div class="exit-dialog__body">Vàng kiếm được sẽ được giữ lại.<br>Tiến trình khác (exp, stage) sẽ bị mất.</div>
        <div class="exit-dialog__actions">
          <PixelButton label="✗ Hủy" variant="secondary" size="md" @click="cancelExit" />
          <PixelButton label="✓ Thoát" variant="danger" size="md" @click="confirmExit" />
        </div>
      </div>
    </div>

    <!-- In-game spotlight tour -->
    <TourOverlay v-if="showGameTour" :steps="GAME_TOUR_STEPS" @done="onGameTourDone" />
  </div>
</template>

<style scoped>
.game-view {
  width: 100%;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  align-items: center;
  overflow: hidden;
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
