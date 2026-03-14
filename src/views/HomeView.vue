<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore, ALL_CARD_DEFS, ALL_ARTIFACT_DEFS, SHIP_ARTIFACT_SLOTS, SHIP_DURABILITY_MAX, type CardDef } from '../stores/gameStore'
import PixelButton from '../components/ui/PixelButton.vue'
import TourOverlay, { type TourStep } from '../components/ui/TourOverlay.vue'
import ArtifactIcon from '../components/ui/ArtifactIcon.vue'
import CardIcon from '../components/ui/CardIcon.vue'
import {
  PhCoins, PhDiamond, PhSword, PhShield, PhCrown,
  PhPlay, PhAirplaneTilt, PhRocketLaunch, PhMagicWand, PhCards, PhGear,
  PhClipboardText, PhPencilSimple, PhCheck, PhX,
  PhArrowLeft, PhCaretLeft, PhCaretRight, PhTimer,
  PhDownloadSimple, PhUploadSimple, PhWarning, PhWrench, PhLightning,
  PhTreasureChest,
} from '@phosphor-icons/vue'

const router = useRouter()
const game = useGameStore()

const AVATARS = ['PhRocketLaunch', 'PhAirplaneTilt', 'PhLightning', 'PhFire', 'PhPlanet', 'PhStar']

const showProfileSheet = ref(false)
const showShipsPanel = ref(false)
const shipIndex = ref(0)
const SHIP_COUNT = 3

function prevShip() { shipIndex.value = (shipIndex.value - 1 + SHIP_COUNT) % SHIP_COUNT }
function nextShip() { shipIndex.value = (shipIndex.value + 1) % SHIP_COUNT }

// Touch swipe for carousel
let swipeTouchStartX = 0
function onShipTouchStart(e: TouchEvent) { swipeTouchStartX = e.touches[0].clientX }
function onShipTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - swipeTouchStartX
  if (Math.abs(dx) > 40) dx < 0 ? nextShip() : prevShip()
}
const showCorePanel = ref(false)
const selectedCard = ref<CardDef | null>(null)
const showComingSoon = ref(false)
const showArtifactsPanel = ref(false)
const showMissionsPanel = ref(false)
const showAdminInput = ref(false)
const adminInput = ref('')
const showTourPrompt = ref(false)
const showTour = ref(false)
const showSettingsPanel = ref(false)
const importStatus = ref<'idle' | 'success' | 'error'>('idle')
let importStatusTimer: ReturnType<typeof setTimeout> | null = null

function onImportFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const ok = game.importSave(reader.result as string)
    importStatus.value = ok ? 'success' : 'error'
    if (importStatusTimer) clearTimeout(importStatusTimer)
    importStatusTimer = setTimeout(() => { importStatus.value = 'idle' }, 3000)
  }
  reader.readAsText(file)
  // reset input so same file can be picked again
  ;(e.target as HTMLInputElement).value = ''
}

const completedMissions = computed(() => game.dailyMissions.filter(m => m.completed).length)
const unclaimedMissions = computed(() => game.dailyMissions.filter(m => m.completed && !m.claimed).length)

const MILESTONE_ITEMS: Array<{ step: 3|5; reward: string }> = [
  { step: 3, reward: '400🪙+EXP' },
  { step: 5, reward: '5💎' },
]
const milestoneClaimed = computed(() => ({
  3: game.milestone3Claimed,
  5: game.milestone5Claimed,
} as Record<3|5, boolean>))

const TOUR_STEPS: TourStep[] = [
  {
    title: '✈ Xin Chào, Phi Công!',
    desc: 'Bạn đang ghé thăm lần đầu tiên! Hãy để chúng tôi giới thiệu nhanh các tính năng chính.',
  },
  {
    target: 'profile',
    title: 'Hồ Sơ Phi Công',
    desc: 'Nhấn vào đây để tuỳ chỉnh tên, avatar và tên chiến cơ của bạn.',
  },
  {
    target: 'currency',
    title: 'Tiền Tệ',
    desc: 'Vàng (🪙) kiếm được sau mỗi ván, dùng để mua nâng cấp vĩnh viễn.\nRuby (💎) là tiền tệ cao cấp cho vật phẩm đặc biệt sau này.',
  },
  {
    target: 'stats-panel',
    title: 'Tiến Độ',
    desc: 'Theo dõi cấp độ tài khoản, vàng tích lũy và kỷ lục điểm cao nhất của bạn tại đây.',
  },
  {
    target: 'ships-btn',
    title: 'Phi Cơ',
    desc: 'Xem thông số và kỹ năng đặc biệt của phi cơ. Các chiến cơ mới sẽ được mở khoá trong tương lai.',
  },
  {
    target: 'core-btn',
    title: 'Lõi Sao — Thẻ Kỹ Năng',
    desc: 'Khi lên cấp trong game, bạn chọn 1 trong 3 thẻ ngẫu nhiên. Có 3 loại: Tấn Công, Hỗ Trợ và Tối Thượng cực mạnh.',
  },
  {
    target: 'play-btn',
    title: 'Sẵn Sàng Chiến Đấu!',
    desc: 'Di chuyển: kéo chuột (PC) hoặc chạm và trượt (Mobile).\nKỹ năng: chuột phải (PC) hoặc chạm đôi (Mobile).\n\nTiêu diệt kẻ địch, lên cấp và trở thành huyền thoại!',
  },
]

function dismissTourPrompt() {
  showTourPrompt.value = false
  localStorage.setItem('hasTakenTour', '1')
}
function startTour() {
  showTourPrompt.value = false
  showTour.value = true
}
function onTourDone() {
  showTour.value = false
  localStorage.setItem('hasTakenTour', '1')
}

function confirmAdmin() {
  if (adminInput.value.trim().toUpperCase() === 'ADMIN') {
    game.activateAdmin()
  }
  showAdminInput.value = false
  adminInput.value = ''
}
function onAdminKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
    showAdminInput.value = true
    adminInput.value = ''
  }
}

const attackCards = ALL_CARD_DEFS.filter(c => c.type === 'attack')
const supportCards = ALL_CARD_DEFS.filter(c => c.type === 'support')
const ultimateCards = ALL_CARD_DEFS.filter(c => c.type === 'ultimate')

function getCardById(id?: string) {
  if (!id) return null
  return ALL_CARD_DEFS.find(card => card.id === id) ?? null
}

function openCardDetails(card: CardDef) {
  selectedCard.value = card
}

interface StarCoreRow {
  attack: CardDef | null
  support: CardDef | null
  ultimate: CardDef | null
  opLeft: string
  opRight: string
}

const comboCoreRows = computed<StarCoreRow[]>(() =>
  ultimateCards.map((ultimate) => {
    const attack = getCardById(ultimate.requiresAttackId)
    const support = getCardById(ultimate.requiresSupportId)
    const useImplication = !support
    return {
      attack,
      support,
      ultimate,
      opLeft: useImplication ? '⇒' : '+',
      opRight: useImplication ? '⇒' : '=',
    }
  }),
)

const pairedAttackIds = computed(() => new Set(comboCoreRows.value.map(row => row.attack?.id).filter(Boolean)))
const pairedSupportIds = computed(() => new Set(comboCoreRows.value.map(row => row.support?.id).filter(Boolean)))
const pairedUltimateIds = computed(() => new Set(comboCoreRows.value.map(row => row.ultimate?.id).filter(Boolean)))

const columnRows = computed<StarCoreRow[]>(() => {
  const restAttack = attackCards.filter(card => !pairedAttackIds.value.has(card.id))
  const restSupport = supportCards.filter(card => !pairedSupportIds.value.has(card.id))
  const restUltimate = ultimateCards.filter(card => !pairedUltimateIds.value.has(card.id))
  const rowCount = Math.max(restAttack.length, restSupport.length, restUltimate.length)

  return Array.from({ length: rowCount }, (_, idx) => ({
    attack: restAttack[idx] ?? null,
    support: restSupport[idx] ?? null,
    ultimate: restUltimate[idx] ?? null,
    opLeft: '',
    opRight: '',
  }))
})

const starCoreRows = computed<StarCoreRow[]>(() => [...comboCoreRows.value, ...columnRows.value])

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

