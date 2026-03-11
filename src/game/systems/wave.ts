import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { WaveSpawner } from '../types'
import { spawnPioneerSquad } from '../entities/Pioneer'
import { spawnKamikaze } from '../entities/Kamikaze'
import { spawnSniperGroup } from '../entities/Sniper'
import { spawnStarDestroyer } from '../entities/BossStarDestroyer'
import { spawnBossInvader } from '../entities/BossInvader'

type GameStore = ReturnType<typeof useGameStore>

export function buildWave(ctx: GameContext, game: GameStore): WaveSpawner[] {
  const stage = game.currentStage
  const wave: WaveSpawner[] = []
  const isInvaderBossStage = stage % 10 === 0
  const isBossStage = stage % 5 === 0 && !isInvaderBossStage

  if (isInvaderBossStage) {
    const escortGroups = 2 + Math.floor(stage / 10)
    const entries: Array<'top' | 'left' | 'right'> = ['top', 'left', 'right']
    for (let g = 0; g < escortGroups; g++) {
      wave.push(() => spawnPioneerSquad(ctx, game, 'diamond', entries[g % 3]!))
    }
    wave.push(() => spawnBossInvader(ctx, game))
    return wave
  }

  if (isBossStage) {
    const escortGroups = 2 + Math.floor(stage / 5)
    const entries: Array<'top' | 'left' | 'right'> = ['top', 'left', 'right']
    for (let g = 0; g < escortGroups; g++) {
      wave.push(() => spawnPioneerSquad(ctx, game, 'diamond', entries[g % 3]!))
    }
    wave.push(() => spawnStarDestroyer(ctx, game))
    return wave
  }

  const tier = Math.floor((stage - 1) / 5)
  const difficulty = 1 + tier * 0.4

  const squadCount = Math.min(10, 2 + Math.floor(stage / 2))
  for (let i = 0; i < squadCount; i++) {
    const formations: Array<'line' | 'diamond' | 'box'> = ['line', 'diamond', 'box']
    const entries: Array<'top' | 'left' | 'right'> = ['top', 'left', 'right']
    const form = formations[Math.floor(Math.random() * (stage < 4 ? 1 : stage < 7 ? 2 : 3))]
    const entry = entries[Math.floor(Math.random() * (stage < 3 ? 1 : 3))]
    wave.push(() => spawnPioneerSquad(ctx, game, form, entry))
  }

  if (stage >= 2) {
    const sniperCount = Math.min(10, 2 + Math.floor(stage / 2))
    for (let i = 0; i < sniperCount; i++) {
      const withEscort = stage >= 3 && Math.random() < 0.65
      wave.push(() => spawnSniperGroup(ctx, game, withEscort))
    }
  }

  if (stage >= 4 && difficulty >= 1) {
    const kamiCount = Math.min(6, stage - 3)
    for (let i = 0; i < kamiCount; i++) {
      wave.push(() => spawnKamikaze(ctx, game))
    }
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
