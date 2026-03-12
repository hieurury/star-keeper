import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { WaveSpawner } from '../types'
import { spawnPioneerSquad } from '../entities/Pioneer'
import { spawnKamikaze } from '../entities/Kamikaze'
import { spawnSniperGroup } from '../entities/Sniper'
import { spawnStarDestroyer } from '../entities/BossStarDestroyer'
import { spawnBossInvader } from '../entities/BossInvader'
import { spawnBossTinhVan } from '../entities/BossTinhVan'
import { spawnDaiLienPair } from '../entities/DaiLien'
import { spawnThuHoSwarm } from '../entities/ThuHo'
import { spawnThuatSi } from '../entities/ThuatSi'

type GameStore = ReturnType<typeof useGameStore>

// ─── Faction helpers ──────────────────────────────────────────────────────────
const ALL_FACTIONS: Array<'anox' | 'bnox'> = ['anox', 'bnox']

/** Rotate to a new faction that is different from the current one. */
function rotateFaction(ctx: GameContext): void {
  const choices = ALL_FACTIONS.filter(f => f !== ctx.activeFaction)
  ctx.lastFaction = ctx.activeFaction
  ctx.activeFaction = choices[Math.floor(Math.random() * choices.length)]!
}

// ─── Anox wave (pioneer / sniper / kamikaze) ──────────────────────────────────
function buildAnoxWave(ctx: GameContext, game: GameStore, wave: WaveSpawner[]): void {
  const stage = game.currentStage

  const squadCount = Math.min(10, 2 + Math.floor(stage / 2))
  for (let i = 0; i < squadCount; i++) {
    const formations: Array<'line' | 'diamond' | 'box'> = ['line', 'diamond', 'box']
    const entries: Array<'top' | 'left' | 'right'> = ['top', 'left', 'right']
    const form = formations[Math.floor(Math.random() * (stage < 4 ? 1 : stage < 7 ? 2 : 3))]!
    const entry = entries[Math.floor(Math.random() * (stage < 3 ? 1 : 3))]!
    wave.push(() => spawnPioneerSquad(ctx, game, form, entry))
  }

  if (stage >= 2) {
    const sniperCount = Math.min(10, 2 + Math.floor(stage / 2))
    for (let i = 0; i < sniperCount; i++) {
      const withEscort = stage >= 3 && Math.random() < 0.65
      wave.push(() => spawnSniperGroup(ctx, game, withEscort))
    }
  }

  if (stage >= 4) {
    const kamiCount = Math.min(6, stage - 3)
    for (let i = 0; i < kamiCount; i++) {
      wave.push(() => spawnKamikaze(ctx, game))
    }
  }
}

// ─── Bnox wave (đại liên / thủ hộ / thuật sĩ) ────────────────────────────────
function buildBnoxWave(ctx: GameContext, game: GameStore, wave: WaveSpawner[]): void {
  const stage = game.currentStage

  const dlCount = Math.min(6, 2 + Math.floor(stage / 3))
  for (let i = 0; i < dlCount; i++) {
    wave.push(() => spawnDaiLienPair(ctx, game))
  }

  if (Math.random() < 0.65) {
    wave.push(() => spawnThuHoSwarm(ctx, game))
  }

  const tsCount = Math.min(3, 1 + Math.floor(stage / 5))
  for (let i = 0; i < tsCount; i++) {
    wave.push(() => spawnThuatSi(ctx, game))
  }
}

// ─── Escort for boss stage ────────────────────────────────────────────────────
function spawnBossEscort(ctx: GameContext, game: GameStore, wave: WaveSpawner[], count: number): void {
  const faction = ctx.activeFaction
  if (faction === 'bnox') {
    for (let g = 0; g < count; g++) {
      wave.push(() => spawnDaiLienPair(ctx, game))
    }
    if (count >= 3) wave.push(() => spawnThuHoSwarm(ctx, game))
  } else {
    const entries: Array<'top' | 'left' | 'right'> = ['top', 'left', 'right']
    for (let g = 0; g < count; g++) {
      wave.push(() => spawnPioneerSquad(ctx, game, 'diamond', entries[g % 3]!))
    }
  }
}

// ─── Main buildWave ───────────────────────────────────────────────────────────
export function buildWave(ctx: GameContext, game: GameStore): WaveSpawner[] {
  const stage = game.currentStage
  const wave: WaveSpawner[] = []

  // ── Rotate faction every 5-stage block ──────────────────────────────────────
  const block = Math.floor((stage - 1) / 5)
  if (block !== ctx.factionBlock) {
    rotateFaction(ctx)
    ctx.factionBlock = block
  }

  const isTinhVanBossStage = stage % 15 === 0
  const isInvaderBossStage = stage % 10 === 0 && !isTinhVanBossStage
  const isBossStage = stage % 5 === 0 && !isInvaderBossStage && !isTinhVanBossStage

  if (isTinhVanBossStage) {
    const escortCount = 1 + Math.floor(stage / 15)
    spawnBossEscort(ctx, game, wave, escortCount)
    wave.push(() => spawnBossTinhVan(ctx, game))
    return wave
  }

  if (isInvaderBossStage) {
    const escortCount = 2 + Math.floor(stage / 10)
    spawnBossEscort(ctx, game, wave, escortCount)
    wave.push(() => spawnBossInvader(ctx, game))
    return wave
  }

  if (isBossStage) {
    const escortCount = 2 + Math.floor(stage / 5)
    spawnBossEscort(ctx, game, wave, escortCount)
    wave.push(() => spawnStarDestroyer(ctx, game))
    return wave
  }

  // ── Regular stage: spawn only active faction ─────────────────────────────────
  if (ctx.activeFaction === 'bnox') {
    buildBnoxWave(ctx, game, wave)
  } else {
    buildAnoxWave(ctx, game, wave)
  }

  // Shuffle
  for (let i = wave.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wave[i], wave[j]] = [wave[j]!, wave[i]!]
  }

  return wave
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

