<script setup lang="ts">
import { ref, watch } from 'vue'
import { useGameStore } from '../../stores/gameStore'
import type { UpgradeRarity } from '../../stores/gameStore'

const game = useGameStore()

function rarityLabel(r: UpgradeRarity) {
  return { white: 'THƯỜNG', blue: 'HIẾM', purple: 'Sử THI', gold: 'HUYỀN THOẠI' }[r]
}

// Flash kéo sự chú ý khi cooldown xong
const skillJustReady = ref(false)
watch(() => game.isSkillReady, (ready) => {
  if (ready) {
    skillJustReady.value = true
    setTimeout(() => { skillJustReady.value = false }, 900)
  }
})
</script>

<template>
  <div class="hud">
    <!-- Top bar -->
    <div class="hud__top">
      <!-- HP bar -->
      <div class="hud__hp">
        <div class="hud__hp-label">HP</div>
        <div class="hud__hp-track">
          <div
            class="hud__hp-fill"
            :style="{ width: game.hpPercent + '%' }"
            :class="{
              'hud__hp-fill--mid': game.hpPercent <= 50 && game.hpPercent > 25,
              'hud__hp-fill--low': game.hpPercent <= 25,
            }"
          />
        </div>
        <div class="hud__hp-num">{{ game.playerHp }}/{{ game.playerMaxHp }}</div>
      </div>

      <div class="hud__score">
        <span class="hud__score-label">SCORE</span>
        <span class="hud__score-value">{{ game.currentScore }}</span>
      </div>
      <div class="hud__stage">
        <span class="hud__stage-label">STAGE</span>
        <span class="hud__stage-value">{{ game.currentStage }}</span>
      </div>
      <div class="hud__enemies">
        <span class="hud__enemies-label">TIÊU DIỆT</span>
        <div class="hud__enemies-track">
          <div class="hud__enemies-fill" :style="{ width: game.stageProgress + '%' }" />
        </div>
        <span class="hud__enemies-num">{{ game.stageEnemiesKilled }}/{{ game.stageEnemiesTotal }}</span>
      </div>
    </div>

    <!-- EXP bar (below top bar) -->
    <div class="hud__exp-row">
      <span class="hud__exp-label">LV{{ game.playerLevel }}</span>
      <div class="hud__exp-track">
        <div class="hud__exp-fill" :style="{ width: game.expPercent + '%' }" />
      </div>
      <span class="hud__exp-num">{{ game.playerExp }}/{{ game.expToNextLevel }}</span>
    </div>

    <!-- Pause overlay -->
    <div v-if="game.isPaused && !game.isLevelUpPending" class="hud__pause-overlay">
      <div class="hud__pause-box">
        <div class="hud__pause-title">PAUSE</div>
        <div class="hud__pause-score">Score: {{ game.currentScore }}</div>
      </div>
    </div>

    <!-- Level-up overlay -->
    <div v-if="game.isLevelUpPending" class="hud__levelup-overlay">
      <div class="hud__levelup-box">
        <div class="hud__levelup-title">&#9650; LEVEL UP! &#9650;</div>
        <div class="hud__levelup-sub">Chọn nâng cấp</div>
        <div class="hud__levelup-choices">
          <button
            v-for="opt in game.levelUpChoices"
            :key="opt.id"
            class="hud__levelup-card"
            :class="'rarity-' + opt.rarity"
            @click="game.chooseLevelUpOption(opt)"
          >
            <div class="hud__levelup-card-name">{{ opt.name }}</div>
            <div class="hud__levelup-card-desc">{{ opt.desc }}</div>
            <div class="hud__levelup-card-rarity">{{ rarityLabel(opt.rarity) }}</div>
          </button>
        </div>
      </div>
    </div>

    <!-- Game over overlay removed — handled by InfiniteGameView -->

    <!-- Skill button: bên trái, ngang vị trí máy bay xuất hiện -->
    <div
      v-if="game.isPlaying && !game.isLevelUpPending"
      class="hud__skill-wrap"
    >
      <button
        class="hud__skill-btn"
        :class="{
          'hud__skill-btn--ready': game.isSkillReady,
          'hud__skill-btn--flash': skillJustReady,
        }"
        :disabled="!game.isSkillReady || game.isPaused"
        @click="game.activateSkill()"
      >
        <span v-if="game.isSkillReady" class="hud__skill-icon">🌊</span>
        <span v-else class="hud__skill-cd">{{ Math.ceil(game.skillCooldown) }}</span>
      </button>
      <div class="hud__skill-label">SÓNG<br/>NHIỀT</div>
    </div>
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  font-family: var(--font-pixel);
}

