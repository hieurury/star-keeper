<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/gameStore'
import PixelButton from '../components/ui/PixelButton.vue'
import PixelPanel from '../components/ui/PixelPanel.vue'

const router = useRouter()
const game = useGameStore()

const AVATARS = ['🚀', '✈', '⚡', '🔥', '🛸', '⭐']

const showProfileSheet = ref(false)
const editingUsername = ref(false)
const editingShipName = ref(false)
const usernameInput = ref('')
const shipNameInput = ref('')

onMounted(() => {
  game.loadProgress()
})

function startGame() {
  router.push('/game')
}

function openProfileSheet() {
  usernameInput.value = game.username
  shipNameInput.value = game.shipName
  showProfileSheet.value = true
}

function closeProfileSheet() {
  showProfileSheet.value = false
  editingUsername.value = false
  editingShipName.value = false
}

function selectAvatar(idx: number) {
  game.avatarId = idx
  game.saveProgress()
}

function saveUsername() {
  const trimmed = usernameInput.value.trim()
  if (trimmed) { game.username = trimmed; game.saveProgress() }
  editingUsername.value = false
}

function saveShipName() {
  const trimmed = shipNameInput.value.trim()
  if (trimmed) { game.shipName = trimmed; game.saveProgress() }
  editingShipName.value = false
}

function onUsernameKey(e: KeyboardEvent) {
  if (e.key === 'Enter') saveUsername()
  if (e.key === 'Escape') editingUsername.value = false
}

function onShipNameKey(e: KeyboardEvent) {
  if (e.key === 'Enter') saveShipName()
  if (e.key === 'Escape') editingShipName.value = false
}
</script>

