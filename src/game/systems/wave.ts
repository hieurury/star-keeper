import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { WaveSpawner } from '../types'
import { spawnPioneerSquad } from '../entities/Pioneer'
import { spawnKamikaze } from '../entities/Kamikaze'
import { spawnSniperGroup } from '../entities/Sniper'
import { spawnStarDestroyer } from '../entities/BossStarDestroyer'
import { spawnBossInvader } from '../entities/BossInvader'
import { spawnBossTinhVan } from '../entities/BossTinhVan'
import { spawnBossTrumSo } from '../entities/BossTrumSo'
import { spawnBossCnoxSun } from '../entities/BossCnoxSun'

import { spawnDaiLienPair } from '../entities/DaiLien'
import { spawnThuHoSwarm } from '../entities/ThuHo'
import { spawnThuatSi } from '../entities/ThuatSi'
import { spawnCnoxGreedy } from '../entities/CnoxGreedy'
import { spawnCnoxShieldWall } from '../entities/CnoxShield'
import { spawnCnoxSparkGroup } from '../entities/CnoxSpark'
import { spawnDnoxFireSquad } from '../entities/DnoxFire'
import { spawnDnoxIce } from '../entities/DnoxIce'
import { spawnDnoxSoilGroup } from '../entities/DnoxSoil'
import { getThreatProfile, type ThreatProfile } from './threat'

type GameStore = ReturnType<typeof useGameStore>

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
}