/* Top bar */
.hud__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.6);
  border-bottom: 2px solid var(--color-border-dark);
  backdrop-filter: blur(4px);
}

.hud__hp {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  max-width: 140px;
}
.hud__hp-label {
  font-size: 8px;
  color: #e74c3c;
  letter-spacing: 1px;
  white-space: nowrap;
}
.hud__hp-track {
  flex: 1;
  height: 10px;
  background: #1a0a0a;
  border: 2px solid #5a1010;
  overflow: hidden;
}
.hud__hp-fill {
  height: 100%;
  background: #e74c3c;
  box-shadow: 0 0 5px #e74c3c;
  transition: width 0.2s, background 0.3s;
}
.hud__hp-fill--mid { background: #f39c12; box-shadow: 0 0 5px #f39c12; }
.hud__hp-fill--low {
  background: #c0392b;
  box-shadow: 0 0 6px #c0392b;
  animation: hp-blink 0.5s step-start infinite;
}
@keyframes hp-blink { 50% { opacity: 0.4; } }
.hud__hp-num {
  font-size: 7px;
  color: var(--color-text-dim);
  white-space: nowrap;
}

.hud__score, .hud__stage {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hud__score-label, .hud__stage-label {
  font-size: 8px;
  color: var(--color-text-dim);
  letter-spacing: 1px;
}
.hud__score-value {
  font-size: 16px;
  color: var(--color-accent);
}
.hud__stage-value {
  font-size: 16px;
  color: #f1c40f;
}
.hud__enemies {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 72px;
}
.hud__enemies-label {
  font-size: 7px;
  color: var(--color-text-dim);
  letter-spacing: 1px;
}
.hud__enemies-track {
  width: 64px;
  height: 6px;
  background: #111;
  border: 1px solid #444;
  overflow: hidden;
}
.hud__enemies-fill {
  height: 100%;
  background: #2ecc71;
  transition: width 0.3s;
}
.hud__enemies-num {
  font-size: 7px;
  color: #aaa;
}


.hud__pause-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(3px);
}
.hud__pause-box {
  text-align: center;
  padding: 24px 40px;
  background: var(--color-panel);
  border: 3px solid var(--color-border);
  box-shadow: 6px 6px 0 var(--color-border-dark);
}
.hud__pause-title {
  font-size: 28px;
  color: #f1c40f;
  letter-spacing: 4px;
  text-shadow: 3px 3px 0 #7d6608;
}
.hud__pause-score {
  font-size: 12px;
  color: var(--color-text-dim);
  margin-top: 8px;
}

/* EXP bar */
.hud__exp-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid var(--color-border-dark);
}
.hud__exp-label {
  font-size: 8px;
  color: #44ffaa;
  white-space: nowrap;
  min-width: 30px;
}
.hud__exp-track {
  flex: 1;
  height: 8px;
  background: #071a10;
  border: 2px solid #0a3018;
  overflow: hidden;
}
.hud__exp-fill {
  height: 100%;
  background: linear-gradient(90deg, #27ae60, #44ffaa);
  box-shadow: 0 0 5px #44ffaa;
  transition: width 0.4s ease;
}
.hud__exp-num {
  font-size: 7px;
  color: var(--color-text-dim);
  white-space: nowrap;
}

/* Level-up overlay */
.hud__levelup-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(4px);
  pointer-events: all;
  z-index: 30;
}
.hud__levelup-box {
  width: 340px;
  max-width: 92vw;
  padding: 20px 14px 24px;
  background: var(--color-panel);
  border: 3px solid #44ffaa;
  box-shadow: 6px 6px 0 #0a3018, 0 0 30px rgba(68,255,170,0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.hud__levelup-title {
  font-size: 16px;
  color: #44ffaa;
  letter-spacing: 3px;
  text-shadow: 0 0 12px #44ffaa;
}
.hud__levelup-sub {
  font-size: 9px;
  color: var(--color-text-dim);
  letter-spacing: 2px;
}
.hud__levelup-choices {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.hud__levelup-card {
  width: 100%;
  background: var(--color-panel-dark);
  border: 3px solid var(--color-border);
  box-shadow: 3px 3px 0 var(--color-border-dark);
  padding: 10px 14px;
  text-align: left;
  cursor: pointer;
  font-family: var(--font-pixel);
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: transform 0.06s, box-shadow 0.06s;
}
.hud__levelup-card:hover {
  transform: translateY(-2px);
  box-shadow: 3px 5px 0 var(--color-border-dark);
}
.hud__levelup-card:active { transform: translateY(1px); box-shadow: 1px 2px 0 var(--color-border-dark); }
.hud__levelup-card-name { font-size: 10px; color: var(--color-text); }
.hud__levelup-card-desc { font-size: 8px; color: var(--color-text-dim); }
.hud__levelup-card-rarity { font-size: 7px; letter-spacing: 1px; margin-top: 2px; }

.rarity-white  { border-color: #aaaaaa; }
.rarity-white  .hud__levelup-card-rarity { color: #aaaaaa; }
.rarity-blue   { border-color: #4488ff; box-shadow: 3px 3px 0 #112244; }
.rarity-blue   .hud__levelup-card-rarity { color: #4488ff; }
.rarity-purple { border-color: #aa44ff; box-shadow: 3px 3px 0 #220033; }
.rarity-purple .hud__levelup-card-rarity { color: #aa44ff; }
.rarity-gold   { border-color: #f1c40f; box-shadow: 3px 3px 0 #7d6608, 0 0 12px rgba(241,196,15,0.3); }
.rarity-gold   .hud__levelup-card-rarity { color: #f1c40f; }

/* Skill button */
.hud__skill-wrap {
  position: absolute;
  left: 12px;
  top: 67%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  pointer-events: all;
  z-index: 20;
}
.hud__skill-btn {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 3px solid #334;
  background: rgba(5, 12, 35, 0.88);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-pixel);
  transition: border-color 0.25s, box-shadow 0.25s;
  backdrop-filter: blur(4px);
}
.hud__skill-btn:disabled {
  cursor: default;
}
.hud__skill-btn--ready {
  border-color: #ff6600;
  box-shadow: 0 0 10px rgba(255, 100, 0, 0.6), inset 0 0 8px rgba(255, 100, 0, 0.15);
}
.hud__skill-btn--flash {
  animation: skill-flash 0.9s ease-out;
}
.hud__skill-icon {
  font-size: 22px;
  filter: drop-shadow(0 0 6px #ff8800);
}
.hud__skill-cd {
  font-size: 15px;
  color: #778899;
  letter-spacing: 0;
}
.hud__skill-label {
  font-size: 7px;
  color: var(--color-text-dim);
  letter-spacing: 1px;
  text-align: center;
  line-height: 1.4;
}
@keyframes skill-flash {
  0%   { box-shadow: 0 0 6px rgba(255,100,0,0.5); }
  20%  { box-shadow: 0 0 28px rgba(255,180,0,1), 0 0 60px rgba(255,120,0,0.7); border-color: #ffcc00; }
  50%  { box-shadow: 0 0 18px rgba(255,130,0,0.8); border-color: #ff9900; }
  100% { box-shadow: 0 0 10px rgba(255,100,0,0.6); border-color: #ff6600; }
}
</style>