<template>
  <div class="home">
    <!-- Starfield background -->
    <div class="starfield">
      <span v-for="n in 60" :key="n" class="star" :style="{
        left: (Math.random() * 100) + '%',
        top: (Math.random() * 100) + '%',
        animationDelay: (Math.random() * 3) + 's',
        width: (Math.random() * 2 + 1) + 'px',
        height: (Math.random() * 2 + 1) + 'px',
      }" />
    </div>

    <!-- Top profile bar -->
    <div class="home__topbar">
      <button class="profile-btn" @click="openProfileSheet">
        <div class="profile-avatar">{{ AVATARS[game.avatarId] }}</div>
        <div class="profile-info">
          <div class="profile-name">{{ game.username }}</div>
          <div class="profile-ship">{{ game.shipName }}</div>
        </div>
      </button>
      <div class="currency-display">
        <div class="gold-display">
          <span class="gold-icon">🪙</span>
          <span class="gold-amount">{{ game.playerCoins }}</span>
        </div>
        <div class="ruby-display">
          <span class="ruby-icon">💎</span>
          <span class="ruby-amount">{{ game.playerRuby }}</span>
        </div>
      </div>
    </div>

    <div class="home__container">
      <!-- Logo / Title -->
      <div class="home__hero">
        <div class="home__title-wrapper">
          <h1 class="home__title">BẮN<br/>MÁY BAY</h1>
          <div class="home__subtitle">STAR SHOOTER</div>
        </div>
        <div class="home__ship-icon">✈</div>
      </div>

      <!-- Player Stats -->
      <PixelPanel title="Tiến Độ">
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-label">Cấp độ</span>
            <span class="stat-value">{{ game.playerLevel }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">🪙 Vàng</span>
            <span class="stat-value coin">{{ game.playerCoins }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Kỷ lục</span>
            <span class="stat-value score">{{ game.highScore }}</span>
          </div>
        </div>
        <!-- EXP bar -->
        <div class="exp-bar-wrapper">
          <div class="exp-bar-label">EXP {{ game.playerExp }} / {{ game.expToNextLevel }}</div>
          <div class="exp-bar">
            <div class="exp-bar__fill" :style="{ width: game.expPercent + '%' }" />
          </div>
        </div>
      </PixelPanel>

      <!-- Menu buttons -->
      <div class="home__menu">
        <PixelButton label="▶ Bắt Đầu" size="lg" @click="startGame" />
        <PixelButton label="Nâng Cấp" variant="secondary" size="md" @click="() => {}" />
        <PixelButton label="Bảng Xếp Hạng" variant="secondary" size="md" @click="() => {}" />
      </div>

      <!-- Version -->
      <div class="home__footer">v0.1.0 · PIXEL EDITION</div>
    </div>

    <!-- Profile Sheet Overlay -->
    <Transition name="sheet">
      <div v-if="showProfileSheet" class="sheet-overlay" @click.self="closeProfileSheet">
        <div class="profile-sheet">
          <div class="sheet-header">
            <div class="sheet-title">HỒ SƠ PHI CÔNG</div>
            <button class="sheet-close" @click="closeProfileSheet">✕</button>
          </div>

          <!-- Username -->
          <div class="sheet-section">
            <div class="sheet-section-label">TÊN PHI CÔNG</div>
            <div class="sheet-edit-row" v-if="!editingUsername">
              <span class="sheet-value">{{ game.username }}</span>
              <button class="edit-btn" @click="editingUsername = true; usernameInput = game.username">✏</button>
            </div>
            <div class="sheet-input-row" v-else>
              <input
                v-model="usernameInput"
                class="sheet-input"
                maxlength="20"
                autofocus
                @keydown="onUsernameKey"
              />
              <button class="confirm-btn" @click="saveUsername">✓</button>
            </div>
          </div>

          <!-- Ship name -->
          <div class="sheet-section">
            <div class="sheet-section-label">TÊN CHIẾN CƠ</div>
            <div class="sheet-edit-row" v-if="!editingShipName">
              <span class="sheet-value">{{ game.shipName }}</span>
              <button class="edit-btn" @click="editingShipName = true; shipNameInput = game.shipName">✏</button>
            </div>
            <div class="sheet-input-row" v-else>
              <input
                v-model="shipNameInput"
                class="sheet-input"
                maxlength="24"
                autofocus
                @keydown="onShipNameKey"
              />
              <button class="confirm-btn" @click="saveShipName">✓</button>
            </div>
          </div>

          <!-- Avatar picker -->
          <div class="sheet-section">
            <div class="sheet-section-label">CHỌN AVATAR</div>
            <div class="avatar-grid">
              <button
                v-for="(av, idx) in AVATARS"
                :key="idx"
                class="avatar-option"
                :class="{ 'avatar-option--selected': game.avatarId === idx }"
                @click="selectAvatar(idx)"
              >{{ av }}</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.home {
  position: relative;
  width: 100%;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-bg);
  overflow: hidden;
}

/* Starfield */
.starfield {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.star {
  position: absolute;
  background: #fff;
  border-radius: 50%;
  opacity: 0.6;
  animation: twinkle 2.5s ease-in-out infinite alternate;
}
@keyframes twinkle {
  from { opacity: 0.2; }
  to   { opacity: 1; }
}

/* Top profile bar */
.home__topbar {
  position: sticky;
  top: 0;
  width: 100%;
  max-width: 420px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: rgba(8, 8, 20, 0.88);
  border-bottom: 2px solid var(--color-border-dark);
  backdrop-filter: blur(8px);
  z-index: 10;
}
.profile-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
.profile-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-panel);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  line-height: 1;
  transition: border-color 0.2s;
}
.profile-btn:hover .profile-avatar { border-color: var(--color-accent); }
.profile-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
}
.profile-name {
  font-family: var(--font-pixel);
  font-size: 11px;
  color: var(--color-text);
}
.profile-ship {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  letter-spacing: 0.5px;
}
.currency-display {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}
.gold-display,
.ruby-display {
  display: flex;
  align-items: center;
  gap: 5px;
  background: var(--color-panel);
  padding: 3px 10px;
  font-family: var(--font-pixel);
}
.gold-display { border: 2px solid #7d6608; }
.ruby-display { border: 2px solid #7b1fa2; }
.gold-icon, .ruby-icon { font-size: 14px; }
.gold-amount {
  font-size: 14px;
  color: #f1c40f;
  min-width: 20px;
  text-align: right;
}
.ruby-amount {
  font-size: 14px;
  color: #e040fb;
  min-width: 20px;
  text-align: right;
}

/* Container */
.home__container {
  position: relative;
  width: 100%;
  max-width: 380px;
  padding: 20px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  z-index: 1;
}

/* Hero */
.home__hero {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 8px 0;
}
.home__title {
  font-family: var(--font-pixel);
  font-size: 32px;
  line-height: 1.15;
  color: var(--color-accent);
  text-shadow:
    3px 3px 0 var(--color-accent-dark),
    0 0 20px rgba(0, 200, 255, 0.4);
  margin: 0;
  letter-spacing: 2px;
}
.home__subtitle {
  font-family: var(--font-pixel);
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 3px;
  margin-top: 4px;
}
.home__ship-icon {
  font-size: 64px;
  animation: float 2s ease-in-out infinite alternate;
  filter: drop-shadow(0 0 12px var(--color-accent));
  transform: rotate(-90deg);
}
@keyframes float {
  from { transform: rotate(-90deg) translateX(-6px); }
  to   { transform: rotate(-90deg) translateX(6px); }
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  background: var(--color-panel-dark);
  border: 2px solid var(--color-border-dark);
}
.stat-label {
  font-size: 9px;
  font-family: var(--font-pixel);
  color: var(--color-text-dim);
  text-transform: uppercase;
  letter-spacing: 1px;
}
.stat-value {
  font-family: var(--font-pixel);
  font-size: 18px;
  color: var(--color-text);
}
.stat-value.coin  { color: #f1c40f; }
.stat-value.score { color: var(--color-accent); }

/* EXP */
.exp-bar-wrapper { margin-top: 4px; }
.exp-bar-label {
  font-size: 9px;
  font-family: var(--font-pixel);
  color: var(--color-text-dim);
  margin-bottom: 4px;
}
.exp-bar {
  height: 10px;
  background: var(--color-panel-dark);
  border: 2px solid var(--color-border-dark);
  overflow: hidden;
}
.exp-bar__fill {
  height: 100%;
  background: linear-gradient(90deg, #27ae60, #2ecc71);
  transition: width 0.5s ease;
  box-shadow: 0 0 6px #2ecc71;
}

/* Menu */
.home__menu {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
}

/* Footer */
.home__footer {
  text-align: center;
  font-size: 9px;
  font-family: var(--font-pixel);
  color: var(--color-text-dim);
  letter-spacing: 2px;
  opacity: 0.5;
}

/* ─── Profile Sheet ───────────────────────────────────────────────────── */
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}
.profile-sheet {
  width: 100%;
  max-width: 420px;
  background: var(--color-panel);
  border-top: 3px solid var(--color-border);
  border-left: 3px solid var(--color-border);
  border-right: 3px solid var(--color-border);
  padding: 0 0 32px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  border-bottom: 2px solid var(--color-border-dark);
}
.sheet-title {
  font-family: var(--font-pixel);
  font-size: 11px;
  color: var(--color-accent);
  letter-spacing: 2px;
}
.sheet-close {
  background: none;
  border: 2px solid var(--color-border-dark);
  color: var(--color-text-dim);
  font-size: 14px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: sans-serif;
}
.sheet-close:hover { border-color: var(--color-border); color: var(--color-text); }
.sheet-section {
  padding: 14px 20px 0;
}
.sheet-section-label {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  letter-spacing: 2px;
  margin-bottom: 8px;
}
.sheet-edit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-panel-dark);
  border: 2px solid var(--color-border-dark);
  padding: 8px 12px;
}
.sheet-value {
  font-family: var(--font-pixel);
  font-size: 13px;
  color: var(--color-text);
}
.edit-btn {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
}
.edit-btn:hover { color: var(--color-accent); }
.sheet-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.sheet-input {
  flex: 1;
  background: var(--color-panel-dark);
  border: 2px solid var(--color-accent);
  color: var(--color-text);
  font-family: var(--font-pixel);
  font-size: 13px;
  padding: 8px 10px;
  outline: none;
}
.confirm-btn {
  background: var(--color-accent-dark, #006088);
  border: 2px solid var(--color-accent);
  color: var(--color-accent);
  font-size: 16px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: sans-serif;
}
.confirm-btn:hover { background: var(--color-accent); color: #000; }

/* Avatar grid */
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 8px;
  padding-bottom: 4px;
}
.avatar-option {
  aspect-ratio: 1;
  background: var(--color-panel-dark);
  border: 2px solid var(--color-border-dark);
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, transform 0.1s;
  border-radius: 4px;
}
.avatar-option:hover { border-color: var(--color-border); transform: scale(1.08); }
.avatar-option--selected {
  border-color: var(--color-accent);
  box-shadow: 0 0 10px rgba(0, 200, 255, 0.4);
  background: rgba(0, 200, 255, 0.08);
}

/* Transitions */
.sheet-enter-active { animation: sheet-up 0.3s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
.sheet-leave-active { animation: sheet-up 0.2s reverse both; }
@keyframes sheet-up {
  from { transform: translateY(100%); opacity: 0.6; }
  to   { transform: translateY(0);    opacity: 1; }
}
</style>
