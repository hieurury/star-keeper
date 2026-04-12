<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/gameStore'
import { useAuthStore } from '../stores/authStore'
import LobbyBottomNav from '../components/ui/LobbyBottomNav.vue'
import {
  PhCloudArrowUp,
  PhMagicWand,
  PhMusicNotes,
  PhSignOut,
  PhSpeakerHigh,
  PhSpeakerSlash,
} from '@phosphor-icons/vue'

const router = useRouter()
const game = useGameStore()
const auth = useAuthStore()

const activeTab = ref<'account' | 'audio' | 'graphics'>('account')

function setAudioEnabled(enabled: boolean) {
  game.updateAudioSettings({ enabled })
}

function setMusicEnabled(musicEnabled: boolean) {
  game.updateAudioSettings({ musicEnabled })
}

function setSfxEnabled(sfxEnabled: boolean) {
  game.updateAudioSettings({ sfxEnabled })
}

function setMasterVolume(ev: Event) {
  const value = Number((ev.target as HTMLInputElement).value)
  game.updateAudioSettings({ masterVolume: value / 100 })
}

function setMusicVolume(ev: Event) {
  const value = Number((ev.target as HTMLInputElement).value)
  game.updateAudioSettings({ musicVolume: value / 100 })
}

function setSfxVolume(ev: Event) {
  const value = Number((ev.target as HTMLInputElement).value)
  game.updateAudioSettings({ sfxVolume: value / 100 })
}

function setGraphicsQuality(quality: 'low' | 'high') {
  game.updateGraphicsSettings({ quality })
}

function setShowFps(showFps: boolean) {
  game.updateGraphicsSettings({ showFps })
}
</script>

