import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ─── Upgrade definitions ──────────────────────────────────────────────────────
export type UpgradeRarity = 'white' | 'blue' | 'purple' | 'gold'
export interface UpgradeOption {
  id: string
  name: string
  desc: string
  rarity: UpgradeRarity
  apply: (store: ReturnType<typeof useGameStore>) => void
}

export const useGameStore = defineStore('game', () => {
  // Tiến độ người chơi
  const playerLevel = ref(1)
  const playerExp = ref(0)
  const playerCoins = ref(0)   // vàng (gold)
  const playerRuby = ref(0)    // ruby (tiền tệ quý hiếm)
  const goldEarnedThisRun = ref(0) // vàng kiếm được trong ván này
  const highScore = ref(0)
  const currentScore = ref(0)
  const playerHp = ref(100)
  const playerMaxHp = ref(100)

  // Hồ sơ người chơi
  const username = ref('Phi Công')
  const avatarId = ref(0)
  const shipName = ref('Chiến Cơ Alpha')

  // Nâng cấp dạng stat
  const upgrades = ref({
    bulletSpeed: 1,
    bulletCount: 1,
    shipSpeed: 1,
    shield: 0,
    bombCount: 0,
    damage: 10,
    collectRange: 40,
    hpRegen: 0,
  })

  // Trạng thái game
  const isPlaying = ref(false)
  const isPaused = ref(false)
  const isGameOverSequence = ref(false) // đang phát hiệu ứng nổ khi chết
  const currentStage = ref(1)
  const lives = ref(3)
  const survivalSeconds = ref(0)

  const survivalTimeFormatted = computed(() => {
    const s = Math.floor(survivalSeconds.value)
    const mm = Math.floor(s / 60).toString().padStart(2, '0')
    const ss = (s % 60).toString().padStart(2, '0')
    return `${mm}:${ss}`
  })

  // Level-up UI
  const levelUpChoices = ref<UpgradeOption[]>([])
  const isLevelUpPending = ref(false)

  // Computed
  const expToNextLevel = computed(() => playerLevel.value * 100)
  const expPercent = computed(() =>
    Math.min(100, (playerExp.value / expToNextLevel.value) * 100)
  )
  const hpPercent = computed(() =>
    Math.min(100, (playerHp.value / playerMaxHp.value) * 100)
  )

  // Actions
  function addScore(points: number) {
    currentScore.value += points
    if (currentScore.value > highScore.value) {
      highScore.value = currentScore.value
      saveProgress()
    }
  }

  function addCoins(amount: number) {
    playerCoins.value += amount
    saveProgress()
  }

  // Thêm exp trong session (không lưu, dùng expOrb)
  function gainSessionExp(amount: number) {
    playerExp.value += amount
    if (playerExp.value >= expToNextLevel.value) {
      playerExp.value -= expToNextLevel.value
      playerLevel.value++
      triggerLevelUp()
    }
  }

  function addExp(amount: number) {
    gainSessionExp(amount)
    saveProgress()
  }

  // All possible upgrades pool
  function buildUpgradePool(): UpgradeOption[] {
    return [
      { id: 'bulletSpeed_w', name: '⚡ Đạn nhanh', desc: 'Tốc độ đạn +20%', rarity: 'white', apply: s => { s.upgrades.bulletSpeed += 0.2 } },
      { id: 'shipSpeed_w', name: '🚀 Máy bay nhanh', desc: 'Tốc độ tàu +15%', rarity: 'white', apply: s => { s.upgrades.shipSpeed += 0.15 } },
      { id: 'hp_w', name: '❤ Máu +20', desc: 'Tăng HP tối đa lên 20', rarity: 'white', apply: s => { s.playerMaxHp += 20; s.playerHp = Math.min(s.playerHp + 20, s.playerMaxHp) } },
      { id: 'bulletCount_b', name: '🔫 Đa đạn', desc: 'Bắn thêm 1 viên đạn', rarity: 'blue', apply: s => { s.upgrades.bulletCount++ } },
      { id: 'damage_b', name: '💥 Sức mạnh', desc: 'Sát thương +15', rarity: 'blue', apply: s => { s.upgrades.damage += 15 } },
      { id: 'collectRange_b', name: '🌀 Hút kinh nghiệm', desc: 'Phạm vi thu kinh nghiệm +30', rarity: 'blue', apply: s => { s.upgrades.collectRange += 30 } },
      { id: 'hpRegen_p', name: '💊 Tái sinh', desc: 'Hồi 2 HP/s', rarity: 'purple', apply: s => { s.upgrades.hpRegen += 2 } },
      { id: 'trishot_p', name: '💠 Tam xạ', desc: 'Đạn +2, tốc đạn +10%', rarity: 'purple', apply: s => { s.upgrades.bulletCount += 2; s.upgrades.bulletSpeed += 0.1 } },
      { id: 'damage_p', name: '🔥 Đại phá', desc: 'Sát thương +40, đạn nhanh +15%', rarity: 'purple', apply: s => { s.upgrades.damage += 40; s.upgrades.bulletSpeed += 0.15 } },
      { id: 'godship_g', name: '⭐ Thần tốc', desc: 'Tất cả chỉ số +25%', rarity: 'gold', apply: s => { s.upgrades.bulletSpeed += 0.25; s.upgrades.shipSpeed += 0.25; s.upgrades.damage += 25; s.upgrades.collectRange += 25 } },
      { id: 'fullheal_g', name: '✨ Phục hồi', desc: 'Hồi đầy HP + thêm 50 HP tối đa', rarity: 'gold', apply: s => { s.playerMaxHp += 50; s.playerHp = s.playerMaxHp } },
    ]
  }

  function getRarityWeight(rarity: UpgradeRarity): number {
    const lvl = playerLevel.value
    if (rarity === 'white') return Math.max(20, 70 - lvl * 2)
    if (rarity === 'blue') return Math.min(30, 12 + lvl * 1.5)
    if (rarity === 'purple') return Math.min(8, lvl * 0.4)
    if (rarity === 'gold') return Math.min(3, lvl * 0.15)
    return 1
  }

  function pickWeightedUpgrades(count: number): UpgradeOption[] {
    const pool = buildUpgradePool()
    const result: UpgradeOption[] = []
    const remaining = [...pool]
    for (let i = 0; i < count && remaining.length > 0; i++) {
      const totalW = remaining.reduce((s, u) => s + getRarityWeight(u.rarity), 0)
      let r = Math.random() * totalW
      for (let j = 0; j < remaining.length; j++) {
        r -= getRarityWeight(remaining[j]!.rarity)
        if (r <= 0) {
          result.push(remaining[j]!)
          remaining.splice(j, 1)
          break
        }
      }
    }
    return result
  }

  function triggerLevelUp() {
    levelUpChoices.value = pickWeightedUpgrades(3)
    isLevelUpPending.value = true
    isPaused.value = true
  }

  function chooseLevelUpOption(option: UpgradeOption) {
    option.apply(useGameStore())
    isLevelUpPending.value = false
    isPaused.value = false
    saveProgress()
  }

  function takeDamage(amount: number) {
    if (isGameOverSequence.value) return
    playerHp.value = Math.max(0, playerHp.value - amount)
    if (playerHp.value <= 0) {
      playerHp.value = 0
      isGameOverSequence.value = true
      // GameCanvas sẽ gọi finalizeGameOver() sau 2 giây khi hiệu ứng xong
    }
  }

  function finalizeGameOver() {
    isGameOverSequence.value = false
    goldEarnedThisRun.value = Math.floor(survivalSeconds.value / 10) + Math.floor(currentScore.value / 100)
    playerCoins.value += goldEarnedThisRun.value
    isPlaying.value = false
    saveProgress()
  }

  function startGame() {
    // Reset toàn bộ tiến trình session — mỗi lần chơi mới bắt đầu từ đầu
    currentScore.value = 0
    lives.value = 3
    currentStage.value = 1
    survivalSeconds.value = 0
    playerLevel.value = 1
    playerExp.value = 0
    playerMaxHp.value = 100
    playerHp.value = 100
    upgrades.value = {
      bulletSpeed: 1,
      bulletCount: 1,
      shipSpeed: 1,
      shield: 0,
      bombCount: 0,
      damage: 10,
      collectRange: 40,
      hpRegen: 0,
    }
    levelUpChoices.value = []
    isLevelUpPending.value = false
    goldEarnedThisRun.value = 0
    isGameOverSequence.value = false
    isPlaying.value = true
    isPaused.value = false
  }

  function endGame() {
    // Thoát thủ công (không tính gold cho manual exit)
    isGameOverSequence.value = false
    isPlaying.value = false
    saveProgress()
  }

  function pauseGame() {
    if (!isLevelUpPending.value) {
      isPaused.value = !isPaused.value
    }
  }

  function loseLife() {
    lives.value--
    if (lives.value <= 0) {
      endGame()
    }
  }

  function upgradeShip(stat: keyof typeof upgrades.value) {
    upgrades.value[stat]++
    saveProgress()
  }

  function saveProgress() {
    const data = {
      playerCoins: playerCoins.value,
      playerRuby: playerRuby.value,
      highScore: highScore.value,
      username: username.value,
      avatarId: avatarId.value,
      shipName: shipName.value,
    }
    localStorage.setItem('ban-may-bay-save', JSON.stringify(data))
  }

  function loadProgress() {
    const saved = localStorage.getItem('ban-may-bay-save')
    if (saved) {
      const data = JSON.parse(saved)
      playerCoins.value = data.playerCoins ?? 0
      playerRuby.value = data.playerRuby ?? 0
      highScore.value = data.highScore ?? 0
      username.value = data.username ?? 'Phi Công'
      avatarId.value = data.avatarId ?? 0
      shipName.value = data.shipName ?? 'Chiến Cơ Alpha'
    }
  }

  return {
    playerLevel,
    playerExp,
    playerCoins,
    playerRuby,
    goldEarnedThisRun,
    playerHp,
    playerMaxHp,
    highScore,
    currentScore,
    upgrades,
    isPlaying,
    isPaused,
    isGameOverSequence,
    currentStage,
    lives,
    survivalSeconds,
    survivalTimeFormatted,
    levelUpChoices,
    isLevelUpPending,
    expToNextLevel,
    expPercent,
    hpPercent,
    username,
    avatarId,
    shipName,
    addScore,
    addCoins,
    addExp,
    gainSessionExp,
    startGame,
    endGame,
    finalizeGameOver,
    pauseGame,
    loseLife,
    takeDamage,
    upgradeShip,
    triggerLevelUp,
    chooseLevelUpOption,
    saveProgress,
    loadProgress,
  }
})
