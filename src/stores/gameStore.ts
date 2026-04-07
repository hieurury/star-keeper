import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { UPDATE_NOTICES } from '../content/updateNotices'
import type { EnemyKind } from '../game/types'
import { audioManager, DEFAULT_AUDIO_SETTINGS, type AudioSettings } from '../game/systems/audio'
import { queueMirrorSave, readMirrorSave } from '../game/systems/saveFileMirror'
import { pushSave, pullSave, resolveConflict, ensureProfile } from '../lib/syncService'
import { isOnline, onReconnect } from '../lib/networkStatus'

export const ALL_ENEMY_KINDS: EnemyKind[] = [
  'pioneer',
  'kamikaze',
  'sniper',
  'dai_lien',
  'thu_ho',
  'thuat_si',
  'cnox_greedy',
  'cnox_shield',
  'cnox_spark',
  'boss_stardestroyer',
  'boss_invader',
  'boss_tinhvan',
  'boss_trumso',
  'boss_cnox_sun',
  'dnox_fire',
  'dnox_ice',
  'dnox_soil',
]

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
  requiresSupportId2?: string    // ultimate: optional 2nd required support card (any level)
  shipId?: string                // if set, only available when using this ship
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
  regenPctPerSec: number
  staticFieldLifesteal: boolean
  plasmaBolt: boolean
  plasmaBoltDmgMult: number
  plasmaBoltIntervalFrames: number
  plasmaBoltCount: number
  plasmaBoltWidthMult: number
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
  arsenalLaserSizePct: number
  laserKillDropsSoul: boolean
  // Tân Tiến Sức Mạnh
  damageBonusPct: number
  // Tia Hủy Diệt (ultimate)
  plasmaClearsBullets: boolean
  // Từ Trường Tĩnh Điện (ultimate)
  staticField: boolean
  staticFieldRadius: number
  staticFieldDmgPerTick: number
  // Cánh Tản Nhiệt (support)
  speedCardPct: number
  // Xạ Thủ Nhanh (support)
  turboFireRatePct: number
  // Mưa Bom Liên Hoàn (ultimate)
  cbTurboBoost: boolean
  // Kho Vũ Khí - Star Shooter
  shooterMissileBonus: number
  shooterMissileAoe: boolean
  shooterMissileSpdMult: number
  shooterMissileDmgMult: number
  shooterMissileAoeSizeBonus: number
  shooterMissileKillCdReduce: number
  armorPlatingHpPct: number
  allyDroneCount: number
  allyDroneDamageMult: number
  allyDroneBurstCount: number
  allyDroneBeamCount: number
  allyDroneFireRateMult: number
  allyDroneUltimate: boolean
  fasterDeepWound: boolean
  // Kho Vũ Khí - Thiên Hà Truy
  tracerSwordBonus: number
  tracerSwordSpdMult: number
  tracerSwordDmgMult: number
  tracerSwordPierce: boolean
  tracerSwordUltimateMode: 'none' | 'tu_kiem' | 'van_kiem'
  tracerSwordSmallMax: number
  tracerSwordExecutePct: number
}