<template>
  <div class="settings-view">
    <div class="settings-view__inner">
      <header class="settings-head">
        <h1>CÀI ĐẶT</h1>
        <p>Tùy chỉnh tài khoản, âm thanh và đồ họa của trạm chỉ huy.</p>
      </header>

      <div class="settings-tabs">
        <button class="settings-tab" :class="{ 'settings-tab--active': activeTab === 'account' }" @click="activeTab = 'account'">Tài Khoản</button>
        <button class="settings-tab" :class="{ 'settings-tab--active': activeTab === 'audio' }" @click="activeTab = 'audio'">Âm Thanh</button>
        <button class="settings-tab" :class="{ 'settings-tab--active': activeTab === 'graphics' }" @click="activeTab = 'graphics'">Đồ Họa</button>
      </div>

      <section v-if="activeTab === 'account'" class="settings-section">
        <article class="settings-card">
          <template v-if="auth.isLoggedIn">
            <div class="auth-status">
              <div class="auth-status__icon">✅</div>
              <div>
                <div class="auth-status__title">Đã kết nối</div>
                <div class="auth-status__desc">{{ auth.userEmail }}</div>
              </div>
            </div>
            <div class="auth-sync">
              <span v-if="game.pendingSync">⏳ Đang chờ đồng bộ...</span>
              <span v-else>☁ Đã đồng bộ lên Cloud</span>
            </div>
            <div v-if="game.lastSyncError" class="auth-error">⚠ {{ game.lastSyncError }}</div>
            <button class="btn-logout" @click="void auth.logout()">
              <PhSignOut :size="16" /> Đăng xuất
            </button>
          </template>

          <template v-else-if="auth.isGuest">
            <div class="auth-status">
              <div class="auth-status__icon">👤</div>
              <div>
                <div class="auth-status__title">Chơi Khách</div>
                <div class="auth-status__desc">Dữ liệu chỉ lưu trên thiết bị này.</div>
              </div>
            </div>
            <button class="btn-link" @click="router.push('/auth')">
              <PhCloudArrowUp :size="16" /> Liên kết tài khoản
            </button>
          </template>

          <template v-else>
            <div class="auth-status">
              <div class="auth-status__icon">⚠️</div>
              <div>
                <div class="auth-status__title">Chưa đăng nhập</div>
                <div class="auth-status__desc">Vui lòng liên kết để đồng bộ tiến trình.</div>
              </div>
            </div>
            <button class="btn-link" @click="router.push('/auth')">
              <PhCloudArrowUp :size="16" /> Liên kết tài khoản
            </button>
          </template>

          <div v-if="auth.authError" class="auth-error">{{ auth.authError }}</div>
        </article>
      </section>

      <section v-if="activeTab === 'audio'" class="settings-section">
        <article class="settings-card">
          <p class="settings-desc">Điều chỉnh nhạc nền và hiệu ứng theo ý bạn. Cài đặt sẽ được lưu tự động.</p>

          <label class="toggle-row" for="audio-enabled">
            <span class="toggle-row__label"><PhSpeakerHigh :size="13" /> Bật âm thanh</span>
            <span class="switch">
              <input id="audio-enabled" class="switch__input" type="checkbox" :checked="game.audioSettings.enabled" @change="setAudioEnabled(($event.target as HTMLInputElement).checked)" />
              <span class="switch__track" />
            </span>
          </label>

          <label class="toggle-row" for="audio-music">
            <span class="toggle-row__label"><PhMusicNotes :size="13" /> Nhạc nền</span>
            <span class="switch">
              <input id="audio-music" class="switch__input" type="checkbox" :checked="game.audioSettings.musicEnabled" :disabled="!game.audioSettings.enabled" @change="setMusicEnabled(($event.target as HTMLInputElement).checked)" />
              <span class="switch__track" />
            </span>
          </label>

          <label class="toggle-row" for="audio-sfx">
            <span class="toggle-row__label"><PhSpeakerSlash :size="13" /> Hiệu ứng</span>
            <span class="switch">
              <input id="audio-sfx" class="switch__input" type="checkbox" :checked="game.audioSettings.sfxEnabled" :disabled="!game.audioSettings.enabled" @change="setSfxEnabled(($event.target as HTMLInputElement).checked)" />
              <span class="switch__track" />
            </span>
          </label>

          <div class="slider-row">
            <label class="slider-label" for="audio-master">Âm lượng tổng: {{ Math.round(game.audioSettings.masterVolume * 100) }}%</label>
            <input id="audio-master" class="slider" type="range" min="0" max="100" step="1" :value="Math.round(game.audioSettings.masterVolume * 100)" :disabled="!game.audioSettings.enabled" @input="setMasterVolume" />
          </div>

          <div class="slider-row">
            <label class="slider-label" for="audio-music-volume">Âm lượng nhạc nền: {{ Math.round(game.audioSettings.musicVolume * 100) }}%</label>
            <input id="audio-music-volume" class="slider" type="range" min="0" max="100" step="1" :value="Math.round(game.audioSettings.musicVolume * 100)" :disabled="!game.audioSettings.enabled || !game.audioSettings.musicEnabled" @input="setMusicVolume" />
          </div>

          <div class="slider-row">
            <label class="slider-label" for="audio-sfx-volume">Âm lượng hiệu ứng: {{ Math.round(game.audioSettings.sfxVolume * 100) }}%</label>
            <input id="audio-sfx-volume" class="slider" type="range" min="0" max="100" step="1" :value="Math.round(game.audioSettings.sfxVolume * 100)" :disabled="!game.audioSettings.enabled || !game.audioSettings.sfxEnabled" @input="setSfxVolume" />
          </div>
        </article>
      </section>

      <section v-if="activeTab === 'graphics'" class="settings-section">
        <article class="settings-card">
          <p class="settings-desc">Mức Thấp sẽ tắt nhiều hiệu ứng để ưu tiên độ mượt.</p>

          <div class="quality-row">
            <button class="quality-btn" :class="{ 'quality-btn--active': game.graphicsQuality === 'low' }" @click="setGraphicsQuality('low')">
              <PhMagicWand :size="13" /> Thấp
            </button>
            <button class="quality-btn" :class="{ 'quality-btn--active': game.graphicsQuality === 'high' }" @click="setGraphicsQuality('high')">
              <PhMagicWand :size="13" /> Cao
            </button>
          </div>

          <label class="toggle-row" for="graphics-show-fps">
            <span class="toggle-row__label"><span class="toggle-row__fps-badge">FPS</span> Hiển thị FPS trong game</span>
            <span class="switch">
              <input id="graphics-show-fps" class="switch__input" type="checkbox" :checked="game.showFps" @change="setShowFps(($event.target as HTMLInputElement).checked)" />
              <span class="switch__track" />
            </span>
          </label>
        </article>
      </section>
    </div>

    <LobbyBottomNav />
  </div>
</template>

<style scoped>
.settings-view {
  min-height: 100dvh;
  padding: 14px 12px 90px;
}

