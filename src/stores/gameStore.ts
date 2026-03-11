import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// ─── Card System ──────────────────────────────────────────────────────────────
export type CardType = 'attack' | 'support' | 'ultimate'

export interface CardLevelDef {
  desc: string
}

export interface CardDef {
  id: string
  name: string
  type: CardType
  icon: string
  maxLevel: number
  levels: CardLevelDef[]         // index 0 = lv1 desc, etc.
  requiresAttackId?: string      // ultimate: required attack card (must be max level)
  requiresSupportId?: string     // ultimate: required support card (any level)
}

export interface CardStats {
  missileLaunchers: number
  missileSpeedMult: number
  missileDamageMult: number
  missileAOE: boolean
  missileIntervalFrames: number
  interstellarMissile: boolean
  cdReductionPct: number
  shieldCooldownSec: number
  shieldLives: number
  shieldHealOnBreak: number
  expRangeBonus: number
  vampireHitHeal: number
  vampireKillHeal: number
  plasmaBolt: boolean
  plasmaBoltDmgMult: number
  plasmaBoltIntervalFrames: number
  plasmaBoltCount: number
  clusterBomb: boolean
  clusterBombDmgMult: number
  clusterBombIntervalFrames: number
  clusterBombDouble: boolean
  laserSweep: boolean
  laserSweepDmgMult: number
  laserSweepIntervalFrames: number
  laserSweepDouble: boolean
  // Kho Vũ Khí (Arsenal)
  arsenalBulletBonus: number
  arsenalFireRatePct: number
  arsenalDamagePct: number
  bulletPierceOnKill: boolean
  // Tân Tiến Sức Mạnh
  damageBonusPct: number
  // Tia Hủy Diệt (ultimate)
  plasmaClearsBullets: boolean
  // Từ Trường Tĩnh Điện (ultimate)
  staticField: boolean
  staticFieldRadius: number
  staticFieldDmgPerTick: number
}

