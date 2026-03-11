import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ─── Achievement definitions ──────────────────────────────────────────────────
export interface AchievementDef {
  id: string
  name: string
  desc: string
}
export const ALL_ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_run',   name: '🚀 Phi Công Mới',      desc: 'Hoàn thành ván chơi đầu tiên' },
  { id: 'score_1k',    name: '🎯 Bắn Tốt',            desc: 'Đạt 1,000 điểm trong 1 ván' },
  { id: 'score_10k',   name: '⭐ Xạ Thủ Xuất Sắc',    desc: 'Đạt 10,000 điểm trong 1 ván' },
  { id: 'score_50k',   name: '👑 Huyền Thoại',         desc: 'Đạt 50,000 điểm trong 1 ván' },
  { id: 'survive_1m',  name: '⏱ Kiên Định',            desc: 'Sống sót 1 phút' },
  { id: 'survive_5m',  name: '💪 Bất Tử',              desc: 'Sống sót 5 phút' },
  { id: 'survive_10m', name: '🏆 Chiến Thần',           desc: 'Sống sót 10 phút liên tục' },
  { id: 'kill_boss',   name: '💥 Kẻ Diệt Trùm',        desc: 'Hạ gục boss Star Destroyer' },
  { id: 'level_10',    name: '⚡ Đỉnh Chiến',           desc: 'Đạt cấp 10 trong 1 ván' },
  { id: 'skill_use',   name: '🌊 Sóng Nhiệt',           desc: 'Sử dụng kỹ năng Sóng Tầm Nhiệt lần đầu' },
  { id: 'earn_1000g',  name: '🪙 Phú Hào',              desc: 'Tích lũy 1,000 vàng' },
  { id: 'earn_5000g',  name: '💰 Đại Phú',              desc: 'Tích lũy 5,000 vàng' },
]

