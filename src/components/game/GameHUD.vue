<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore, ALL_CARD_DEFS, ALL_ARTIFACT_DEFS, SHIP_DEFS } from '../../stores/gameStore'
import type { CardDef, CardType } from '../../stores/gameStore'
import { estimatePlayerCombatPower } from '../../game/systems/threat'
import { PhCoins, PhCrosshair, PhHouse, PhLightning, PhPlay, PhQuestion, PhSpiral, PhSword } from '@phosphor-icons/vue'
import ArtifactIcon from '../ui/ArtifactIcon.vue'
import CardIcon from '../ui/CardIcon.vue'

const game = useGameStore()

const isTouchDevice = 'ontouchstart' in window

const props = defineProps<{ tourActive?: boolean }>()
const emit = defineEmits<{ requestGoHome: []; requestTour: [] }>()

function cardTypeLabel(type: CardType): string {
  return { attack: 'TẤN CÔNG', support: 'HỖ TRỢ', ultimate: 'TỐI THƯỢNG' }[type]
}

function getCardDef(id: string) {
  return ALL_CARD_DEFS.find(c => c.id === id)
}

function getUltimateSourceDefs(card: { requiresAttackId?: string; requiresSupportId?: string; requiresSupportId2?: string }) {
  const ids = [card.requiresAttackId, card.requiresSupportId, card.requiresSupportId2].filter((id): id is string => !!id)
  return ids.map(id => getCardDef(id)).filter((def): def is NonNullable<typeof def> => !!def)
}

function getRecommendedPairCard(card: { id: string; type: CardType }) {
  if (card.type !== 'attack' && card.type !== 'support') return null
  for (const ult of ALL_CARD_DEFS) {
    if (ult.type !== 'ultimate') continue
    if (card.type === 'attack' && ult.requiresAttackId === card.id && ult.requiresSupportId) {
      if ((game.activeCards[ult.requiresSupportId] ?? 0) > 0) return getCardDef(ult.requiresSupportId) ?? null
    }
    if (card.type === 'support' && ult.requiresSupportId === card.id && ult.requiresAttackId) {
      if ((game.activeCards[ult.requiresAttackId] ?? 0) > 0) return getCardDef(ult.requiresAttackId) ?? null
    }
  }
  return null
}

interface PauseSlot {
  def: CardDef | null
  level: number
  kind: CardType | 'empty'
}

function buildPauseCatalog(type: 'attack' | 'support'): CardDef[] {
  const allByType = ALL_CARD_DEFS.filter(card => {
    if (card.type !== type) return false
    return type === 'support' || !card.shipId || card.shipId === game.selectedShip
  })
  const activeDefs = Object.keys(game.activeCards)
    .map(id => getCardDef(id))
    .filter((def): def is CardDef => !!def && def.type === type && (type === 'support' || !def.shipId || def.shipId === game.selectedShip) && (game.activeCards[def.id] ?? 0) > 0)
  const activeIds = new Set(activeDefs.map(def => def.id))
  const remainingDefs = allByType.filter(def => !activeIds.has(def.id))
  return [...activeDefs, ...remainingDefs].slice(0, 5)
}

const pauseAttackCatalog = computed(() => buildPauseCatalog('attack'))

const pauseSupportCatalog = computed(() => buildPauseCatalog('support'))

const pauseAttackSlots = computed<PauseSlot[]>(() =>
  pauseAttackCatalog.value.map((attackDef) => {
    const activeUltimate = Object.keys(game.activeCards).find((cardId) => {
      const def = getCardDef(cardId)
      return def?.type === 'ultimate' && def.requiresAttackId === attackDef.id && (game.activeCards[cardId] ?? 0) > 0
    })

    if (activeUltimate) {
      return {
        def: getCardDef(activeUltimate) ?? null,
        level: game.activeCards[activeUltimate] ?? 0,
        kind: 'ultimate',
      }
    }

    const level = game.activeCards[attackDef.id] ?? 0
    if (level > 0) return { def: attackDef, level, kind: 'attack' }
    return { def: null, level: 0, kind: 'empty' }
  }),
)

const pauseSupportSlots = computed<PauseSlot[]>(() =>
  pauseSupportCatalog.value.map((supportDef) => {
    const level = game.activeCards[supportDef.id] ?? 0
    if (level > 0) return { def: supportDef, level, kind: 'support' }
    return { def: null, level: 0, kind: 'empty' }
  }),
)