const starHolderStats = [
  { label: 'SÁT THƯƠNG',  display: '25 / 150',  pct: 17, color: '#ff4444' },
  { label: 'TỐC ĐỘ BẮN', display: '1.2 / 1.8', pct: 67, color: '#ff9900' },
  { label: 'ĐẠN / LỚT',   display: '1 / 3',    pct: 33, color: '#ffcc00' },
  { label: 'TỐC BAY',     display: '1.2 / 1.75', pct: 69, color: '#44aaff' },
  { label: 'HP',          display: '180 / 300', pct: 60, color: '#44ff88' },
]

const starShooterStats = [
  { label: 'SÁT THƯƠNG',  display: '40 / 200',  pct: 20, color: '#ff4444' },
  { label: 'TỐC ĐỘ BẮN', display: '0.38 / 1.25', pct: 30, color: '#ff9900' },
  { label: 'ĐẠN / LỚT',   display: '1 / 4',    pct: 25, color: '#ffcc00' },
  { label: 'TỐC BAY',     display: '0.7 / 1.1', pct: 64, color: '#44aaff' },
  { label: 'HP',          display: '220 / 400', pct: 55, color: '#44ff88' },
]

function buyShip(id: string, cost: number) {
  game.buyShip(id, cost)
}
function selectShip(id: string) {
  game.selectShip(id)
}

let regenInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  game.loadProgress()
  if (!localStorage.getItem('hasTakenTour')) {
    showTourPrompt.value = true
  }
  // Thụ động tái sinh độ bền: 1/phút
  regenInterval = setInterval(() => game.tickDurabilityRegen(), 60000)
  document.addEventListener('keydown', onAdminKeyDown)
})

onUnmounted(() => {
  if (regenInterval) clearInterval(regenInterval)
  document.removeEventListener('keydown', onAdminKeyDown)
})

function startGame() {
  router.push('/game')
}

function goToTest() {
  router.push('/test')
}

