import type { Graphics, Container, Text } from 'pixi.js'

// ─── Entity types ──────────────────────────────────────────────────────────────
export interface Bullet {
  gfx: Graphics
  vy: number
  vx?: number
}

export type EnemyKind = 'pioneer' | 'kamikaze' | 'sniper' | 'boss_stardestroyer' | 'boss_invader'
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
  bossTargetY?: number
  bossPhase?: 1 | 2
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
}

export interface EnemyBullet {
  gfx: Graphics
  vx: number
  vy: number
  homing?: boolean
  homingLife?: number
  homingSpeed?: number
  onHitPlayer?: () => void
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

export type GamePhase = 'intro' | 'stageTitle' | 'playing'

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
}

export type WaveSpawner = () => void

export interface FlockState {
  x: number
  y: number
  tx: number
  ty: number
  timer: number
}