const pauseRows = computed(() => [
  { label: 'TẤN CÔNG', slots: pauseAttackSlots.value },
  { label: 'HỖ TRỢ', slots: pauseSupportSlots.value },
])

// Flash kéo sự chú ý khi cooldown xong
const skillJustReady = ref(false)
watch(() => game.isSkillReady, (ready) => {
  if (ready) {
    skillJustReady.value = true
    setTimeout(() => { skillJustReady.value = false }, 900)
  }
})

const skillLabelHtml = computed(() => {
  return SHIP_DEFS[game.selectedShip as keyof typeof SHIP_DEFS]?.skill.hudLabelHtml ?? 'SÓNG<br/>NHIỆT'
})

const combatPower = computed(() => estimatePlayerCombatPower(game))
const goldEarnedPreview = computed(() => game.projectedGoldEarnedThisRun)
</script>

<template>
  <div class="hud">
    <!-- Top bar -->
    <div class="hud__top" data-tour="hud-top">
      <!-- HP bar -->
      <div class="hud__hp" data-tour="hud-hp">
        <div class="hud__hp-main">
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
        <div class="hud__hp-extra">
          <span class="hud__hp-stat hud__hp-stat--power">
            <PhSword :size="11" weight="fill" class="hud__hp-stat-icon" />
            <span class="hud__hp-stat-sep">:</span>
            <span class="hud__hp-stat-value">{{ combatPower.toLocaleString('vi-VN') }}</span>
          </span>
          <span class="hud__hp-stat hud__hp-stat--gold">
            <PhCoins :size="11" weight="fill" class="hud__hp-stat-icon" />
            <span class="hud__hp-stat-sep">:</span>
            <span class="hud__hp-stat-value">{{ goldEarnedPreview.toLocaleString('vi-VN') }}</span>
          </span>
        </div>
      </div>

      <div class="hud__score" data-tour="hud-score">
        <span class="hud__score-label">SCORE</span>
        <span class="hud__score-value">{{ game.currentScore }}</span>
      </div>
      <div class="hud__stage">
        <span class="hud__stage-label">STAGE</span>
        <span class="hud__stage-value">{{ game.currentStage }}</span>
      </div>
      <div class="hud__enemies" data-tour="hud-enemies">
        <span class="hud__enemies-label">TIÊU DIỆT</span>
        <div class="hud__enemies-track">
          <div class="hud__enemies-fill" :style="{ width: game.stageProgress + '%' }" />
        </div>
        <span class="hud__enemies-num">{{ game.stageEnemiesKilled }}/{{ game.stageEnemiesTotal }}</span>
      </div>
    </div>

    <!-- EXP bar (below top bar) -->
    <div class="hud__exp-block" data-tour="hud-exp">
      <div class="hud__exp-row">
        <span class="hud__exp-label">LV{{ game.playerLevel }}</span>
        <div class="hud__exp-track">
          <div class="hud__exp-fill" :style="{ width: game.expPercent + '%' }" />
        </div>
        <span class="hud__exp-num">{{ game.playerExp }}/{{ game.expToNextLevel }}</span>
      </div>
    </div>

    <!-- Pause overlay -->
    <div v-if="game.isPaused && !game.isLevelUpPending && !props.tourActive" class="hud__pause-overlay">
      <div class="hud__pause-box">
        <div class="hud__pause-title">PAUSE</div>
        <div class="hud__pause-score">Score: {{ game.currentScore }}</div>
        <div class="hud__pause-actions">
          <button class="hud__pause-btn hud__pause-btn--resume" @click="game.pauseGame()">
            <PhPlay :size="12" weight="fill" />
            <span>TIẾP TỤC</span>
          </button>
          <button class="hud__pause-btn hud__pause-btn--menu" @click="emit('requestGoHome')">
            <PhHouse :size="12" weight="fill" />
            <span>MENU</span>
          </button>
        </div>
        <button class="hud__pause-btn hud__pause-btn--help" @click="emit('requestTour')">
          <PhQuestion :size="11" weight="bold" />
          <span>HƯỚNG DẪN</span>
        </button>
        <!-- Active card collection -->
        <div v-if="Object.keys(game.activeCards).length > 0" class="hud__pause-cards">
          <div class="hud__pause-cards-title">LÕI ĐANG KÍCH HOẠT</div>
          <div
            v-for="row in pauseRows"
            :key="row.label"
            class="hud__pause-row"
          >
            <div class="hud__pause-row-label">{{ row.label }}</div>
            <div class="hud__pause-card-list">
              <div
                v-for="(slot, index) in row.slots"
                :key="row.label + index"
                class="hud__pause-card-item"
                :class="'pause-card--' + slot.kind"
              >
                <template v-if="slot.def">
                  <span class="hud__pause-card-icon"><CardIcon :name="slot.def.icon" :size="16" /></span>
                  <span class="hud__pause-card-name">{{ slot.def.name }}</span>
                  <div class="hud__pause-card-dots">
                    <span
                      v-for="d in slot.def.maxLevel"
                      :key="d"
                      class="hud__card-dot"
                      :class="{ 'hud__card-dot--filled': d <= slot.level }"
                    />
                  </div>
                </template>
                <template v-else>
                  <div class="hud__pause-card-empty">Ô trống</div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Level-up overlay (Card selection 3-column) -->
    <div v-if="game.isLevelUpPending" class="hud__levelup-overlay">
      <div class="hud__levelup-box">
        <div class="hud__levelup-title">&#9650; LEVEL UP! &#9650;</div>
        <div class="hud__levelup-sub">Chọn 1 thẻ kỹ năng</div>
        <div class="hud__card-grid">
          <button
            v-for="card in game.levelUpCardChoices"
            :key="card.id"
            class="hud__card"
            :class="'card--' + card.type"
            @click="game.chooseCard(card.id)"
          >
            <div
              v-if="card.type !== 'ultimate' && getRecommendedPairCard(card)"
              :class="['hud__card-reco', `hud__card-reco--${card.type}`]"
            >
              <CardIcon :name="getRecommendedPairCard(card)?.icon ?? ''" :size="11" />
              <span>KHUYẾN NGHỊ</span>
            </div>
            <!-- Thumbnail -->
            <div class="hud__card-thumb" :class="'card-thumb--' + card.type">
              <span class="hud__card-big-icon"><CardIcon :name="card.icon" :size="28" /></span>
            </div>
            <!-- Type badge -->
            <div class="hud__card-type-badge" :class="'badge--' + card.type">
              {{ cardTypeLabel(card.type) }}
            </div>
            <!-- Name -->
            <div class="hud__card-name">{{ card.name }}</div>
            <!-- Ultimate source pair -->
            <div v-if="card.type === 'ultimate'" class="hud__card-ult-combo">
              <template v-for="(src, idx) in getUltimateSourceDefs(card)" :key="src.id">
                <span v-if="idx > 0" class="hud__card-ult-plus">+</span>
                <span class="hud__card-ult-src"><CardIcon :name="src.icon" :size="13" /></span>
              </template>
            </div>
            <!-- Level dots -->
            <div class="hud__card-dots">
              <span
                v-for="d in card.maxLevel"
                :key="d"
                class="hud__card-dot"
                :class="{ 'hud__card-dot--filled': d <= (game.activeCards[card.id] ?? 0) }"
              />
            </div>
            <!-- Description (next level that will be gained) -->
            <div class="hud__card-desc">
              {{ card.levels[game.activeCards[card.id] ?? 0]?.desc }}
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Skill indicator (click to activate: double-tap mobile / right-click PC) -->
    <div
      v-if="game.isPlaying && !game.isLevelUpPending"
      class="hud__skill-wrap"
      data-tour="hud-skill"
    >
      <div
        class="hud__skill-btn"
        :class="{
          'hud__skill-btn--ready': game.isSkillReady,
          'hud__skill-btn--flash': skillJustReady,
          'hud__skill-btn--orange': game.selectedShip === 'star_holder',
          'hud__skill-btn--purple': game.selectedShip === 'star_shooter',
          'hud__skill-btn--cyan': game.selectedShip === 'star_faster',
        }"
      >
        <!-- Star Holder: fragment counter -->
        <template v-if="game.selectedShip === 'star_holder'">
          <span class="hud__skill-frags">{{ game.fragmentCount }}<span class="hud__skill-frags-max">/50</span></span>
        </template>
        <!-- Star Keeper: default cooldown / ready -->
        <template v-else>
          <span v-if="game.isSkillReady" class="hud__skill-icon">
            <PhSpiral v-if="game.selectedShip === 'star_shooter'" weight="fill" :size="24" />
            <PhCrosshair v-else-if="game.selectedShip === 'star_faster'" weight="fill" :size="24" />
            <PhLightning v-else weight="fill" :size="24" />
          </span>
          <span v-else class="hud__skill-cd">{{ Math.ceil(game.skillCooldown) }}</span>
        </template>
      </div>
      <div class="hud__skill-label" v-html="skillLabelHtml"></div>
      <div class="hud__skill-hint">{{ isTouchDevice ? '2× TAP' : 'RMB' }}</div>
    </div>
    <!-- Artifact progress bars (active artifacts only) -->
    <div
      v-if="game.isPlaying && !game.isLevelUpPending"
      class="hud__artifact-bars"
    >
      <!-- Neutron Star: 30s vacuum cooldown -->
      <div
        v-if="(game.equippedArtifacts[game.selectedShip] ?? []).includes('neutron_star')"
        class="hud__artifact-bar-row"
      >
        <ArtifactIcon id="neutron_star" :size="16" class="hud__artifact-icon" />
        <div class="hud__artifact-bar-details">
          <span class="hud__artifact-name">{{ ALL_ARTIFACT_DEFS.find(a => a.id === 'neutron_star')?.name }}</span>
          <div class="hud__artifact-track">
            <div class="hud__artifact-fill hud__artifact-fill--gold" :style="{ width: (game.neutronVacuumPct * 100) + '%' }" />
          </div>
        </div>
      </div>
      <!-- Mana Core: 10-kill overload -->
      <div
        v-if="(game.equippedArtifacts[game.selectedShip] ?? []).includes('mana_core')"
        class="hud__artifact-bar-row"
      >
        <ArtifactIcon id="mana_core" :size="16" class="hud__artifact-icon" />
        <div class="hud__artifact-bar-details">
          <span class="hud__artifact-name">{{ ALL_ARTIFACT_DEFS.find(a => a.id === 'mana_core')?.name }}</span>
          <div class="hud__artifact-track">
            <div class="hud__artifact-fill hud__artifact-fill--purple" :style="{ width: (game.manaCorePct * 100) + '%' }" />
          </div>
        </div>
      </div>
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
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0;
  background: transparent;
  border: 0;
  backdrop-filter: none;
}

