<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  useGameStore,
  ALL_CARD_DEFS,
  ALL_ARTIFACT_DEFS,
  SHIP_DEFS,
  SHIP_UNLOCK_CURRENCY,
  type ShipId,
  type ArtifactDef,
  type CardDef,
} from '../stores/gameStore'
import ArtifactIcon from '../components/ui/ArtifactIcon.vue'
import CardIcon from '../components/ui/CardIcon.vue'
import LobbyBottomNav from '../components/ui/LobbyBottomNav.vue'
import { PhCaretLeft, PhCaretRight, PhCheck, PhCoins, PhDiamond, PhLightning, PhLock, PhTimer } from '@phosphor-icons/vue'

const game = useGameStore()

const activeTab = ref<'ships' | 'cores'>('ships')

const shipOrder: ShipId[] = ['star_keeper', 'star_holder', 'star_faster', 'star_shooter', 'thien_ha_truy']
const shipIndex = ref(0)
const currentShipId = computed(() => shipOrder[shipIndex.value] ?? 'star_keeper')

let shipTouchStartX = 0
function onShipTouchStart(e: TouchEvent) {
  shipTouchStartX = e.touches[0].clientX
}

function onShipTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - shipTouchStartX
  if (Math.abs(dx) < 36) return
  if (dx < 0) nextShip()
  else prevShip()
}

function nextShip() {
  shipIndex.value = (shipIndex.value + 1) % shipOrder.length
}

function prevShip() {
  shipIndex.value = (shipIndex.value - 1 + shipOrder.length) % shipOrder.length
}

function jumpToShip(index: number) {
  shipIndex.value = Math.max(0, Math.min(shipOrder.length - 1, index))
}

const displayedArtifacts = computed<ArtifactDef[]>(() => ALL_ARTIFACT_DEFS)

interface ShipStatBar {
  key: string
  label: string
  display: string
  percent: number
  color: string
}

interface WeaponCachePreviewCard {
  key: string
  name: string
  tier: 'normal' | 'ultimate'
  tierLabel: string
  description: string
  icon: CardDef['icon']
}

function toPercent(value: number, max: number): number {
  if (max <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)))
}

function isOwned(shipId: ShipId): boolean {
  return game.ownedShips.includes(shipId)
}

function formatStatValue(key: 'hp' | 'damage' | 'fireRate' | 'speed' | 'bulletCount', now: number, max: number): string {
  if (key === 'fireRate' || key === 'speed') return `${now.toFixed(2)} / ${max.toFixed(2)}`
  return `${Math.round(now)} / ${Math.round(max)}`
}

function getShipStatBars(shipId: ShipId): ShipStatBar[] {
  const effective = game.getShipEffectiveStats(shipId)
  const max = game.getShipMaxStats(shipId)
  const bullet = SHIP_DEFS[shipId].bulletCount
  const bulletNow = Math.min(bullet.max, bullet.base + game.permUpgrades.bulletCount)
  return [
    {
      key: 'hp',
      label: 'HP',
      display: formatStatValue('hp', effective.hp, max.hp),
      percent: toPercent(effective.hp, max.hp),
      color: '#57de93',
    },
    {
      key: 'damage',
      label: 'Sát thương',
      display: formatStatValue('damage', effective.damage, max.damage),
      percent: toPercent(effective.damage, max.damage),
      color: '#ff7f7f',
    },
    {
      key: 'fireRate',
      label: 'Tốc bắn',
      display: formatStatValue('fireRate', effective.fireRate, max.fireRate),
      percent: toPercent(effective.fireRate, max.fireRate),
      color: '#ffcb74',
    },
    {
      key: 'speed',
      label: 'Tốc độ',
      display: formatStatValue('speed', effective.speed, max.speed),
      percent: toPercent(effective.speed, max.speed),
      color: '#7ec7ff',
    },
    {
      key: 'bulletCount',
      label: 'Số đạn',
      display: formatStatValue('bulletCount', bulletNow, bullet.max),
      percent: toPercent(bulletNow, bullet.max),
      color: '#98f0a4',
    },
  ]
}