export const ALL_CARD_DEFS: CardDef[] = [
  // ── Tấn công ────────────────────────────────────────────────────────────────
  {
    id: 'heat_missile', name: 'Tên Lửa Tầm Nhiệt', type: 'attack', icon: '🚀', maxLevel: 5,
    levels: [
      { desc: 'Triệu hồi 1 bệ phóng bám theo phi cơ, mỗi 5s bắn 1 tên lửa tầm nhiệt.' },
      { desc: 'Tên lửa bay nhanh +30%, sát thương +20%.' },
      { desc: 'Thêm 1 bệ phóng tên lửa (tổng 2 bệ).' },
      { desc: 'Sát thương tên lửa +30%.' },
      { desc: 'Tên lửa nổ AOE, gây sát thương diện rộng.' },
    ],
  },
  {
    id: 'plasma_bolt', name: 'Tia Plasma', type: 'attack', icon: '⚡', maxLevel: 5,
    levels: [
      { desc: 'Mỗi 6s phóng 1 tia plasma xuyên thấu, gây 80 sát thương.' },
      { desc: 'Sát thương +25%.' },
      { desc: 'Tia plasma làm chậm kẻ địch trúng đòn.' },
      { desc: 'Sát thương +30%.' },
      { desc: 'Bắn 2 tia plasma song song.' },
    ],
  },
  {
    id: 'cluster_bomb', name: 'Bom Cụm', type: 'attack', icon: '💣', maxLevel: 5,
    levels: [
      { desc: 'Mỗi 8s thả 1 bom cụm, nổ gây 70 sát thương diện rộng.' },
      { desc: 'Phạm vi nổ +30%, sát thương +20%.' },
      { desc: 'Bom nổ ra 4 mảnh nhỏ tiếp tục gây sát thương.' },
      { desc: 'Sát thương +35%.' },
      { desc: 'Thả 2 bom liên tiếp.' },
    ],
  },
  {
    id: 'laser_sweep', name: 'Quét Laser', type: 'attack', icon: '🔴', maxLevel: 5,
    levels: [
      { desc: 'Mỗi 7s quét tia laser ngang, gây 50 sát thương mọi kẻ địch trong vùng.' },
      { desc: 'Sát thương +25%.' },
      { desc: 'Laser quét 2 lần liên tiếp.' },
      { desc: 'Sát thương +30%.' },
      { desc: 'Laser vùng rộng, quét toàn màn hình.' },
    ],
  },
  {
    id: 'weapon_cache_star', name: 'Kho Vũ Khí - Star Keeper', type: 'attack', icon: '🔫', maxLevel: 5,
    levels: [
      { desc: '+1 đạn bắn ra và tăng 20% tốc độ bắn.' },
      { desc: '+25% sát thương đạn.' },
      { desc: '+1 đạn bắn ra (tổng +2 đạn).' },
      { desc: '+25% tốc độ bắn và +20% sát thương (cộng dồn).' },
      { desc: '+50% sát thương đạn (cộng dồn).' },
    ],
  },
  // ── Hỗ trợ ──────────────────────────────────────────────────────────────────
  {
    id: 'skill_recovery', name: 'Phục Hồi Kỹ Năng', type: 'support', icon: '🔄', maxLevel: 5,
    levels: [
      { desc: 'Giảm 5% thời gian hồi chiêu kỹ năng.' },
      { desc: 'Giảm thêm 5% (tổng -10%) thời gian hồi chiêu.' },
      { desc: 'Giảm thêm 5% (tổng -15%) thời gian hồi chiêu.' },
      { desc: 'Giảm thêm 5% (tổng -20%) thời gian hồi chiêu.' },
      { desc: 'Giảm thêm 5% (tổng -25%) thời gian hồi chiêu.' },
    ],
  },
  {
    id: 'energy_shield', name: 'Lá Chắn Năng Lượng', type: 'support', icon: '🛡️', maxLevel: 5,
    levels: [
      { desc: 'Mỗi 25s tự động tạo lá chắn hấp thụ 1 đòn tấn công.' },
      { desc: 'Thời gian hồi lá chắn giảm còn 20s.' },
      { desc: 'Khi lá chắn vỡ, hồi 50 HP.' },
      { desc: 'Thời gian hồi lá chắn giảm còn 15s.' },
      { desc: 'Lá chắn hấp thụ 2 đòn tấn công.' },
    ],
  },
  {
    id: 'exp_magnet', name: 'Nam Châm EXP', type: 'support', icon: '🧲', maxLevel: 5,
    levels: [
      { desc: 'Phạm vi thu thập kinh nghiệm +40.' },
      { desc: 'Phạm vi thu thập kinh nghiệm +40 (tổng +80).' },
      { desc: 'Phạm vi thu thập kinh nghiệm +40 (tổng +120).' },
      { desc: 'Phạm vi thu thập kinh nghiệm +40 (tổng +160).' },
      { desc: 'Phạm vi thu thập kinh nghiệm +40 (tổng +200). Hút tự động từ xa.' },
    ],
  },
  {
    id: 'hp_vampire', name: 'Hút Máu', type: 'support', icon: '🩸', maxLevel: 5,
    levels: [
      { desc: 'Đánh trúng kẻ địch hồi 1 HP.' },
      { desc: 'Đánh trúng kẻ địch hồi 2 HP.' },
      { desc: 'Tiêu diệt kẻ địch bổ sung hồi +5 HP.' },
      { desc: 'Đánh trúng kẻ địch hồi 3 HP.' },
      { desc: 'Tiêu diệt kẻ địch bổ sung hồi +10 HP.' },
    ],
  },
  // ── Tối thượng ──────────────────────────────────────────────────────────────
  {
    id: 'weapon_cache_star_ult', name: 'Đạn Xuyên Phá', type: 'ultimate', icon: '🔮', maxLevel: 1,
    requiresAttackId: 'weapon_cache_star',
    levels: [
      { desc: 'Đạn xuyên qua kẻ địch khi tiêu diệt, tiếp tục tấn công mục tiêu phía sau. (Yêu cầu: Kho Vũ Khí - Star Keeper Lv5)' },
    ],
  },
  {
    id: 'interstellar_missile', name: 'Tên Lửa Liên Sao', type: 'ultimate', icon: '🌠', maxLevel: 1,
    requiresAttackId: 'heat_missile',
    requiresSupportId: 'skill_recovery',
    levels: [
      { desc: 'Tên lửa nhỏ bắn mỗi 0.5s, luôn bám sát và trúng mục tiêu. (Yêu cầu: Tên Lửa Tầm Nhiệt Lv5 + Phục Hồi Kỹ Năng)' },
    ],
  },
  // ── Hỗ trợ (mới) ────────────────────────────────────────────────────────────
  {
    id: 'power_advance', name: 'Tân Tiến Sức Mạnh', type: 'support', icon: '💪', maxLevel: 5,
    levels: [
      { desc: '+10% sát thương gây ra.' },
      { desc: '+10% sát thương gây ra (tổng +20%).' },
      { desc: '+10% sát thương gây ra (tổng +30%).' },
      { desc: '+10% sát thương gây ra (tổng +40%).' },
      { desc: '+10% sát thương gây ra (tổng +50%).' },
    ],
  },
  // ── Tối thượng (mới) ─────────────────────────────────────────────────────────
  {
    id: 'devastation_ray', name: 'Tia Hủy Diệt', type: 'ultimate', icon: '🔱', maxLevel: 1,
    requiresAttackId: 'plasma_bolt',
    requiresSupportId: 'energy_shield',
    levels: [
      { desc: 'Tia plasma tiêu diệt tất cả đạn kẻ địch trên đường đi. (Yêu cầu: Tia Plasma Lv5 + Lá Chắn Năng Lượng)' },
    ],
  },
  {
    id: 'static_field_ult', name: 'Từ Trường Tĩnh Điện', type: 'ultimate', icon: '🌀', maxLevel: 1,
    requiresAttackId: 'laser_sweep',
    requiresSupportId: 'exp_magnet',
    levels: [
      { desc: 'Thay thế quét laser bằng vùng tĩnh điện bao quanh phi cơ, gây sát thương mỗi 0.5s cho kẻ địch bên trong. (Yêu cầu: Quét Laser Lv5 + Nam Châm EXP)' },
    ],
  },
]

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
export type PermUpgradeKey = 'baseDamage' | 'baseHp' | 'baseSpeed' | 'expBonus' | 'bulletCount' | 'fireRate'
export interface PermUpgradeDef {
  key: PermUpgradeKey
  name: string
  desc: string
  costs: number[]
}
export const PERM_UPGRADE_DEFS: PermUpgradeDef[] = [
  { key: 'baseDamage',  name: '💥 Sức Công Cơ Bản', desc: '+5 sát thương khởi đầu mỗi cấp',      costs: [100, 250, 500, 1000, 2000] },
  { key: 'baseHp',      name: '❤ Thể Trạng',        desc: '+25 HP tối đa khởi đầu mỗi cấp',      costs: [80,  200, 400,  800, 1600] },
  { key: 'baseSpeed',   name: '🚀 Tốc Hành',         desc: '+0.05 tốc bay khởi đầu mỗi cấp',      costs: [150, 400, 900] },
  { key: 'expBonus',    name: '🌀 Hấp Thu',          desc: '+10% kinh nghiệm nhận được mỗi cấp',  costs: [120, 300, 700] },
  { key: 'bulletCount', name: '🔫 Hỏa Lực',          desc: '+1 viên đạn cùng lúc mỗi cấp',        costs: [200, 600, 1500] },
  { key: 'fireRate',    name: '⚡ Tốc Xạ',           desc: '+15% tốc độ bắn mỗi cấp',             costs: [150, 400, 900] },
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
    baseDamage:  0,  // +5 damage/level
    baseHp:      0,  // +25 HP/level
    baseSpeed:   0,  // +0.05 speed/level
    expBonus:    0,  // +10% exp/level
    bulletCount: 0,  // +1 extra bullet/level
    fireRate:    0,  // +15% fire rate/level
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

  // Level-up UI (card system)
  const levelUpCardChoices = ref<CardDef[]>([])
  const isLevelUpPending = ref(false)

  // Card system state
  const activeCards = ref<Record<string, number>>({})   // cardId → level (1‑5)
  const shieldActive = ref(false)
  const shieldLivesLeft = ref(0)
  const shieldCooldownLeft = ref(0)

  // Derived card stats (read by GameCanvas each frame)
  const cardStats = computed((): CardStats => {
    const stats: CardStats = {
      missileLaunchers: 0,
      missileSpeedMult: 1,
      missileDamageMult: 1,
      missileAOE: false,
      missileIntervalFrames: 300,
      interstellarMissile: false,
      cdReductionPct: 0,
      shieldCooldownSec: 0,
      shieldLives: 0,
      shieldHealOnBreak: 0,
      expRangeBonus: 0,
      vampireHitHeal: 0,
      vampireKillHeal: 0,
      plasmaBolt: false,
      plasmaBoltDmgMult: 1,
      plasmaBoltIntervalFrames: 360,
      plasmaBoltCount: 1,
      clusterBomb: false,
      clusterBombDmgMult: 1,
      clusterBombIntervalFrames: 480,
      clusterBombDouble: false,
      laserSweep: false,
      laserSweepDmgMult: 1,
      laserSweepIntervalFrames: 420,
      laserSweepDouble: false,
      arsenalBulletBonus: 0,
      arsenalFireRatePct: 0,
      arsenalDamagePct: 0,
      bulletPierceOnKill: false,
      damageBonusPct: 0,
      plasmaClearsBullets: false,
      staticField: false,
      staticFieldRadius: 0,
      staticFieldDmgPerTick: 0,
    }
    const c = activeCards.value

    // heat_missile
    const hmLv = c['heat_missile'] ?? 0
    if (hmLv >= 1) stats.missileLaunchers = 1
    if (hmLv >= 2) { stats.missileSpeedMult = 1.3; stats.missileDamageMult = 1.2 }
    if (hmLv >= 3) stats.missileLaunchers = 2
    if (hmLv >= 4) stats.missileDamageMult = 1.56   // 1.2 × 1.3
    if (hmLv >= 5) stats.missileAOE = true

    // plasma_bolt
    const pbLv = c['plasma_bolt'] ?? 0
    if (pbLv >= 1) stats.plasmaBolt = true
    if (pbLv >= 2) stats.plasmaBoltDmgMult = 1.25
    if (pbLv >= 4) stats.plasmaBoltDmgMult = 1.625  // 1.25 × 1.3
    if (pbLv >= 5) stats.plasmaBoltCount = 2

    // cluster_bomb
    const cbLv = c['cluster_bomb'] ?? 0
    if (cbLv >= 1) stats.clusterBomb = true
    if (cbLv >= 2) stats.clusterBombDmgMult = 1.2
    if (cbLv >= 4) stats.clusterBombDmgMult = 1.62  // 1.2 × 1.35
    if (cbLv >= 5) stats.clusterBombDouble = true

    // laser_sweep
    const lsLv = c['laser_sweep'] ?? 0
    if (lsLv >= 1) stats.laserSweep = true
    if (lsLv >= 2) stats.laserSweepDmgMult = 1.25
    if (lsLv >= 3) stats.laserSweepDouble = true
    if (lsLv >= 4) stats.laserSweepDmgMult = 1.625

    // skill_recovery
    stats.cdReductionPct = (c['skill_recovery'] ?? 0) * 0.05

    // energy_shield
    const esLv = c['energy_shield'] ?? 0
    if (esLv >= 1) { stats.shieldCooldownSec = 25; stats.shieldLives = 1 }
    if (esLv >= 2) stats.shieldCooldownSec = 20
    if (esLv >= 3) stats.shieldHealOnBreak = 50
    if (esLv >= 4) stats.shieldCooldownSec = 15
    if (esLv >= 5) stats.shieldLives = 2

    // exp_magnet
    stats.expRangeBonus = (c['exp_magnet'] ?? 0) * 40

    // hp_vampire
    const hvLv = c['hp_vampire'] ?? 0
    if (hvLv >= 1) stats.vampireHitHeal = 1
    if (hvLv >= 2) stats.vampireHitHeal = 2
    if (hvLv >= 3) stats.vampireKillHeal = 5
    if (hvLv >= 4) stats.vampireHitHeal = 3
    if (hvLv >= 5) stats.vampireKillHeal = 10

    // weapon_cache_star (Kho Vũ Khí - Star Keeper)
    const ac = c['weapon_cache_star'] ?? 0
    if (ac >= 1) { stats.arsenalBulletBonus = 1; stats.arsenalFireRatePct = 20 }
    if (ac >= 2) stats.arsenalDamagePct = 25
    if (ac >= 3) stats.arsenalBulletBonus = 2
    if (ac >= 4) { stats.arsenalFireRatePct = 45; stats.arsenalDamagePct = 45 }
    if (ac >= 5) stats.arsenalDamagePct = 95
    if ((c['weapon_cache_star_ult'] ?? 0) >= 1) stats.bulletPierceOnKill = true

    // interstellar_missile (ultimate)
    if ((c['interstellar_missile'] ?? 0) >= 1) {
      stats.interstellarMissile = true
      if (stats.missileLaunchers === 0) stats.missileLaunchers = 1
      stats.missileIntervalFrames = 30   // 0.5 s at 60 fps
      stats.missileAOE = false
    }

    // power_advance (support)
    stats.damageBonusPct = (c['power_advance'] ?? 0) * 10

    // devastation_ray (ultimate)
    if ((c['devastation_ray'] ?? 0) >= 1) stats.plasmaClearsBullets = true

    // static_field_ult (ultimate) — replaces laser sweep with an AOE field
    if ((c['static_field_ult'] ?? 0) >= 1) {
      stats.staticField = true
      stats.laserSweep = false   // no more horizontal sweep
      stats.staticFieldRadius = 100 + (c['exp_magnet'] ?? 0) * 20
      stats.staticFieldDmgPerTick = Math.round(50 * stats.laserSweepDmgMult)
    }

    return stats
  })

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

  // ─── Card system helpers ────────────────────────────────────────────────────
  function getAttackSlotsFilled(): number {
    return Object.keys(activeCards.value).filter(id => {
      const def = ALL_CARD_DEFS.find(c => c.id === id)
      return def?.type === 'attack'
    }).length
  }

  function getSupportSlotsFilled(): number {
    return Object.keys(activeCards.value).filter(id => {
      const def = ALL_CARD_DEFS.find(c => c.id === id)
      return def?.type === 'support'
    }).length
  }

  function buildCardChoices(): CardDef[] {
    const owned = activeCards.value
    const atkFilled = getAttackSlotsFilled()
    const supFilled = getSupportSlotsFilled()

    const available = ALL_CARD_DEFS.filter(def => {
      if (def.type === 'ultimate') {
        if (!def.requiresAttackId || !def.requiresSupportId) return false
        const atkDef = ALL_CARD_DEFS.find(c => c.id === def.requiresAttackId)
        const atkLv = owned[def.requiresAttackId] ?? 0
        const supLv = owned[def.requiresSupportId] ?? 0
        return atkLv >= (atkDef?.maxLevel ?? 5) && supLv >= 1 && (owned[def.id] ?? 0) < def.maxLevel
      }
      const currentLv = owned[def.id] ?? 0
      if (currentLv > 0) return currentLv < def.maxLevel
      if (def.type === 'attack') return atkFilled < 5
      if (def.type === 'support') return supFilled < 5
      return false
    })

    return [...available].sort(() => Math.random() - 0.5).slice(0, 3)
  }

  function chooseCard(cardId: string) {
    const def = ALL_CARD_DEFS.find(c => c.id === cardId)
    if (!def) return
    const currentLv = activeCards.value[cardId] ?? 0
    if (currentLv >= def.maxLevel) return
    activeCards.value = { ...activeCards.value, [cardId]: currentLv + 1 }
    isLevelUpPending.value = false
    isPaused.value = false
  }

  function triggerLevelUp() {
    if (playerLevel.value >= 10) unlockAchievement('level_10')
    levelUpCardChoices.value = buildCardChoices()
    if (levelUpCardChoices.value.length === 0) return  // all cards maxed, skip
    isLevelUpPending.value = true
    isPaused.value = true
  }

  // ─── Shield helpers ─────────────────────────────────────────────────────────
  function tickShield(deltaSeconds: number) {
    const cs = cardStats.value
    if (cs.shieldCooldownSec <= 0) return
    if (!shieldActive.value) {
      if (shieldCooldownLeft.value > 0) {
        shieldCooldownLeft.value = Math.max(0, shieldCooldownLeft.value - deltaSeconds)
        if (shieldCooldownLeft.value <= 0) {
          shieldActive.value = true
          shieldLivesLeft.value = cs.shieldLives
        }
      } else {
        shieldActive.value = true
        shieldLivesLeft.value = cs.shieldLives
      }
    }
  }

  // Returns true if the hit was absorbed by shield
  function absorbShieldHit(): boolean {
    if (!shieldActive.value) return false
    const cs = cardStats.value
    shieldLivesLeft.value--
    if (shieldLivesLeft.value <= 0) {
      shieldActive.value = false
      shieldCooldownLeft.value = cs.shieldCooldownSec
      if (cs.shieldHealOnBreak > 0) {
        playerHp.value = Math.min(playerMaxHp.value, playerHp.value + cs.shieldHealOnBreak)
      }
    }
    return true
  }

  function healPlayer(amount: number) {
    playerHp.value = Math.min(playerMaxHp.value, playerHp.value + amount)
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
    skillCooldown.value = 30 * (1 - cardStats.value.cdReductionPct)
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
      bulletCount: 1 + permUpgrades.value.bulletCount,
      shipSpeed: Math.min(1.5, 1 + permUpgrades.value.baseSpeed * 0.05),
      shield: 0,
      bombCount: 0,
      damage: Math.min(100, 10 + permUpgrades.value.baseDamage * 5),
      collectRange: 40,
      hpRegen: 0,
    }
    levelUpCardChoices.value = []
    isLevelUpPending.value = false
    goldEarnedThisRun.value = 0
    isGameOverSequence.value = false
    skillCooldown.value = 0
    skillActivationPending.value = false
    // Reset card system
    activeCards.value = {}
    shieldActive.value = false
    shieldLivesLeft.value = 0
    shieldCooldownLeft.value = 0
    isPlaying.value = true
    isPaused.value = false
  }

  function endGame() {
    isGameOverSequence.value = false
    // Award gold/exp earned during this run when player exits manually
    if (isPlaying.value) {
      goldEarnedThisRun.value = Math.floor(currentStage.value * 5) + Math.floor(currentScore.value / 100)
      playerCoins.value += goldEarnedThisRun.value
      const earnedAccountExp = currentStage.value * 10 + Math.floor(currentScore.value / 50)
      addAccountExp(earnedAccountExp)
    }
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
            baseDamage:  data.permUpgrades.baseDamage  ?? 0,
            baseHp:      data.permUpgrades.baseHp      ?? 0,
            baseSpeed:   data.permUpgrades.baseSpeed   ?? 0,
            expBonus:    data.permUpgrades.expBonus    ?? 0,
            bulletCount: data.permUpgrades.bulletCount ?? 0,
            fireRate:    data.permUpgrades.fireRate    ?? 0,
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
    // Card system
    levelUpCardChoices,
    isLevelUpPending,
    activeCards,
    cardStats,
    shieldActive,
    shieldLivesLeft,
    shieldCooldownLeft,
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
    healPlayer,
    upgradeShip,
    triggerLevelUp,
    chooseCard,
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
    tickShield,
    absorbShieldHit,
  }
})
