<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/gameStore'
import { ENEMY_CODEX, type EnemyCodexEntry } from '../content/enemyCodex'
import type { EnemyKind } from '../game/types'
import EnemyCodexArt from '../components/ui/EnemyCodexArt.vue'
import EnemyPhaseArt from '../components/ui/EnemyPhaseArt.vue'
import { PhArrowLeft } from '@phosphor-icons/vue'

const router = useRouter()
const game = useGameStore()

const activeTab = ref<'minion' | 'boss'>('minion')
const selectedKind = ref<EnemyKind | null>(null)

const statRows: Array<{ key: keyof EnemyCodexEntry['stats'], label: string, color: string }> = [
  { key: 'hp', label: 'HP', color: '#49f2a2' },
  { key: 'speed', label: 'Tốc độ', color: '#69b6ff' },
  { key: 'damage', label: 'Sát thương', color: '#ff6f6f' },
  { key: 'threat', label: 'Đe doạ', color: '#ffc26a' },
]

const entries = computed(() => ENEMY_CODEX.filter(e => e.tab === activeTab.value))
const discoveredSet = computed(() => new Set(game.encounteredEnemyKinds as EnemyKind[]))
const discoveredCount = computed(() => entries.value.filter(e => discoveredSet.value.has(e.kind)).length)
const selectedEntry = computed(() => entries.value.find(e => e.kind === selectedKind.value) ?? entries.value[0] ?? null)

watch(entries, (list) => {
  if (list.length === 0) {
    selectedKind.value = null
    return
  }
  if (!selectedKind.value || !list.some(e => e.kind === selectedKind.value)) {
    selectedKind.value = list[0]!.kind
  }
}, { immediate: true })

function isDiscovered(kind: EnemyKind): boolean {
  return discoveredSet.value.has(kind)
}

function pct(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

function goHome() {
  router.push('/')
}
</script>

<template>
  <div class="codex">
    <div class="codex__header">
      <button class="codex__back" @click="goHome">
        <PhArrowLeft :size="16" />
        <span>Trang Chủ</span>
      </button>
      <div class="codex__title-wrap">
        <h1 class="codex__title">BÁCH KHOA QUÁI</h1>
        <div class="codex__subtitle">Danh sách ảnh quái. Chạm vào ảnh để mở hồ sơ chi tiết.</div>
      </div>
    </div>

    <div class="codex__tabs">
      <button class="codex-tab" :class="{ 'codex-tab--active': activeTab === 'minion' }" @click="activeTab = 'minion'">Minions</button>
      <button class="codex-tab" :class="{ 'codex-tab--active': activeTab === 'boss' }" @click="activeTab = 'boss'">Bosses</button>
      <div class="codex__progress">Đã khám phá: {{ discoveredCount }}/{{ entries.length }}</div>
    </div>

    <div class="portrait-list">
      <button
        v-for="entry in entries"
        :key="entry.kind"
        class="portrait-item"
        :class="{
          'portrait-item--locked': !isDiscovered(entry.kind),
          'portrait-item--active': selectedKind === entry.kind,
        }"
        @click="selectedKind = entry.kind"
        :title="isDiscovered(entry.kind) ? entry.name : '???'"
      >
        <EnemyCodexArt :kind="entry.kind" :locked="!isDiscovered(entry.kind)" :size="84" />
      </button>
    </div>

    <article v-if="selectedEntry" class="detail-card" :class="{ 'detail-card--locked': !isDiscovered(selectedEntry.kind) }">
      <div class="detail-card__head">
        <EnemyCodexArt :kind="selectedEntry.kind" :locked="!isDiscovered(selectedEntry.kind)" :size="112" />
        <div class="detail-card__meta">
          <h2 class="detail-card__name">{{ isDiscovered(selectedEntry.kind) ? selectedEntry.name : '???' }}</h2>
          <p class="detail-card__info">{{ isDiscovered(selectedEntry.kind) ? selectedEntry.info : 'Mục tiêu chưa được nhận diện. Hãy chạm trán trong trận để mở dữ liệu.' }}</p>
        </div>
      </div>

      <template v-if="isDiscovered(selectedEntry.kind)">
        <div class="detail-card__section">
          <div class="detail-card__label">Cách Tấn Công</div>
          <div class="detail-card__text">{{ selectedEntry.attackPattern }}</div>
        </div>

        <div class="detail-card__section">
          <div class="detail-card__label">Cơ Chế</div>
          <div class="detail-card__text">{{ selectedEntry.counters }}</div>
        </div>

        <div class="detail-card__section">
          <div class="detail-card__label">Sơ Đồ Chỉ Số Cơ Bản</div>
          <div class="enemy-stats">
            <div v-for="s in statRows" :key="selectedEntry.kind + s.key" class="enemy-stats__row">
              <span class="enemy-stats__name">{{ s.label }}</span>
              <div class="enemy-stats__track">
                <div class="enemy-stats__fill" :style="{ width: pct(selectedEntry.stats[s.key]) + '%', background: s.color }" />
              </div>
              <span class="enemy-stats__val">{{ pct(selectedEntry.stats[s.key]) }}</span>
            </div>
          </div>
        </div>

        <div class="detail-card__section">
          <div class="detail-card__label">EXP Rơi Ra</div>
          <div class="detail-card__text">{{ selectedEntry.expDrop }}</div>
        </div>

        <div class="detail-card__section">
          <div class="detail-card__label">Mẹo Tiêu Diệt</div>
          <ul class="detail-card__tips">
            <li v-for="tip in selectedEntry.tips" :key="selectedEntry.kind + tip">{{ tip }}</li>
          </ul>
        </div>

        <div class="detail-card__section">
          <div class="detail-card__label">Giai Đoạn / Cách Thức (Ảnh mô phỏng trong game)</div>
          <div class="phase-grid">
            <div v-for="phase in selectedEntry.phases" :key="selectedEntry.kind + phase.title" class="phase-item">
              <EnemyPhaseArt :art="phase.art" :size="136" />
              <div class="phase-item__title">{{ phase.title }}</div>
              <div class="phase-item__desc">{{ phase.desc }}</div>
            </div>
          </div>
        </div>
      </template>
    </article>
  </div>
