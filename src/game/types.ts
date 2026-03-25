import type { Graphics, Container, Text } from 'pixi.js'

// ─── Entity types ──────────────────────────────────────────────────────────────
export interface Bullet {
  gfx: Graphics
  vy: number
  vx?: number
  damage?: number
  pierceLeft?: number
  pierceDmgMult?: number
}

export interface AllyDrone {
  gfx: Graphics
  angle: number
  shootTimer: number
  burstRemaining: number
  burstTimer: number
}

export type EnemyKind = 'pioneer' | 'kamikaze' | 'sniper' | 'boss_stardestroyer' | 'boss_invader'
  | 'dai_lien' | 'thu_ho' | 'thuat_si' | 'boss_tinhvan' | 'boss_trumso'
  | 'cnox_greedy' | 'cnox_shield' | 'cnox_spark' | 'boss_cnox_sun' | 'boss_cnox_moon'
  | 'dnox_fire' | 'dnox_ice' | 'dnox_soil'
export type KamiState = 'descend' | 'aim' | 'charge' | 'prexplode' | 'dead'
export type BossAttack2State = 'ready' | 'locking'
export type PioneerPhase = 'enter' | 'patrol' | 'approach'

export interface BossTurret {
  gfx: Graphics
  hpBarBg: Graphics
  hpBar: Graphics
  hp: number
  maxHp: number
  offsetX: number
  offsetY: number
  stunTimer: number
  shootTimer: number
  attached: boolean
  kamiTimer: number
  laserState: 'idle' | 'warning' | 'firing'
  laserTimer: number
  laserWarnTimer: number
  laserAngle: number
  laserGfx: Graphics
}

export interface Enemy {
  container: Container
  body: Graphics
  hpBarBg: Graphics
  hpBar: Graphics
  kind: EnemyKind
  vy: number
  vx: number
  hp: number
  maxHp: number
  barW: number
  contactDamageCd?: number
  // kamikaze
  kamiState?: KamiState
  kamiTimer?: number
  warnSign?: Text
  aimLine?: Graphics
  targetX?: number
  targetY?: number
  // sniper
  shootTimer?: number
  dodgeCooldown?: number
  dodgeTarget?: number
  // boss_stardestroyer
  bossEntered?: boolean
  bossBattleReady?: boolean   // true after entry + zoom + 1s delay
  bossBattleTimer?: number    // countdown after zoom completes
  bossTargetY?: number
  bossPhase?: 1 | 2 | 3
  attack1Timer?: number
  attack2Timer?: number
  bossAttack2State?: BossAttack2State
  laserLockTimer?: number
  laserLine?: Graphics
  laserTargetX?: number
  laserTargetY?: number
  pendingMissiles?: number
  missileFireTimer?: number
  bossDriftTarget?: number
  bossDriftTimer?: number
  bossLabel?: Text
  // formation / pioneer squad
  pioneerPhase?: PioneerPhase
  formTargetX?: number
  formTargetY?: number
  enterTargetX?: number
  enterTargetY?: number
  approachTimer?: number
  squadId?: number
  formOffsetX?: number
  formOffsetY?: number
  // boss_invader
  bossTurrets?: BossTurret[]
  // dai_lien — reuses shootTimer, pioneerPhase, formTargetX/Y
  // thu_ho (guardian)
  reflectCooldown?: number
  isReflecting?: boolean
  // thuat_si (healer)
  healTarget?: Enemy | null
  healBeamGfx?: Graphics
  isDyingMeteor?: boolean
  meteorVx?: number
  meteorVy?: number
  // cnox_greedy
  cnoxStolenExp?: number
  cnoxPowerMult?: number
  dnoxSoilHasteMult?: number
  dnoxFireCoolTimer?: number
  cnoxBaseMaxHp?: number
  cnoxBaseBarW?: number
  cnoxBaseSize?: number
  // cnox_shield
  cnoxShields?: Graphics[]
  cnoxShieldAngle?: number
  // Star Faster ultimate (Vết thương sâu)
  starFasterWoundBonus?: number
  // cnox_spark
  cnoxLaserGfx?: Graphics
  cnoxWarnGfx?: Graphics
  cnoxLaserState?: 'idle' | 'warning' | 'firing' | 'link_warning' | 'link_firing'
  cnoxLaserTimer?: number
  cnoxLaserAngle?: number
  cnoxLinkOrder?: number
  // boss_tinhvan
  tinhVanGuns?: TinhVanGun[]
  blackHoles?: BlackHoleEntity[]
  summonPortalGfx?: Graphics
  // boss_trumso
  trumSoGuns?: TrumSoGun[]
  trumSoLasers?: TrumSoLaser[]
  trumSoPhase2LaserGfx?: Graphics
  trumSoCharge?: 'idle' | 'warning' | 'charging'
  trumSoChargeTimer?: number
  trumSoChargeLane?: number
  trumSoChargeLineGfx?: Graphics
  trumSoContinuousDmgTimer?: number
  trumSoPhase2LaserState?: 'idle' | 'warning' | 'firing'
  trumSoPhase2LaserAngle?: number
  // boss_cnox_sun
  sunStars?: SunWeaponStar[]
  sunEnergyCrystals?: SunEnergyCrystal[]
  sunCrystalSpawnCd?: number
  sunAttackQueue?: Array<'triangle' | 'circle' | 'diamond' | 'pentagon'>
  sunActiveStars?: Array<'triangle' | 'circle' | 'diamond' | 'pentagon'>
  sunDiamondCooldownPicks?: number
  sunLinkGfx?: Graphics
  sunCoreLaserGfx?: Graphics
  sunCoreSpin?: number
  sunCoreLaserState?: 'idle' | 'warning' | 'firing'
  sunCoreLaserTimer?: number
  sunCoreLaserAngle?: number
  sunCoreLaserStartAngle?: number
  sunCoreLaserSweepSpan?: number