const canPlay = computed(() => {
  const dur = game.shipDurabilities[game.selectedShip] ?? (SHIP_DURABILITY_MAX[game.selectedShip] ?? 100)
  return dur >= 10
})

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
      <button class="profile-btn" data-tour="profile" @click="openProfileSheet">
        <div class="profile-avatar"><CardIcon :name="AVATARS[game.avatarId]" :size="20" /></div>
        <div class="profile-info">
          <div class="profile-name">{{ game.username }}</div>
          <div class="profile-ship">{{ game.shipName }}</div>
        </div>
      </button>
      <!-- LV + EXP bar -->
      <div class="topbar-lv">
        <div class="topbar-lv__badge">LV {{ game.accountLevel }}</div>
        <div class="topbar-lv__bar">
          <div class="topbar-lv__fill" :style="{ width: game.accountExpPercent + '%' }" />
        </div>
        <div class="topbar-lv__exp">{{ game.accountExp }}/{{ game.accountExpToNextLevel }}</div>
      </div>
      <div class="topbar-right" data-tour="currency">
        <button class="topbar-missions" @click="showMissionsPanel = true">
          <PhClipboardText weight="fill" :size="18" />
          <span v-if="unclaimedMissions > 0" class="topbar-missions__badge">{{ unclaimedMissions }}</span>
        </button>
        <div class="currency-display">
          <div class="gold-display">
            <span class="gold-icon"><PhCoins weight="fill" :size="16" /></span>
            <span class="gold-amount">{{ game.playerCoins }}</span>
          </div>
          <div class="ruby-display">
            <span class="ruby-icon"><PhDiamond weight="fill" :size="16" /></span>
            <span class="ruby-amount">{{ game.playerRuby }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="home__container">
      <!-- Logo / Title -->
      <div class="home__hero">
        <div class="home__title-wrapper">
          <h1 class="home__title">STAR<br/>KEEPER</h1>
          <div class="home__subtitle">NGƯỜI HỘ SAO</div>
        </div>
        <div class="home__ship-icon"><PhAirplaneTilt :size="64" weight="fill" /></div>
      </div>

      <!-- Equipment Panel -->
      <div data-tour="stats-panel" class="equip-panel">
        <div class="equip-panel__title">TRANG BỊ</div>
        <div class="equip-panel__body">
          <!-- Left: ship SVG -->
          <div class="equip-panel__ship">
            <template v-if="game.selectedShip === 'star_keeper'">
              <svg viewBox="-32 -28 64 58" width="56" height="54">
                <polygon points="-10,0 -28,18 -10,10" fill="#0077bb"/>
                <polygon points="10,0 28,18 10,10" fill="#0077bb"/>
                <rect x="-10" y="-22" width="20" height="34" fill="#00cfff"/>
                <rect x="-5" y="-22" width="10" height="13" fill="#ffd700"/>
                <rect x="-6" y="12" width="12" height="9" fill="#ff6600" opacity="0.85"/>
              </svg>
            </template>
            <template v-else-if="game.selectedShip === 'star_shooter'">
              <svg viewBox="-32 -33 64 62" width="56" height="54">
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
            <template v-else>
              <svg viewBox="-34 -32 68 66" width="56" height="54">
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
          </div>
          <!-- Right: stats -->
          <div class="equip-panel__right">
            <!-- Durability bar -->
            <div class="equip-dur">
              <div class="equip-dur__label">
                ĐỘ BỀN
                <span class="equip-dur__val">{{ game.shipDurabilities[game.selectedShip] ?? SHIP_DURABILITY_MAX[game.selectedShip] }} / {{ SHIP_DURABILITY_MAX[game.selectedShip] }}</span>
              </div>
              <div class="equip-dur__track">
                <div
                  class="equip-dur__fill"
                  :class="{
                    'dur--low':  ((game.shipDurabilities[game.selectedShip] ?? 100) / (SHIP_DURABILITY_MAX[game.selectedShip] ?? 100)) <= 0.3,
                    'dur--mid':  ((game.shipDurabilities[game.selectedShip] ?? 100) / (SHIP_DURABILITY_MAX[game.selectedShip] ?? 100)) > 0.3 && ((game.shipDurabilities[game.selectedShip] ?? 100) / (SHIP_DURABILITY_MAX[game.selectedShip] ?? 100)) <= 0.6,
                  }"
                  :style="{ width: (((game.shipDurabilities[game.selectedShip] ?? SHIP_DURABILITY_MAX[game.selectedShip]) / SHIP_DURABILITY_MAX[game.selectedShip]) * 100) + '%' }"
                />
              </div>
              <div v-if="!game.canUseShip(game.selectedShip)" class="equip-dur__warn"><PhWarning :size="11" style="vertical-align:middle;margin-right:3px"/>Cần ≥ 10 để xuất trận</div>
            </div>
            <!-- Artifact slot(s) -->
            <div class="equip-artifacts">
              <div class="equip-artifacts__label">CỔ VẬT</div>
              <div class="equip-artifacts__slots">
                <template v-for="slotIdx in (SHIP_ARTIFACT_SLOTS[game.selectedShip] ?? 1)" :key="slotIdx">
                  <div
                    class="equip-slot"
                    :class="{ 'equip-slot--filled': !!(game.equippedArtifacts[game.selectedShip] ?? [])[slotIdx - 1] }"
                    @click="showArtifactsPanel = true"
                  >
                    <template v-if="(game.equippedArtifacts[game.selectedShip] ?? [])[slotIdx - 1]">
                      <ArtifactIcon :id="(game.equippedArtifacts[game.selectedShip] ?? [])[slotIdx - 1]!" :size="18" class="equip-slot__icon" />
                      <span class="equip-slot__name">{{ ALL_ARTIFACT_DEFS.find(a => a.id === (game.equippedArtifacts[game.selectedShip] ?? [])[slotIdx - 1])?.name }}</span>
                    </template>
                    <template v-else>
                      <span class="equip-slot__empty">+ Gắn cổ vật</span>
                    </template>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Menu buttons -->
      <div class="home__menu">
        <button class="menu-play-btn" data-tour="play-btn" :disabled="!canPlay" @click="startGame">
          <PhPlay :size="18" weight="fill" />
          <span>BẮT ĐẦU</span>
        </button>
        <div v-if="!canPlay" class="menu-play-warn">⚠ Độ bền phi cơ quá thấp! Sửa chữa trước khi cất cánh.</div>
        <div class="menu-grid">
          <button class="menu-tile" data-tour="ships-btn" @click="showShipsPanel = true">
            <PhRocketLaunch :size="24" weight="fill" />
            <span>Phi Cơ</span>
          </button>
          <button class="menu-tile" @click="showArtifactsPanel = true">
            <PhMagicWand :size="24" weight="fill" />
            <span>Cổ Vật</span>
          </button>
          <button class="menu-tile" data-tour="core-btn" @click="showCorePanel = true">
            <PhCards :size="24" weight="fill" />
            <span>Lõi Sao</span>
          </button>
          <button class="menu-tile" @click="showSettingsPanel = true">
            <PhGear :size="24" weight="fill" />
            <span>Cài Đặt</span>
          </button>
          <button v-if="game.isAdminMode" class="menu-tile menu-tile--test" @click="goToTest">
            <PhWrench :size="24" weight="fill" />
            <span>Thử Nghiệm</span>
          </button>
        </div>
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
            <button class="sheet-close" @click="closeProfileSheet"><PhX :size="14" /></button>
          </div>

          <!-- Username -->
          <div class="sheet-section">
            <div class="sheet-section-label">TÊN PHI CÔNG</div>
            <div class="sheet-edit-row" v-if="!editingUsername">
              <span class="sheet-value">{{ game.username }}</span>
              <button class="edit-btn" @click="editingUsername = true; usernameInput = game.username"><PhPencilSimple :size="14" /></button>
            </div>
            <div class="sheet-input-row" v-else>
              <input
                v-model="usernameInput"
                class="sheet-input"
                maxlength="20"
                autofocus
                @keydown="onUsernameKey"
              />
              <button class="confirm-btn" @click="saveUsername"><PhCheck :size="16" /></button>
            </div>
          </div>

          <!-- Ship name -->
          <div class="sheet-section">
            <div class="sheet-section-label">TÊN CHIẾN CƠ</div>
            <div class="sheet-edit-row" v-if="!editingShipName">
              <span class="sheet-value">{{ game.shipName }}</span>
              <button class="edit-btn" @click="editingShipName = true; shipNameInput = game.shipName"><PhPencilSimple :size="14" /></button>
            </div>
            <div class="sheet-input-row" v-else>
              <input
                v-model="shipNameInput"
                class="sheet-input"
                maxlength="24"
                autofocus
                @keydown="onShipNameKey"
              />
              <button class="confirm-btn" @click="saveShipName"><PhCheck :size="16" /></button>
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
              ><CardIcon :name="av" :size="24" /></button>
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
            <button class="sheet-close" @click="showShipsPanel = false"><PhX :size="14" /></button>
          </div>

          <!-- Carousel wrapper -->
          <div
            class="ship-carousel"
            @touchstart.passive="onShipTouchStart"
            @touchend.passive="onShipTouchEnd"
          >
            <!-- Slide track -->
            <div class="ship-carousel__track" :style="{ transform: `translateX(${-shipIndex * 100}%)` }">

              <!-- Slide 0: Star Keeper -->
              <div class="ship-carousel__slide">
                <div class="ship-card" :class="{ 'ship-card--selected': game.selectedShip === 'star_keeper' }">
                  <div class="ship-card__header">
                    <svg class="ship-svg" viewBox="-32 -28 64 58" width="60" height="58">
                      <polygon points="-10,0 -28,18 -10,10" fill="#0077bb"/>
                      <polygon points="10,0 28,18 10,10" fill="#0077bb"/>
                      <rect x="-10" y="-22" width="20" height="34" fill="#00cfff"/>
                      <rect x="-5" y="-22" width="10" height="13" fill="#ffd700"/>
                      <rect x="-6" y="12" width="12" height="9" fill="#ff6600" opacity="0.85"/>
                    </svg>
                    <div class="ship-card__info">
                      <div class="ship-card__name">STAR KEEPER</div>
                      <div class="ship-card__tag">⭐ Phi cơ cơ bản · Miễn phí</div>
                      <div class="ship-card__desc">Chiến cơ mức trung bình, cân bằng giữa tốc độ và sức mạnh. Lựa chọn đầu tiên cho mọi phi công.</div>
                    </div>
                  </div>
                  <div class="ship-stats">
                    <div v-for="stat in starKeeperStats" :key="stat.label" class="ship-stat">
                      <span class="ship-stat__label">{{ stat.label }}</span>
                      <div class="ship-stat__track"><div class="ship-stat__fill" :style="{ width: stat.pct + '%', background: stat.color }" /></div>
                      <span class="ship-stat__val">{{ stat.display }}</span>
                    </div>
                  </div>
                  <div class="ship-skill">
                    <div class="ship-skill__name"><PhCrown weight="fill" :size="14" style="vertical-align:middle;margin-right:4px"/>SÓNG TẦM NHIỆT HỦY DIỆT</div>
                    <div class="ship-skill__cd"><PhTimer :size="11" style="vertical-align:middle;margin-right:4px"/>Hồi chiêu: 30 giây</div>
                    <div class="ship-skill__desc">Tỏa ra sóng nhiệt tốc độ cao, gây sát thương lên tất cả kẻ địch trên màn hình và hủy toàn bộ đường đạn của đối phương.</div>
                  </div>
                  <div class="ship-card__actions">
                    <button v-if="game.selectedShip !== 'star_keeper'" class="ship-btn ship-btn--select" @click="selectShip('star_keeper')"><PhCheck :size="11" style="vertical-align:middle;margin-right:4px"/>Chọn phi cơ này</button>
                    <div v-else class="ship-btn ship-btn--active"><PhLightning weight="fill" :size="11" style="vertical-align:middle;margin-right:4px"/>Đang sử dụng</div>
                  </div>
                </div>
              </div>

              <!-- Slide 1: Star Holder -->
              <div class="ship-carousel__slide">
                <div class="ship-card" :class="{ 'ship-card--selected': game.selectedShip === 'star_holder' }">
                  <div class="ship-card__header">
                    <svg class="ship-svg" viewBox="-34 -32 68 66" width="60" height="60">
                      <polygon points="-9,4 -30,20 -9,14" fill="#dd6600"/>
                      <polygon points="-25,18 -30,20 -20,22" fill="#ff8800"/>
                      <polygon points="9,4 30,20 9,14" fill="#dd6600"/>
                      <polygon points="25,18 30,20 20,22" fill="#ff8800"/>
                      <rect x="-9" y="-24" width="18" height="38" fill="#ff9900"/>
                      <polygon points="0,-28 8,-18 -8,-18" fill="#ffee44"/>
                      <rect x="-6" y="14" width="12" height="10" fill="#ff4400" opacity="0.9"/>
                      <rect x="-3" y="18" width="6" height="6" fill="#ffcc00" opacity="0.85"/>
                    </svg>
                    <div class="ship-card__info">
                      <div class="ship-card__name">STAR HOLDER</div>
                      <div class="ship-card__tag" :class="game.ownedShips.includes('star_holder') ? 'tag--owned' : 'tag--locked'">
                        {{ game.ownedShips.includes('star_holder') ? '✅ Đã sở hữu' : '🔒 Cần mở khoá · 5,000 🪙' }}
                      </div>
                      <div class="ship-card__desc">Chiến cơ tấn công cao, thân tàu mạnh mẽ. Linh hồn kẻ địch trở thành vũ khí hủy diệt.</div>
                    </div>
                  </div>
                  <div class="ship-stats">
                    <div v-for="stat in starHolderStats" :key="stat.label" class="ship-stat">
                      <span class="ship-stat__label">{{ stat.label }}</span>
                      <div class="ship-stat__track"><div class="ship-stat__fill" :style="{ width: stat.pct + '%', background: stat.color }" /></div>
                      <span class="ship-stat__val">{{ stat.display }}</span>
                    </div>
                  </div>
                  <div class="ship-skill ship-skill--orange">
                    <div class="ship-skill__name">🔥 THU THẬP LINH HỒN</div>
                    <div class="ship-skill__cd">⬡ Cần: 10 mảnh linh hồn (tối đa 50)</div>
                    <div class="ship-skill__desc">Kẻ địch bị hạ có 75% cơ hội rơi mảnh linh hồn. Thu thập đủ 10 mảnh rồi kích hoạt để bắn tất cả thành tên lửa tự dẫn, bám sát kẻ địch gần nhất.</div>
                  </div>
                  <div class="ship-card__actions">
                    <template v-if="!game.ownedShips.includes('star_holder')">
                      <button class="ship-btn ship-btn--buy" :disabled="game.playerCoins < 5000" @click="buyShip('star_holder', 5000)">
                        {{ game.playerCoins >= 5000 ? 'Mua — 5,000 🪙' : 'Không đủ vàng' }}
                      </button>
                    </template>
                    <template v-else>
                      <button v-if="game.selectedShip !== 'star_holder'" class="ship-btn ship-btn--select" @click="selectShip('star_holder')"><PhCheck :size="11" style="vertical-align:middle;margin-right:4px"/>Chọn phi cơ này</button>
                      <div v-else class="ship-btn ship-btn--active"><PhLightning weight="fill" :size="11" style="vertical-align:middle;margin-right:4px"/>Đang sử dụng</div>
                    </template>
                  </div>
                </div>
              </div>

              <!-- Slide 2: Star Shooter -->
              <div class="ship-carousel__slide">
                <div class="ship-card" :class="{ 'ship-card--selected': game.selectedShip === 'star_shooter' }">
                  <div class="ship-card__header">
                    <svg class="ship-svg" viewBox="-32 -33 64 62" width="60" height="58">
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
                    <div class="ship-card__info">
                      <div class="ship-card__name">STAR SHOOTER</div>
                      <div class="ship-card__tag" :class="game.ownedShips.includes('star_shooter') ? 'tag--owned' : 'tag--locked'">
                        {{ game.ownedShips.includes('star_shooter') ? '✅ Đã sở hữu' : '🔒 Cần mở khoá · 15,000 🪙' }}
                      </div>
                      <div class="ship-card__desc">Chiến cơ 4 cánh với pod tên lửa hạng nặng. Tên lửa tự dẫn bám sát đối thủ, kỹ năng hố đen hấp thụ kẻ địch.</div>
                    </div>
                  </div>
                  <div class="ship-stats">
                    <div v-for="stat in starShooterStats" :key="stat.label" class="ship-stat">
                      <span class="ship-stat__label">{{ stat.label }}</span>
                      <div class="ship-stat__track"><div class="ship-stat__fill" :style="{ width: stat.pct + '%', background: stat.color }" /></div>
                      <span class="ship-stat__val">{{ stat.display }}</span>
                    </div>
                  </div>
                  <div class="ship-skill ship-skill--purple">
                    <div class="ship-skill__name">🌑 HỐ ĐEN HẤP DẪN</div>
                    <div class="ship-skill__cd"><PhTimer :size="11" style="vertical-align:middle;margin-right:4px"/>Hồi chiêu: 35 giây</div>
                    <div class="ship-skill__desc">Triệu hồi hố đen trong 5 giây — hút kẻ địch thường lại gần, gây 10% HP/s sát thương liên tục (trùm 2%) và hấp thụ toàn bộ đạn kẻ địch.</div>
                  </div>
                  <div class="ship-card__actions">
                    <template v-if="!game.ownedShips.includes('star_shooter')">
                      <button class="ship-btn ship-btn--buy" :disabled="game.playerCoins < 15000" @click="buyShip('star_shooter', 15000)">
                        {{ game.playerCoins >= 15000 ? 'Mua — 15,000 🪙' : 'Không đủ vàng' }}
                      </button>
                    </template>
                    <template v-else>
                      <button v-if="game.selectedShip !== 'star_shooter'" class="ship-btn ship-btn--select" @click="selectShip('star_shooter')"><PhCheck :size="11" style="vertical-align:middle;margin-right:4px"/>Chọn phi cơ này</button>
                      <div v-else class="ship-btn ship-btn--active"><PhLightning weight="fill" :size="11" style="vertical-align:middle;margin-right:4px"/>Đang sử dụng</div>
                    </template>
                  </div>
                </div>
              </div>

            </div><!-- /.ship-carousel__track -->

            <!-- Prev / Next arrows -->
            <button class="ship-carousel__arrow ship-carousel__arrow--prev" :disabled="shipIndex === 0" @click="prevShip"><PhCaretLeft :size="18" /></button>
            <button class="ship-carousel__arrow ship-carousel__arrow--next" :disabled="shipIndex === SHIP_COUNT - 1" @click="nextShip"><PhCaretRight :size="18" /></button>

            <!-- Dot indicators -->
            <div class="ship-carousel__dots">
              <span
                v-for="i in SHIP_COUNT"
                :key="i"
                class="ship-carousel__dot"
                :class="{ 'ship-carousel__dot--active': shipIndex === i - 1 }"
                @click="shipIndex = i - 1"
              />
            </div>
          </div><!-- /.ship-carousel -->
        </div>
      </div>
    </Transition>

    <!-- Artifacts Panel -->
    <Transition name="sheet">
      <div v-if="showArtifactsPanel" class="sheet-overlay" @click.self="showArtifactsPanel = false">
        <div class="ships-sheet">
          <div class="sheet-header">
            <div style="width:36px"/>
            <div class="sheet-title">CỔ VẬT</div>
            <button class="sheet-close" @click="showArtifactsPanel = false"><PhX :size="14" /></button>
          </div>
          <div class="ships-scroll" style="padding: 14px;">
            <div class="artifact-hint">Trang bị cổ vật vào ô cổ vật của phi cơ để nhận hiệu ứng đặc biệt trong trận.</div>
            <div class="artifact-grid">
              <div
                v-for="art in ALL_ARTIFACT_DEFS"
                :key="art.id"
                class="artifact-card"
                :class="{ 'artifact-card--owned': game.ownedArtifacts.includes(art.id) }"
              >
                <ArtifactIcon :id="art.id" :size="38" class="artifact-card__icon" />
                <div class="artifact-card__name">{{ art.name }}</div>
                <div class="artifact-card__desc">{{ art.desc }}</div>
                <div class="artifact-card__cost" v-if="!game.ownedArtifacts.includes(art.id)">
                  <PhCoins weight="fill" :size="11" style="vertical-align:middle;margin-right:3px;color:#f1c40f"/>{{ art.cost.toLocaleString() }}
                </div>
                <div class="artifact-card__actions">
                  <button
                    v-if="!game.ownedArtifacts.includes(art.id)"
                    class="artifact-btn artifact-btn--buy"
                    :disabled="game.playerCoins < art.cost"
                    @click="game.buyArtifact(art.id)"
                  >{{ game.playerCoins >= art.cost ? 'Mua' : 'Thiếu vàng' }}</button>
                  <template v-else>
                    <button
                      v-if="(game.equippedArtifacts[game.selectedShip] ?? []).includes(art.id)"
                      class="artifact-btn artifact-btn--unequip"
                      @click="game.unequipArtifact(game.selectedShip, art.id)"
                    >Tháo</button>
                    <button
                      v-else
                      class="artifact-btn artifact-btn--equip"
                      :disabled="((game.equippedArtifacts[game.selectedShip] ?? []).length) >= (SHIP_ARTIFACT_SLOTS[game.selectedShip] ?? 1)"
                      @click="game.equipArtifact(game.selectedShip, art.id)"
                    >Trang bị</button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Lõi Sao Panel -->
    <Transition name="sheet">
      <div v-if="showCorePanel" class="sheet-overlay" @click.self="showCorePanel = false; selectedCard = null">
        <div class="ships-sheet">
          <div class="sheet-header">
            <button v-if="selectedCard" class="sheet-back" @click="selectedCard = null"><PhArrowLeft :size="14" /></button>
            <div v-else style="width: 36px;" />
            <div class="sheet-title">{{ selectedCard ? selectedCard.name : 'LÕI SAO' }}</div>
            <button class="sheet-close" @click="showCorePanel = false; selectedCard = null"><PhX :size="14" /></button>
          </div>

          <!-- Card detail view -->
          <div v-if="selectedCard" class="ships-scroll">
            <div class="core-detail-card">
              <div class="core-detail-header">
                <div class="core-detail-icon"><CardIcon :name="selectedCard.icon" :size="42" /></div>
                <div class="core-detail-meta">
                  <div class="core-detail-name">{{ selectedCard.name }}</div>
                  <div class="core-detail-type" :class="'type--' + selectedCard.type">
                    <template v-if="selectedCard.type === 'attack'"><PhSword weight="fill" :size="12" style="vertical-align:middle;margin-right:3px"/>TẤN CÔNG</template>
                    <template v-else-if="selectedCard.type === 'support'"><PhShield weight="fill" :size="12" style="vertical-align:middle;margin-right:3px"/>HỖ TRỢ</template>
                    <template v-else><PhCrown weight="fill" :size="12" style="vertical-align:middle;margin-right:3px"/>TỐI THƯỢNG</template>
                  </div>
                </div>
              </div>
              <div class="core-detail-levels">
                <div v-for="(lv, i) in selectedCard.levels" :key="i" class="core-detail-level">
                  <div class="core-detail-lv-badge">Lv{{ i + 1 }}</div>
                  <div class="core-detail-lv-desc">{{ lv.desc }}</div>
                </div>
              </div>
              <div v-if="selectedCard.requiresAttackId || selectedCard.requiresSupportId" class="core-detail-req">
                <div class="core-detail-req-label">YÊU CẦU MỞ KHÓA</div>
                <div v-if="selectedCard.requiresAttackId" class="core-detail-req-item">
                  <CardIcon :name="ALL_CARD_DEFS.find(c => c.id === selectedCard!.requiresAttackId)?.icon ?? ''" :size="14" />
                  {{ ALL_CARD_DEFS.find(c => c.id === selectedCard!.requiresAttackId)?.name }} (Lv5)
                </div>
                <div v-if="selectedCard.requiresSupportId" class="core-detail-req-item">
                  + <CardIcon :name="ALL_CARD_DEFS.find(c => c.id === selectedCard!.requiresSupportId)?.icon ?? ''" :size="14" />
                  {{ ALL_CARD_DEFS.find(c => c.id === selectedCard!.requiresSupportId)?.name }}
                </div>
              </div>
            </div>
          </div>

          <!-- Card list view -->
          <div v-else class="ships-scroll">
            <div class="core-section-label">LÕI TẤN CÔNG + LÕI HỖ TRỢ = LÕI TỐI THƯỢNG</div>
            <div class="core-relation-head">
              <div class="core-relation-head__cell core-relation-head__cell--attack"><PhSword weight="fill" :size="14" style="vertical-align:middle;margin-right:4px"/>TẤN CÔNG</div>
              <div class="core-relation-head__op">+</div>
              <div class="core-relation-head__cell core-relation-head__cell--support"><PhShield weight="fill" :size="14" style="vertical-align:middle;margin-right:4px"/>HỖ TRỢ</div>
              <div class="core-relation-head__op">=</div>
              <div class="core-relation-head__cell core-relation-head__cell--ultimate"><PhCrown weight="fill" :size="14" style="vertical-align:middle;margin-right:4px"/>TỐI THƯỢNG</div>
            </div>

            <div class="core-relation-list">
              <div
                v-for="(row, rowIdx) in starCoreRows"
                :key="(row.ultimate?.id ?? 'empty-ult') + '-' + rowIdx"
                class="core-relation-row"
              >
                <button
                  v-if="row.attack"
                  class="core-icon-card core-icon-card--attack"
                  @click="openCardDetails(row.attack)"
                >
                  <CardIcon :name="row.attack.icon" :size="22" />
                  <span class="core-icon-card__name">{{ row.attack.name }}</span>
                </button>
                <div v-else class="core-icon-card core-icon-card--empty" />

                <div class="core-relation-op">{{ row.opLeft }}</div>

                <button
                  v-if="row.support"
                  class="core-icon-card core-icon-card--support"
                  @click="openCardDetails(row.support)"
                >
                  <CardIcon :name="row.support.icon" :size="22" />
                  <span class="core-icon-card__name">{{ row.support.name }}</span>
                </button>
                <div v-else class="core-icon-card core-icon-card--empty" />

                <div class="core-relation-op">{{ row.opRight }}</div>

                <button
                  v-if="row.ultimate"
                  class="core-icon-card core-icon-card--ultimate"
                  @click="openCardDetails(row.ultimate)"
                >
                  <CardIcon :name="row.ultimate.icon" :size="22" />
                  <span class="core-icon-card__name">{{ row.ultimate.name }}</span>
                </button>
                <div v-else class="core-icon-card core-icon-card--empty" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Coming Soon modal -->
    <Transition name="sheet">
      <div v-if="showComingSoon" class="sheet-overlay" @click.self="showComingSoon = false">
        <div class="modal-dialog">
          <div class="modal-dialog__icon"><PhWrench weight="fill" :size="32" /></div>
          <div class="modal-dialog__title">SẮP RA MẮT</div>
          <div class="modal-dialog__desc">Tính năng này đang được phát triển và sẽ có mặt trong phiên bản tới!</div>
          <PixelButton label="Đã Hiểu" size="md" @click="showComingSoon = false" />
        </div>
      </div>
    </Transition>

    <!-- Settings Panel -->
    <Transition name="sheet">
      <div v-if="showSettingsPanel" class="sheet-overlay" @click.self="showSettingsPanel = false">
        <div class="ships-sheet">
          <div class="sheet-header">
            <div style="width:36px"/>
            <div class="sheet-title">CÀI ĐẶT</div>
            <button class="sheet-close" @click="showSettingsPanel = false"><PhX :size="14" /></button>
          </div>
          <div class="ships-scroll" style="padding: 20px 16px 32px;">
            <!-- Save data section -->
            <div class="settings-section-label">DỮ LIỆU GAME</div>
            <div class="settings-desc">Xuất file lưu để bảo quản tiến trình, hoặc nạp lại từ file đã xuất trước đó.</div>

            <button class="settings-btn settings-btn--export" @click="game.exportSave()">
              <PhDownloadSimple :size="14" style="vertical-align:middle;margin-right:6px" weight="bold"/>Xuất File Lưu Game
            </button>

            <label class="settings-btn settings-btn--import">
              <PhUploadSimple :size="14" style="vertical-align:middle;margin-right:6px" weight="bold"/>Nạp File Lưu Game
              <input
                type="file"
                accept=".json,application/json"
                style="display:none"
                @change="onImportFile"
              />
            </label>

            <Transition name="fade">
              <div v-if="importStatus === 'success'" class="settings-status settings-status--ok">
                <PhCheck :size="12" style="vertical-align:middle;margin-right:4px"/>Nạp dữ liệu thành công!
              </div>
              <div v-else-if="importStatus === 'error'" class="settings-status settings-status--err">
                <PhX :size="12" style="vertical-align:middle;margin-right:4px"/>File không hợp lệ, vui lòng thử lại.
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </Transition>

    <!-- First-visit tour prompt -->
    <Transition name="sheet">
      <div v-if="showTourPrompt" class="sheet-overlay" @click.self="dismissTourPrompt">
        <div class="modal-dialog">
          <div class="modal-dialog__icon"><PhAirplaneTilt weight="fill" :size="32" /></div>
          <div class="modal-dialog__title">XIN CHÀO, PHI CÔNG!</div>
          <div class="modal-dialog__desc">Đây là lần đầu bạn ghé thăm. Bạn có muốn xem hướng dẫn cách chơi không?</div>
          <div class="modal-dialog__actions">
            <PixelButton label="Bỏ Qua" variant="secondary" size="md" @click="dismissTourPrompt" />
            <PixelButton label="Xem Ngay ›" size="md" @click="startTour" />
          </div>
        </div>
      </div>
    </Transition>

    <!-- Onboarding spotlight tour -->
    <TourOverlay v-if="showTour" :steps="TOUR_STEPS" @done="onTourDone" />

    <!-- Missions Panel -->
    <Transition name="sheet">
      <div v-if="showMissionsPanel" class="sheet-overlay" @click.self="showMissionsPanel = false">
        <div class="ships-sheet">
          <div class="sheet-header">
            <div style="width:36px"/>
            <div class="sheet-title">NHIỆM VỤ HÔM NAY</div>
            <button class="sheet-close" @click="showMissionsPanel = false"><PhX :size="14" /></button>
          </div>
          <div class="ships-scroll" style="padding: 14px 14px 24px;">
            <!-- Milestone Timeline -->
            <div class="ms-timeline">
              <div class="ms-timeline__title">CỘT MỐC</div>
              <div class="ms-track">
                <div class="ms-track__fill" :style="{ width: Math.min(100, (completedMissions / 5 * 100)) + '%' }" />
                <div
                  v-for="ms in MILESTONE_ITEMS"
                  :key="ms.step"
                  class="ms-chest"
                  :style="{ left: 'calc(' + (ms.step / 5 * 100).toFixed(0) + '% - 22px)' }"
                  :class="{
                    'ms-chest--unlocked':  completedMissions >= ms.step,
                    'ms-chest--claimed':   milestoneClaimed[ms.step],
                    'ms-chest--claimable': completedMissions >= ms.step && !milestoneClaimed[ms.step],
                  }"
                  @click="completedMissions >= ms.step && !milestoneClaimed[ms.step] && game.claimMilestone(ms.step)"
                >
                  <div class="ms-chest__icon">
                    <PhTreasureChest :size="24" :weight="completedMissions >= ms.step ? 'fill' : 'regular'" />
                  </div>
                  <div class="ms-chest__step">
                    <PhCheck v-if="milestoneClaimed[ms.step]" :size="8" weight="bold" />
                    <span v-else>{{ ms.step }}/5</span>
                  </div>
                  <div class="ms-chest__reward">{{ ms.reward }}</div>
                </div>
              </div>
              <div class="ms-progress-label">{{ completedMissions }}/5 nhiệm vụ hoàn thành</div>
            </div>
            <div v-for="m in game.dailyMissions" :key="m.id" class="mission-item" :class="{ 'mission-item--done': m.completed }">
              <div class="mission-item__top">
                <span class="mission-item__desc">{{ m.desc }}</span>
                <span class="mission-item__prog">{{ Math.min(m.progress, m.target) }}/{{ m.target }}</span>
              </div>
              <div class="mission-item__bar">
                <div class="mission-item__fill" :style="{ width: (Math.min(m.progress, m.target) / m.target * 100) + '%' }" />
              </div>
              <div class="mission-item__reward">
                <span class="mission-reward-label">Phần thưởng:</span>
                <span v-if="m.reward.coins"> {{ m.reward.coins }}🪙</span>
                <span v-if="m.reward.ruby"> {{ m.reward.ruby }}💎</span>
                <span v-if="m.reward.accountExp"> {{ m.reward.accountExp }} EXP</span>
              </div>
              <button v-if="m.completed && !m.claimed" class="mission-claim-btn" @click="game.claimMissionReward(m.id)">Nhận thưởng</button>
              <div v-else-if="m.claimed" class="mission-claimed"><PhCheck :size="12" style="vertical-align:middle"/> Đã nhận</div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Admin input modal -->
    <Transition name="sheet">
      <div v-if="showAdminInput" class="sheet-overlay admin-overlay" @click.self="showAdminInput = false">
        <div class="modal-dialog">
          <div class="modal-dialog__title">NHẬP MÃ ADMIN</div>
          <input
            class="admin-input"
            v-model="adminInput"
            maxlength="10"
            autofocus
            placeholder="..."
            @keydown.enter="confirmAdmin"
            @keydown.escape="showAdminInput = false"
          />
          <div class="modal-dialog__actions">
            <PixelButton label="Hủy" variant="secondary" size="md" @click="showAdminInput = false" />
            <PixelButton label="Xác nhận" size="md" @click="confirmAdmin" />
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
  font-size: 9px;
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
  animation: float 2s ease-in-out infinite alternate;
  filter: drop-shadow(0 0 12px var(--color-accent));
  color: var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