</template>

<style scoped>
.codex {
  min-height: 100dvh;
  width: 100%;
  max-width: 960px;
  margin: 0 auto;
  padding: 14px 14px 24px;
  color: var(--color-text);
}

.codex__header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}

.codex__back {
  width: fit-content;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 2px solid var(--color-border-dark);
  background: var(--color-panel-dark);
  color: var(--color-text);
  padding: 6px 10px;
  font-family: var(--font-pixel);
  font-size: 10px;
  cursor: pointer;
}

.codex__title {
  margin: 0;
  font-family: var(--font-pixel);
  font-size: 24px;
  color: var(--color-accent);
  letter-spacing: 2px;
}

.codex__subtitle {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-text-dim);
  margin-top: 4px;
}

.codex__tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.codex-tab {
  border: 2px solid var(--color-border-dark);
  background: var(--color-panel-dark);
  color: var(--color-text);
  padding: 8px 14px;
  font-family: var(--font-pixel);
  font-size: 10px;
  letter-spacing: 1px;
  cursor: pointer;
}

.codex-tab--active {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.codex__progress {
  margin-left: auto;
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-text-dim);
}

.portrait-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}

.portrait-item {
  border: 2px solid #304061;
  background: linear-gradient(180deg, rgba(16, 24, 44, 0.95), rgba(9, 14, 27, 0.96));
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.portrait-item--active {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px rgba(68, 199, 255, 0.25) inset;
}

.portrait-item--locked {
  background: linear-gradient(180deg, rgba(12, 12, 12, 0.96), rgba(7, 7, 7, 0.98));
  border-color: #202020;
}

.detail-card {
  background: linear-gradient(180deg, rgba(16, 24, 44, 0.95), rgba(9, 14, 27, 0.96));
  border: 2px solid #2f3f61;
  padding: 12px;
}

.detail-card--locked {
  background: linear-gradient(180deg, rgba(12, 12, 12, 0.96), rgba(7, 7, 7, 0.98));
  border-color: #202020;
}

.detail-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.detail-card__name {
  margin: 0;
  font-family: var(--font-pixel);
  font-size: 14px;
  color: #f3f6ff;
}

.detail-card__info {
  margin: 6px 0 0;
  font-family: var(--font-pixel);
  font-size: 9px;
  line-height: 1.6;
  color: #b9c8e5;
}

.detail-card__section {
  margin-top: 10px;
}

.detail-card__label {
  font-family: var(--font-pixel);
  font-size: 9px;
  letter-spacing: 1px;
  color: #ffd37b;
  margin-bottom: 4px;
}

.detail-card__text {
  font-family: var(--font-pixel);
  font-size: 9px;
  line-height: 1.6;
  color: #d6def0;
}

.detail-card__tips {
  margin: 0;
  padding-left: 16px;
  font-family: var(--font-pixel);
  font-size: 9px;
  line-height: 1.6;
  color: #d6def0;
}

.enemy-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.enemy-stats__row {
  display: grid;
  grid-template-columns: 62px 1fr 34px;
  align-items: center;
  gap: 8px;
}

.enemy-stats__name,
.enemy-stats__val {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #c8d2ea;
}

.enemy-stats__val {
  text-align: right;
}

.enemy-stats__track {
  height: 8px;
  border: 1px solid #35476c;
  background: #121c31;
  overflow: hidden;
}

.enemy-stats__fill {
  height: 100%;
}

.phase-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 8px;
}

.phase-item {
  border: 1px solid #304061;
  background: rgba(17, 26, 47, 0.86);
  padding: 6px;
}

.phase-item__title {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #f0f5ff;
  margin-top: 4px;
}

.phase-item__desc {
  font-family: var(--font-pixel);
  font-size: 8px;
  line-height: 1.5;
  color: #bdcce7;
  margin-top: 2px;
}
</style>
