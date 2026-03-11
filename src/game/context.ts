import type { Application, Graphics, Container, Text } from 'pixi.js'
import type {
  Bullet, Enemy, EnemyBullet, StarBg, DamageText, ExpOrb,
  FragmentOrb, FragmentMissile, MissileLauncher, PlayerMissile,
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
  enemies: Enemy[]
  enemyBullets: EnemyBullet[]
  expOrbs: ExpOrb[]
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

  // Input
  isDragging: boolean
  touchX: number
  touchY: number
  shootTimer: number
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
    enemies: [],
    enemyBullets: [],
    expOrbs: [],
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
    neutronVacuumTimer: 0,
    manaCoreKillCount: 0,
    manaCoreOverloadPending: false,
    artifactOrbitAngle: 0,
    artifactGfx: null,
    soulMissileQueue: 0,
    soulMissileFireTimer: 0,
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
    isDragging: false,
    touchX: 0,
    touchY: 0,
    shootTimer: 0,
  }
}