.settings-view__inner {
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-head {
  border: 2px solid var(--color-border-dark);
  background: linear-gradient(180deg, rgba(11, 19, 36, 0.92), rgba(8, 13, 27, 0.95));
  padding: 12px;
}

.settings-head h1 {
  margin: 0;
  font-family: var(--font-pixel);
  font-size: 14px;
  color: #9fd9ff;
}

.settings-head p {
  margin: 5px 0 0;
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #8fa5c2;
  line-height: 1.5;
}

.settings-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.settings-tab {
  border: 2px solid #2b456b;
  background: rgba(14, 23, 44, 0.88);
  color: #91a8c6;
  font-family: var(--font-pixel);
  font-size: 9px;
  text-transform: uppercase;
  padding: 9px 6px;
  cursor: pointer;
}

.settings-tab--active {
  border-color: #5fcfff;
  color: #cbf0ff;
}

.settings-card {
  border: 2px solid var(--color-border-dark);
  background: rgba(11, 19, 37, 0.9);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.settings-desc {
  margin: 0;
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #93a9c8;
  line-height: 1.6;
}

.auth-status {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(98, 132, 172, 0.35);
  background: rgba(8, 16, 31, 0.8);
  padding: 8px;
}

.auth-status__icon {
  font-size: 14px;
}

.auth-status__title,
.auth-status__desc,
.auth-sync,
.auth-error {
  font-family: var(--font-pixel);
  font-size: 8px;
}

.auth-status__title {
  color: #dcf2ff;
}

.auth-status__desc,
.auth-sync {
  color: #8ca8cb;
}

.auth-error {
  color: #ff8a8a;
}

.btn-logout,
.btn-link {
  border: 2px solid #315f95;
  background: rgba(17, 42, 75, 0.9);
  color: #bfe7ff;
  font-family: var(--font-pixel);
  font-size: 9px;
  text-transform: uppercase;
  padding: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
}

.btn-logout {
  border-color: rgba(229, 62, 62, 0.4);
  color: #ffb2b2;
  background: rgba(66, 18, 18, 0.65);
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid rgba(100, 132, 170, 0.35);
  background: rgba(10, 17, 33, 0.85);
  padding: 8px;
}

.toggle-row__label,
.slider-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #9ab2d0;
}

.toggle-row__fps-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 14px;
  border: 1px solid rgba(111, 206, 255, 0.65);
  background: rgba(16, 55, 89, 0.9);
  color: #c9f1ff;
  font-family: var(--font-pixel);
  font-size: 7px;
  letter-spacing: 0.4px;
}

.switch {
  position: relative;
  width: 36px;
  height: 18px;
  flex-shrink: 0;
}

.switch__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  margin: 0;
}

.switch__track {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(104, 142, 183, 0.55);
  background: rgba(9, 19, 36, 0.92);
  transition: border-color 0.15s, background 0.15s;
}

.switch__track::after {
  content: '';
  position: absolute;
  top: 1px;
  left: 1px;
  width: 14px;
  height: 14px;
  background: #9bb7d8;
  border: 1px solid rgba(210, 230, 255, 0.5);
  transition: transform 0.15s, background 0.15s;
}

.switch__input:checked + .switch__track {
  border-color: rgba(100, 215, 255, 0.7);
  background: rgba(18, 56, 94, 0.92);
}

.switch__input:checked + .switch__track::after {
  transform: translateX(18px);
  background: #79dbff;
}

.switch__input:disabled {
  cursor: default;
}

.switch__input:disabled + .switch__track {
  opacity: 0.55;
}

.slider-row {
  border: 1px solid rgba(100, 132, 170, 0.35);
  background: rgba(10, 17, 33, 0.78);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.slider {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 10px;
  border: 1px solid rgba(103, 145, 194, 0.55);
  background: linear-gradient(180deg, rgba(7, 15, 30, 0.95), rgba(10, 23, 44, 0.95));
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 16px;
  border: 1px solid #f0d287;
  background: linear-gradient(180deg, #f8dc8e, #d9ad42);
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 12px;
  height: 16px;
  border: 1px solid #f0d287;
  background: linear-gradient(180deg, #f8dc8e, #d9ad42);
  border-radius: 0;
  cursor: pointer;
}

.slider::-moz-range-track {
  height: 10px;
  border: 1px solid rgba(103, 145, 194, 0.55);
  background: linear-gradient(180deg, rgba(7, 15, 30, 0.95), rgba(10, 23, 44, 0.95));
}

.slider:disabled {
  opacity: 0.5;
}

.quality-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.quality-btn {
  border: 1px solid rgba(101, 135, 178, 0.35);
  background: rgba(11, 22, 42, 0.88);
  color: #8da9ca;
  font-family: var(--font-pixel);
  font-size: 9px;
  padding: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
}

.quality-btn--active {
  border-color: #57d0ff;
  color: #d0f3ff;
}
</style>