function getShipCombatPower(shipId: ShipId): number {
  return game.getPreBattleCombatPower(shipId)
}

function canAffordShip(shipId: ShipId): boolean {
  const cost = SHIP_DEFS[shipId].unlockCost
  if (SHIP_UNLOCK_CURRENCY[shipId] === 'ruby') return game.playerRuby >= cost
  return game.playerCoins >= cost
}

function buyShip(shipId: ShipId) {
  if (isOwned(shipId)) return
  game.buyShip(shipId)
}

function selectShip(shipId: ShipId) {
  if (!isOwned(shipId)) return
  game.selectShip(shipId)
}

function getUnlockLabel(shipId: ShipId): string {
  const def = SHIP_DEFS[shipId]
  const icon = SHIP_UNLOCK_CURRENCY[shipId] === 'ruby' ? '💎' : '🪙'
  return `${def.unlockCost.toLocaleString('en-US')} ${icon}`
}

function getSkillCooldownLabel(shipId: ShipId): string {
  const skill = SHIP_DEFS[shipId].skill
  if (skill.cooldownSec == null) return skill.requirementText ?? 'Theo điều kiện'
  return `Hồi chiêu: ${skill.cooldownSec} giây`
}

function getWeaponCacheCards(shipId: ShipId): WeaponCachePreviewCard[] {
  const normalCard = ALL_CARD_DEFS.find(
    (card) => card.type === 'attack' && card.shipId === shipId && card.id.startsWith('weapon_cache_')
  )
  if (!normalCard) return []

  const normalLevelCount = Math.min(5, normalCard.levels.length)
  const normalCards = normalCard.levels.slice(0, normalLevelCount).map((level, index) => ({
    key: `${normalCard.id}_lv_${index + 1}`,
    name: `${normalCard.name} · Cấp ${index + 1}`,
    tier: 'normal' as const,
    tierLabel: `Thẻ thường ${index + 1}/${normalLevelCount}`,
    description: level.desc,
    icon: normalCard.icon,
  }))

  const ultimateCards = ALL_CARD_DEFS.filter(
    (card) =>
      card.type === 'ultimate'
      && card.shipId === shipId
      && card.requiresAttackId === normalCard.id
      && !!card.levels[0]
  )
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .map((card, index, arr) => ({
      key: card.id,
      name: card.name,
      tier: 'ultimate' as const,
      tierLabel: arr.length > 1 ? `Thẻ tối thượng ${index + 1}/${arr.length}` : 'Thẻ tối thượng',
      description: card.levels[0]?.desc ?? 'Chưa có mô tả.',
      icon: card.icon,
    }))

  return [...normalCards, ...ultimateCards]
}

function isArtifactOwned(artifactId: string): boolean {
  return game.ownedArtifacts.includes(artifactId)
}

function getArtifactThemeClass(artifactId: string): string {
  if (artifactId === 'neutron_star') return 'core-card--neutron'
  if (artifactId === 'carbon_core') return 'core-card--carbon'
  if (artifactId === 'mana_core') return 'core-card--mana'
  return 'core-card--stardust'
}

function getArtifactActionLabel(core: ArtifactDef): string {
  if (!isArtifactOwned(core.id)) return `Mua ${core.cost.toLocaleString('en-US')} 🪙`
  return 'Đã sở hữu'
}

function isArtifactActionDisabled(core: ArtifactDef): boolean {
  if (isArtifactOwned(core.id)) return true
  return game.playerCoins < core.cost
}

function handleArtifactAction(core: ArtifactDef) {
  if (isArtifactOwned(core.id)) return
  game.buyArtifact(core.id)
}
</script>