@keyframes float {
  from { transform: rotate(-90deg) translateX(-6px); }
  to   { transform: rotate(-90deg) translateX(6px); }
}
.home__ship-icon > * {
  transform: rotate(-90deg);
}
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
  font-size: 9px;
  color: var(--color-text-dim);
}

/* Menu */
.home__menu {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: stretch;
}
.menu-play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 14px 20px;
  background: var(--color-accent);
  color: #fff;
  font-family: var(--font-pixel);
  font-size: 16px;
  letter-spacing: 2px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 0 var(--color-accent-dark), inset 0 1px 0 rgba(255,255,255,0.25);
  transition: transform 0.05s, box-shadow 0.05s, background 0.1s;
  text-transform: uppercase;
  user-select: none;
}
.menu-play-btn:hover { background: var(--color-accent-light); }
.menu-play-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 var(--color-accent-dark); }
.menu-play-btn:disabled {
  background: #555;
  box-shadow: 0 4px 0 #333, inset 0 1px 0 rgba(255,255,255,0.08);
  cursor: not-allowed;
  opacity: 0.65;
}
.menu-play-warn {
  text-align: center;
  font-family: var(--font-pixel);
  font-size: 10px;
  color: #ff7043;
  letter-spacing: 1px;
  margin-top: -4px;
}
.menu-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
}
.menu-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 16px 8px;
  background: var(--color-panel);
  border: 2px solid var(--color-border-dark);
  color: var(--color-text-dim);
  font-family: var(--font-pixel);
  font-size: 11px;
  letter-spacing: 1.5px;
  cursor: pointer;
  text-transform: uppercase;
  box-shadow: 0 3px 0 var(--color-border-dark);
  transition: transform 0.05s, box-shadow 0.05s, border-color 0.12s, color 0.12s;
  user-select: none;
}
.menu-tile:hover { border-color: var(--color-accent); color: var(--color-accent); }
.menu-tile:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--color-border-dark); }
.menu-tile--test { border-color: #f39c12; color: #f39c12; }
.menu-tile--test:hover { border-color: #f1c40f; color: #f1c40f; }

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
  width: 28px;
  height: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sheet-close:hover { border-color: var(--color-border); color: var(--color-text); }
.sheet-section {
  padding: 14px 20px 0;
}
.sheet-section-label {
  font-family: var(--font-pixel);
  font-size: 9px;
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
  cursor: pointer;
  padding: 2px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  width: 36px;
  height: 36px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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
/* Carousel */
.ship-carousel {
  position: relative;
  overflow: hidden;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.ship-carousel__track {
  display: flex;
  flex-direction: row;
  width: 100%;
  flex: 1;
  transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}
.ship-carousel__slide {
  min-width: 100%;
  overflow-y: auto;
  padding: 14px 16px 60px;
  box-sizing: border-box;
}
.ship-carousel__arrow {
  position: absolute;
  bottom: 44px;
  background: rgba(5, 12, 35, 0.85);
  border: 2px solid var(--color-border);
  color: var(--color-accent);
  font-family: var(--font-pixel);
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 2;
  padding: 0;
  transition: opacity 0.2s;
}
.ship-carousel__arrow:disabled { opacity: 0.2; cursor: default; }
.ship-carousel__arrow--prev { left: 12px; }
.ship-carousel__arrow--next { right: 12px; }
.ship-carousel__dots {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 2;
}
.ship-carousel__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-border);
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}
.ship-carousel__dot--active {
  background: var(--color-accent);
  transform: scale(1.3);
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
  font-size: 9px;
  color: #f1c40f;
  letter-spacing: 1px;
}
.ship-card__desc {
  font-family: var(--font-pixel);
  font-size: 9px;
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
  font-size: 9px;
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
  font-size: 9px;
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
  font-size: 10px;
  color: #ff8833;
  letter-spacing: 1px;
}
.ship-skill__cd {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #ffaa55;
  letter-spacing: 0.5px;
}
.ship-skill__desc {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-text-dim);
  line-height: 1.7;
  letter-spacing: 0.2px;
}

/* ─── Lõi Sao (Core Panel) ────────────────────────────────────────────────── */
.ship-card--selected {
  border-color: #ff9900;
  box-shadow: 4px 4px 0 #8b4000, 0 0 10px rgba(255, 150, 0, 0.25);
}
.tag--owned { color: #44ff88; }
.tag--locked { color: #ff6644; }
.ship-skill--orange {
  background: rgba(255, 140, 0, 0.09);
  border-color: rgba(255, 140, 0, 0.5);
}
.ship-skill--purple {
  background: rgba(160, 60, 255, 0.09);
  border-color: rgba(160, 60, 255, 0.5);
}
.ship-card__actions {
  display: flex;
  gap: 10px;
}
.ship-btn {
  flex: 1;
  font-family: var(--font-pixel);
  font-size: 8px;
  letter-spacing: 1px;
  padding: 9px 12px;
  border: 2px solid transparent;
  cursor: pointer;
  text-align: center;
  text-transform: uppercase;
}
.ship-btn--buy {
  background: #22330a;
  border-color: #44aa22;
  color: #88ff55;
}
.ship-btn--buy:disabled {
  background: #1a1a1a;
  border-color: #444;
  color: #666;
  cursor: not-allowed;
}
.ship-btn--select {
  background: #0a1a33;
  border-color: #2255aa;
  color: #66aaff;
}
.ship-btn--active {
  background: #1a1a00;
  border-color: #ff9900;
  color: #ffcc55;
  padding: 9px 12px;
  text-align: center;
  font-family: var(--font-pixel);
  font-size: 8px;
  letter-spacing: 1px;
}
.sheet-back {
  background: none;
  border: 2px solid var(--color-border-dark);
  color: var(--color-text-dim);
  padding: 0;
  cursor: pointer;
  width: 36px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sheet-back:hover { border-color: var(--color-border); color: var(--color-text); }

.core-section-label {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-text-dim);
  letter-spacing: 2px;
  padding: 4px 4px 6px;
  border-bottom: 1px solid var(--color-border-dark);
  margin-bottom: 8px;
}

.core-icon-card {
  width: 100%;
  min-height: 62px;
  background: var(--color-panel-dark);
  border: 2px solid var(--color-border-dark);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
  transition: border-color 0.15s, transform 0.1s;
}
.core-icon-card--attack { border-color: rgba(255, 106, 64, 0.4); }
.core-icon-card--support { border-color: rgba(68, 170, 255, 0.4); }
.core-icon-card--ultimate { border-color: rgba(255, 200, 0, 0.45); background: linear-gradient(180deg, rgba(255, 220, 120, 0.16), rgba(20, 14, 8, 0.96)); }
.core-icon-card--empty { border-style: dashed; border-color: #2f3850; background: rgba(12, 14, 22, 0.88); }
button.core-icon-card { cursor: pointer; }
button.core-icon-card:hover { border-color: var(--color-border); transform: translateY(-1px); }
.core-icon-card__name {
  font-family: var(--font-pixel);
  font-size: 7px;
  line-height: 1.3;
  letter-spacing: 0.2px;
  color: var(--color-text-dim);
  text-align: center;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.core-relation-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr) 24px minmax(0, 1fr);
  gap: 6px;
  align-items: center;
  margin-bottom: 10px;
}
.core-relation-head__cell {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  letter-spacing: 1px;
  text-align: center;
  padding: 6px 4px;
  border: 1px solid var(--color-border-dark);
  background: rgba(255, 255, 255, 0.03);
}
.core-relation-head__cell--attack { color: #ff8a66; }
.core-relation-head__cell--support { color: #7dbfff; }
.core-relation-head__cell--ultimate { color: #ffd25a; }
.core-relation-head__op,
.core-relation-op {
  font-family: var(--font-pixel);
  font-size: 12px;
  color: #8da5c7;
  text-align: center;
  min-height: 62px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.core-relation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.core-relation-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr) 24px minmax(0, 1fr);
  gap: 6px;
  align-items: stretch;
}

/* Card detail */
.core-detail-card { display: flex; flex-direction: column; gap: 16px; }
.core-detail-header { display: flex; align-items: center; gap: 14px; }
.core-detail-icon { display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.core-detail-meta { display: flex; flex-direction: column; gap: 6px; }
.core-detail-name {
  font-family: var(--font-pixel);
  font-size: 14px;
  color: var(--color-text);
  letter-spacing: 1px;
}
.core-detail-type {
  font-family: var(--font-pixel);
  font-size: 9px;
  letter-spacing: 1.5px;
  padding: 2px 8px;
  display: inline-block;
}
.type--attack  { color: #ff6644; background: rgba(255,80,40,0.12);  border: 1px solid rgba(255,80,40,0.3); }
.type--support { color: #44aaff; background: rgba(40,120,255,0.10); border: 1px solid rgba(40,120,255,0.3); }
.type--ultimate{ color: #ffd700; background: rgba(255,200,0,0.10);  border: 1px solid rgba(255,200,0,0.3); }

.core-detail-levels { display: flex; flex-direction: column; gap: 8px; }
.core-detail-level {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: var(--color-panel-dark);
  border: 2px solid var(--color-border-dark);
  padding: 8px 10px;
}
.core-detail-lv-badge {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #f1c40f;
  min-width: 24px;
  flex-shrink: 0;
  padding-top: 1px;
}
.core-detail-lv-desc {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-text-dim);
  line-height: 1.7;
}
.core-detail-req {
  background: rgba(255,200,0,0.05);
  border: 2px solid rgba(255,200,0,0.25);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.core-detail-req-label {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #f1c40f;
  letter-spacing: 1px;
  margin-bottom: 3px;
}
.core-detail-req-item {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-text-dim);
}

/* ─── Modal dialog (Coming Soon / Tour Prompt) ────────────────────────────── */
.modal-dialog {
  width: 300px;
  max-width: 90vw;
  background: var(--color-panel);
  border: 3px solid var(--color-border);
  box-shadow: 5px 5px 0 rgba(0,0,0,0.5);
  padding: 28px 24px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}
.modal-dialog__icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  filter: drop-shadow(0 0 8px rgba(0, 200, 255, 0.4));
}
.modal-dialog__title {
  font-family: var(--font-pixel);
  font-size: 14px;
  color: var(--color-accent);
  letter-spacing: 1px;
}
.modal-dialog__desc {
  font-family: 'Chakra Petch', sans-serif;
  font-size: 12px;
  color: var(--color-text-dim);
  line-height: 1.7;
}
.modal-dialog__actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

/* ─── Topbar LV + EXP ────────────────────────────────────────────────────── */
.topbar-lv {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  padding: 0 10px;
}
.topbar-lv__badge {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-accent);
  letter-spacing: 1px;
}
.topbar-lv__bar {
  width: 100%;
  height: 6px;
  background: var(--color-panel-dark);
  border: 1px solid var(--color-border-dark);
  overflow: hidden;
}
.topbar-lv__fill {
  height: 100%;
  background: linear-gradient(90deg, #27ae60, #2ecc71);
  transition: width 0.5s ease;
  box-shadow: 0 0 4px #2ecc71;
}
.topbar-lv__exp {
  width: 100%;
  text-align: left;
  font-family: var(--font-pixel);
  font-size: 8px;
  color: #66b8ff;
  letter-spacing: 0.5px;
}

@media (max-width: 380px) {
  .core-relation-head,
  .core-relation-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .core-relation-head__op,
  .core-relation-op {
    display: none;
  }
}

/* ─── Equipment Panel (Trang Bị) ─────────────────────────────────────────── */
.equip-panel {
  background: var(--color-panel);
  border: 2px solid var(--color-border);
  box-shadow: 4px 4px 0 var(--color-border-dark);
  padding: 10px 12px 12px;
}
.equip-panel__title {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-accent);
  letter-spacing: 2px;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--color-border-dark);
}
.equip-panel__body {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.equip-panel__ship {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: var(--color-panel-dark);
  border: 2px solid var(--color-border-dark);
  filter: drop-shadow(0 0 8px rgba(0, 200, 255, 0.3));
}
.equip-panel__right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* Durability bar */
.equip-dur__label {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  letter-spacing: 1px;
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.equip-dur__val { color: var(--color-text); }
.equip-dur__track {
  height: 10px;
  background: var(--color-panel-dark);
  border: 2px solid var(--color-border-dark);
  overflow: hidden;
}
.equip-dur__fill {
  height: 100%;
  background: linear-gradient(90deg, #27ae60, #2ecc71);
  transition: width 0.5s ease;
  box-shadow: 0 0 5px #2ecc71;
}
.equip-dur__fill.dur--mid {
  background: linear-gradient(90deg, #e67e22, #f39c12);
  box-shadow: 0 0 5px #f39c12;
}
.equip-dur__fill.dur--low {
  background: linear-gradient(90deg, #c0392b, #e74c3c);
  box-shadow: 0 0 5px #e74c3c;
}
.equip-dur__warn {
  font-family: var(--font-pixel);
  font-size: 7px;
  color: #e74c3c;
  margin-top: 3px;
  letter-spacing: 0.5px;
}
/* Artifact slots */
.equip-artifacts__label {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  letter-spacing: 1px;
  margin-bottom: 5px;
}
.equip-artifacts__slots { display: flex; flex-direction: column; gap: 5px; }
.equip-slot {
  display: flex;
  align-items: center;
  gap: 7px;
  background: var(--color-panel-dark);
  border: 2px dashed var(--color-border-dark);
  padding: 5px 8px;
  cursor: pointer;
  transition: border-color 0.15s;
  min-height: 28px;
}
.equip-slot:hover { border-color: var(--color-border); }
.equip-slot--filled { border-style: solid; border-color: rgba(100, 200, 255, 0.4); }
.equip-slot__icon { font-size: 16px; flex-shrink: 0; }
.equip-slot__name {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-accent);
  letter-spacing: 0.5px;
}
.equip-slot__empty {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-text-dim);
  letter-spacing: 0.5px;
}

/* ─── Artifact Panel ─────────────────────────────────────────────────────── */
.artifact-hint {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-text-dim);
  line-height: 1.7;
  margin-bottom: 12px;
  padding: 8px 10px;
  background: rgba(0, 200, 255, 0.05);
  border: 1px solid rgba(0, 200, 255, 0.15);
}
.artifact-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.artifact-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  background: var(--color-panel-dark);
  border: 2px solid var(--color-border-dark);
  padding: 10px 8px;
  transition: border-color 0.15s;
}
.artifact-card--owned { border-color: rgba(100, 200, 100, 0.4); }
.artifact-card__icon { font-size: 26px; flex-shrink: 0; }
.artifact-card__name {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-text);
  margin-bottom: 2px;
}
.artifact-card__desc {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  line-height: 1.6;
  flex: 1;
}
.artifact-card__cost {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #f1c40f;
}
.artifact-card__actions { display: flex; flex-direction: column; gap: 4px; width: 100%; margin-top: auto; }
.artifact-btn {
  font-family: var(--font-pixel);
  font-size: 9px;
  letter-spacing: 1px;
  padding: 5px 6px;
  border: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  text-transform: uppercase;
  width: 100%;
}
.artifact-btn--buy {
  background: #22330a;
  border-color: #44aa22;
  color: #88ff55;
}
.artifact-btn--buy:disabled {
  background: #1a1a1a;
  border-color: #444;
  color: #666;
  cursor: not-allowed;
}
.artifact-btn--equip {
  background: #0a1a33;
  border-color: #2255aa;
  color: #66aaff;
}
.artifact-btn--equip:disabled {
  background: #111;
  border-color: #333;
  color: #555;
  cursor: not-allowed;
}
.artifact-btn--unequip {
  background: #1a1a00;
  border-color: #777700;
  color: #cccc44;
}

/* ─── PC Scroll Fix ──────────────────────────────────────────────────────── */
.ships-scroll {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1;
  min-height: 0;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}
.topbar-missions {
  position: relative;
  background: none;
  border: 2px solid var(--color-border-dark);
  color: var(--color-text-dim);
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 2px;
  transition: border-color 0.15s, color 0.15s;
  flex-shrink: 0;
}
.topbar-missions:hover { border-color: var(--color-accent); color: var(--color-accent); }
.topbar-missions__badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #ff4444;
  color: #fff;
  font-family: var(--font-pixel);
  font-size: 7px;
  min-width: 15px;
  height: 15px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--color-bg);
  padding: 0 2px;
}

/* ─── Mission Panel ──────────────────────────────────────────────────────── */
.mission-item {
  background: var(--color-panel-dark);
  border: 2px solid var(--color-border-dark);
  padding: 10px 12px;
  margin-bottom: 8px;
  transition: border-color 0.15s;
}
.mission-item--done { border-color: rgba(100, 200, 100, 0.35); }
.mission-item__top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 6px;
}
.mission-item__desc {
  font-family: var(--font-pixel);
  font-size: 10px;
  color: var(--color-text);
  flex: 1;
  line-height: 1.7;
}
.mission-item__prog {
  font-family: var(--font-pixel);
  font-size: 10px;
  color: var(--color-accent);
  white-space: nowrap;
}
.mission-item__bar {
  height: 5px;
  background: var(--color-border-dark);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 6px;
}
.mission-item__fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}
.mission-item__reward {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-text-dim);
  margin-bottom: 6px;
}
.mission-reward-label { margin-right: 4px; }
.mission-claim-btn {
  font-family: var(--font-pixel);
  font-size: 9px;
  background: #1a3300;
  border: 2px solid #44aa22;
  color: #88ff55;
  padding: 5px 14px;
  cursor: pointer;
  letter-spacing: 1px;
  transition: background 0.15s;
}
.mission-claim-btn:hover { background: #224400; }
.mission-claimed {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: #44bb44;
}
/* ─── Milestone Timeline ────────────────────────────────────────────── */
.ms-timeline {
  background: var(--color-panel-dark);
  border: 2px solid var(--color-border-dark);
  padding: 12px 16px 14px;
  margin-bottom: 14px;
}
.ms-timeline__title {
  font-family: var(--font-pixel);
  font-size: 9px;
  color: var(--color-accent);
  letter-spacing: 2px;
  margin-bottom: 14px;
}
.ms-track {
  position: relative;
  height: 70px;
  overflow: visible;
}
.ms-track::before {
  content: '';
  position: absolute;
  top: 11px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-border);
  border-radius: 1px;
  z-index: 1;
  pointer-events: none;
}
.ms-track__fill {
  position: absolute;
  top: 11px;
  left: 0;
  height: 2px;
  background: #ffd700;
  border-radius: 1px;
  transition: width 0.4s ease;
  z-index: 1;
  max-width: 100%;
  pointer-events: none;
}
.ms-chest {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  width: 44px;
  position: absolute;
  top: 0;
  z-index: 10;
  cursor: default;
}
.ms-chest--claimable { cursor: pointer; animation: chest-pulse 1.4s ease-in-out infinite; }
.ms-chest__icon { color: var(--color-border); display: flex; }
.ms-chest--unlocked .ms-chest__icon { color: #ffd700; }
.ms-chest--claimed .ms-chest__icon { color: rgba(255, 215, 0, 0.35); }
.ms-chest__step {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 10px;
}
.ms-chest--claimable .ms-chest__step { color: #ffd700; }
.ms-chest--claimed .ms-chest__step { color: #26de81; }
.ms-chest__reward {
  font-family: var(--font-pixel);
  font-size: 7px;
  color: var(--color-text-dim);
  text-align: center;
  line-height: 1.4;
  white-space: nowrap;
}
.ms-progress-label {
  font-family: var(--font-pixel);
  font-size: 8px;
  color: var(--color-text-dim);
  text-align: right;
  margin-top: 10px;
}
@keyframes chest-pulse {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-3px) scale(1.1); }
}

/* ─── Admin modal ────────────────────────────────────────────────────────── */
.admin-overlay { align-items: center; }
.admin-input {
  font-family: var(--font-pixel);
  font-size: 14px;
  background: var(--color-panel-dark);
  border: 2px solid var(--color-accent);
  color: var(--color-text);
  padding: 10px 14px;
  width: 100%;
  text-align: center;
  letter-spacing: 4px;
  outline: none;
  box-sizing: border-box;
}

/* ─── Settings Panel ─────────────────────────────────────────────────────── */
.settings-section-label {
  font-family: var(--font-pixel);
  font-size: 8px;
  letter-spacing: 3px;
  color: var(--color-accent);
  margin-bottom: 6px;
  text-transform: uppercase;
}
.settings-desc {
  font-family: var(--font-pixel);
  font-size: 7.5px;
  color: var(--color-text-dim);
  line-height: 1.8;
  margin-bottom: 14px;
}
.settings-btn {
  display: block;
  width: 100%;
  font-family: var(--font-pixel);
  font-size: 8.5px;
  letter-spacing: 1.5px;
  padding: 11px 14px;
  border: 2px solid transparent;
  cursor: pointer;
  text-align: center;
  margin-bottom: 10px;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  text-transform: uppercase;
  text-decoration: none;
}
.settings-btn:active { transform: scale(0.98); }
.settings-btn--export {
  background: #001a33;
  border-color: #0088cc;
  color: #00cfff;
}
.settings-btn--export:hover { background: #00253d; border-color: #00cfff; }
.settings-btn--import {
  background: #001a0a;
  border-color: #00882b;
  color: #44ff88;
}
.settings-btn--import:hover { background: #002514; border-color: #44ff88; }
.settings-status {
  font-family: var(--font-pixel);
  font-size: 8px;
  padding: 8px 10px;
  text-align: center;
  border: 2px solid transparent;
  margin-top: 4px;
}
.settings-status--ok  { background: rgba(68, 255, 136, 0.1); border-color: #44ff88; color: #44ff88; }
.settings-status--err { background: rgba(255, 80,  80,  0.1); border-color: #ff5050; color: #ff5050; }

/* fade transition for status text */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
