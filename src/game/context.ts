import type { Application, Graphics, Container, Text } from 'pixi.js'
import type {
  AllyDrone, Bullet, Enemy, EnemyBullet, StarBg, DamageText, ExpOrb,
  ExpCollectParticle, FragmentOrb, FragmentMissile, MissileLauncher, PlayerMissile,
  WaveSpawner, FlockState, GamePhase,
} from './types'

export interface GameContext {
  // PixiJS
  app: Application | null
  gameLayer: Container
  bgLayer: Container
  uiLayer: Container

  // Player
  playerShip: Graphics | null
  shieldGfx: Graphics | null

  // Entities
  bullets: Bullet[]
  allyDrones: AllyDrone[]
  enemies: Enemy[]
  enemyBullets: EnemyBullet[]
  expOrbs: ExpOrb[]
  expCollectParticles: ExpCollectParticle[]
  fragmentOrbs: FragmentOrb[]
  fragmentMissiles: FragmentMissile[]
  stars: StarBg[]
  damageTexts: DamageText[]

  // Card ability state
  missileLaunchers: MissileLauncher[]
  playerMissiles: PlayerMissile[]
  pbTimer: number
  cbTimer: number
  lsTimer: number
  sfDmgTimer: number
  sfGfx: Graphics | null
  regenTimer: number

  // Artifact state
  neutronVacuumTimer: number
  manaCoreKillCount: number
  /** Set by killEnemy when threshold reached; game loop calls activateManaCoreOverload */
  manaCoreOverloadPending: boolean
  artifactOrbitAngle: number
  artifactGfx: Graphics | null

  // Soul missile queue (Star Holder)
  soulMissileQueue: number
  soulMissileFireTimer: number

  // Thủ Hộ (Guardian) global reflect state
  thuHoReflectTimer: number
  thuHoReflecting: boolean
  thuHoReflectGlow: number

  // Faction system (rotates every 5 stages, no same faction twice in a row)
  activeFaction: 'anox' | 'bnox' | 'cnox' | 'dnox'
  lastFaction: 'anox' | 'bnox' | 'cnox' | 'dnox'
  factionBlock: number

  // Boss zoom (smooth scale-out when Tinh Vân boss is active)
  bossZoom: number
  bossZoomTarget: number
  bossAttackLockTimer: number

  // Wave / stage state
  waveQueue: WaveSpawner[]
  waveDispatchTimer: number
  waveIsClearing: boolean
  stageClearTimer: number
  stageAnnouncePending: boolean

  // Pioneer flock state
  flockStates: Map<number, FlockState>
  nextSquadId: number

  // Game phase
  gamePhase: GamePhase
  introTimer: number
  stageTitleText: Text | null
  stageTitleTimer: number

  // Star Shooter
  shooterMissiles: PlayerMissile[]
  shooterMissileTimer: number
  shooterBlackHoleGfx: Graphics | null
  shooterBlackHoleTimer: number
  shooterBlackHoleDamageTick: number
  shooterBlackHoleProjGfx: Graphics | null
  shooterBlackHoleProjTX: number
  shooterBlackHoleProjTY: number

  // Star Faster
  starFasterSkillTimer: number
  starFasterEnemySlowFactor: number
  starFasterFireRateBoost: number

  // Input
  isDragging: boolean
  touchX: number
  touchY: number
  shootTimer: number

  // Prevent laser beams from applying damage every single frame.
  playerLaserDamageCd: number
}

export function createGameContext(): GameContext {
  return {
    app: null,
    gameLayer: null as unknown as Container,
    bgLayer: null as unknown as Container,
    uiLayer: null as unknown as Container,
    playerShip: null,
    shieldGfx: null,
    bullets: [],
    allyDrones: [],
    enemies: [],
    enemyBullets: [],
    expOrbs: [],
    expCollectParticles: [],
    fragmentOrbs: [],
    fragmentMissiles: [],
    stars: [],
    damageTexts: [],
    missileLaunchers: [],
    playerMissiles: [],
    pbTimer: 0,
    cbTimer: 0,
    lsTimer: 0,
    sfDmgTimer: 0,
    sfGfx: null,
    regenTimer: 0,
    neutronVacuumTimer: 0,
    manaCoreKillCount: 0,
    manaCoreOverloadPending: false,
    artifactOrbitAngle: 0,
    artifactGfx: null,
    soulMissileQueue: 0,
    soulMissileFireTimer: 0,
    thuHoReflectTimer: 300,
    thuHoReflecting: false,
    thuHoReflectGlow: 0,
    ...(() => {
      const factions: Array<'anox' | 'bnox' | 'cnox' | 'dnox'> = ['anox', 'bnox', 'cnox', 'dnox']
      const f = factions[Math.floor(Math.random() * factions.length)]!
      const last = factions.find(x => x !== f) ?? 'anox'
      return { activeFaction: f, lastFaction: last, factionBlock: 0 }
    })(),
    bossZoom: 1.0,
    bossZoomTarget: 1.0,
    bossAttackLockTimer: 0,
    waveQueue: [],
    waveDispatchTimer: 0,
    waveIsClearing: false,
    stageClearTimer: 0,
    stageAnnouncePending: false,
    flockStates: new Map(),
    nextSquadId: 0,
    gamePhase: 'intro',
    introTimer: 0,
    stageTitleText: null,
    stageTitleTimer: 0,
    shooterMissiles: [],
    shooterMissileTimer: 0,
    shooterBlackHoleGfx: null,
    shooterBlackHoleTimer: 0,
    shooterBlackHoleDamageTick: 0,
    shooterBlackHoleProjGfx: null,
    shooterBlackHoleProjTX: 0,
    shooterBlackHoleProjTY: 0,
    starFasterSkillTimer: 0,
    starFasterEnemySlowFactor: 1,
    starFasterFireRateBoost: 1,
    isDragging: false,
    touchX: 0,
    touchY: 0,
    shootTimer: 0,
    playerLaserDamageCd: 0,
  }
}