<template>
  <div class="tech-view">
    <div class="tech-view__inner">
      <header class="tech-header">
        <div>
          <h1 class="tech-title">CÔNG NGHỆ</h1>
          <p class="tech-subtitle">Nâng cấp chiến lực qua Phi cơ và Cổ vật.</p>
        </div>
        <div class="tech-currency">
          <div class="tech-currency__item"><PhCoins :size="15" weight="fill" />{{ game.playerCoins }}</div>
          <div class="tech-currency__item tech-currency__item--ruby"><PhDiamond :size="15" weight="fill" />{{ game.playerRuby }}</div>
        </div>
      </header>

      <div class="tech-tabs">
        <button class="tech-tab" :class="{ 'tech-tab--active': activeTab === 'ships' }" @click="activeTab = 'ships'">Phi Cơ</button>
        <button class="tech-tab" :class="{ 'tech-tab--active': activeTab === 'cores' }" @click="activeTab = 'cores'">Cổ Vật</button>
      </div>

      <section v-if="activeTab === 'ships'" class="tech-section">
        <article class="ship-carousel" @touchstart.passive="onShipTouchStart" @touchend.passive="onShipTouchEnd">
          <div class="ship-carousel__head">
            <div>
              <div class="ship-carousel__label">Phi cơ chiến đấu</div>
              <div class="ship-carousel__name">{{ SHIP_DEFS[currentShipId].name }}</div>
            </div>
            <div class="ship-carousel__nav">
              <button class="ship-carousel__arrow" @click="prevShip"><PhCaretLeft :size="12" weight="bold" /></button>
              <span class="ship-carousel__index">{{ shipIndex + 1 }}/{{ shipOrder.length }}</span>
              <button class="ship-carousel__arrow" @click="nextShip"><PhCaretRight :size="12" weight="bold" /></button>
            </div>
          </div>

          <div class="ship-carousel__track" :style="{ transform: `translateX(${-shipIndex * 100}%)` }">
            <div v-for="shipId in shipOrder" :key="shipId" class="ship-carousel__slide">
              <div class="ship-card-main">
                <div class="ship-card-main__grid">
                  <div class="ship-card-main__left">
                    <div class="ship-card-visual">
                      <template v-if="shipId === 'star_keeper'">
                        <svg viewBox="-32 -28 64 58" width="70" height="70">
                          <polygon points="-10,0 -28,18 -10,10" fill="#0077bb"/>
                          <polygon points="10,0 28,18 10,10" fill="#0077bb"/>
                          <rect x="-10" y="-22" width="20" height="34" fill="#00cfff"/>
                          <rect x="-5" y="-22" width="10" height="13" fill="#ffd700"/>
                          <rect x="-6" y="12" width="12" height="9" fill="#ff6600" opacity="0.85"/>
                        </svg>
                      </template>
                      <template v-else-if="shipId === 'star_holder'">
                        <svg viewBox="-34 -32 68 66" width="70" height="70">
                          <polygon points="-9,4 -30,20 -9,14" fill="#dd6600"/>
                          <polygon points="-25,18 -30,20 -20,22" fill="#ff8800"/>
                          <polygon points="9,4 30,20 9,14" fill="#dd6600"/>
                          <polygon points="25,18 30,20 20,22" fill="#ff8800"/>
                          <rect x="-9" y="-24" width="18" height="38" fill="#ff9900"/>
                          <polygon points="0,-28 8,-18 -8,-18" fill="#ffee44"/>
                          <rect x="-6" y="14" width="12" height="10" fill="#ff4400" opacity="0.9"/>
                          <rect x="-3" y="18" width="6" height="6" fill="#ffcc00" opacity="0.85"/>
                        </svg>
                      </template>
                      <template v-else-if="shipId === 'star_shooter'">
                        <svg viewBox="-32 -33 64 62" width="70" height="70">
                          <polygon points="-7,-4 -29,-12 -25,5 -7,5" fill="#27405f"/>
                          <polygon points="7,-4 29,-12 25,5 7,5" fill="#27405f"/>
                          <polygon points="-7,-4 -29,-12 -28,-9 -7,-3" fill="#4477aa" opacity="0.75"/>
                          <polygon points="7,-4 29,-12 28,-9 7,-3" fill="#4477aa" opacity="0.75"/>
                          <polygon points="-7,9 -20,15 -18,21 -7,17" fill="#1a2e48"/>
                          <polygon points="7,9 20,15 18,21 7,17" fill="#1a2e48"/>
                          <rect x="-28" y="-10" width="7" height="4" fill="#ff3333"/>
                          <rect x="-25" y="-4" width="7" height="4" fill="#ff3333"/>
                          <rect x="21" y="-10" width="7" height="4" fill="#ff3333"/>
                          <rect x="18" y="-4" width="7" height="4" fill="#ff3333"/>
                          <rect x="-7" y="-24" width="14" height="42" fill="#1c2c44"/>
                          <polygon points="-7,18 7,18 4,22 -4,22" fill="#151f33"/>
                          <rect x="-2" y="-24" width="4" height="42" fill="#7733cc" opacity="0.38"/>
                          <polygon points="0,-30 6,-21 -6,-21" fill="#ff4422"/>
                          <rect x="-3" y="-19" width="6" height="8" fill="#66ccff" opacity="0.88"/>
                          <rect x="-5" y="18" width="10" height="7" fill="#ff5500" opacity="0.9"/>
                          <rect x="-3" y="22" width="6" height="5" fill="#ffcc22" opacity="0.95"/>
                        </svg>
                      </template>
                      <template v-else-if="shipId === 'star_faster'">
                        <svg viewBox="-36 -44 72 64" width="70" height="70">
                          <rect x="-6" y="-28" width="12" height="44" fill="#f5f5ff"/>
                          <rect x="-5.5" y="-28" width="2.5" height="44" fill="#ffffff" opacity="0.5"/>
                          <polygon points="0,-40 6,-20 -6,-20" fill="#6644bb"/>
                          <polygon points="0,-40 0,-25 6,-20" fill="#8855dd" opacity="0.7"/>
                          <polygon points="-4,-20 4,-20 3,-10 -3,-10" fill="#4477ff"/>
                          <polygon points="-3.5,-10 3.5,-10 2.5,-2 -2.5,-2" fill="#6699ff" opacity="0.8"/>
                          <rect x="-5" y="-7" width="1.8" height="5" fill="#b8a8dd" opacity="0.7"/>
                          <rect x="3.2" y="-7" width="1.8" height="5" fill="#b8a8dd" opacity="0.7"/>
                          <polygon points="-6,-10 -27,-5 -25,7 -6,0" fill="#b8a0ff"/>
                          <polygon points="6,-10 27,-5 25,7 6,0" fill="#b8a0ff"/>
                          <polygon points="-6,-10 -27,-5 -26,-2 -6,-5" fill="#d0c0ff" opacity="0.6"/>
                          <polygon points="6,-10 27,-5 25,-2 6,-5" fill="#d0c0ff" opacity="0.6"/>
                          <polygon points="-6,-2 -20,-2 -18,13 -6,7" fill="#a08add" opacity="0.85"/>
                          <polygon points="6,-2 20,-2 18,13 6,7" fill="#a08add" opacity="0.85"/>
                          <polygon points="-6,5 -15,5 -13,10 -6,7" fill="#8878cc" opacity="0.8"/>
                          <polygon points="6,5 15,5 13,10 6,7" fill="#8878cc" opacity="0.8"/>
                          <polygon points="-6,15 6,15 4,20 -4,20" fill="#9a88cc"/>
                          <rect x="-5.8" y="-12" width="1" height="27" fill="#c0a8ff" opacity="0.5"/>
                          <rect x="4.8" y="-12" width="1" height="27" fill="#c0a8ff" opacity="0.5"/>
                          <circle cx="0" cy="16" r="3.8" fill="#00eeff" opacity="0.6"/>
                          <circle cx="0" cy="16" r="2.2" fill="#66ffff"/>
                        </svg>
                      </template>
                      <template v-else>
                        <svg viewBox="-34 -38 68 74" width="70" height="70">
                          <polygon points="0,-34 8,-10 5,20 0,28 -5,20 -8,-10" fill="#39d3a2"/>
                          <polygon points="0,-34 8,-10 3,-7 0,-20" fill="#7dffd7" opacity="0.75"/>
                          <polygon points="0,-30 5,16 0,24 -5,16" fill="#1f9f7f"/>
                          <polygon points="0,-36 3,-30 -3,-30" fill="#d9fff4"/>
                          <rect x="-10" y="18" width="20" height="4" fill="#0f6f5b"/>
                          <rect x="-5" y="20" width="10" height="5" fill="#155448"/>
                          <rect x="-1" y="-32" width="2" height="58" fill="#d5fff4" opacity="0.55"/>
                          <polygon points="-12,4 -18,18 -14,24 -8,10" fill="#66ffe4" opacity="0.45"/>
                          <polygon points="12,4 18,18 14,24 8,10" fill="#66ffe4" opacity="0.45"/>
                        </svg>
                      </template>
                    </div>

                    <div class="ship-card-power">
                      <span class="ship-card-power__label">Lực chiến</span>
                      <span class="ship-card-power__value"><PhLightning :size="12" weight="fill" />{{ getShipCombatPower(shipId) }}</span>
                    </div>

                    <button
                      v-if="!isOwned(shipId)"
                      class="ship-card-buy"
                      :disabled="!canAffordShip(shipId)"
                      @click="buyShip(shipId)"
                    >
                      <PhLock :size="11" weight="fill" /> Mua {{ getUnlockLabel(shipId) }}
                    </button>

                    <button
                      v-else-if="game.selectedShip !== shipId"
                      class="ship-card-select"
                      @click="selectShip(shipId)"
                    >
                      <PhCheck :size="11" weight="bold" /> Chọn phi cơ
                    </button>

                    <div v-else class="ship-card-active">
                      <PhCheck :size="11" weight="bold" /> Đang sử dụng
                    </div>
                  </div>

                  <div class="ship-card-main__right">
                    <div v-for="stat in getShipStatBars(shipId)" :key="shipId + stat.key" class="ship-chart-row">
                      <div class="ship-chart-row__meta">
                        <span>{{ stat.label }}</span>
                        <small>{{ stat.display }}</small>
                      </div>
                      <div class="ship-chart-row__track">
                        <div class="ship-chart-row__fill" :style="{ width: stat.percent + '%', background: stat.color }" />
                      </div>
                    </div>
                  </div>
                </div>

                <div class="ship-card-skill">
                  <div class="ship-card-skill__name">{{ SHIP_DEFS[shipId].skill.name }}</div>
                  <div class="ship-card-skill__cd"><PhTimer :size="11" /> {{ getSkillCooldownLabel(shipId) }}</div>
                  <div class="ship-card-skill__desc">{{ SHIP_DEFS[shipId].skill.description }}</div>
                </div>

                <div class="ship-upgrade-list">
                  <div class="ship-upgrade-list__title">Lõi kho vũ khí</div>
                  <div class="arsenal-core-grid">
                    <article
                      v-for="coreCard in getWeaponCacheCards(shipId)"
                      :key="shipId + coreCard.key"
                      class="arsenal-core-card"
                      :class="{ 'arsenal-core-card--ultimate': coreCard.tier === 'ultimate' }"
                    >
                      <div class="arsenal-core-card__head">
                        <CardIcon :name="coreCard.icon" :size="16" />
                        <div class="arsenal-core-card__meta">
                          <div class="arsenal-core-card__name">{{ coreCard.name }}</div>
                          <div class="arsenal-core-card__tier">{{ coreCard.tierLabel }}</div>
                        </div>
                      </div>
                      <div class="arsenal-core-card__desc">{{ coreCard.description }}</div>
                    </article>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="ship-carousel__dots">
            <button
              v-for="(_, idx) in shipOrder"
              :key="idx"
              class="ship-carousel__dot"
              :class="{ 'ship-carousel__dot--active': idx === shipIndex }"
              @click="jumpToShip(idx)"
            />
          </div>
        </article>
      </section>

      <section v-else class="tech-section">
        <article class="tech-block">
          <div class="tech-block__title">Kho Cổ Vật</div>

          <div class="core-grid">
            <div
              v-for="core in displayedArtifacts"
              :key="core.id"
              class="core-card"
              :class="[getArtifactThemeClass(core.id), { 'core-card--owned': isArtifactOwned(core.id) }]"
            >
              <div class="core-card__head">
                <div class="core-card__icon-wrap">
                  <ArtifactIcon :id="core.id" :size="34" />
                </div>
                <div>
                  <div class="core-card__name">{{ core.name }}</div>
                  <div class="core-card__type">Cổ vật chiến thuật</div>
                </div>
              </div>

              <div class="core-card__desc">{{ core.desc }}</div>

              <div class="core-card__actions">
                <button
                  class="core-card__action"
                  :class="{ 'core-card__action--buy': !isArtifactOwned(core.id), 'core-card__action--owned': isArtifactOwned(core.id) }"
                  :disabled="isArtifactActionDisabled(core)"
                  @click="handleArtifactAction(core)"
                >
                  {{ getArtifactActionLabel(core) }}
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>

    <LobbyBottomNav />
  </div>
