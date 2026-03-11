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
const showShipsPanel = ref(false)
const editingUsername = ref(false)
const editingShipName = ref(false)
const usernameInput = ref('')
const shipNameInput = ref('')

// Dữ liệu phi cơ
const starKeeperStats = [
  { label: 'SÁT THƯƠNG',  display: '10 / 100',  pct: 10, color: '#ff4444' },
  { label: 'TỐC ĐỘ BẮN', display: '1.0 / 1.5', pct: 67, color: '#ff9900' },
  { label: 'ĐẠN / LỚT',   display: '1 / 3',    pct: 33, color: '#ffcc00' },
  { label: 'TỐC BAY',     display: '1.0 / 1.5', pct: 67, color: '#44aaff' },
  { label: 'HP',          display: '100 / 300', pct: 33, color: '#44ff88' },
]

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
            <span class="stat-value">{{ game.accountLevel }}</span>
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
        <!-- Account EXP bar -->
        <div class="exp-bar-wrapper">
          <div class="exp-bar-label">EXP TÀI KHOẢN {{ game.accountExp }} / {{ game.accountExpToNextLevel }}</div>
          <div class="exp-bar">
            <div class="exp-bar__fill" :style="{ width: game.accountExpPercent + '%' }" />
          </div>
        </div>
        <!-- Achievements -->
        <div v-if="game.unlockedAchievements.length > 0" class="ach-summary">
          <div class="ach-summary__label">🏅 THÀNH TỰU ({{ game.unlockedAchievements.length }})</div>
          <div class="ach-summary__count">{{ game.unlockedAchievements.length }} / 12 mở khóa</div>
        </div>
      </PixelPanel>

      <!-- Menu buttons -->
      <div class="home__menu">
        <PixelButton label="▶ Bắt Đầu" size="lg" @click="startGame" />
        <PixelButton label="Phi Cơ" variant="secondary" size="md" @click="showShipsPanel = true" />
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

    <!-- Ships Panel -->
    <Transition name="sheet">
      <div v-if="showShipsPanel" class="sheet-overlay" @click.self="showShipsPanel = false">
        <div class="ships-sheet">
          <div class="sheet-header">
            <div class="sheet-title">PHI CƠ</div>
            <button class="sheet-close" @click="showShipsPanel = false">✕</button>
          </div>

          <div class="ships-scroll">
            <!-- Star Keeper card -->
            <div class="ship-card">
              <div class="ship-card__header">
                <svg class="ship-svg" viewBox="-32 -28 64 58" width="60" height="58">
                  <!-- Wings -->
                  <polygon points="-10,0 -28,18 -10,10" fill="#0077bb"/>
                  <polygon points="10,0 28,18 10,10" fill="#0077bb"/>
                  <!-- Body -->
                  <rect x="-10" y="-22" width="20" height="34" fill="#00cfff"/>
                  <!-- Cockpit -->
                  <rect x="-5" y="-22" width="10" height="13" fill="#ffd700"/>
                  <!-- Thruster -->
                  <rect x="-6" y="12" width="12" height="9" fill="#ff6600" opacity="0.85"/>
                </svg>
                <div class="ship-card__info">
                  <div class="ship-card__name">STAR KEEPER</div>
                  <div class="ship-card__tag">⭐ Phi cơ cơ bản · Miễn phí</div>
                  <div class="ship-card__desc">Chiến cơ mức trung bình, cân bằng giữa tốc độ và sức mạnh. Lựa chọn đầu tiên cho mọi phi công.</div>
                </div>
              </div>

              <!-- Stats bars -->
              <div class="ship-stats">
                <div v-for="stat in starKeeperStats" :key="stat.label" class="ship-stat">
                  <span class="ship-stat__label">{{ stat.label }}</span>
                  <div class="ship-stat__track">
                    <div class="ship-stat__fill" :style="{ width: stat.pct + '%', background: stat.color }" />
                  </div>
                  <span class="ship-stat__val">{{ stat.display }}</span>
                </div>
              </div>

              <!-- Skill -->
              <div class="ship-skill">
                <div class="ship-skill__name">🌊 SÓNG TẦM NHIỀT HUỶ DIỆT</div>
                <div class="ship-skill__cd">⏱ Hồi chiêu: 30 giây</div>
                <div class="ship-skill__desc">Toả ra sóng nhiệt tốc độ cao, gây sát thương lên tất cả kẻ địch trên màn hình và huỷ toàn bộ đường đạn của đối phương.</div>
              </div>
            </div>

            <!-- Placeholder: phi cơ khác -->
            <div class="ship-locked">
              <div class="ship-locked__icon">🔒</div>
              <div class="ship-locked__text">Phi cơ mới · Sắp ra mắt</div>
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

/* Achievements summary */
.ach-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding: 7px 10px;
  background: rgba(241, 196, 15, 0.07);
  border: 1px solid rgba(241, 196, 15, 0.3);
}
.ach-summary__label {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #f1c40f;
  letter-spacing: 1px;
}
.ach-summary__count {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
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

/* ─── Ships Panel ────────────────────────────────────────────────────────── */
.ships-sheet {
  width: 100%;
  max-width: 420px;
  max-height: 88dvh;
  background: var(--color-panel);
  border-top: 3px solid var(--color-border);
  border-left: 3px solid var(--color-border);
  border-right: 3px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ships-scroll {
  overflow-y: auto;
  padding: 14px 16px 32px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* Ship card */
.ship-card {
  background: var(--color-panel-dark);
  border: 2px solid var(--color-border);
  box-shadow: 4px 4px 0 var(--color-border-dark);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ship-card__header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.ship-svg {
  flex-shrink: 0;
  filter: drop-shadow(0 0 8px rgba(0, 200, 255, 0.5));
}
.ship-card__info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ship-card__name {
  font-family: var(--font-pixel);
  font-size: 14px;
  color: var(--color-accent);
  letter-spacing: 1px;
}
.ship-card__tag {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #f1c40f;
  letter-spacing: 1px;
}
.ship-card__desc {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  line-height: 1.7;
  letter-spacing: 0.3px;
}

/* Stats bars */
.ship-stats {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.ship-stat {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ship-stat__label {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  letter-spacing: 0.5px;
  min-width: 84px;
}
.ship-stat__track {
  flex: 1;
  height: 9px;
  background: #0a0e1e;
  border: 2px solid #1a2040;
  overflow: hidden;
}
.ship-stat__fill {
  height: 100%;
  transition: width 0.6s ease;
  box-shadow: 0 0 5px currentColor;
}
.ship-stat__val {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  min-width: 54px;
  text-align: right;
  white-space: nowrap;
}

/* Skill info */
.ship-skill {
  background: rgba(255, 100, 0, 0.07);
  border: 2px solid rgba(255, 100, 0, 0.4);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.ship-skill__name {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #ff8833;
  letter-spacing: 1px;
}
.ship-skill__cd {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #ffaa55;
  letter-spacing: 0.5px;
}
.ship-skill__desc {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  line-height: 1.7;
  letter-spacing: 0.2px;
}

/* Locked slot */
.ship-locked {
  border: 2px dashed var(--color-border-dark);
  padding: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  opacity: 0.45;
}
.ship-locked__icon { font-size: 22px; }
.ship-locked__text {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-text-dim);
  letter-spacing: 1px;
}
</style>