  // boss_cnox_moon
  moonEnergy?: number
  moonMaxEnergy?: number
  moonRecoveryMode?: boolean
  moonWeapons?: MoonWeapon[]
  moonAttackQueue?: Array<'sword' | 'shield' | 'staff' | 'bow'>
  moonActiveWeapon?: 'sword' | 'shield' | 'staff' | 'bow' | null

}

export interface SunWeaponStar {
  kind: 'triangle' | 'circle' | 'diamond' | 'pentagon'
  gfx: Graphics
  warningGfx: Graphics
  beamGfx: Graphics
  orbitAngle: number
  orbitRadius: number
  attackPush?: number
  state: 'idle' | 'warning' | 'firing' | 'cooldown'
  timer: number
  burstLeft?: number
  targetX?: number
  targetY?: number
  missileTargets?: Array<{ x: number, y: number }>
  missileIndex?: number
  attackAngle?: number
}

export interface SunEnergyCrystal {
  gfx: Graphics
  x: number
  y: number
  hp: number
  maxHp: number
  contactDamageCd?: number
}

export interface MoonWeapon {
  kind: 'sword' | 'shield' | 'staff' | 'bow'
  gfx: Graphics
  state: 'idle' | 'attack_charge' | 'attack_strike' | 'return' | 'broken'
  hp: number
  maxHp: number
  baseOffset: { x: number, y: number }
  timer: number
  attackType?: 'stab' | 'slash'
  targetX?: number
  targetY?: number
  warningGfx: Graphics
}


export interface TrumSoGun {
  gfx: Graphics
  offsetX: number
  offsetY: number
  type: 'machinegun' | 'missile'
  timer: number
  burstLeft: number
  rapidTimer: number
}

export interface TrumSoLaser {
  gfx: Graphics
  offsetX: number
  offsetY: number
  state: 'idle' | 'warning' | 'firing'
  timer: number
  angle: number
}

export interface TinhVanGun {
  gfx: Graphics
  offsetX: number
  offsetY: number
  shootTimer: number
  burstLeft: number
  pauseTimer: number
}

export interface BlackHoleEntity {
  gfx: Graphics
  x: number
  y: number
  r: number
  age: number
  maxAge: number
  portal?: boolean       // phase 2 summon portal: no pull, no age-removal, purple vortex
  lastPlayerX?: number  // track player position for escape resistance
  lastPlayerY?: number
}

export interface EnemyBullet {
  gfx: Graphics
  vx: number
  vy: number
  homing?: boolean
  homingLife?: number
  homingSpeed?: number
  homingRange?: number
  onHitPlayer?: () => void
  aoe?: boolean
  targetX?: number
  targetY?: number
  damage?: number   // override default hit damage (e.g. 50% for reflected)
  sunShardBurst?: boolean
  sunShardCount?: number
  missileTrail?: boolean
  missileTrailColor?: number
  trailPulse?: number
}

export interface StarBg {
  gfx: Graphics
  vy: number
}

export interface DamageText {
  gfx: Text
  vy: number
  life: number
}

export interface ExpCollectParticle {
  gfx: Graphics
  x: number
  y: number
  vx: number
  vy: number
  targetX: number
  targetY: number
  life: number
  maxLife: number
}

export type OrbTier = 'white' | 'blue' | 'purple' | 'gold'

export interface ExpOrb {
  gfx: Graphics
  x: number
  y: number
  vy: number
  amount: number
  tier: OrbTier
}

export interface FragmentOrb {
  gfx: Graphics
  x: number
  y: number
  vy: number
  age: number
}

export interface FragmentMissile {
  gfx: Graphics
  vx: number
  vy: number
}

export type GamePhase = 'intro' | 'stageTitle' | 'bossIntro' | 'playing'

export interface MissileLauncher {
  gfx: Graphics
  angle: number
  timer: number
}

export interface PlayerMissile {
  gfx: Graphics
  vx: number
  vy: number
  damage: number
  aoe: boolean
  targetEnemy?: Enemy
  targetX?: number
  targetY?: number
}

export type WaveSpawner = () => void

export interface FlockState {
  x: number
  y: number
  tx: number
  ty: number
  timer: number
}