export const ALL_CARD_DEFS: CardDef[] = [
  // ── Tấn công ────────────────────────────────────────────────────────────────
  {
    id: 'heat_missile', name: 'Tên Lửa Tầm Nhiệt', type: 'attack', icon: 'PhRocketLaunch', maxLevel: 5,
    levels: [
      { desc: 'Triệu hồi 1 bệ phóng bám theo phi cơ, mỗi 5s bắn 1 tên lửa tầm nhiệt.' },
      { desc: 'Tên lửa bay nhanh +30%, sát thương +20%.' },
      { desc: 'Thêm 1 bệ phóng tên lửa (tổng 2 bệ).' },
      { desc: 'Sát thương tên lửa +30%.' },
      { desc: 'Tên lửa nổ AOE, gây sát thương diện rộng.' },
    ],
  },
  {
    id: 'plasma_bolt', name: 'Tia Plasma', type: 'attack', icon: 'PhLightning', maxLevel: 5,
    levels: [
      { desc: 'Mỗi 6s phóng 1 tia plasma xuyên thấu, gây 80 sát thương.' },
      { desc: 'Sát thương +25%.' },
      { desc: 'Tia plasma rộng hơn, tăng vùng trúng đòn.' },
      { desc: 'Sát thương +30%.' },
      { desc: 'Bắn 2 tia plasma song song.' },
    ],
  },
  {
    id: 'cluster_bomb', name: 'Bom Cụm', type: 'attack', icon: 'PhBomb', maxLevel: 5,
    levels: [
      { desc: 'Mỗi 8s thả 1 bom cụm, nổ gây 70 sát thương diện rộng.' },
      { desc: 'Phạm vi nổ +30%, sát thương +20%.' },
      { desc: 'Bom nổ ra 4 mảnh nhỏ tiếp tục gây sát thương.' },
      { desc: 'Sát thương +35%.' },
      { desc: 'Thả 2 bom liên tiếp.' },
    ],
  },
  {
    id: 'laser_sweep', name: 'Quét Laser', type: 'attack', icon: 'PhWaveSine', maxLevel: 5,
    levels: [
      { desc: 'Mỗi 7s quét tia laser ngang, gây 50 sát thương mọi kẻ địch trong vùng.' },
      { desc: 'Sát thương +25%.' },
      { desc: 'Laser quét 2 lần liên tiếp.' },
      { desc: 'Sát thương +30%.' },
      { desc: 'Laser vùng rộng, quét toàn màn hình.' },
    ],
  },
  {
    id: 'weapon_cache_star', name: 'Kho Vũ Khí - Star Keeper', type: 'attack', icon: 'PhSword', maxLevel: 5, shipId: 'star_keeper',
    levels: [
      { desc: '+1 đạn bắn ra và tăng 20% tốc độ bắn.' },
      { desc: '+25% sát thương đạn.' },
      { desc: '+1 đạn bắn ra (tổng +2 đạn).' },
      { desc: '+25% tốc độ bắn và +20% sát thương (cộng dồn).' },
      { desc: '+50% sát thương đạn (cộng dồn).' },
    ],
  },
  {
    id: 'weapon_cache_shooter', name: 'Kho Vũ Khí - Star Shooter', type: 'attack', icon: 'PhTarget', maxLevel: 5, shipId: 'star_shooter',
    levels: [
      { desc: 'Tăng thêm 1 tên lửa bắn ra.' },
      { desc: 'Tăng 20% tốc độ bay và 40% sát thương cho tên lửa.' },
      { desc: 'Sát thương tên lửa +30%.' },
      { desc: 'Tăng nhẹ phạm vi nổ AOE thêm 15%.' },
      { desc: 'Thêm 2 tên lửa bắn ra.' },
    ],
  },
  { id: 'weapon_cache_holder', name: 'Kho Vũ Khí - Star Holder', type: 'attack', icon: 'PhFire', maxLevel: 5, shipId: 'star_holder',
    levels: [
      { desc: 'Tăng kích thước tia laser +25%.' },
      { desc: 'Bắn thêm 1 tia laser song song.' },
      { desc: '+30% sát thương laser và +20% tốc độ bắn.' },
      { desc: 'Bắn thêm 1 tia laser nữa (tổng +2 tia).' },
      { desc: '+40% sát thương laser và +20% kích thước laser.' },
    ],
  },
  { id: 'weapon_cache_faster', name: 'Kho Vũ Khí - Star Faster', type: 'attack', icon: 'PhCrosshair', maxLevel: 5, shipId: 'star_faster',
    levels: [
      { desc: 'Tăng 30% sát thương đạn.' },
      { desc: 'Tăng thêm 1 tia đạn.' },
      { desc: 'Tăng 20% tốc độ bắn, tăng thêm 20% sát thương đạn.' },
      { desc: 'Tăng thêm 1 tia đạn và tăng 20% tốc độ bắn.' },
      { desc: 'Tăng thêm 1 tia đạn và tăng 30% sát thương đạn.' },
    ],
  },
  { id: 'weapon_cache_truy', name: 'Kho Vũ Khí - Thiên Hà Truy', type: 'attack', icon: 'PhSword', maxLevel: 5, shipId: 'thien_ha_truy',
    levels: [
      { desc: 'Kiếm hồn bay nhanh hơn 50%.' },
      { desc: 'Thêm 1 kiếm hồn (tổng +1).' },
      { desc: 'Sát thương kiếm hồn +30%.' },
      { desc: 'Sát thương kiếm hồn +50%.' },
      { desc: 'Thêm 1 kiếm hồn nữa và tốc độ bay tăng thêm 20%.' },
    ],
  },
  // ── Hỗ trợ ──────────────────────────────────────────────────────────────────
  {
    id: 'skill_recovery', name: 'Phục Hồi Kỹ Năng', type: 'support', icon: 'PhArrowsClockwise', maxLevel: 5,
    levels: [
      { desc: 'Giảm 8% hồi chiêu kỹ năng phi cơ và mọi lõi có thời gian hồi.' },
      { desc: 'Giảm thêm 8% (tổng -16%) hồi chiêu kỹ năng phi cơ và lõi.' },
      { desc: 'Giảm thêm 8% (tổng -24%) hồi chiêu kỹ năng phi cơ và lõi.' },
      { desc: 'Giảm thêm 8% (tổng -32%) hồi chiêu kỹ năng phi cơ và lõi.' },
      { desc: 'Giảm thêm 8% (tổng -40%) hồi chiêu kỹ năng phi cơ và lõi.' },
    ],
  },
  {
    id: 'energy_shield', name: 'Lá Chắn Năng Lượng', type: 'support', icon: 'PhShieldPlus', maxLevel: 5,
    levels: [
      { desc: 'Mỗi 25s tự động tạo lá chắn hấp thụ 1 đòn tấn công.' },
      { desc: 'Thời gian hồi lá chắn giảm còn 20s.' },
      { desc: 'Khi lá chắn vỡ, hồi 50 HP.' },
      { desc: 'Thời gian hồi lá chắn giảm còn 15s.' },
      { desc: 'Lá chắn hấp thụ 2 đòn tấn công.' },
    ],
  },
  {
    id: 'exp_magnet', name: 'Nam Châm EXP', type: 'support', icon: 'PhMagnet', maxLevel: 5,
    levels: [
      { desc: 'Phạm vi thu thập kinh nghiệm +40.' },
      { desc: 'Phạm vi thu thập kinh nghiệm +40 (tổng +80).' },
      { desc: 'Phạm vi thu thập kinh nghiệm +40 (tổng +120).' },
      { desc: 'Phạm vi thu thập kinh nghiệm +40 (tổng +160).' },
      { desc: 'Phạm vi thu thập kinh nghiệm +40 (tổng +200). Hút tự động từ xa.' },
    ],
  },
  {
    id: 'hp_regen', name: 'Hồi Máu', type: 'support', icon: 'PhPlusCircle', maxLevel: 5,
    levels: [
      { desc: 'Hồi 1% HP tối đa của phi cơ mỗi giây.' },
      { desc: 'Hồi 2% HP tối đa của phi cơ mỗi giây.' },
      { desc: 'Hồi 3% HP tối đa của phi cơ mỗi giây.' },
      { desc: 'Hồi 4% HP tối đa của phi cơ mỗi giây.' },
      { desc: 'Hồi 5% HP tối đa của phi cơ mỗi giây.' },
    ],
  },
  {
    id: 'armor_plating', name: 'Bọc Thép', type: 'support', icon: 'PhShieldPlus', maxLevel: 5,
    levels: [
      { desc: 'Tăng 15% HP tối đa.' },
      { desc: 'Tăng thêm 15% HP tối đa (tổng +30%).' },
      { desc: 'Tăng thêm 15% HP tối đa (tổng +45%).' },
      { desc: 'Tăng thêm 15% HP tối đa (tổng +60%).' },
      { desc: 'Tăng thêm 15% HP tối đa (tổng +75%). Không vượt trần HP của máy bay.' },
    ],
  },
  {
    id: 'ally_drone_support', name: 'Đồng Minh Hỗ Trợ', type: 'attack', icon: 'PhAirplaneTilt', maxLevel: 5,
    levels: [
      { desc: 'Triệu hồi drone hỗ trợ tấn công, bắn đạn nhỏ dạng dài và tốc độ cao.' },
      { desc: 'Sát thương drone +35%.' },
      { desc: 'Drone bắn cùng lúc 3 viên.' },
      { desc: 'Triệu hồi thêm 1 drone nữa.' },
      { desc: 'Mỗi drone tăng số tia đạn lên 2.' },
    ],
  },
  // ── Tối thượng ──────────────────────────────────────────────────────────────
  {
    id: 'weapon_cache_shooter_ult', name: 'Tái chế hố đen', type: 'ultimate', icon: 'PhShootingStar', maxLevel: 1, shipId: 'star_shooter',
    requiresAttackId: 'weapon_cache_shooter',
    levels: [
      { desc: 'Kẻ địch bị tên lửa tiêu diệt giảm 1s hồi chiêu kỹ năng.' },
    ],
  },
  {
    id: 'weapon_cache_star_ult', name: 'Đạn Xuyên Phá', type: 'ultimate', icon: 'PhDiamondsFour', maxLevel: 1, shipId: 'star_keeper',
    requiresAttackId: 'weapon_cache_star',
    levels: [
      { desc: 'Mỗi viên đạn xuyên qua tối đa 2 mục tiêu trước khi biến mất.' },
    ],
  },
  {
    id: 'weapon_cache_holder_ult', name: 'Thu Hồn Tự Động', type: 'ultimate', icon: 'PhGhost', maxLevel: 1, shipId: 'star_holder',
    requiresAttackId: 'weapon_cache_holder',
    levels: [
      { desc: 'Kẻ địch bị tiêu diệt bởi laser có 100% cơ hội rơi linh hồn.' },
    ],
  },
  {
    id: 'weapon_cache_faster_ult', name: 'Vết Thương Sâu', type: 'ultimate', icon: 'PhDrop', maxLevel: 1, shipId: 'star_faster',
    requiresAttackId: 'weapon_cache_faster',
    levels: [
      { desc: 'Kẻ địch càng dính nhiều đạn của Star Faster càng nhận thêm sát thương, tối đa +100% với quái thường và +50% với boss.' },
    ],
  },
  {
    id: 'weapon_cache_truy_tu_kiem', name: 'Tứ Kiếm Trận', type: 'ultimate', icon: 'PhDiamondsFour', maxLevel: 1, shipId: 'thien_ha_truy',
    requiresAttackId: 'weapon_cache_truy',
    levels: [
      { desc: 'Số kiếm hồn cố định thành 4. Tốc độ và sát thương +30%. Mục tiêu dưới 10% HP sẽ bị xử trảm ngay.' },
    ],
  },
  {
    id: 'weapon_cache_truy_van_kiem', name: 'Vạn Kiếm Tề Tụ', type: 'ultimate', icon: 'PhSparkle', maxLevel: 1, shipId: 'thien_ha_truy',
    requiresAttackId: 'weapon_cache_truy',
    levels: [
      { desc: 'Chỉ còn 1 kiếm hồn chính, nhưng mỗi lần lướt qua mục tiêu sẽ sinh kiếm nhỏ gây 50% sát thương, tối đa 10 kiếm nhỏ.' },
    ],
  },
  {
    id: 'interstellar_missile', name: 'Tên Lửa Liên Sao', type: 'ultimate', icon: 'PhPlanet', maxLevel: 1,
    requiresAttackId: 'heat_missile',
    requiresSupportId: 'skill_recovery',
    levels: [
      { desc: 'Tên lửa nhỏ bắn mỗi 0.5s, luôn bám sát và trúng mục tiêu.' },
    ],
  },
  // ── Hỗ trợ (mới) ────────────────────────────────────────────────────────────
  {
    id: 'power_advance', name: 'Tân Tiến Sức Mạnh', type: 'support', icon: 'PhTrendUp', maxLevel: 5,
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
    id: 'devastation_ray', name: 'Tia Hủy Diệt', type: 'ultimate', icon: 'PhAtom', maxLevel: 1,
    requiresAttackId: 'plasma_bolt',
    requiresSupportId: 'energy_shield',
    levels: [
      { desc: 'Tia plasma tăng 50% sát thương và tiêu diệt tất cả đạn kẻ địch trên đường đi.' },
    ],
  },
  {
    id: 'static_field_ult', name: 'Sinh Lực Hấp Thụ', type: 'ultimate', icon: 'PhSpiral', maxLevel: 1,
    requiresAttackId: 'laser_sweep',
    requiresSupportId: 'hp_regen',
    levels: [
      { desc: 'Thay thế quét laser bằng vùng tĩnh điện bao quanh phi cơ, gây sát thương mỗi 0.5s cho kẻ địch bên trong. Cứ mỗi lần gây sát thương cho địch, ta hồi 1 HP.' },
    ],
  },
  // ── Hỗ trợ (tốc độ & tốc bắn) ───────────────────────────────────────────────
  {
    id: 'wing_boost', name: 'Cánh Tản Nhiệt', type: 'support', icon: 'PhWind', maxLevel: 5,
    levels: [
      { desc: '+7% tốc độ bay của phi cơ.' },
      { desc: '+7% tốc độ bay của phi cơ (tổng +14%).' },
      { desc: '+7% tốc độ bay của phi cơ (tổng +21%).' },
      { desc: '+7% tốc độ bay của phi cơ (tổng +28%).' },
      { desc: '+7% tốc độ bay của phi cơ (tổng +35%). Không ảnh hưởng tốc độ đạn.' },
    ],
  },
  {
    id: 'turbo_fire_card', name: 'Xạ Thủ Nhanh', type: 'support', icon: 'PhLightning', maxLevel: 5,
    levels: [
      { desc: '+10% tốc độ bắn.' },
      { desc: '+10% tốc độ bắn (tổng +20%).' },
      { desc: '+10% tốc độ bắn (tổng +30%).' },
      { desc: '+10% tốc độ bắn (tổng +40%).' },
      { desc: '+10% tốc độ bắn (tổng +50%).' },
    ],
  },
  // ── Tấn công (mới) ───────────────────────────────────────────────────────────
  {
    id: 'bullet_rain_ult', name: 'Mưa Bom Liên Hoàn', type: 'ultimate', icon: 'PhSparkle', maxLevel: 1,
    requiresAttackId: 'cluster_bomb',
    requiresSupportId: 'turbo_fire_card',
    levels: [
      { desc: 'Bom cụm bắn nhanh gấp đôi, luôn bắn kép.' },
    ],
  },
  {
    id: 'drone_annihilation', name: 'Drone Hủy Diệt', type: 'ultimate', icon: 'PhStar', maxLevel: 1,
    requiresAttackId: 'ally_drone_support',
    requiresSupportId: 'power_advance',
    levels: [
      { desc: 'Drone đổi sang lõi trắng-đỏ, chỉ còn 1 tia đạn nhưng tốc độ xả cực cao.' },
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
  { id: 'skill_use',   name: '⚡ Kích Hoạt Kỹ Năng',    desc: 'Sử dụng kỹ năng phi cơ lần đầu' },
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

// ─── Artifact definitions ─────────────────────────────────────────────────────
export interface ArtifactDef {
  id: string
  name: string
  icon: string
  desc: string
  cost: number
}

export const ALL_ARTIFACT_DEFS: ArtifactDef[] = [
  { id: 'neutron_star', name: 'Sao Neutron',   icon: '⭐', cost: 2000, desc: '+35% EXP nhận được; mỗi 20 giây hút tất cả orb EXP về tàu' },
  { id: 'carbon_core',  name: 'Lõi Cacbon',    icon: '🪨', cost: 2000, desc: '-10% sát thương nhận; mỗi lần lên cấp +5 HP tối đa' },
  { id: 'stardust',     name: 'Bùa Bụi Sao',  icon: '✨', cost: 1000, desc: '+10% tốc bắn; +10% sát thương' },
  { id: 'mana_core',    name: 'Lõi Mana',      icon: '💠', cost: 3500, desc: '+1 đạn (vượt giới hạn); mỗi 10 tiêu diệt bắn tia laser xuyên thẳng gây 100 sát thương' },
]

export type ShipId = 'star_keeper' | 'star_holder' | 'star_shooter' | 'star_faster' | 'thien_ha_truy'
export type ShipUpgradeKey = 'hp' | 'fireRate' | 'damage'
export interface ShipUpgradeLevels { hp: number, fireRate: number, damage: number }
export type ShipUnlockCurrency = 'coins' | 'ruby'

export interface ShipDefinition {
  id: ShipId
  name: string
  description: string
  unlockCost: number
  unlockCurrency?: ShipUnlockCurrency
  durabilityMax: number
  artifactSlots: number
  bulletCount: { base: number, max: number }
  skill: {
    name: string
    cooldownSec: number | null
    requirementText?: string
    description: string
    hudLabelHtml: string
  }
  stats: {
    base: { hp: number, damage: number, fireRate: number, speed: number }
    max: { hp: number, damage: number, fireRate: number, speed: number }
  }
}

export const SHIP_DEFS: Record<ShipId, ShipDefinition> = {
  star_keeper: {
    id: 'star_keeper',
    name: 'Star Keeper',
    description: 'Chiến cơ mức trung bình, cân bằng giữa tốc độ và sức mạnh. Lựa chọn đầu tiên cho mọi phi công.',
    unlockCost: 0,
    durabilityMax: 100,
    artifactSlots: 1,
    bulletCount: { base: 1, max: 3 },
    skill: {
      name: 'SÓNG TẦM NHIỆT HỦY DIỆT',
      cooldownSec: 30,
      description: 'Tỏa ra sóng nhiệt tốc độ cao, gây sát thương lên tất cả kẻ địch trên màn hình và hủy toàn bộ đường đạn của đối phương.',
      hudLabelHtml: 'SÓNG<br/>NHIỆT',
    },
    stats: {
      base: { hp: 100, damage: 15, fireRate: 0.8, speed: 1.0 },
      max: { hp: 300, damage: 100, fireRate: 1.25, speed: 1.5 },
    },
  },
  star_holder: {
    id: 'star_holder',
    name: 'Star Holder',
    description: 'Chiến cơ tấn công cao, thân tàu mạnh mẽ. Linh hồn kẻ địch trở thành vũ khí hủy diệt.',
    unlockCost: 5000,
    durabilityMax: 90,
    artifactSlots: 1,
    bulletCount: { base: 1, max: 3 },
    skill: {
      name: 'THU HOẠCH LINH HỒN',
      cooldownSec: null,
      requirementText: '⬡ Cần: 10 mảnh linh hồn (tối đa 50)',
      description: 'Kẻ địch bị hạ có 75% cơ hội rơi mảnh linh hồn. Thu thập đủ 10 mảnh rồi kích hoạt để bắn tất cả thành tên lửa tự dẫn, bám sát kẻ địch gần nhất.',
      hudLabelHtml: 'THU<br/>HOẠCH',
    },
    stats: {
      base: { hp: 180, damage: 25, fireRate: 1.0, speed: 1.2 },
      max: { hp: 300, damage: 150, fireRate: 1.5, speed: 1.75 },
    },
  },
  star_shooter: {
    id: 'star_shooter',
    name: 'Star Shooter',
    description: 'Chiến cơ 4 cánh với pod tên lửa hạng nặng. Tên lửa tự dẫn bám sát đối thủ, kỹ năng hố đen hấp thụ kẻ địch.',
    unlockCost: 15000,
    durabilityMax: 95,
    artifactSlots: 2,
    bulletCount: { base: 1, max: 4 },
    skill: {
      name: 'HỐ ĐEN HẤP DẪN',
      cooldownSec: 35,
      description: 'Triệu hồi hố đen trong 5 giây — hút kẻ địch thường lại gần, gây 10% HP/s (trùm 4%) và hấp thụ toàn bộ đạn kẻ địch.',
      hudLabelHtml: 'HỐ<br/>ĐEN',
    },
    stats: {
      base: { hp: 220, damage: 45, fireRate: 0.6, speed: 1.0 },
      max: { hp: 400, damage: 200, fireRate: 1.25, speed: 1.6 },
    },
  },
  star_faster: {
    id: 'star_faster',
    name: 'Star Faster',
    description: 'Chiến cơ tiểu liên với tốc độ xả đạn cực nhanh. Đạn nhỏ mảnh nhưng chính xác cao, độ lệch bắn cực thấp khi xả liên thanh.',
    unlockCost: 5000,
    durabilityMax: 100,
    artifactSlots: 1,
    bulletCount: { base: 2, max: 5 },
    skill: {
      name: 'GIA TỐC HẠT',
      cooldownSec: 30,
      description: 'Kích hoạt tốc độ tối đa làm không gian xung quanh như chậm lại. Trong 5 giây, kẻ địch và đạn của chúng giảm tốc 70%, tốc độ bắn của phi cơ đạt đỉnh.',
      hudLabelHtml: 'GIA<br/>TỐC',
    },
    stats: {
      base: { hp: 100, damage: 12, fireRate: 1.2, speed: 1.25 },
      max: { hp: 310, damage: 65, fireRate: 2.0, speed: 2.0 },
    },
  },
  thien_ha_truy: {
    id: 'thien_ha_truy',
    name: 'Thiên Hà Truy',
    description: 'Phi kiếm ngọc bích truy sát mục tiêu bằng kiếm hồn. Kỹ năng Thiên Hà Trảm ngưng động chiến trường rồi chém quét toàn bản đồ.',
    unlockCost: 30,
    unlockCurrency: 'ruby',
    durabilityMax: 105,
    artifactSlots: 2,
    bulletCount: { base: 1, max: 3 },
    skill: {
      name: 'THIÊN HÀ TRẢM',
      cooldownSec: 45,
      description: 'Ngưng động thời gian trong 2 giây, gọi toàn bộ kiếm hồn quay về, sau đó vung trảm sóng xung kích gây sát thương cực lớn lên mọi mục tiêu và hủy toàn bộ đạn.',
      hudLabelHtml: 'THIÊN<br/>TRẢM',
    },
    stats: {
      base: { hp: 165, damage: 35, fireRate: 0.72, speed: 1.25 },
      max: { hp: 360, damage: 210, fireRate: 1.45, speed: 2.0 },
    },
  },
}

export const SHIP_ARTIFACT_SLOTS: Record<string, number> = Object.fromEntries(
  Object.entries(SHIP_DEFS).map(([id, def]) => [id, def.artifactSlots]),
) as Record<string, number>

export const SHIP_DURABILITY_MAX: Record<string, number> = Object.fromEntries(
  Object.entries(SHIP_DEFS).map(([id, def]) => [id, def.durabilityMax]),
) as Record<string, number>

export const SHIP_BULLET_COUNT: Record<ShipId, { base: number, max: number }> = Object.fromEntries(
  Object.entries(SHIP_DEFS).map(([id, def]) => [id, def.bulletCount]),
) as Record<ShipId, { base: number, max: number }>

export const SHIP_UPGRADE_MAX_LEVEL = 5
export const SHIP_UPGRADE_COSTS: Record<ShipUpgradeKey, number[]> = {
  hp: [350, 700, 1200, 1900, 2800],
  fireRate: [400, 780, 1300, 2050, 3000],
  damage: [420, 820, 1380, 2180, 3200],
}

const SHIP_BASE_STATS: Record<ShipId, { hp: number, damage: number, fireRate: number, speed: number }> = Object.fromEntries(
  Object.entries(SHIP_DEFS).map(([id, def]) => [id, def.stats.base]),
) as Record<ShipId, { hp: number, damage: number, fireRate: number, speed: number }>

const SHIP_MAX_STATS: Record<ShipId, { hp: number, damage: number, fireRate: number, speed: number }> = Object.fromEntries(
  Object.entries(SHIP_DEFS).map(([id, def]) => [id, def.stats.max]),
) as Record<ShipId, { hp: number, damage: number, fireRate: number, speed: number }>

const SHIP_UPGRADE_STEP_FACTOR: Record<ShipUpgradeKey, number> = {
  hp: 0.08,
  fireRate: 0.07,
  damage: 0.07,
}

export const SHIP_UNLOCK_COST: Record<ShipId, number> = Object.fromEntries(
  Object.entries(SHIP_DEFS).map(([id, def]) => [id, def.unlockCost]),
) as Record<ShipId, number>

export const SHIP_UNLOCK_CURRENCY: Record<ShipId, ShipUnlockCurrency> = Object.fromEntries(
  Object.entries(SHIP_DEFS).map(([id, def]) => [id, def.unlockCurrency ?? 'coins']),
) as Record<ShipId, ShipUnlockCurrency>

function getShipUpgradeCostMultiplierByUnlockCost(shipId: ShipId): number {
  const unlockCost = SHIP_UNLOCK_COST[shipId] ?? 0
  const unlockCurrency = SHIP_UNLOCK_CURRENCY[shipId] ?? 'coins'
  // Economy mapping: 30 ruby ship is treated as 15,000 coins tier for upgrade pricing.
  const unlockCostCoinEquivalent = unlockCurrency === 'ruby' ? unlockCost * 500 : unlockCost
  // Unlock cost 2000 -> x1.10, 5000 -> x1.25, 15000 -> x1.75
  return 1 + unlockCostCoinEquivalent / 20000
}

// ─── Upgrade definitions ──────────────────────────────────────────────────────
export type UpgradeRarity = 'white' | 'blue' | 'purple' | 'gold'
export interface UpgradeOption {
  id: string
  name: string
  desc: string
  rarity: UpgradeRarity
  apply: (store: ReturnType<typeof useGameStore>) => void
}

// ─── Daily Mission ────────────────────────────────────────────────────────────
export interface DailyMission {
  id: string
  kind: string
  desc: string
  target: number
  progress: number
  completed: boolean
  claimed: boolean
  reward: { coins?: number; ruby?: number; accountExp?: number }
  shipId?: string
}

const MISSION_POOL: Array<{
  kind: string; shipId?: string
  variants: Array<{ target: number; desc: string; reward: { coins?: number; ruby?: number; accountExp?: number } }>
}> = [
  { kind: 'score', variants: [
    { target: 1500,  desc: 'Đạt 1,500 điểm trong 1 ván',   reward: { coins: 80 } },
    { target: 4000,  desc: 'Đạt 4,000 điểm trong 1 ván',   reward: { coins: 120 } },
    { target: 8000,  desc: 'Đạt 8,000 điểm trong 1 ván',   reward: { coins: 180 } },
    { target: 15000, desc: 'Đạt 15,000 điểm trong 1 ván',  reward: { coins: 260 } },
  ]},
  { kind: 'kills', variants: [
    { target: 40,  desc: 'Tiêu diệt 40 kẻ địch trong 1 ván',  reward: { coins: 70 } },
    { target: 80,  desc: 'Tiêu diệt 80 kẻ địch trong 1 ván',  reward: { coins: 110 } },
    { target: 130, desc: 'Tiêu diệt 130 kẻ địch trong 1 ván', reward: { coins: 160 } },
    { target: 200, desc: 'Tiêu diệt 200 kẻ địch trong 1 ván', reward: { coins: 220 } },
  ]},
  { kind: 'earn_gold', variants: [
    { target: 150, desc: 'Kiếm 150 vàng trong 1 ván', reward: { accountExp: 50 } },
    { target: 300, desc: 'Kiếm 300 vàng trong 1 ván', reward: { accountExp: 80 } },
    { target: 550, desc: 'Kiếm 550 vàng trong 1 ván', reward: { accountExp: 120 } },
  ]},
  { kind: 'reach_stage', variants: [
    { target: 5,  desc: 'Vượt qua stage 5 trong 1 ván',  reward: { coins: 100 } },
    { target: 8,  desc: 'Vượt qua stage 8 trong 1 ván',  reward: { accountExp: 80 } },
    { target: 12, desc: 'Vượt qua stage 12 trong 1 ván', reward: { coins: 160 } },
    { target: 18, desc: 'Vượt qua stage 18 trong 1 ván', reward: { accountExp: 140 } },
  ]},
  { kind: 'kill_boss', variants: [
    { target: 2, desc: 'Hạ gục 2 trùm trong ngày', reward: { ruby: 1 } },
    { target: 5, desc: 'Hạ gục 5 trùm trong ngày', reward: { ruby: 3 } },
  ]},
  { kind: 'play_with_ship', shipId: 'star_keeper', variants: [
    { target: 2, desc: 'Chơi 2 ván với Star Keeper', reward: { coins: 60 } },
    { target: 4, desc: 'Chơi 4 ván với Star Keeper', reward: { coins: 110 } },
  ]},
  { kind: 'play_with_ship', shipId: 'star_holder', variants: [
    { target: 2, desc: 'Chơi 2 ván với Star Holder', reward: { coins: 70 } },
    { target: 4, desc: 'Chơi 4 ván với Star Holder', reward: { coins: 120 } },
  ]},
  { kind: 'play_with_ship', shipId: 'star_shooter', variants: [
    { target: 2, desc: 'Chơi 2 ván với Star Shooter', reward: { coins: 80 } },
    { target: 4, desc: 'Chơi 4 ván với Star Shooter', reward: { coins: 130 } },
  ]},
  { kind: 'play_with_ship', shipId: 'star_faster', variants: [
    { target: 2, desc: 'Chơi 2 ván với Star Faster', reward: { coins: 75 } },
    { target: 4, desc: 'Chơi 4 ván với Star Faster', reward: { coins: 125 } },
  ]},
  { kind: 'play_time', variants: [
    { target: 120, desc: 'Chơi liên tục 2 phút trong 1 ván',   reward: { accountExp: 60 } },
    { target: 240, desc: 'Chơi liên tục 4 phút trong 1 ván',   reward: { accountExp: 90 } },
    { target: 360, desc: 'Chơi liên tục 6 phút trong 1 ván',   reward: { accountExp: 130 } },
  ]},
  { kind: 'choose_upgrades', variants: [
    { target: 5,  desc: 'Chọn 5 thẻ Lõi Sao trong 1 ván',  reward: { coins: 80 } },
    { target: 8,  desc: 'Chọn 8 thẻ Lõi Sao trong 1 ván',  reward: { coins: 130 } },
    { target: 12, desc: 'Chọn 12 thẻ Lõi Sao trong 1 ván', reward: { coins: 180 } },
  ]},
  { kind: 'earn_upgrades', variants: [
    { target: 5,  desc: 'Đạt cấp 5 trong 1 ván',  reward: { accountExp: 60 } },
    { target: 8,  desc: 'Đạt cấp 8 trong 1 ván',  reward: { accountExp: 100 } },
    { target: 12, desc: 'Đạt cấp 12 trong 1 ván', reward: { accountExp: 150 } },
  ]},
]

// ─── Save version ─────────────────────────────────────────────────────────────
// Tăng số này mỗi khi cấu trúc dữ liệu save thay đổi không tương thích ngược.
// loadProgress() sẽ dùng số này để chạy migration thích hợp.
const SAVE_VERSION = 1
const SAVE_KEY = 'ban-may-bay-save'
const SAVE_BACKUP_KEY = 'ban-may-bay-save-backup'
const SAVE_REJECTED_KEY = 'ban-may-bay-save-rejected'
const SAVE_ENVELOPE_VERSION = 1
const SAVE_SIGNATURE_PEPPER_CURRENT = 'ban-may-bay::save-signature::2026'
const SAVE_SIGNATURE_PEPPERS_LEGACY = [
  'ban-may-bay::save-signature::2025',
  'ban-may-bay::save-signature::2024',
  'ban-may-bay::save-signature',
]

interface SaveEnvelope {
  format: 'signed'
  envelopeVersion: number
  payload: Record<string, unknown>
  sig: string
}

type SaveVerifyMode = 'ok' | 'legacy-ok' | 'invalid'

function normalizeForJson(value: unknown): unknown {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return undefined
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    // JSON arrays preserve length; undefined/function/symbol become null.
    return value.map(item => {
      const normalized = normalizeForJson(item)
      return normalized === undefined ? null : normalized
    })
  }
  const obj = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    const normalized = normalizeForJson(obj[key])
    if (normalized !== undefined) out[key] = normalized
  }
  return out
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const parts: string[] = []
  for (const key of keys) {
    parts.push(`${JSON.stringify(key)}:${stableStringify(obj[key])}`)
  }
  return `{${parts.join(',')}}`
}

function fnv1aHash(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

function createSaveSignatureWithPepper(payload: Record<string, unknown>, pepper: string): string {
  const normalizedPayload = normalizeForJson(payload) as Record<string, unknown>
  return fnv1aHash(`${stableStringify(normalizedPayload)}|${pepper}`)
}

function createSaveSignature(payload: Record<string, unknown>): string {
  return createSaveSignatureWithPepper(payload, SAVE_SIGNATURE_PEPPER_CURRENT)
}

function createLegacyV1SignatureWithKnownBug(payload: Record<string, unknown>, pepper: string): string {
  // Compatibility path for previously saved envelopes where undefined fields were
  // included in signature input but dropped by JSON persistence.
  const cloned = structuredClone(payload) as Record<string, unknown>
  const missions = Array.isArray(cloned.dailyMissions) ? cloned.dailyMissions as Array<Record<string, unknown>> : []
  for (const m of missions) {
    if (m && typeof m === 'object' && !Array.isArray(m) && !Object.prototype.hasOwnProperty.call(m, 'shipId')) {
      m.shipId = undefined
    }
  }
  return fnv1aHash(`${stableStringify(cloned)}|${pepper}`)
}

function buildSaveEnvelope(payload: Record<string, unknown>): SaveEnvelope {
  return {
    format: 'signed',
    envelopeVersion: SAVE_ENVELOPE_VERSION,
    payload,
    sig: createSaveSignature(payload),
  }
}

function isSaveEnvelope(data: unknown): data is SaveEnvelope {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const obj = data as Record<string, unknown>
  return obj.format === 'signed'
    && typeof obj.envelopeVersion === 'number'
    && !!obj.payload
    && typeof obj.payload === 'object'
    && !Array.isArray(obj.payload)
    && typeof obj.sig === 'string'
}

function getSaveVerificationMode(envelope: SaveEnvelope): SaveVerifyMode {
  if (envelope.sig === createSaveSignature(envelope.payload)) return 'ok'

  const knownPeppers = [SAVE_SIGNATURE_PEPPER_CURRENT, ...SAVE_SIGNATURE_PEPPERS_LEGACY]
  for (const pepper of knownPeppers) {
    if (envelope.sig === createSaveSignatureWithPepper(envelope.payload, pepper)) return 'legacy-ok'
    if (envelope.sig === createLegacyV1SignatureWithKnownBug(envelope.payload, pepper)) return 'legacy-ok'
  }

  return 'invalid'
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
  const baseSessionMaxHp = ref(100)
  const pendingHealPopup = ref(0)

  // Hồ sơ người chơi
  const username = ref('Phi Công')
  const avatarId = ref(0)
  const shipName = ref('Chiến Cơ Alpha')
  const updateNoticeSeenIds = ref<string[]>([])
  const audioSettings = ref<AudioSettings>({ ...DEFAULT_AUDIO_SETTINGS })
  audioManager.setSettings(audioSettings.value)

  // Tiến trình tài khoản (persistent, không reset giữa các ván)
  const accountLevel = ref(1)
  const accountExp = ref(0)

  // Test mode (không ảnh hưởng save / kết quả thật)
  const testMode = ref<{ type: 'faction'; faction: 'anox' | 'bnox' | 'cnox' | 'dnox' } | { type: 'boss'; bossKind: string } | null>(null)

  // Phi cơ sở hữu
  const ownedShips = ref<string[]>(['star_keeper'])
  const selectedShip = ref('star_keeper')
  const shipUpgrades = ref<Record<ShipId, ShipUpgradeLevels>>({
    star_keeper: { hp: 0, fireRate: 0, damage: 0 },
    star_holder: { hp: 0, fireRate: 0, damage: 0 },
    star_shooter: { hp: 0, fireRate: 0, damage: 0 },
    star_faster: { hp: 0, fireRate: 0, damage: 0 },
    thien_ha_truy: { hp: 0, fireRate: 0, damage: 0 },
  })

  // Thành tựu
  const unlockedAchievements = ref<string[]>([])
  const encounteredEnemyKinds = ref<EnemyKind[]>([])

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
      regenPctPerSec: 0,
      staticFieldLifesteal: false,
      plasmaBolt: false,
      plasmaBoltDmgMult: 1,
      plasmaBoltIntervalFrames: 360,
      plasmaBoltCount: 1,
      plasmaBoltWidthMult: 1,
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
      arsenalLaserSizePct: 0,
      laserKillDropsSoul: false,
      damageBonusPct: 0,
      plasmaClearsBullets: false,
      staticField: false,
      staticFieldRadius: 0,
      staticFieldDmgPerTick: 0,
      speedCardPct: 0,
      turboFireRatePct: 0,
      cbTurboBoost: false,
      shooterMissileBonus: 0,
      shooterMissileAoe: true,
      shooterMissileSpdMult: 1.0,
      shooterMissileDmgMult: 1.0,
      shooterMissileAoeSizeBonus: 0,
      shooterMissileKillCdReduce: 0,
      armorPlatingHpPct: 0,
      allyDroneCount: 0,
      allyDroneDamageMult: 1,
      allyDroneBurstCount: 1,
      allyDroneBeamCount: 1,
      allyDroneFireRateMult: 1,
      allyDroneUltimate: false,
      fasterDeepWound: false,
      tracerSwordBonus: 0,
      tracerSwordSpdMult: 1,
      tracerSwordDmgMult: 1,
      tracerSwordPierce: false,
      tracerSwordUltimateMode: 'none',
      tracerSwordSmallMax: 0,
      tracerSwordExecutePct: 0,
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
    if (pbLv >= 3) stats.plasmaBoltWidthMult = 1.5
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
    stats.cdReductionPct = (c['skill_recovery'] ?? 0) * 0.08

    // energy_shield
    const esLv = c['energy_shield'] ?? 0
    if (esLv >= 1) { stats.shieldCooldownSec = 25; stats.shieldLives = 1 }
    if (esLv >= 2) stats.shieldCooldownSec = 20
    if (esLv >= 3) stats.shieldHealOnBreak = 50
    if (esLv >= 4) stats.shieldCooldownSec = 15
    if (esLv >= 5) stats.shieldLives = 2

    // exp_magnet
    stats.expRangeBonus = (c['exp_magnet'] ?? 0) * 40

    // hp_regen
    const hrLv = c['hp_regen'] ?? 0
    if (hrLv >= 1) stats.regenPctPerSec = hrLv

    // hp_vampire cleanup (in case it was loaded from old save)
    if (c['hp_vampire']) {
      stats.regenPctPerSec = Math.max(stats.regenPctPerSec, c['hp_vampire'])
    }

    // armor_plating
    stats.armorPlatingHpPct = (c['armor_plating'] ?? 0) * 15

    // ally_drone_support
    const adsLv = c['ally_drone_support'] ?? 0
    if (adsLv >= 1) {
      stats.allyDroneCount = 1
      stats.allyDroneDamageMult = 1
      stats.allyDroneBurstCount = 1
      stats.allyDroneBeamCount = 1
      stats.allyDroneFireRateMult = 1
    }
    if (adsLv >= 2) stats.allyDroneDamageMult = 1.35
    if (adsLv >= 3) stats.allyDroneBurstCount = 3
    if (adsLv >= 4) stats.allyDroneCount = 2
    if (adsLv >= 5) stats.allyDroneBeamCount = 2

    // weapon_cache_star (Kho Vũ Khí - Star Keeper)
    const ac = c['weapon_cache_star'] ?? 0
    if (ac >= 1) { stats.arsenalBulletBonus = 1; stats.arsenalFireRatePct = 20 }
    if (ac >= 2) stats.arsenalDamagePct = 25
    if (ac >= 3) stats.arsenalBulletBonus = 2
    if (ac >= 4) { stats.arsenalFireRatePct = 45; stats.arsenalDamagePct = 45 }
    if (ac >= 5) stats.arsenalDamagePct = 95
    if ((c['weapon_cache_star_ult'] ?? 0) >= 1) stats.bulletPierceOnKill = true

    // weapon_cache_holder (Kho Vũ Khí - Star Holder)
    const hac = c['weapon_cache_holder'] ?? 0
    if (hac >= 1) stats.arsenalLaserSizePct = 25
    if (hac >= 2) stats.arsenalBulletBonus = 1
    if (hac >= 3) { stats.arsenalDamagePct = 30; stats.arsenalFireRatePct = 20 }
    if (hac >= 4) stats.arsenalBulletBonus = 2
    if (hac >= 5) { stats.arsenalDamagePct = 70; stats.arsenalLaserSizePct = 45 }
    if ((c['weapon_cache_holder_ult'] ?? 0) >= 1) stats.laserKillDropsSoul = true

    // weapon_cache_faster (Kho Vũ Khí - Star Faster)
    const fac = c['weapon_cache_faster'] ?? 0
    if (fac >= 1) stats.arsenalDamagePct = 30
    if (fac >= 2) stats.arsenalBulletBonus = 1
    if (fac >= 3) { stats.arsenalFireRatePct = 20; stats.arsenalDamagePct = 50 }
    if (fac >= 4) { stats.arsenalBulletBonus = 2; stats.arsenalFireRatePct = 40 }
    if (fac >= 5) { stats.arsenalBulletBonus = 3; stats.arsenalDamagePct = 80 }
    if ((c['weapon_cache_faster_ult'] ?? 0) >= 1) stats.fasterDeepWound = true

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
      stats.staticFieldLifesteal = true
      stats.staticFieldRadius = Math.round((100 + (c['exp_magnet'] ?? 0) * 20) * 1.3)
      stats.staticFieldDmgPerTick = Math.max(1, Math.round(50 * stats.laserSweepDmgMult))
    }

    // wing_boost (support)
    stats.speedCardPct = (c['wing_boost'] ?? 0) * 7

    // turbo_fire_card (support)
    stats.turboFireRatePct = (c['turbo_fire_card'] ?? 0) * 10

    // weapon_cache_shooter (Star Shooter)
    const sc = c['weapon_cache_shooter'] ?? 0
    if (sc >= 1) stats.shooterMissileBonus = 1
    if (sc >= 2) { stats.shooterMissileSpdMult = 1.2; stats.shooterMissileDmgMult = 1.4 }
    if (sc >= 3) stats.shooterMissileDmgMult *= 1.3
    if (sc >= 4) stats.shooterMissileAoeSizeBonus = 0.15
    if (sc >= 5) { stats.shooterMissileBonus = 3; stats.shooterMissileDmgMult = (sc >= 3 ? 1.4 : 1.0) * 1.3 }
    if ((c['weapon_cache_shooter_ult'] ?? 0) >= 1) stats.shooterMissileKillCdReduce = 1

    // weapon_cache_truy (Thiên Hà Truy)
    const tc = c['weapon_cache_truy'] ?? 0
    if (tc >= 1) stats.tracerSwordSpdMult *= 1.5
    if (tc >= 2) stats.tracerSwordBonus = 1
    if (tc >= 3) stats.tracerSwordDmgMult *= 1.3
    if (tc >= 4) stats.tracerSwordDmgMult *= 1.5
    if (tc >= 5) { stats.tracerSwordBonus = 2; stats.tracerSwordSpdMult *= 1.2 }

    if ((c['weapon_cache_truy_tu_kiem'] ?? 0) >= 1) {
      stats.tracerSwordUltimateMode = 'tu_kiem'
      stats.tracerSwordSpdMult *= 1.3
      stats.tracerSwordDmgMult *= 1.3
      stats.tracerSwordExecutePct = 0.1
    } else if ((c['weapon_cache_truy_van_kiem'] ?? 0) >= 1) {
      stats.tracerSwordUltimateMode = 'van_kiem'
      stats.tracerSwordSmallMax = 10
    }

    // bullet_rain_ult: cluster bomb halved interval + always double
    if ((c['bullet_rain_ult'] ?? 0) >= 1) {
      stats.cbTurboBoost = true
      stats.clusterBombIntervalFrames = Math.round(stats.clusterBombIntervalFrames / 2)
      stats.clusterBombDouble = true
    }

    // drone_annihilation (ultimate)
    if ((c['drone_annihilation'] ?? 0) >= 1) {
      stats.allyDroneUltimate = true
      stats.allyDroneBurstCount = 1
      stats.allyDroneBeamCount = 1
      stats.allyDroneFireRateMult = 2.8
    }

    return stats
  })

  // ─── Sync state ────────────────────────────────────────────────────────────────
  /** True khi có thay đổi chưa được đồng bộ lên Supabase */
  const pendingSync = ref(false)
  /** Thời điểm client lần cuối lưu (ISO string), dùng cho conflict resolution */
  const saveUpdatedAt = ref<string | null>(null)

  // Reconnect → tự động push pending save
  onReconnect(() => {
    if (pendingSync.value) void pushToSupabase()
  })

  // Skill: Sóng tầm nhiệt huỷ diệt (Star Keeper) / Thu thập linh hồn (Star Holder)
  const skillCooldown = ref(0)          // giây còn lại (0 = sẵn sàng) — chỉ dùng cho star_keeper
  const skillActivationPending = ref(false) // GameCanvas tiêu thụ flag này
  const fragmentCount = ref(0)           // Star Holder: mảnh linh hồn đã thu thập

  // ─── Artifact & Durability state ─────────────────────────────────────────────
  const ownedArtifacts = ref<string[]>([])
  const equippedArtifacts = ref<Record<string, string[]>>({})  // shipId → artifactId[]
  const shipDurabilities = ref<Record<string, number>>({ star_keeper: 100, star_holder: 90, star_shooter: 95, star_faster: 100, thien_ha_truy: 105 })
  // Runtime artifact progress (0–1), written by GameCanvas each frame for HUD
  const neutronVacuumPct = ref(0)
  const manaCorePct = ref(0)

  // ─── Daily missions ───────────────────────────────────────────────────────────
  const dailyMissions = ref<DailyMission[]>([])
  const dailyDate = ref('')
  const milestone3Claimed = ref(false)
  const milestone5Claimed = ref(false)

  // ─── Session tracking (per run) ───────────────────────────────────────────────
  const sessionKillsTotal = ref(0)
  const sessionBossKillsTotal = ref(0)
  const sessionCardsChosen = ref(0)
  const sessionStartMs = ref(0)
  const isAdminMode = ref(false)

  const isSkillReady = computed(() =>
    selectedShip.value === 'star_holder'
      ? fragmentCount.value >= 10
      : skillCooldown.value <= 0
  )

  function getShipBaseStats(shipId: ShipId) {
    return SHIP_BASE_STATS[shipId]
  }

  function getShipMaxStats(shipId: ShipId) {
    return SHIP_MAX_STATS[shipId]
  }

  function getShipUpgradeLevel(shipId: ShipId, key: ShipUpgradeKey): number {
    const lv = shipUpgrades.value[shipId]?.[key] ?? 0
    return Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(lv)))
  }

  function getShipUpgradeCost(shipId: ShipId, key: ShipUpgradeKey): number | null {
    if (!ownedShips.value.includes(shipId)) return null
    const lv = getShipUpgradeLevel(shipId, key)
    if (lv >= SHIP_UPGRADE_MAX_LEVEL) return null
    const baseCost = SHIP_UPGRADE_COSTS[key][lv]
    if (baseCost == null) return null
    const mult = getShipUpgradeCostMultiplierByUnlockCost(shipId)
    return Math.round(baseCost * mult)
  }

  function getShipEffectiveStats(shipId: ShipId): { hp: number, damage: number, fireRate: number, speed: number } {
    const base = getShipBaseStats(shipId)
    const max = getShipMaxStats(shipId)
    const up = shipUpgrades.value[shipId] ?? { hp: 0, fireRate: 0, damage: 0 }

    const hp = Math.min(max.hp, Math.round(base.hp + (max.hp - base.hp) * SHIP_UPGRADE_STEP_FACTOR.hp * (up.hp ?? 0)))
    const damage = Math.min(max.damage, Math.round(base.damage + (max.damage - base.damage) * SHIP_UPGRADE_STEP_FACTOR.damage * (up.damage ?? 0)))
    const fireRate = Math.min(max.fireRate, Number((base.fireRate + (max.fireRate - base.fireRate) * SHIP_UPGRADE_STEP_FACTOR.fireRate * (up.fireRate ?? 0)).toFixed(2)))

    return { hp, damage, fireRate, speed: base.speed }
  }

  const selectedShipFireRateMult = computed(() => {
    const shipId = (selectedShip.value as ShipId)
    const base = getShipBaseStats(shipId).fireRate
    const now = getShipEffectiveStats(shipId).fireRate
    if (base <= 0) return 1
    return Math.max(0.25, now / base)
  })

  // ─── Artifact stats computed ──────────────────────────────────────────────────
  const artifactStats = computed(() => {
    const equipped = equippedArtifacts.value[selectedShip.value] ?? []
    return {
      expMult:               equipped.includes('neutron_star') ? 1.35 : 1.0,
      damageTakenReduction:  equipped.includes('carbon_core')  ? 0.1 : 0,
      hpPerLevel:            equipped.includes('carbon_core')  ? 5   : 0,
      speedBonus:            0,
      fireRateBonus:         equipped.includes('stardust')     ? 0.1 : 0,
      damageBonus:           equipped.includes('stardust')     ? 0.1 : 0,
      extraBullet:           equipped.includes('mana_core')    ? 1   : 0,
      neutronVacuumActive:   equipped.includes('neutron_star'),
      manaCoreActive:        equipped.includes('mana_core'),
    }
  })

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
    const multi = (1 + permUpgrades.value.expBonus * 0.1) * artifactStats.value.expMult
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

    // Ultimates eligible: requirements met (attack max if provided, supports level>=1)
    const ownedUltimateIds = new Set(
      Object.keys(owned).filter(id => {
        const d = ALL_CARD_DEFS.find(c => c.id === id)
        return !!d && d.type === 'ultimate' && (owned[id] ?? 0) > 0
      }),
    )

    const hasSiblingUltimateOwned = (def: CardDef): boolean => {
      if (def.type !== 'ultimate') return false
      return ALL_CARD_DEFS.some(other => {
        if (other.id === def.id || other.type !== 'ultimate') return false
        if ((other.shipId ?? '') !== (def.shipId ?? '')) return false
        if ((other.requiresAttackId ?? '') !== (def.requiresAttackId ?? '')) return false
        return ownedUltimateIds.has(other.id)
      })
    }

    const eligibleUltimates = ALL_CARD_DEFS.filter(def => {
      if (def.type !== 'ultimate') return false
      if (def.shipId && def.shipId !== selectedShip.value) return false
      if ((owned[def.id] ?? 0) >= def.maxLevel) return false
      if (hasSiblingUltimateOwned(def)) return false
      const hasAtkReq = !!def.requiresAttackId
      const hasSupReq = !!def.requiresSupportId
      const hasSupReq2 = !!def.requiresSupportId2
      if (!hasAtkReq && !hasSupReq && !hasSupReq2) return false
      if (hasAtkReq) {
        const atkDef = ALL_CARD_DEFS.find(c => c.id === def.requiresAttackId)
        if ((owned[def.requiresAttackId!] ?? 0) < (atkDef?.maxLevel ?? 5)) return false
      }
      if (def.requiresSupportId && (owned[def.requiresSupportId] ?? 0) < 1) return false
      if (def.requiresSupportId2 && (owned[def.requiresSupportId2] ?? 0) < 1) return false
      return true
    })

    // Non-ultimates eligible
    const eligibleOthers = ALL_CARD_DEFS.filter(def => {
      if (def.type === 'ultimate') return false
      if (def.shipId && def.shipId !== selectedShip.value) return false
      const currentLv = owned[def.id] ?? 0
      if (currentLv > 0) return currentLv < def.maxLevel
      if (def.type === 'attack') return atkFilled < 5
      if (def.type === 'support') return supFilled < 5
      return false
    })

    // Khi có ultimate đủ điều kiện, nó luôn xuất hiện trong lựa chọn
    const shuffledUlts = [...eligibleUltimates].sort(() => Math.random() - 0.5)
    const shuffledOthers = [...eligibleOthers].sort(() => Math.random() - 0.5)

    const choices: CardDef[] = []
    for (const ult of shuffledUlts) {
      if (choices.length >= 3) break
      choices.push(ult)
    }
    for (const card of shuffledOthers) {
      if (choices.length >= 3) break
      choices.push(card)
    }
    return choices
  }

  function chooseCard(cardId: string) {
    const def = ALL_CARD_DEFS.find(c => c.id === cardId)
    if (!def) return
    const currentLv = activeCards.value[cardId] ?? 0
    if (currentLv >= def.maxLevel) return
    activeCards.value = { ...activeCards.value, [cardId]: currentLv + 1 }
    applyArmorPlatingHpBonus()
    sessionCardsChosen.value++
    isLevelUpPending.value = false
    isPaused.value = false
  }

  function applyArmorPlatingHpBonus() {
    const shipId = selectedShip.value as ShipId
    const shipMaxHp = getShipMaxStats(shipId).hp
    const armorMult = 1 + (cardStats.value.armorPlatingHpPct / 100)
    const targetMax = Math.min(shipMaxHp, Math.round(baseSessionMaxHp.value * armorMult))
    const oldMax = playerMaxHp.value
    playerMaxHp.value = targetMax
    if (targetMax >= oldMax) {
      playerHp.value = Math.min(playerMaxHp.value, playerHp.value + (targetMax - oldMax))
    } else {
      playerHp.value = Math.min(playerHp.value, playerMaxHp.value)
    }
  }

  function triggerLevelUp() {
    if (playerLevel.value >= 10) unlockAchievement('level_10')
    // Carbon core: +5 max HP per level-up
    const hpBonus = artifactStats.value.hpPerLevel
    if (hpBonus > 0) {
      playerMaxHp.value = Math.min(300, playerMaxHp.value + hpBonus)
      playerHp.value = Math.min(playerMaxHp.value, playerHp.value + hpBonus)
      baseSessionMaxHp.value = Math.min(300, baseSessionMaxHp.value + hpBonus)
      applyArmorPlatingHpBonus()
    }
    levelUpCardChoices.value = buildCardChoices()
    if (levelUpCardChoices.value.length === 0) return  // all cards maxed, skip
    audioManager.playLevelUp()
    isLevelUpPending.value = true
    isPaused.value = true
  }

  function updateAudioSettings(next: Partial<AudioSettings>) {
    audioSettings.value = {
      ...audioSettings.value,
      ...next,
      masterVolume: Math.max(0, Math.min(1, next.masterVolume ?? audioSettings.value.masterVolume)),
      musicVolume: Math.max(0, Math.min(1, next.musicVolume ?? audioSettings.value.musicVolume)),
      sfxVolume: Math.max(0, Math.min(1, next.sfxVolume ?? audioSettings.value.sfxVolume)),
    }
    audioManager.setSettings(audioSettings.value)
    saveProgress()
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
      const cooldownFactor = Math.max(0.35, 1 - cs.cdReductionPct)
      shieldCooldownLeft.value = cs.shieldCooldownSec * cooldownFactor
      if (cs.shieldHealOnBreak > 0) {
        const prevHp = playerHp.value
        playerHp.value = Math.min(playerMaxHp.value, playerHp.value + cs.shieldHealOnBreak)
        const healed = Math.max(0, Math.round(playerHp.value - prevHp))
        if (healed > 0) pendingHealPopup.value += healed
      }
    }
    return true
  }

  function healPlayer(amount: number) {
    if (amount <= 0) return
    const prevHp = playerHp.value
    playerHp.value = Math.min(playerMaxHp.value, playerHp.value + amount)
    const healed = Math.max(0, Math.round(playerHp.value - prevHp))
    if (healed > 0) pendingHealPopup.value += healed
  }

  function consumePendingHealPopup(): number {
    const amount = pendingHealPopup.value
    pendingHealPopup.value = 0
    return amount
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

  function hasEncounteredEnemy(kind: EnemyKind): boolean {
    return encounteredEnemyKinds.value.includes(kind)
  }

  function markEnemyEncountered(kind: EnemyKind) {
    if (encounteredEnemyKinds.value.includes(kind)) return
    encounteredEnemyKinds.value = [...encounteredEnemyKinds.value, kind]
    saveProgress()
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
    const reduction = artifactStats.value.damageTakenReduction
    const actualDmg = reduction > 0 ? Math.max(1, Math.round(amount * (1 - reduction))) : amount
    if (actualDmg > 0) audioManager.playPlayerHit()
    playerHp.value = Math.max(0, playerHp.value - actualDmg)
    if (playerHp.value <= 0) {
      playerHp.value = 0
      isGameOverSequence.value = true
      // GameCanvas sẽ gọi finalizeGameOver() sau 2 giây khi hiệu ứng xong
    }
  }

  function finalizeGameOver() {
    isGameOverSequence.value = false
    // Tàu bị phá hủy: mất thêm độ bền
    consumeDurability(selectedShip.value, 15)
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
    updateRunMissions()
    saveProgress()
  }

  // Ship purchase + selection
  function buyShip(id: ShipId): boolean {
    const cost = SHIP_UNLOCK_COST[id] ?? 0
    const currency = SHIP_UNLOCK_CURRENCY[id] ?? 'coins'
    if (ownedShips.value.includes(id)) return false
    if (currency === 'ruby') {
      if (playerRuby.value < cost) return false
      playerRuby.value -= cost
    } else {
      if (playerCoins.value < cost) return false
      playerCoins.value -= cost
    }
    ownedShips.value = [...ownedShips.value, id]
    saveProgress()
    return true
  }

  function isUpdateNoticeSeen(id: string): boolean {
    return updateNoticeSeenIds.value.includes(id)
  }

  function markUpdateNoticeSeen(id: string) {
    if (!UPDATE_NOTICES.some(n => n.id === id)) return
    if (updateNoticeSeenIds.value.includes(id)) return
    updateNoticeSeenIds.value = [...updateNoticeSeenIds.value, id]
    saveProgress()
  }

  function markAllUpdateNoticesSeen() {
    const allIds = UPDATE_NOTICES.map(n => n.id)
    const same = allIds.length === updateNoticeSeenIds.value.length
      && allIds.every(id => updateNoticeSeenIds.value.includes(id))
    if (same) return
    updateNoticeSeenIds.value = allIds
    saveProgress()
  }

  function buyShipUpgrade(shipId: ShipId, key: ShipUpgradeKey): boolean {
    if (!ownedShips.value.includes(shipId)) return false
    const cost = getShipUpgradeCost(shipId, key)
    if (cost == null) return false
    if (playerCoins.value < cost) return false
    playerCoins.value -= cost
    const nextShip = { ...(shipUpgrades.value[shipId] ?? { hp: 0, fireRate: 0, damage: 0 }) }
    nextShip[key] = Math.min(SHIP_UPGRADE_MAX_LEVEL, (nextShip[key] ?? 0) + 1)
    shipUpgrades.value = { ...shipUpgrades.value, [shipId]: nextShip }
    saveProgress()
    return true
  }

  function selectShip(id: string) {
    if (!ownedShips.value.includes(id)) return
    selectedShip.value = id
    saveProgress()
  }

  function addKill() {
    stageEnemiesKilled.value++
    sessionKillsTotal.value++
  }

  function addBossKill() {
    sessionBossKillsTotal.value++
    unlockAchievement('kill_boss')
  }

  // Skill actions
  function activateSkill() {
    if (selectedShip.value === 'star_holder') {
      if (fragmentCount.value < 10) return
      unlockAchievement('skill_use')
      skillActivationPending.value = true
      audioManager.playSkill()
      // fragmentCount sẽ được reset bởi GameCanvas sau khi bắn hết tên lửa
    } else {
      if (skillCooldown.value > 0) return
      unlockAchievement('skill_use')
      skillActivationPending.value = true
      audioManager.playSkill()
      const shipDef = SHIP_DEFS[selectedShip.value as ShipId]
      const baseCd = shipDef?.skill.cooldownSec ?? 30
      skillCooldown.value = baseCd * (1 - cardStats.value.cdReductionPct)
    }
  }

  function reduceSkillCooldown(seconds: number) {
    if (skillCooldown.value > 0) skillCooldown.value = Math.max(0, skillCooldown.value - seconds)
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
    // Áp dụng nâng cấp vĩnh viễn + cổ vật vào chỉ số bắt đầu
    const isHolder = selectedShip.value === 'star_holder'
    const aStats = artifactStats.value
    const shipId = selectedShip.value as ShipId
    const effectiveShipStats = getShipEffectiveStats(shipId)
    const maxShipStats = getShipMaxStats(shipId)
    const baseHp = effectiveShipStats.hp
    const maxHpCap = maxShipStats.hp
    playerMaxHp.value = Math.min(maxHpCap, baseHp + permUpgrades.value.baseHp * 25)
    playerHp.value = playerMaxHp.value
    baseSessionMaxHp.value = playerMaxHp.value
    const baseDmg = effectiveShipStats.damage
    const maxDmg = maxShipStats.damage
    const baseSpd = SHIP_BASE_STATS[shipId].speed
    const maxSpd = maxShipStats.speed
    const shipBulletDef = SHIP_BULLET_COUNT[shipId] ?? { base: 1, max: 3 }
    const shipBaseBulletCount = shipBulletDef.base
    const shipMaxBulletCount = shipBulletDef.max
    const shipBaseBulletSpeed = isHolder ? 1.2 : (shipId === 'star_faster' ? 1.45 : 1)
    upgrades.value = {
      bulletSpeed: shipBaseBulletSpeed,
      bulletCount: Math.min(shipMaxBulletCount, shipBaseBulletCount + permUpgrades.value.bulletCount + aStats.extraBullet),
      shipSpeed: Math.min(maxSpd, (baseSpd + permUpgrades.value.baseSpeed * 0.05) * (1 + aStats.speedBonus)),
      shield: 0,
      bombCount: 0,
      damage: Math.min(maxDmg, (baseDmg + permUpgrades.value.baseDamage * 5) * (1 + aStats.damageBonus)),
      collectRange: 40,
      hpRegen: 0,
    }
    levelUpCardChoices.value = []
    isLevelUpPending.value = false
    goldEarnedThisRun.value = 0
    isGameOverSequence.value = false
    skillCooldown.value = 0
    skillActivationPending.value = false
    fragmentCount.value = 0
    pendingHealPopup.value = 0
    // Reset card system
    activeCards.value = {}
    // Test mode: auto-equip only the ship's Kho Vũ Khí card at max level
    if (testMode.value !== null) {
      const shipId = selectedShip.value
      const weaponCache = ALL_CARD_DEFS.find(d => d.shipId === shipId && d.id.startsWith('weapon_cache_') && d.type === 'attack')
      if (weaponCache) activeCards.value = { [weaponCache.id]: weaponCache.maxLevel }
    }
    applyArmorPlatingHpBonus()
    shieldActive.value = false
    shieldLivesLeft.value = 0
    shieldCooldownLeft.value = 0
    isPlaying.value = true
    isPaused.value = false
    // Reset session tracking
    sessionKillsTotal.value = 0
    sessionBossKillsTotal.value = 0
    sessionCardsChosen.value = 0
    sessionStartMs.value = Date.now()
    // Tiêu hao độ bền khi ra trận
    consumeDurability(selectedShip.value, 5)
  }

  function endGame() {
    pendingHealPopup.value = 0
    isGameOverSequence.value = false
    // Award gold/exp earned during this run when player exits manually
    if (isPlaying.value) {
      goldEarnedThisRun.value = Math.floor(currentStage.value * 5) + Math.floor(currentScore.value / 100)
      playerCoins.value += goldEarnedThisRun.value
      const earnedAccountExp = currentStage.value * 10 + Math.floor(currentScore.value / 50)
      addAccountExp(earnedAccountExp)
      updateRunMissions()
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

  // ─── Artifact actions ─────────────────────────────────────────────────────────
  function buyArtifact(id: string): boolean {
    const def = ALL_ARTIFACT_DEFS.find(d => d.id === id)
    if (!def) return false
    if (ownedArtifacts.value.includes(id)) return false
    if (playerCoins.value < def.cost) return false
    playerCoins.value -= def.cost
    ownedArtifacts.value = [...ownedArtifacts.value, id]
    saveProgress()
    return true
  }

  function equipArtifact(shipId: string, artifactId: string) {
    if (!ownedArtifacts.value.includes(artifactId)) return
    const slots = SHIP_ARTIFACT_SLOTS[shipId] ?? 1
    const currentRaw = equippedArtifacts.value[shipId] ?? []
    const current = [...new Set(currentRaw)]
    if (current.includes(artifactId)) {
      if (currentRaw.length !== current.length) {
        equippedArtifacts.value = { ...equippedArtifacts.value, [shipId]: current.slice(0, slots) }
        saveProgress()
      }
      return
    }
    if (current.length >= slots) return
    equippedArtifacts.value = { ...equippedArtifacts.value, [shipId]: [...current, artifactId] }
    saveProgress()
  }

  function unequipArtifact(shipId: string, artifactId: string) {
    const current = equippedArtifacts.value[shipId] ?? []
    const idx = current.indexOf(artifactId)
    if (idx < 0) return
    const next = [...current]
    next.splice(idx, 1)
    equippedArtifacts.value = { ...equippedArtifacts.value, [shipId]: next }
    saveProgress()
  }

  // ─── Durability actions ───────────────────────────────────────────────────────
  function canUseShip(shipId: string): boolean {
    const dur = shipDurabilities.value[shipId] ?? (SHIP_DURABILITY_MAX[shipId] ?? 100)
    return dur >= 10
  }

  function consumeDurability(shipId: string, amount: number) {
    const maxDur = SHIP_DURABILITY_MAX[shipId] ?? 100
    const current = shipDurabilities.value[shipId] ?? maxDur
    shipDurabilities.value = { ...shipDurabilities.value, [shipId]: Math.max(0, current - amount) }
  }

  function tickDurabilityRegen() {
    const updated = { ...shipDurabilities.value }
    for (const [shipId, maxDur] of Object.entries(SHIP_DURABILITY_MAX)) {
      const current = updated[shipId] ?? maxDur
      if (current < maxDur) updated[shipId] = Math.min(maxDur, current + 1)
    }
    shipDurabilities.value = updated
    saveProgress()
  }

  // ─── Daily mission functions ──────────────────────────────────────────────────
  function _seededRand(seed: number): () => number {
    let s = (seed === 0 ? 1 : seed) | 0
    return () => {
      s ^= s << 13; s ^= s >> 17; s ^= s << 5
      return (s >>> 0) / 0x100000000
    }
  }

  function generateDailyMissions() {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (dailyDate.value === today && dailyMissions.value.length === 5) return
    if (dailyDate.value !== today) {
      milestone3Claimed.value = false
      milestone5Claimed.value = false
    }
    dailyDate.value = today
    const seed = parseInt(today.replace(/-/g, ''), 10)
    const rand = _seededRand(seed)
    const owned = ownedShips.value
    const pool = MISSION_POOL.filter(e => !e.shipId || owned.includes(e.shipId))
    const shuffled = [...pool].sort(() => rand() - 0.5)
    const picked: typeof MISSION_POOL = []
    const usedKeys = new Set<string>()
    for (const entry of shuffled) {
      const key = `${entry.kind}:${entry.shipId ?? ''}`
      if (!usedKeys.has(key) && picked.length < 5) {
        usedKeys.add(key)
        picked.push(entry)
      }
    }
    // Restore progress if date is same (shouldn't happen but just in case)
    const prevById = Object.fromEntries(dailyMissions.value.map(m => [m.id, m]))
    dailyMissions.value = picked.map((entry, i) => {
      const vIdx = Math.floor(rand() * entry.variants.length)
      const variant = entry.variants[Math.min(vIdx, entry.variants.length - 1)]!
      const id = `m${i}_${today.replace(/-/g, '')}`
      const prev = prevById[id]
      return prev ?? {
        id,
        kind: entry.kind,
        shipId: entry.shipId,
        desc: variant.desc,
        target: variant.target,
        progress: 0,
        completed: false,
        claimed: false,
        reward: variant.reward,
      }
    })
    saveProgress()
  }

  function updateRunMissions() {
    if (dailyMissions.value.length === 0) return
    const runScore    = currentScore.value
    const runKills    = sessionKillsTotal.value
    const runGold     = goldEarnedThisRun.value
    const runStage    = Math.max(0, currentStage.value - 1)
    const runBoss     = sessionBossKillsTotal.value
    const playTimeSec = Math.floor((Date.now() - sessionStartMs.value) / 1000)
    const cardsPicked = sessionCardsChosen.value
    const levelReached = playerLevel.value
    const shipUsed    = selectedShip.value
    let changed = false
    dailyMissions.value = dailyMissions.value.map(m => {
      if (m.completed) return m
      const updated = { ...m }
      switch (m.kind) {
        case 'score':          if (runScore     >= m.target) updated.progress = m.target; break
        case 'kills':          if (runKills     >= m.target) updated.progress = m.target; break
        case 'earn_gold':      if (runGold      >= m.target) updated.progress = m.target; break
        case 'reach_stage':    if (runStage     >= m.target) updated.progress = m.target; break
        case 'kill_boss':      updated.progress = Math.min(m.target, m.progress + runBoss); break
        case 'play_with_ship': if (m.shipId === shipUsed) updated.progress = Math.min(m.target, m.progress + 1); break
        case 'play_time':      if (playTimeSec  >= m.target) updated.progress = m.target; break
        case 'choose_upgrades': if (cardsPicked >= m.target) updated.progress = m.target; break
        case 'earn_upgrades':  if (levelReached >= m.target) updated.progress = m.target; break
      }
      if (updated.progress >= m.target) updated.completed = true
      if (updated.progress !== m.progress || updated.completed !== m.completed) changed = true
      return updated
    })
    if (changed) saveProgress()
  }

  function claimMissionReward(id: string) {
    const m = dailyMissions.value.find(x => x.id === id)
    if (!m || !m.completed || m.claimed) return
    dailyMissions.value = dailyMissions.value.map(x => x.id === id ? { ...x, claimed: true } : x)
    if (m.reward.coins)      playerCoins.value  += m.reward.coins
    if (m.reward.ruby)       playerRuby.value   += m.reward.ruby
    if (m.reward.accountExp) addAccountExp(m.reward.accountExp)
    saveProgress()
  }

  function claimMilestone(which: 3 | 5) {
    const doneCount = dailyMissions.value.filter(m => m.completed).length
    if (which === 3) {
      if (doneCount < 3 || milestone3Claimed.value) return
      milestone3Claimed.value = true
      playerCoins.value += 400
      addAccountExp(100)
    } else {
      if (doneCount < 5 || milestone5Claimed.value) return
      milestone5Claimed.value = true
      playerRuby.value += 5
    }
    saveProgress()
  }

  function activateAdmin() {
    isAdminMode.value = true
    playerCoins.value = 99999
    playerRuby.value = 999
    ownedShips.value = ['star_keeper', 'star_holder']
    ownedArtifacts.value = ALL_ARTIFACT_DEFS.map(a => a.id)
    shipDurabilities.value = { ...SHIP_DURABILITY_MAX }
    dailyMissions.value = dailyMissions.value.map(m =>
      ({ ...m, progress: m.target, completed: true })
    )
    saveProgress()
  }

  function sanitizeLoadedStateForNonAdmin() {
    playerCoins.value = Math.max(0, Math.floor(playerCoins.value))
    playerRuby.value = Math.max(0, Math.floor(playerRuby.value))
    highScore.value = Math.max(0, Math.floor(highScore.value))
    accountLevel.value = Math.max(1, Math.floor(accountLevel.value))
    accountExp.value = Math.max(0, Math.floor(accountExp.value))

    const validShipIds = new Set(Object.keys(SHIP_DEFS))
    const safeOwnedShips = ownedShips.value.filter(id => validShipIds.has(id))
    ownedShips.value = safeOwnedShips.length > 0 ? [...new Set(safeOwnedShips)] : ['star_keeper']
    if (!ownedShips.value.includes(selectedShip.value)) selectedShip.value = ownedShips.value[0] ?? 'star_keeper'

    const validAchievementIds = new Set(ALL_ACHIEVEMENTS.map(a => a.id))
    unlockedAchievements.value = [...new Set(unlockedAchievements.value.filter(id => validAchievementIds.has(id)))]

    const validEnemyKinds = new Set<EnemyKind>(ALL_ENEMY_KINDS)
    encounteredEnemyKinds.value = [...new Set(encounteredEnemyKinds.value.filter(kind => validEnemyKinds.has(kind as EnemyKind)))] as EnemyKind[]

    const validNoticeIds = new Set(UPDATE_NOTICES.map(n => n.id))
    updateNoticeSeenIds.value = [...new Set(updateNoticeSeenIds.value.filter(id => validNoticeIds.has(id)))]

    const perm = { ...permUpgrades.value }
    for (const def of PERM_UPGRADE_DEFS) {
      const maxLv = def.costs.length
      const lv = Math.floor(Math.max(0, perm[def.key] ?? 0))
      perm[def.key] = Math.min(maxLv, lv)
    }
    permUpgrades.value = perm

    const validArtifactIds = new Set(ALL_ARTIFACT_DEFS.map(a => a.id))
    ownedArtifacts.value = [...new Set(ownedArtifacts.value.filter(id => validArtifactIds.has(id)))]

    const nextEquip: Record<string, string[]> = {}
    for (const shipId of Object.keys(SHIP_ARTIFACT_SLOTS)) {
      const slots = SHIP_ARTIFACT_SLOTS[shipId] ?? 1
      const list = equippedArtifacts.value[shipId] ?? []
      nextEquip[shipId] = [...new Set(list.filter(id => ownedArtifacts.value.includes(id) && validArtifactIds.has(id)))].slice(0, slots)
    }
    equippedArtifacts.value = nextEquip
  }

  function saveProgress() {
    const data = {
      version: SAVE_VERSION,
      playerCoins: playerCoins.value,
      playerRuby: playerRuby.value,
      highScore: highScore.value,
      username: username.value,
      avatarId: avatarId.value,
      shipName: shipName.value,
      updateNoticeSeenIds: updateNoticeSeenIds.value,
      // Account progression
      accountLevel: accountLevel.value,
      accountExp: accountExp.value,
      // Ships
      ownedShips: ownedShips.value,
      selectedShip: selectedShip.value,
      shipUpgrades: shipUpgrades.value,
      // Achievements
      unlockedAchievements: unlockedAchievements.value,
      encounteredEnemyKinds: encounteredEnemyKinds.value,
      // Permanent upgrades
      permUpgrades: permUpgrades.value,
      // Artifacts
      ownedArtifacts: ownedArtifacts.value,
      equippedArtifacts: equippedArtifacts.value,
      // Durability
      shipDurabilities: shipDurabilities.value,
      durabilityLastSave: Date.now(),
      // Daily missions
      dailyMissions: dailyMissions.value,
      dailyDate: dailyDate.value,
      milestone3Claimed: milestone3Claimed.value,
      milestone5Claimed: milestone5Claimed.value,
      audioSettings: audioSettings.value,
    }
    const envelope = buildSaveEnvelope(data as Record<string, unknown>)
    const prev = localStorage.getItem(SAVE_KEY)
    if (prev) localStorage.setItem(SAVE_BACKUP_KEY, prev)
    const serialized = JSON.stringify(envelope)
    localStorage.setItem(SAVE_KEY, serialized)
    queueMirrorSave(serialized)
    // Ghi timestamp để dùng cho conflict resolution
    saveUpdatedAt.value = new Date().toISOString()
    // Push lên Supabase nếu online, nếu không thì đặt cờ pendingSync
    void pushToSupabase()
  }

  /** Push dữ liệu save hiện tại lên Supabase (nội bộ hoặc khi liên kết). */
  async function pushToSupabase(): Promise<void> {
    // Import inline để tránh circular dependency với authStore
    const { useAuthStore } = await import('./authStore')
    const auth = useAuthStore()
    if (!auth.isLoggedIn || !auth.userId) { pendingSync.value = true; return }
    if (!isOnline.value) { pendingSync.value = true; return }
    const saved = localStorage.getItem(SAVE_KEY)
    if (!saved) return
    let payload: Record<string, unknown>
    try { payload = (JSON.parse(saved) as { payload: Record<string, unknown> }).payload } catch { return }
    const ok = await pushSave(auth.userId, SAVE_VERSION, payload)
    if (ok) {
      pendingSync.value = false
      void ensureProfile(auth.userId, username.value, avatarId.value)
    } else {
      pendingSync.value = true
    }
  }

  /** Pull dữ liệu từ Supabase và merge nếu cần (gọi khi startup). */
  async function pullFromSupabase(): Promise<void> {
    const { useAuthStore } = await import('./authStore')
    const auth = useAuthStore()
    if (!auth.isLoggedIn || !auth.userId) return
    if (!isOnline.value) return
    const remote = await pullSave(auth.userId)
    if (!remote) return
    const decision = resolveConflict(saveUpdatedAt.value, SAVE_VERSION, remote)
    if (decision === 'remote') {
      // Áp dụng dữ liệu từ server
      const remotePayload = remote.payload
      // Backup local trước
      const localSaved = localStorage.getItem(SAVE_KEY)
      if (localSaved) localStorage.setItem(SAVE_BACKUP_KEY, localSaved)
      _applyDataToStore(remotePayload)
      if (!isAdminMode.value) sanitizeLoadedStateForNonAdmin()
      saveProgress()
      console.info('[Sync] Đã tải dữ liệu từ cloud (server mới hơn local).')
    } else if (decision === 'local') {
      // Local mới hơn → push lên server
      void pushToSupabase()
    }
  }

  function _applyDataToStore(data: Record<string, unknown>) {
    playerCoins.value             = (data.playerCoins as number)             ?? 0
    playerRuby.value              = (data.playerRuby as number)              ?? 0
    highScore.value               = (data.highScore as number)               ?? 0
    username.value                = (data.username as string)                ?? 'Phi Công'
    avatarId.value                = (data.avatarId as number)                ?? 0
    shipName.value                = (data.shipName as string)                ?? 'Chiến Cơ Alpha'
    const rawNoticeIds = (data.updateNoticeSeenIds as string[]) ?? []
    const validNoticeIds = new Set(UPDATE_NOTICES.map(n => n.id))
    updateNoticeSeenIds.value = [...new Set(rawNoticeIds.filter(id => validNoticeIds.has(id)))]
    accountLevel.value            = (data.accountLevel as number)            ?? 1
    accountExp.value              = (data.accountExp as number)              ?? 0
    ownedShips.value              = (data.ownedShips as string[])            ?? ['star_keeper']
    selectedShip.value            = (data.selectedShip as string)            ?? 'star_keeper'
    const rawShipUpgrades = (data.shipUpgrades as Record<string, Partial<ShipUpgradeLevels>>) ?? {}
    shipUpgrades.value = {
      star_keeper: {
        hp: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.star_keeper?.hp ?? 0))),
        fireRate: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.star_keeper?.fireRate ?? 0))),
        damage: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.star_keeper?.damage ?? 0))),
      },
      star_holder: {
        hp: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.star_holder?.hp ?? 0))),
        fireRate: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.star_holder?.fireRate ?? 0))),
        damage: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.star_holder?.damage ?? 0))),
      },
      star_shooter: {
        hp: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.star_shooter?.hp ?? 0))),
        fireRate: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.star_shooter?.fireRate ?? 0))),
        damage: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.star_shooter?.damage ?? 0))),
      },
      star_faster: {
        hp: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.star_faster?.hp ?? 0))),
        fireRate: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.star_faster?.fireRate ?? 0))),
        damage: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.star_faster?.damage ?? 0))),
      },
      thien_ha_truy: {
        hp: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.thien_ha_truy?.hp ?? 0))),
        fireRate: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.thien_ha_truy?.fireRate ?? 0))),
        damage: Math.max(0, Math.min(SHIP_UPGRADE_MAX_LEVEL, Math.floor(rawShipUpgrades.thien_ha_truy?.damage ?? 0))),
      },
    }
    unlockedAchievements.value    = (data.unlockedAchievements as string[])  ?? []
    encounteredEnemyKinds.value   = ((data.encounteredEnemyKinds as EnemyKind[]) ?? []).filter(k => ALL_ENEMY_KINDS.includes(k))
    const pu = (data.permUpgrades as Record<string, number>) ?? {}
    permUpgrades.value = {
      baseDamage:  pu.baseDamage  ?? 0,
      baseHp:      pu.baseHp      ?? 0,
      baseSpeed:   pu.baseSpeed   ?? 0,
      expBonus:    pu.expBonus    ?? 0,
      bulletCount: pu.bulletCount ?? 0,
      fireRate:    pu.fireRate    ?? 0,
    }
    ownedArtifacts.value    = (data.ownedArtifacts as string[])                           ?? []
    equippedArtifacts.value = (data.equippedArtifacts as Record<string, string[]>)        ?? {}
    // Durability — apply offline regen
    const savedDurs = (data.shipDurabilities as Record<string, number>) ?? {}
    const lastSave  = (data.durabilityLastSave as number) ?? Date.now()
    const minutesPassed = Math.floor((Date.now() - lastSave) / 60000)
    const regenDurs: Record<string, number> = {}
    for (const [shipId, maxDur] of Object.entries(SHIP_DURABILITY_MAX)) {
      const cur = savedDurs[shipId] ?? maxDur
      regenDurs[shipId] = Math.min(maxDur, cur + minutesPassed)
    }
    shipDurabilities.value  = regenDurs
    dailyDate.value         = (data.dailyDate as string)          ?? ''
    dailyMissions.value     = (data.dailyMissions as DailyMission[]) ?? []
    milestone3Claimed.value = (data.milestone3Claimed as boolean) ?? false
    milestone5Claimed.value = (data.milestone5Claimed as boolean) ?? false

    const loadedAudio = (data.audioSettings as Partial<AudioSettings>) ?? {}
    audioSettings.value = {
      enabled: typeof loadedAudio.enabled === 'boolean' ? loadedAudio.enabled : DEFAULT_AUDIO_SETTINGS.enabled,
      musicEnabled: typeof loadedAudio.musicEnabled === 'boolean' ? loadedAudio.musicEnabled : DEFAULT_AUDIO_SETTINGS.musicEnabled,
      sfxEnabled: typeof loadedAudio.sfxEnabled === 'boolean' ? loadedAudio.sfxEnabled : DEFAULT_AUDIO_SETTINGS.sfxEnabled,
      masterVolume: Math.max(0, Math.min(1, Number(loadedAudio.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume))),
      musicVolume: Math.max(0, Math.min(1, Number(loadedAudio.musicVolume ?? DEFAULT_AUDIO_SETTINGS.musicVolume))),
      sfxVolume: Math.max(0, Math.min(1, Number(loadedAudio.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume))),
    }
    audioManager.setSettings(audioSettings.value)
  }

  // Migration stubs — thêm case mới khi cấu trúc save thay đổi.
  // Mỗi hàm nhận raw object v(N) và trả ra object đã migrate lên v(N+1).
  function _migrateV0toV1(d: Record<string, unknown>): Record<string, unknown> {
    // v0 (chưa có trường version) → v1: không thay đổi cấu trúc, chỉ thêm trường version.
    return { ...d, version: 1 }
  }

  function tryLoadSerializedSave(saved: string): boolean {
    try {
      const parsed = JSON.parse(saved) as unknown
      let data: Record<string, unknown> | null = null
      let verifyMode: SaveVerifyMode = 'ok'

      if (isSaveEnvelope(parsed)) {
        verifyMode = getSaveVerificationMode(parsed)
        if (!isAdminMode.value && verifyMode === 'invalid') {
          localStorage.setItem(SAVE_REJECTED_KEY, saved)
          return false
        }
        data = parsed.payload
      } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Legacy plain-object save. Load once then re-save in signed format.
        data = parsed as Record<string, unknown>
      }

      if (!data) return false

      // -- Migration chain -------------------------------------------------
      const ver = typeof data.version === 'number' ? data.version : 0
      if (ver < 1) data = _migrateV0toV1(data)
      // -------------------------------------------------------------------
      _applyDataToStore(data)
      if (!isAdminMode.value) sanitizeLoadedStateForNonAdmin()
      // Re-save if migrated, legacy format, or verified by legacy signature.
      if (ver < SAVE_VERSION || !isSaveEnvelope(parsed) || verifyMode === 'legacy-ok') saveProgress()
      return true
    } catch {
      localStorage.setItem(SAVE_REJECTED_KEY, saved)
      return false
    }
  }

  async function tryRecoverFromMirrorFile(): Promise<boolean> {
    const mirrored = await readMirrorSave()
    if (!mirrored) return false
    const ok = tryLoadSerializedSave(mirrored)
    if (!ok) return false
    // Keep localStorage synchronized after a successful mirror recovery.
    saveProgress()
    return true
  }

  function loadProgress() {
    const saveCandidates = [
      localStorage.getItem(SAVE_KEY),
      localStorage.getItem(SAVE_BACKUP_KEY),
    ]

    let loaded = false

    for (const saved of saveCandidates) {
      if (!saved) continue
      if (tryLoadSerializedSave(saved)) {
        loaded = true
        break
      }
    }

    if (!loaded) {
      void tryRecoverFromMirrorFile().finally(() => {
        generateDailyMissions()
        void pullFromSupabase()
      })
      return
    }

    // Refresh/generate today's missions after loading
    generateDailyMissions()
    // Đồng bộ từ Supabase sau khi load local xong
    void pullFromSupabase()
  }

  /** Xuất dữ liệu game ra file JSON để người dùng tự bảo quản. */
  function exportSave() {
    const saved = localStorage.getItem(SAVE_KEY)
    if (!saved) return
    const blob = new Blob([saved], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    const d = new Date()
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    a.download = `ban-may-bay-save-${stamp}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Nạp lại dữ liệu từ chuỗi JSON (do người dùng cung cấp qua file).
   * Trả về true nếu thành công.
   */
  function importSave(jsonStr: string): boolean {
    try {
      const raw = JSON.parse(jsonStr) as unknown
      if (isSaveEnvelope(raw)) {
        if (!isAdminMode.value && getSaveVerificationMode(raw) === 'invalid') return false
        const serialized = JSON.stringify(raw)
        localStorage.setItem(SAVE_KEY, serialized)
        queueMirrorSave(serialized)
      } else {
        // Chỉ admin mới được import save dạng không ký.
        if (!isAdminMode.value) return false
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false
        const serialized = JSON.stringify(raw)
        localStorage.setItem(SAVE_KEY, serialized)
        queueMirrorSave(serialized)
      }
      loadProgress()
      return true
    } catch {
      return false
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
    updateNoticeSeenIds,
    audioSettings,
    // Account
    accountLevel,
    accountExp,
    accountExpToNextLevel,
    accountExpPercent,
    // Ships
    ownedShips,
    selectedShip,
    shipUpgrades,
    selectedShipFireRateMult,
    getShipBaseStats,
    getShipMaxStats,
    getShipEffectiveStats,
    getShipUpgradeLevel,
    getShipUpgradeCost,
    buyShipUpgrade,
    // Achievements
    unlockedAchievements,
    encounteredEnemyKinds,
    hasEncounteredEnemy,
    markEnemyEncountered,
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
    consumePendingHealPopup,
    upgradeShip,
    triggerLevelUp,
    chooseCard,
    saveProgress,
    loadProgress,
    isUpdateNoticeSeen,
    markUpdateNoticeSeen,
    markAllUpdateNoticesSeen,
    unlockAchievement,
    buyPermUpgrade,
    skillCooldown,
    skillActivationPending,
    fragmentCount,
    isSkillReady,
    activateSkill,
    tickSkillCooldown,
    consumeSkillActivation,
    reduceSkillCooldown,
    tickShield,
    absorbShieldHit,
    buyShip,
    selectShip,
    // Artifacts
    ownedArtifacts,
    equippedArtifacts,
    artifactStats,
    neutronVacuumPct,
    manaCorePct,
    buyArtifact,
    equipArtifact,
    unequipArtifact,
    // Durability
    shipDurabilities,
    canUseShip,
    consumeDurability,
    tickDurabilityRegen,
    // Daily missions
    dailyMissions,
    dailyDate,
    milestone3Claimed,
    milestone5Claimed,
    generateDailyMissions,
    claimMissionReward,
    claimMilestone,
    // Admin
    isAdminMode,
    activateAdmin,
    // Kill tracking (called from GameCanvas)
    addKill,
    addBossKill,
    // Save management
    exportSave,
    importSave,
    updateAudioSettings,
    // Supabase sync
    pendingSync,
    pullFromSupabase,
    pushToSupabase,
    // Test mode
    testMode,
  }
})