</template>

<style scoped>
.tech-view {
  min-height: 100dvh;
  padding: 14px 12px 88px;
}

.tech-view__inner {
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tech-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 12px;
  border: 2px solid var(--color-border-dark);
  background: linear-gradient(180deg, rgba(8, 18, 43, 0.96), rgba(7, 15, 34, 0.92));
}

.tech-title {
  margin: 0;
  font-family: var(--font-pixel);
  font-size: 14px;
  letter-spacing: 1px;
  color: #8edbff;
}

.tech-subtitle {
  margin: 4px 0 0;
  font-family: var(--font-pixel);
  font-size: 8px;
  line-height: 1.5;
  color: #8da3c1;
}

.tech-currency {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tech-currency__item {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #f4d35e;
}

.tech-currency__item--ruby {
  color: #ff86d4;
}

.tech-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.tech-tab {
  border: 2px solid #28456f;
  background: rgba(9, 24, 52, 0.86);
  color: #8ca8ca;
  font-family: var(--font-pixel);
  font-size: 10px;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 10px 8px;
  cursor: pointer;
}

.tech-tab--active {
  border-color: #5bc8ff;
  color: #b5ecff;
  background: linear-gradient(180deg, rgba(18, 52, 98, 0.9), rgba(15, 35, 80, 0.95));
}

.tech-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ship-carousel,
.tech-block {
  border: 2px solid var(--color-border-dark);
  background: rgba(8, 20, 44, 0.92);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ship-carousel {
  overflow: hidden;
}

.ship-carousel__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.ship-carousel__label {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #7aa7d0;
}

.ship-carousel__name {
  font-family: var(--font-pixel);
  font-size: 11px;
  margin-top: 3px;
  color: #f3f7ff;
}

.ship-carousel__nav {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.ship-carousel__arrow {
  width: 23px;
  height: 23px;
  border: 1px solid rgba(112, 184, 238, 0.55);
  background: rgba(10, 30, 58, 0.9);
  color: #b9e9ff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.ship-carousel__index {
  min-width: 40px;
  text-align: center;
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #98b9dd;
}

.ship-carousel__track {
  display: flex;
  transition: transform 220ms ease;
  touch-action: pan-y;
}

.ship-carousel__slide {
  min-width: 100%;
  padding-top: 2px;
}

.ship-slide {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ship-card-main {
  border: 1px solid rgba(108, 168, 227, 0.36);
  background: rgba(7, 17, 35, 0.86);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
}

.ship-card-main__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
  gap: 8px;
}

.ship-card-main__left {
  border: 1px solid rgba(92, 138, 185, 0.35);
  background: rgba(9, 22, 43, 0.75);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ship-card-main__right {
  border: 1px solid rgba(92, 138, 185, 0.28);
  background: rgba(8, 19, 37, 0.68);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ship-card-visual,
.ship-card-portrait {
  height: 108px;
  border: 1px dashed rgba(107, 156, 209, 0.45);
  background: radial-gradient(circle at 50% 35%, rgba(53, 126, 204, 0.16), rgba(9, 19, 38, 0.9));
  display: flex;
  align-items: center;
  justify-content: center;
}

.ship-card-visual svg,
.ship-card-portrait svg {
  width: 100%;
  height: 100%;
}

.ship-card-power {
  border: 1px solid rgba(114, 198, 255, 0.4);
  background: rgba(11, 36, 70, 0.72);
  padding: 6px;
}

.ship-card-power__label {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #7cb9e5;
  margin-bottom: 4px;
}

.ship-card-power__value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-pixel);
  font-size: 11px;
  color: #ffda76;
}

.ship-card-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 5px;
}

.ship-card-action,
.ship-card-buy,
.ship-card-select,
.ship-card-active {
  border: 1px solid rgba(113, 165, 221, 0.45);
  background: rgba(14, 36, 66, 0.92);
  color: #cae9ff;
  font-family: var(--font-pixel);
  font-size: 8px;
  padding: 7px 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.ship-card-buy,
.ship-card-select {
  cursor: pointer;
}

.ship-card-active {
  border-color: rgba(123, 228, 151, 0.58);
  color: #baf9d0;
  background: rgba(14, 48, 35, 0.88);
}

.ship-card-action:disabled {
  cursor: default;
  opacity: 0.58;
}

.ship-card-buy:disabled {
  cursor: default;
  opacity: 0.58;
}

.ship-card-buy {
  border-color: #f2cf79;
  color: #1a1304;
  background: linear-gradient(180deg, #f8dc8e, #d9ad42);
}

.ship-card-select {
  border-color: rgba(123, 228, 151, 0.58);
  color: #baf9d0;
  background: rgba(14, 48, 35, 0.88);
}

.ship-card-action--primary {
  border-color: #f2cf79;
  color: #1a1304;
  background: linear-gradient(180deg, #f8dc8e, #d9ad42);
}

.ship-card-action--ghost {
  border-color: rgba(123, 228, 151, 0.58);
  color: #baf9d0;
  background: rgba(14, 48, 35, 0.88);
}

.ship-card-action--dim {
  border-color: rgba(96, 130, 168, 0.45);
  color: #89a3be;
  background: rgba(10, 23, 44, 0.72);
}

.ship-stat-title {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #8baed3;
}

.ship-stat-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ship-chart-row,
.ship-stat-bar {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ship-chart-row__meta,
.ship-stat-bar__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.ship-chart-row__meta span,
.ship-chart-row__meta small,
.ship-stat-bar__label,
.ship-stat-bar__value {
  font-family: var(--font-pixel);
  font-size: 8px;
}

.ship-chart-row__meta span,
.ship-stat-bar__label {
  color: #9db6d2;
}

.ship-chart-row__meta small,
.ship-stat-bar__value {
  color: #eff7ff;
  white-space: nowrap;
}

.ship-chart-row__track,
.ship-stat-bar__track {
  width: 100%;
  height: 6px;
  border: 1px solid rgba(104, 140, 182, 0.45);
  background: rgba(9, 18, 34, 0.9);
  overflow: hidden;
}

.ship-chart-row__fill,
.ship-stat-bar__fill {
  height: 100%;
}

.ship-card-skill,
.ship-upgrade-list {
  border: 1px solid rgba(100, 143, 194, 0.35);
  background: rgba(8, 17, 35, 0.84);
  padding: 8px;
}

.ship-card-skill__title,
.ship-upgrade-list__title {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #cde6ff;
  margin-bottom: 5px;
}

.ship-card-skill__name {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #cde6ff;
  margin-bottom: 5px;
}

.ship-card-skill__cd {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #f7d685;
  margin-bottom: 5px;
}

.ship-card-skill__desc {
  font-family: var(--font-pixel);
  font-size: 8px;
  line-height: 1.5;
  color: #9ab0cd;
}


.ship-upgrade-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.arsenal-core-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}

.arsenal-core-card {
  border: 1px solid rgba(104, 150, 201, 0.38);
  background: rgba(7, 16, 32, 0.88);
  padding: 7px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.arsenal-core-card--ultimate {
  border-color: rgba(243, 206, 110, 0.75);
  background: linear-gradient(180deg, rgba(40, 31, 8, 0.88), rgba(21, 15, 5, 0.9));
}

.arsenal-core-card__head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.arsenal-core-card__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.arsenal-core-card__name {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #d8ecff;
}

.arsenal-core-card__tier {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #8ea8c7;
}

.arsenal-core-card--ultimate .arsenal-core-card__tier {
  color: #f9d985;
}

.arsenal-core-card__desc {
  font-family: var(--font-pixel);
  font-size: 8px;
  line-height: 1.5;
  color: #9db7d6;
}

.arsenal-core-card--ultimate .arsenal-core-card__desc {
  color: #f5e2b2;
}

.ship-carousel__dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 2px;
}

.ship-carousel__dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  border: 1px solid rgba(135, 183, 231, 0.6);
  background: rgba(33, 69, 111, 0.7);
  padding: 0;
  cursor: pointer;
}

.ship-carousel__dot--active {
  background: #9ee3ff;
  border-color: #cbf2ff;
}

.tech-block__title {
  font-family: var(--font-pixel);
  font-size: 10px;
  color: #9ed8ff;
  letter-spacing: 1px;
}

.core-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.core-card {
  --core-tint: 120, 170, 225;
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(var(--core-tint), 0.45);
  background:
    radial-gradient(circle at 86% -8%, rgba(var(--core-tint), 0.25), transparent 44%),
    radial-gradient(circle at 15% 120%, rgba(var(--core-tint), 0.2), transparent 52%),
    linear-gradient(160deg, rgba(11, 21, 40, 0.95), rgba(7, 14, 29, 0.94));
  padding: 8px;
  display: grid;
  grid-template-rows: auto minmax(64px, 1fr) auto;
  gap: 6px;
  min-height: 176px;
}

.core-card--neutron {
  --core-tint: 248, 208, 112;
}

.core-card--carbon {
  --core-tint: 136, 152, 196;
}

.core-card--mana {
  --core-tint: 190, 116, 255;
}

.core-card--stardust {
  --core-tint: 255, 198, 118;
}

.core-card--owned {
  border-color: rgba(125, 219, 162, 0.62);
  box-shadow: inset 0 0 0 1px rgba(113, 209, 150, 0.25);
}

.core-card__head {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  align-items: center;
  text-align: center;
}

.core-card__icon-wrap {
  width: 54px;
  height: 54px;
  border: 1px solid rgba(var(--core-tint), 0.58);
  background: rgba(6, 16, 31, 0.78);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.core-card__name {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #d9edff;
}

.core-card__type,
.core-card__desc {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #8da7c9;
}

.core-card__desc {
  margin-top: 1px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.core-card__actions {
  display: flex;
}

.core-card__action {
  width: 100%;
  border: 1px solid rgba(var(--core-tint), 0.56);
  background: linear-gradient(180deg, rgba(24, 45, 75, 0.95), rgba(12, 28, 52, 0.95));
  color: #c9e9ff;
  font-family: var(--font-pixel);
  font-size: 8px;
  padding: 7px;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.35px;
}

.core-card__action:disabled {
  opacity: 0.9;
  cursor: default;
}

.core-card__action--buy {
  border-color: #f2cf79;
  color: #1a1304;
  background: linear-gradient(180deg, #f8dc8e, #d9ad42);
}

.core-card__action--owned {
  border-color: rgba(123, 228, 151, 0.62);
  color: #bdf6d2;
  background: linear-gradient(180deg, rgba(22, 61, 45, 0.96), rgba(13, 41, 30, 0.96));
}
</style>
