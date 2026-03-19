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

// ─── Faction helpers ──────────────────────────────────────────────────────────
const ALL_FACTIONS: Array<'anox' | 'bnox' | 'cnox'> = ['anox', 'bnox', 'cnox']

/** Rotate to a new faction that is different from the current one. */
function rotateFaction(ctx: GameContext): void {
  const choices = ALL_FACTIONS.filter(f => f !== ctx.activeFaction)
  ctx.lastFaction = ctx.activeFaction
  ctx.activeFaction = choices[Math.floor(Math.random() * choices.length)]!
}

// ─── Anox wave (pioneer / sniper / kamikaze) ──────────────────────────────────
function buildAnoxWave(ctx: GameContext, game: GameStore, regular: WaveSpawner[]): void {
  const stage = game.currentStage

  const squadCount = Math.min(10, 2 + Math.floor(stage / 2))
  for (let i = 0; i < squadCount; i++) {
    const formations: Array<'line' | 'diamond' | 'box'> = ['line', 'diamond', 'box']
    const entries: Array<'top' | 'left' | 'right'> = ['top', 'left', 'right']
    const form = formations[Math.floor(Math.random() * (stage < 4 ? 1 : stage < 7 ? 2 : 3))]!
    const entry = entries[Math.floor(Math.random() * (stage < 3 ? 1 : 3))]!
    regular.push(() => spawnPioneerSquad(ctx, game, form, entry))
  }

  if (stage >= 2) {
    const sniperCount = Math.min(10, 2 + Math.floor(stage / 2))
    for (let i = 0; i < sniperCount; i++) {
      const withEscort = stage >= 3 && Math.random() < 0.65
      regular.push(() => spawnSniperGroup(ctx, game, withEscort))
    }
  }

  if (stage >= 4) {
    const kamiCount = Math.min(6, stage - 3)
    for (let i = 0; i < kamiCount; i++) {
      regular.push(() => spawnKamikaze(ctx, game))
    }
  }
}

// ─── Bnox wave (đại liên / thủ hộ / thuật sĩ) ────────────────────────────────
function buildBnoxWave(ctx: GameContext, game: GameStore, tankers: WaveSpawner[], regular: WaveSpawner[]): void {
  const stage = game.currentStage

  const dlCount = Math.min(3, 1 + Math.floor(stage / 5))
  for (let i = 0; i < dlCount; i++) {
    regular.push(() => spawnDaiLienPair(ctx, game))
  }

  tankers.push(() => spawnThuHoSwarm(ctx, game))
  tankers.push(() => spawnThuHoSwarm(ctx, game))
  if (stage >= 4 && Math.random() < 0.55) {
    tankers.push(() => spawnThuHoSwarm(ctx, game))
  }

  const tsCount = Math.min(7, 2 + Math.floor(stage / 3))
  for (let i = 0; i < tsCount; i++) {
    regular.push(() => spawnThuatSi(ctx, game))
  }
}

function buildCnoxWave(ctx: GameContext, game: GameStore, tankers: WaveSpawner[], regular: WaveSpawner[]): void {
  const stage = game.currentStage

  const shieldGroups = 1 + (stage >= 6 ? 1 : 0)
  for (let i = 0; i < shieldGroups; i++) tankers.push(() => spawnCnoxShieldWall(ctx, game))

  if (stage >= 2) {
    const greedyCount = 1 + (Math.random() < 0.55 ? 1 : 0) + (stage >= 7 && Math.random() < 0.28 ? 1 : 0)
    for (let i = 0; i < greedyCount; i++) regular.push(() => spawnCnoxGreedy(ctx, game))
  }

  if (stage >= 3) {
    const sparkGroups = 1 + (stage >= 8 && Math.random() < 0.45 ? 1 : 0)
    for (let i = 0; i < sparkGroups; i++) regular.push(() => spawnCnoxSparkGroup(ctx, game))
  }
}

// ─── Main buildWave ───────────────────────────────────────────────────────────
export function buildWave(ctx: GameContext, game: GameStore): WaveSpawner[] {
  const stage = game.currentStage
  const tankers: WaveSpawner[] = []
  const regular: WaveSpawner[] = []

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
      ctx.activeFaction = game.testMode.faction
      if (game.testMode.faction === 'bnox') buildBnoxWave(ctx, game, tankers, regular)
      else if (game.testMode.faction === 'cnox') buildCnoxWave(ctx, game, tankers, regular)
      else buildAnoxWave(ctx, game, regular)
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
    buildBnoxWave(ctx, game, tankers, regular)
  } else if (ctx.activeFaction === 'cnox') {
    buildCnoxWave(ctx, game, tankers, regular)
  } else {
    buildAnoxWave(ctx, game, regular)
  }

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