.hud__hp {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  flex: 1;
  max-width: 216px;
  padding: 5px 6px 6px;
  background: rgba(0, 0, 0, 0.42);
  border: 1px solid rgba(110, 150, 180, 0.45);
  backdrop-filter: blur(2px);
}
.hud__hp-main {
  display: flex;
  align-items: center;
  gap: 5px;
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
.hud__hp-extra {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 5px;
}
.hud__hp-stat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 8px;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.hud__hp-stat--power {
  color: #7cc9ff;
}
.hud__hp-stat--gold {
  color: #f3c14b;
}
.hud__hp-stat-icon {
  opacity: 0.95;
}
.hud__hp-stat-sep {
  opacity: 0.8;
}
.hud__hp-stat-value {
  font-size: 9px;
}

.hud__score, .hud__stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: rgba(0, 0, 0, 0.42);
  border: 1px solid rgba(120, 140, 170, 0.45);
  padding: 4px 6px;
  min-width: 60px;
  backdrop-filter: blur(2px);
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
  background: rgba(0, 0, 0, 0.42);
  border: 1px solid rgba(120, 140, 170, 0.45);
  padding: 4px 6px;
  backdrop-filter: blur(2px);
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
  pointer-events: all;
  z-index: 20;
}
.hud__pause-box {
  text-align: center;
  padding: 20px 28px;
  background: var(--color-panel);
  border: 3px solid var(--color-border);
  box-shadow: 6px 6px 0 var(--color-border-dark);
  max-width: 420px;
  width: 90%;
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
.hud__pause-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  justify-content: center;
}
.hud__pause-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-family: var(--font-pixel);
  font-size: 9px;
  letter-spacing: 1px;
  padding: 8px 14px;
  cursor: pointer;
  border: 2px solid;
  transition: opacity 0.1s;
}
.hud__pause-btn:hover { opacity: 0.8; }
.hud__pause-btn--resume { background: #0a1a0f; border-color: #44ff88; color: #44ff88; }
.hud__pause-btn--menu   { background: #1a0a0a; border-color: #ff6644; color: #ff9977; }
.hud__pause-btn--help   { background: none; border: none; color: #7799bb; font-size: 9px; margin-top: 2px; padding: 4px 0; width: 100%; box-shadow: none; }
.hud__pause-btn--help:hover { color: #7799bb; }
.hud__pause-cards {
  margin-top: 14px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hud__pause-cards-title {
  font-size: 8px;
  color: #44ffaa;
  letter-spacing: 2px;
  text-align: center;
}
.hud__pause-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hud__pause-row-label {
  font-size: 7px;
  color: var(--color-text-dim);
  letter-spacing: 1px;
  text-align: center;
}
.hud__pause-card-list {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 5px;
}
.hud__pause-card-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 80px;
  padding: 7px 6px;
  background: var(--color-panel-dark);
  border: 1px solid #334;
  text-align: center;
}
.pause-card--attack  { border-color: #884422; background: linear-gradient(180deg, rgba(120, 35, 18, 0.24), rgba(18, 9, 8, 0.96)); }
.pause-card--support { border-color: #224488; background: linear-gradient(180deg, rgba(22, 66, 132, 0.24), rgba(8, 11, 28, 0.96)); }
.pause-card--ultimate { border-color: #b58a19; background: linear-gradient(180deg, rgba(255, 214, 72, 0.3), rgba(48, 34, 6, 0.96)); box-shadow: inset 0 0 10px rgba(255, 220, 90, 0.12); }
.pause-card--empty { border-style: dashed; border-color: #2e3447; background: rgba(9, 12, 20, 0.72); }
.hud__pause-card-icon { display: inline-flex; align-items: center; }
.hud__pause-card-name { font-size: 7px; color: var(--color-text); line-height: 1.35; min-height: 30px; display: flex; align-items: center; }
.hud__pause-card-dots { display: flex; gap: 3px; }
.hud__pause-card-empty {
  font-size: 7px;
  color: #5e6b85;
  letter-spacing: 0.5px;
}

/* Level-up card grid */
.hud__levelup-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(4px);
  pointer-events: all;
  z-index: 30;
}
.hud__levelup-box {
  width: min(420px, 98vw);
  padding: 20px 14px 24px;
  background: var(--color-panel);
  border: 3px solid #44ffaa;
  box-shadow: 6px 6px 0 #0a3018, 0 0 30px rgba(68,255,170,0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.hud__levelup-title {
  font-size: 18px;
  color: #44ffaa;
  letter-spacing: 3px;
  text-shadow: 0 0 12px #44ffaa;
}
.hud__levelup-sub {
  font-size: 10px;
  color: var(--color-text-dim);
  letter-spacing: 2px;
}

/* 3-column card grid */
.hud__card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
}

.hud__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0 0 10px;
  background: var(--color-panel-dark);
  border: 2px solid #334;
  cursor: pointer;
  font-family: var(--font-pixel);
  transition: transform 0.06s, box-shadow 0.06s, border-color 0.12s;
  overflow: visible;
}
.hud__card:hover  { transform: translateY(-3px); box-shadow: 0 4px 14px rgba(100,200,255,0.18); }
.hud__card:active { transform: translateY(1px); }

.hud__card-reco {
  position: absolute;
  top: -8px;
  left: 4px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(14, 40, 62, 0.92);
  border: 1px solid #3ea8ff;
  color: #8fd0ff;
  font-size: 7px;
  letter-spacing: 0.4px;
  padding: 2px 4px;
}
.hud__card-reco--attack {
  background: rgba(14, 40, 62, 0.92);
  border-color: #3ea8ff;
  color: #8fd0ff;
}
.hud__card-reco--support {
  background: rgba(72, 16, 16, 0.95);
  border-color: #ff6666;
  color: #ffb3b3;
}

.card--attack  { border-color: #aa3311; }
.card--support { border-color: #1155aa; }
.card--ultimate { border-color: #aa8811; box-shadow: 0 0 10px rgba(255,220,80,0.18); }

/* Thumbnail area */
.hud__card-thumb {
  width: 100%;
  height: 62px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.card-thumb--attack  { background: linear-gradient(160deg, #1a0808, #2a1008); }
.card-thumb--support { background: linear-gradient(160deg, #080d1a, #081828); }
.card-thumb--ultimate { background: linear-gradient(160deg, #1a1408, #1a1000); }

.hud__card-big-icon { display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 0 6px rgba(255,255,255,0.4)); }

/* Type badge */
.hud__card-type-badge {
  font-size: 7px;
  letter-spacing: 1px;
  padding: 2px 5px;
  border-radius: 1px;
}
.badge--attack  { background: #660022; color: #ff9966; }
.badge--support { background: #001166; color: #88aaff; }
.badge--ultimate { background: #664400; color: #ffcc66; }

.hud__card-name {
  font-size: 9px;
  color: var(--color-text);
  text-align: center;
  padding: 0 4px;
  line-height: 1.3;
}

.hud__card-ult-combo {
  min-height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}
.hud__card-ult-src {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 214, 97, 0.45);
  background: rgba(255, 214, 97, 0.08);
}
.hud__card-ult-plus {
  font-size: 9px;
  color: #ffd36d;
}

/* Level dots */
.hud__card-dots {
  display: flex;
  gap: 4px;
  justify-content: center;
}
.hud__card-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #333;
  border: 1px solid #555;
}
.hud__card-dot--filled {
  background: #f1c40f;
  border-color: #f1c40f;
  box-shadow: 0 0 4px #f1c40f;
}

.hud__card-desc {
  font-size: 9px;
  color: var(--color-text-dim);
  text-align: center;
  padding: 0 6px;
  line-height: 1.5;
}

/* EXP bar */
.hud__exp-block {
  position: absolute;
  top: 66px;
  left: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 216px;
  padding: 4px 6px 6px;
  background: rgba(0, 0, 0, 0.42);
  border: 1px solid rgba(100, 150, 120, 0.45);
  backdrop-filter: blur(2px);
}
.hud__exp-row {
  display: flex;
  align-items: center;
  gap: 5px;
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
  pointer-events: none;
  z-index: 12;
}
.hud__skill-btn {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  border: 3px solid #334;
  background: rgba(5, 12, 35, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-pixel);
  transition: border-color 0.25s, box-shadow 0.25s;
  backdrop-filter: blur(4px);
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
.hud__skill-hint {
  font-size: 6px;
  color: #445566;
  letter-spacing: 0.5px;
  text-align: center;
}
@keyframes skill-flash {
  0%   { box-shadow: 0 0 6px rgba(255,100,0,0.5); }
  20%  { box-shadow: 0 0 28px rgba(255,180,0,1), 0 0 60px rgba(255,120,0,0.7); border-color: #ffcc00; }
  50%  { box-shadow: 0 0 18px rgba(255,130,0,0.8); border-color: #ff9900; }
  100% { box-shadow: 0 0 10px rgba(255,100,0,0.6); border-color: #ff6600; }
}
/* Star Holder fragment counter */
.hud__skill-btn--orange {
  border-color: #664400;
}
.hud__skill-btn--orange.hud__skill-btn--ready {
  border-color: #ff8800;
  box-shadow: 0 0 12px rgba(255, 140, 0, 0.7), inset 0 0 8px rgba(255, 140, 0, 0.18);
}
/* Star Shooter black hole */
.hud__skill-btn--purple {
  border-color: #440077;
}
.hud__skill-btn--purple.hud__skill-btn--ready {
  border-color: #aa44ff;
  box-shadow: 0 0 12px rgba(160, 60, 255, 0.7), inset 0 0 8px rgba(140, 40, 255, 0.18);
}
.hud__skill-btn--cyan {
  border-color: #006b88;
}
.hud__skill-btn--cyan.hud__skill-btn--ready {
  border-color: #33d4ff;
  box-shadow: 0 0 12px rgba(60, 210, 255, 0.7), inset 0 0 8px rgba(50, 170, 220, 0.2);
}
.hud__skill-frags {
  font-size: 16px;
  color: #ffaa33;
  font-family: var(--font-pixel);
  line-height: 1;
}
.hud__skill-frags-max {
  font-size: 9px;
  color: #887744;
}

/* Artifact progress bars */
.hud__artifact-bars {
  position: absolute;
  right: 12px;
  top: 67%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 5px;
  pointer-events: none;
  z-index: 20;
  align-items: flex-end;
}
.hud__artifact-bar-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.hud__artifact-icon {
  flex-shrink: 0;
}
.hud__artifact-bar-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-end;
}
.hud__artifact-name {
  font-family: var(--font-pixel);
  font-size: 7px;
  color: rgba(255,255,255,0.65);
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.hud__artifact-track {
  width: 46px;
  height: 5px;
  background: rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 3px;
  overflow: hidden;
}
.hud__artifact-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.15s linear;
}
.hud__artifact-fill--gold {
  background: linear-gradient(90deg, #cc9900, #ffe566);
  box-shadow: 0 0 4px #ffd700;
}
.hud__artifact-fill--purple {
  background: linear-gradient(90deg, #6600cc, #cc88ff);
  box-shadow: 0 0 4px #9933ff;
}
</style>