// ─── Permanent upgrade definitions ───────────────────────────────────────────
export type PermUpgradeKey = 'baseDamage' | 'baseHp' | 'baseSpeed' | 'expBonus'
export interface PermUpgradeDef {
  key: PermUpgradeKey
  name: string
  desc: string
  costs: number[]
}
export const PERM_UPGRADE_DEFS: PermUpgradeDef[] = [
  { key: 'baseDamage', name: '💥 Sức Công Cơ Bản', desc: '+5 sát thương khởi đầu mỗi cấp',      costs: [100, 250, 500, 1000, 2000] },
  { key: 'baseHp',     name: '❤ Thể Trạng',        desc: '+25 HP tối đa khởi đầu mỗi cấp',      costs: [80,  200, 400,  800, 1600] },
  { key: 'baseSpeed',  name: '🚀 Tốc Hành',         desc: '+0.05 tốc bay khởi đầu mỗi cấp',      costs: [150, 400, 900] },
  { key: 'expBonus',   name: '🌀 Hấp Thu',          desc: '+10% kinh nghiệm nhận được mỗi cấp',  costs: [120, 300, 700] },
]

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

  // Tiến trình tài khoản (persistent, không reset giữa các ván)
  const accountLevel = ref(1)
  const accountExp = ref(0)

  // Phi cơ sở hữu
  const ownedShips = ref<string[]>(['star_keeper'])
  const selectedShip = ref('star_keeper')

  // Thành tựu
  const unlockedAchievements = ref<string[]>([])

  // Nâng cấp vĩnh viễn (mua bằng vàng, giữ giữa các ván)
  const permUpgrades = ref({
    baseDamage: 0,  // +5 damage/level
    baseHp:     0,  // +25 HP/level
    baseSpeed:  0,  // +0.05 speed/level
    expBonus:   0,  // +10% exp/level
  })

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

  // Theo dõi tiến trình stage hiện tại
  const stageEnemiesTotal = ref(0)   // tổng số kẻ địch trong wave này
  const stageEnemiesKilled = ref(0)  // số đã hạ
  const stageComplete = ref(false)   // GameCanvas set true khi xử lý xong

  const stageProgress = computed(() =>
    stageEnemiesTotal.value > 0
      ? Math.min(100, Math.round(stageEnemiesKilled.value / stageEnemiesTotal.value * 100))
      : 0
  )

  // Level-up UI
  const levelUpChoices = ref<UpgradeOption[]>([])
  const isLevelUpPending = ref(false)

  // Skill: Sóng tầm nhiệt huỷ diệt (Star Keeper)
  const skillCooldown = ref(0)          // giây còn lại (0 = sẵn sàng)
  const skillActivationPending = ref(false) // GameCanvas tiêu thụ flag này
  const isSkillReady = computed(() => skillCooldown.value <= 0)

  // Computed
  const expToNextLevel = computed(() => playerLevel.value * 100)
  const expPercent = computed(() =>
    Math.min(100, (playerExp.value / expToNextLevel.value) * 100)
  )
  const hpPercent = computed(() =>
    Math.min(100, (playerHp.value / playerMaxHp.value) * 100)
  )
  const accountExpToNextLevel = computed(() => accountLevel.value * 200)
  const accountExpPercent = computed(() =>
    Math.min(100, (accountExp.value / accountExpToNextLevel.value) * 100)
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
    if (playerCoins.value >= 5000) unlockAchievement('earn_5000g')
    else if (playerCoins.value >= 1000) unlockAchievement('earn_1000g')
    saveProgress()
  }

  // Thêm exp trong session (không lưu, dùng expOrb)
  function gainSessionExp(amount: number) {
    const multi = 1 + permUpgrades.value.expBonus * 0.1
    playerExp.value += Math.round(amount * multi)
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
    if (playerLevel.value >= 10) unlockAchievement('level_10')
    levelUpChoices.value = pickWeightedUpgrades(3)
    isLevelUpPending.value = true
    isPaused.value = true
  }

  // Caps chỉ số Star Keeper
  function capStarKeeperStats() {
    upgrades.value.damage = Math.min(100, upgrades.value.damage)
    upgrades.value.bulletSpeed = Math.min(1.5, upgrades.value.bulletSpeed)
    upgrades.value.bulletCount = Math.min(3, upgrades.value.bulletCount)
    upgrades.value.shipSpeed = Math.min(1.5, upgrades.value.shipSpeed)
    playerMaxHp.value = Math.min(300, playerMaxHp.value)
    playerHp.value = Math.min(playerMaxHp.value, playerHp.value)
  }

  function chooseLevelUpOption(option: UpgradeOption) {
    option.apply(useGameStore())
    capStarKeeperStats()
    isLevelUpPending.value = false
    isPaused.value = false
    saveProgress()
  }

  // ─── Account / Achievement / PermUpgrade helpers ─────────────────────
  function addAccountExp(amount: number) {
    accountExp.value += amount
    while (accountExp.value >= accountExpToNextLevel.value) {
      accountExp.value -= accountExpToNextLevel.value
      accountLevel.value++
    }
  }

  function unlockAchievement(id: string) {
    if (!unlockedAchievements.value.includes(id)) {
      unlockedAchievements.value.push(id)
    }
  }

  function buyPermUpgrade(key: PermUpgradeKey): boolean {
    const def = PERM_UPGRADE_DEFS.find(d => d.key === key)
    if (!def) return false
    const level = permUpgrades.value[key]
    if (level >= def.costs.length) return false
    const cost = def.costs[level]
    if (playerCoins.value < cost) return false
    playerCoins.value -= cost
    permUpgrades.value[key]++
    saveProgress()
    return true
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
    goldEarnedThisRun.value = Math.floor(currentStage.value * 5) + Math.floor(currentScore.value / 100)
    playerCoins.value += goldEarnedThisRun.value

    // Cộng account exp sau mỗi ván
    const earnedAccountExp = currentStage.value * 10 + Math.floor(currentScore.value / 50)
    addAccountExp(earnedAccountExp)

    // Kiểm tra thành tựu cuối ván
    unlockAchievement('first_run')
    if (currentScore.value >= 1000)  unlockAchievement('score_1k')
    if (currentScore.value >= 10000) unlockAchievement('score_10k')
    if (currentScore.value >= 50000) unlockAchievement('score_50k')
    if (currentStage.value >= 5)  unlockAchievement('survive_1m')
    if (currentStage.value >= 15) unlockAchievement('survive_5m')
    if (currentStage.value >= 30) unlockAchievement('survive_10m')
    if (playerCoins.value >= 1000) unlockAchievement('earn_1000g')
    if (playerCoins.value >= 5000) unlockAchievement('earn_5000g')

    isPlaying.value = false
    saveProgress()
  }

  // Skill actions
  function activateSkill() {
    if (skillCooldown.value > 0) return
    unlockAchievement('skill_use')
    skillActivationPending.value = true
    skillCooldown.value = 30
  }

  function tickSkillCooldown(deltaSeconds: number) {
    if (skillCooldown.value > 0) {
      skillCooldown.value = Math.max(0, skillCooldown.value - deltaSeconds)
    }
  }

  function consumeSkillActivation(): boolean {
    if (skillActivationPending.value) {
      skillActivationPending.value = false
      return true
    }
    return false
  }

  function startGame() {
    // Reset toàn bộ tiến trình session — mỗi lần chơi mới bắt đầu từ đầu
    currentScore.value = 0
    lives.value = 3
    currentStage.value = 1
    stageEnemiesTotal.value = 0
    stageEnemiesKilled.value = 0
    stageComplete.value = false
    playerLevel.value = 1
    playerExp.value = 0
    // Áp dụng nâng cấp vĩnh viễn vào chỉ số bắt đầu
    playerMaxHp.value = Math.min(300, 100 + permUpgrades.value.baseHp * 25)
    playerHp.value = playerMaxHp.value
    upgrades.value = {
      bulletSpeed: 1,
      bulletCount: 1,
      shipSpeed: Math.min(1.5, 1 + permUpgrades.value.baseSpeed * 0.05),
      shield: 0,
      bombCount: 0,
      damage: Math.min(100, 10 + permUpgrades.value.baseDamage * 5),
      collectRange: 40,
      hpRegen: 0,
    }
    levelUpChoices.value = []
    isLevelUpPending.value = false
    goldEarnedThisRun.value = 0
    isGameOverSequence.value = false
    skillCooldown.value = 0
    skillActivationPending.value = false
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
      // Account progression
      accountLevel: accountLevel.value,
      accountExp: accountExp.value,
      // Ships
      ownedShips: ownedShips.value,
      selectedShip: selectedShip.value,
      // Achievements
      unlockedAchievements: unlockedAchievements.value,
      // Permanent upgrades
      permUpgrades: permUpgrades.value,
    }
    localStorage.setItem('ban-may-bay-save', JSON.stringify(data))
  }

  function loadProgress() {
    const saved = localStorage.getItem('ban-may-bay-save')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        playerCoins.value             = data.playerCoins ?? 0
        playerRuby.value              = data.playerRuby ?? 0
        highScore.value               = data.highScore ?? 0
        username.value                = data.username ?? 'Phi Công'
        avatarId.value                = data.avatarId ?? 0
        shipName.value                = data.shipName ?? 'Chiến Cơ Alpha'
        accountLevel.value            = data.accountLevel ?? 1
        accountExp.value              = data.accountExp ?? 0
        ownedShips.value              = data.ownedShips ?? ['star_keeper']
        selectedShip.value            = data.selectedShip ?? 'star_keeper'
        unlockedAchievements.value    = data.unlockedAchievements ?? []
        if (data.permUpgrades) {
          permUpgrades.value = {
            baseDamage: data.permUpgrades.baseDamage ?? 0,
            baseHp:     data.permUpgrades.baseHp     ?? 0,
            baseSpeed:  data.permUpgrades.baseSpeed  ?? 0,
            expBonus:   data.permUpgrades.expBonus   ?? 0,
          }
        }
      } catch {
        // dữ liệu lưu bị hỏng, giữ mặc định
      }
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
    stageEnemiesTotal,
    stageEnemiesKilled,
    stageComplete,
    stageProgress,
    levelUpChoices,
    isLevelUpPending,
    expToNextLevel,
    expPercent,
    hpPercent,
    username,
    avatarId,
    shipName,
    // Account
    accountLevel,
    accountExp,
    accountExpToNextLevel,
    accountExpPercent,
    // Ships
    ownedShips,
    selectedShip,
    // Achievements
    unlockedAchievements,
    // Permanent upgrades
    permUpgrades,
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
    unlockAchievement,
    buyPermUpgrade,
    skillCooldown,
    skillActivationPending,
    isSkillReady,
    activateSkill,
    tickSkillCooldown,
    consumeSkillActivation,
  }
})