function finalizeWaveOrder(tankers: WaveSpawner[], regular: WaveSpawner[]): WaveSpawner[] {
  shuffleInPlace(tankers)
  shuffleInPlace(regular)
  return [...tankers, ...regular]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function scaledCount(baseCount: number, cap: number, threat: ThreatProfile): number {
  const scaled = Math.round(baseCount * (0.86 + threat.spawnMult * 0.34))
  return Math.max(1, Math.min(cap, scaled))
}

function threatRoll(baseChance: number, threat: ThreatProfile): boolean {
  const chance = clamp(baseChance * (0.8 + threat.spawnMult * 0.45), 0.02, 0.95)
  return Math.random() < chance
}

// ─── Faction helpers ──────────────────────────────────────────────────────────
const ALL_FACTIONS: Array<'anox' | 'bnox' | 'cnox' | 'dnox'> = ['anox', 'bnox', 'cnox', 'dnox']

/** Rotate to a new faction that is different from the current one. */
function rotateFaction(ctx: GameContext): void {
  const choices = ALL_FACTIONS.filter(f => f !== ctx.activeFaction)
  ctx.lastFaction = ctx.activeFaction as 'anox' | 'bnox' | 'cnox' | 'dnox'
  ctx.activeFaction = choices[Math.floor(Math.random() * choices.length)] as 'anox' | 'bnox' | 'cnox' | 'dnox'
}

// ─── Anox wave (pioneer / sniper / kamikaze) ──────────────────────────────────
function buildAnoxWave(ctx: GameContext, game: GameStore, regular: WaveSpawner[], threat: ThreatProfile): void {
  const stage = game.currentStage

  const squadBase = Math.min(12, 2 + Math.floor(stage / 2))
  const squadCount = scaledCount(squadBase, 15, threat)
  for (let i = 0; i < squadCount; i++) {
    const formations: Array<'line' | 'diamond' | 'box'> = ['line', 'diamond', 'box']
    const entries: Array<'top' | 'left' | 'right'> = ['top', 'left', 'right']
    const form = formations[Math.floor(Math.random() * (stage < 4 ? 1 : stage < 7 ? 2 : 3))]!
    const entry = entries[Math.floor(Math.random() * (stage < 3 ? 1 : 3))]!
    regular.push(() => spawnPioneerSquad(ctx, game, form, entry))
  }

  if (stage >= 2) {
    const sniperBase = Math.min(11, 2 + Math.floor(stage / 2))
    const sniperCount = scaledCount(sniperBase, 13, threat)
    for (let i = 0; i < sniperCount; i++) {
      const withEscort = stage >= 3 && threatRoll(0.65, threat)
      regular.push(() => spawnSniperGroup(ctx, game, withEscort))
    }
  }

  if (stage >= 4) {
    const kamiBase = Math.min(8, stage - 3)
    const kamiCount = scaledCount(kamiBase, 10, threat)
    for (let i = 0; i < kamiCount; i++) {
      regular.push(() => spawnKamikaze(ctx, game))
    }
  }
}

// ─── Bnox wave (đại liên / thủ hộ / thuật sĩ) ────────────────────────────────
function buildBnoxWave(ctx: GameContext, game: GameStore, tankers: WaveSpawner[], regular: WaveSpawner[], threat: ThreatProfile): void {
  const stage = game.currentStage

  // Dai Lien is a high-pressure rapid-fire unit; keep growth slower to avoid screen saturation.
  const dlBase = Math.min(3, 1 + Math.floor(stage / 8))
  const dlCount = Math.max(1, Math.min(3, Math.round(dlBase * (0.78 + threat.spawnMult * 0.18))))
  for (let i = 0; i < dlCount; i++) {
    regular.push(() => spawnDaiLienPair(ctx, game))
  }

  tankers.push(() => spawnThuHoSwarm(ctx, game))
  tankers.push(() => spawnThuHoSwarm(ctx, game))
  if (stage >= 4 && threatRoll(0.55, threat)) {
    tankers.push(() => spawnThuHoSwarm(ctx, game))
  }

  const tsBase = Math.min(7, 1 + Math.floor(stage / 4))
  const tsCount = scaledCount(tsBase, 8, threat)
  for (let i = 0; i < tsCount; i++) {
    regular.push(() => spawnThuatSi(ctx, game))
  }
}

function buildCnoxWave(ctx: GameContext, game: GameStore, tankers: WaveSpawner[], regular: WaveSpawner[], threat: ThreatProfile): void {
  const stage = game.currentStage

  const shieldGroups = 1 + (stage >= 6 ? 1 : 0) + (stage >= 18 && threatRoll(0.5, threat) ? 1 : 0)
  for (let i = 0; i < shieldGroups; i++) tankers.push(() => spawnCnoxShieldWall(ctx, game))

  if (stage >= 2) {
    const greedyCount = 1 + (threatRoll(0.55, threat) ? 1 : 0) + (stage >= 7 && threatRoll(0.28, threat) ? 1 : 0)
    for (let i = 0; i < greedyCount; i++) regular.push(() => spawnCnoxGreedy(ctx, game))
  }

  if (stage >= 3) {
    const sparkGroups = 1 + (stage >= 8 && threatRoll(0.45, threat) ? 1 : 0)
    for (let i = 0; i < sparkGroups; i++) regular.push(() => spawnCnoxSparkGroup(ctx, game))
  }
}

// ─── Dnox wave (hoả chủng / băng lam / thổ nhưỡng) ───────────────────────────
function buildDnoxWave(ctx: GameContext, game: GameStore, tankers: WaveSpawner[], regular: WaveSpawner[], threat: ThreatProfile): void {
  const stage = game.currentStage

  // Hoả chủng làm tank tuyến trước (nhiều đợt hơn ở màn cao)
  tankers.push(() => spawnDnoxFireSquad(ctx, game))
  if (stage >= 4) tankers.push(() => spawnDnoxFireSquad(ctx, game))
  if (stage >= 8 && threatRoll(0.7, threat)) tankers.push(() => spawnDnoxFireSquad(ctx, game))

  // Băng lam tấn công tầm trung (stage >= 1)
  const iceCount = 1 + (threatRoll(0.45, threat) ? 1 : 0) + (stage >= 4 && threatRoll(0.75, threat) ? 1 : 0)
  for (let i = 0; i < iceCount; i++) regular.push(() => spawnDnoxIce(ctx, game))

  // Thổ nhưỡng ký sinh (stage >= 3, hiếm nhưng gây khó chịu)
  if (stage >= 3 && threatRoll(0.55, threat)) {
    regular.push(() => spawnDnoxSoilGroup(ctx, game))
    if (stage >= 7 && threatRoll(0.35, threat)) regular.push(() => spawnDnoxSoilGroup(ctx, game))
  }
}

function addCrossFactionIncursion(
  ctx: GameContext,
  game: GameStore,
  tankers: WaveSpawner[],
  regular: WaveSpawner[],
  threat: ThreatProfile,
): void {
  const stage = game.currentStage
  if (stage < 18) return

  const incursionWaves = Math.min(3, Math.floor((threat.spawnMult - 1) * 2.2) + (stage >= 30 ? 1 : 0))
  if (incursionWaves <= 0) return

  const secondary: WaveSpawner[] = []

  if (ctx.activeFaction !== 'anox') {
    secondary.push(() => spawnSniperGroup(ctx, game, stage >= 24 && threatRoll(0.6, threat)))
    if (stage >= 24) secondary.push(() => spawnKamikaze(ctx, game))
  }
  if (ctx.activeFaction !== 'bnox') {
    secondary.push(() => spawnDaiLienPair(ctx, game))
    if (stage >= 26) secondary.push(() => spawnThuatSi(ctx, game))
  }
  if (ctx.activeFaction !== 'cnox') {
    secondary.push(() => spawnCnoxSparkGroup(ctx, game))
    if (stage >= 28) tankers.push(() => spawnCnoxShieldWall(ctx, game))
  }
  if (ctx.activeFaction !== 'dnox') {
    secondary.push(() => spawnDnoxIce(ctx, game))
    if (stage >= 30 && threatRoll(0.5, threat)) secondary.push(() => spawnDnoxSoilGroup(ctx, game))
  }

  shuffleInPlace(secondary)
  for (let i = 0; i < Math.min(incursionWaves, secondary.length); i++) {
    regular.push(secondary[i]!)
  }
}

// ─── Main buildWave ───────────────────────────────────────────────────────────
export function buildWave(ctx: GameContext, game: GameStore): WaveSpawner[] {
  const stage = game.currentStage
  const tankers: WaveSpawner[] = []
  const regular: WaveSpawner[] = []
  const threat = getThreatProfile(game)

  // ── Test mode override ───────────────────────────────────────────────────────
  if (game.testMode) {
    if (game.testMode.type === 'boss') {
      const bossWave: WaveSpawner[] = []
      const k = game.testMode.bossKind
      if (k === 'boss_stardestroyer') { bossWave.push(() => { spawnStarDestroyer(ctx, game); ctx.gamePhase = 'bossIntro' }) }
      else if (k === 'boss_invader')  { bossWave.push(() => { spawnBossInvader(ctx, game);   ctx.gamePhase = 'bossIntro' }) }
      else if (k === 'boss_tinhvan')  { bossWave.push(() => { spawnBossTinhVan(ctx, game);   ctx.gamePhase = 'bossIntro' }) }
      else if (k === 'boss_trumso')   { bossWave.push(() => { spawnBossTrumSo(ctx, game);    ctx.gamePhase = 'bossIntro' }) }
      else if (k === 'boss_cnox_sun') { bossWave.push(() => { spawnBossCnoxSun(ctx, game);   ctx.gamePhase = 'bossIntro' }) }
      return bossWave
    } else if (game.testMode.type === 'faction') {
      ctx.activeFaction = game.testMode.faction as 'anox' | 'bnox' | 'cnox' | 'dnox'
      if (game.testMode.faction === 'bnox') buildBnoxWave(ctx, game, tankers, regular, threat)
      else if (game.testMode.faction === 'cnox') buildCnoxWave(ctx, game, tankers, regular, threat)
      else if ((game.testMode.faction as string) === 'dnox') buildDnoxWave(ctx, game, tankers, regular, threat)
      else buildAnoxWave(ctx, game, regular, threat)
      return finalizeWaveOrder(tankers, regular)
    }
  }

  // ── Rotate faction every 5-stage block ──────────────────────────────────────
  const block = Math.floor((stage - 1) / 5)
  if (block !== ctx.factionBlock) {
    rotateFaction(ctx)
    ctx.factionBlock = block
  }

  const isBossStage = stage % 5 === 0

  if (isBossStage) {
    const bossWave: WaveSpawner[] = []
    const bossIdx = Math.floor(stage / 5)
    if (ctx.activeFaction === 'anox') {
      if (bossIdx % 2 === 1) { bossWave.push(() => { spawnBossInvader(ctx, game); ctx.gamePhase = 'bossIntro' }) }
      else { bossWave.push(() => { spawnStarDestroyer(ctx, game); ctx.gamePhase = 'bossIntro' }) }
    } else if (ctx.activeFaction === 'bnox') {
      if (bossIdx % 2 === 1) { bossWave.push(() => { spawnBossTinhVan(ctx, game); ctx.gamePhase = 'bossIntro' }) }
      else { bossWave.push(() => { spawnBossTrumSo(ctx, game); ctx.gamePhase = 'bossIntro' }) }
    } else {
      bossWave.push(() => { spawnBossCnoxSun(ctx, game); ctx.gamePhase = 'bossIntro' })
    }
    return bossWave
  }

  // ── Regular stage: spawn only active faction ─────────────────────────────────
  if (ctx.activeFaction === 'bnox') {
    buildBnoxWave(ctx, game, tankers, regular, threat)
  } else if (ctx.activeFaction === 'cnox') {
    buildCnoxWave(ctx, game, tankers, regular, threat)
  } else if ((ctx.activeFaction as string) === 'dnox') {
    buildDnoxWave(ctx, game, tankers, regular, threat)
  } else {
    buildAnoxWave(ctx, game, regular, threat)
  }

  addCrossFactionIncursion(ctx, game, tankers, regular, threat)

  return finalizeWaveOrder(tankers, regular)
}

export function launchWave(ctx: GameContext, game: GameStore): void {
  game.stageEnemiesTotal = 0
  game.stageEnemiesKilled = 0
  game.stageComplete = false
  ctx.waveQueue = buildWave(ctx, game)
  ctx.waveIsClearing = false
  ctx.waveDispatchTimer = 0
  ctx.flockStates.clear()
  ctx.nextSquadId = 0
}

