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

// ─── Faction helpers ──────────────────────────────────────────────────────────
const ALL_FACTIONS: Array<'anox' | 'bnox' | 'cnox'> = ['anox', 'bnox', 'cnox']

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

  const dlCount = Math.min(3, 1 + Math.floor(stage / 5))
  for (let i = 0; i < dlCount; i++) {
    wave.push(() => spawnDaiLienPair(ctx, game))
  }

  wave.push(() => spawnThuHoSwarm(ctx, game))
  wave.push(() => spawnThuHoSwarm(ctx, game))
  if (stage >= 4 && Math.random() < 0.55) {
    wave.push(() => spawnThuHoSwarm(ctx, game))
  }

  const tsCount = Math.min(7, 2 + Math.floor(stage / 3))
  for (let i = 0; i < tsCount; i++) {
    wave.push(() => spawnThuatSi(ctx, game))
  }
}

function buildCnoxWave(ctx: GameContext, game: GameStore, wave: WaveSpawner[]): void {
  const stage = game.currentStage

  const shieldGroups = 1 + (stage >= 6 ? 1 : 0)
  for (let i = 0; i < shieldGroups; i++) wave.push(() => spawnCnoxShieldWall(ctx, game))

  if (stage >= 2) {
    const greedyCount = (Math.random() < 0.45 ? 1 : 0) + (stage >= 7 && Math.random() < 0.22 ? 1 : 0)
    for (let i = 0; i < greedyCount; i++) wave.push(() => spawnCnoxGreedy(ctx, game))
  }

  if (stage >= 3) {
    const sparkGroups = 1 + (stage >= 8 && Math.random() < 0.45 ? 1 : 0)
    for (let i = 0; i < sparkGroups; i++) wave.push(() => spawnCnoxSparkGroup(ctx, game))
  }
}

// ─── Main buildWave ───────────────────────────────────────────────────────────
export function buildWave(ctx: GameContext, game: GameStore): WaveSpawner[] {
  const stage = game.currentStage
  const wave: WaveSpawner[] = []

  // ── Test mode override ───────────────────────────────────────────────────────
  if (game.testMode) {
    if (game.testMode.type === 'boss') {
      const k = game.testMode.bossKind
      if (k === 'boss_stardestroyer') { wave.push(() => { spawnStarDestroyer(ctx, game); ctx.gamePhase = 'bossIntro' }) }
      else if (k === 'boss_invader')  { wave.push(() => { spawnBossInvader(ctx, game);   ctx.gamePhase = 'bossIntro' }) }
      else if (k === 'boss_tinhvan')  { wave.push(() => { spawnBossTinhVan(ctx, game);   ctx.gamePhase = 'bossIntro' }) }
      else if (k === 'boss_trumso')   { wave.push(() => { spawnBossTrumSo(ctx, game);    ctx.gamePhase = 'bossIntro' }) }
      else if (k === 'boss_cnox_sun') { wave.push(() => { spawnBossCnoxSun(ctx, game);   ctx.gamePhase = 'bossIntro' }) }
      return wave
    } else if (game.testMode.type === 'faction') {
      ctx.activeFaction = game.testMode.faction
      if (game.testMode.faction === 'bnox') buildBnoxWave(ctx, game, wave)
      else if (game.testMode.faction === 'cnox') buildCnoxWave(ctx, game, wave)
      else buildAnoxWave(ctx, game, wave)
      for (let i = wave.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [wave[i], wave[j]] = [wave[j]!, wave[i]!]
      }
      return wave
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
    const bossIdx = Math.floor(stage / 5)
    if (ctx.activeFaction === 'anox') {
      if (bossIdx % 2 === 1) { wave.push(() => { spawnBossInvader(ctx, game); ctx.gamePhase = 'bossIntro' }) }
      else { wave.push(() => { spawnStarDestroyer(ctx, game); ctx.gamePhase = 'bossIntro' }) }
    } else if (ctx.activeFaction === 'bnox') {
      if (bossIdx % 2 === 1) { wave.push(() => { spawnBossTinhVan(ctx, game); ctx.gamePhase = 'bossIntro' }) }
      else { wave.push(() => { spawnBossTrumSo(ctx, game); ctx.gamePhase = 'bossIntro' }) }
    } else {
      wave.push(() => { spawnBossCnoxSun(ctx, game); ctx.gamePhase = 'bossIntro' })
    }
    return wave
  }

  // ── Regular stage: spawn only active faction ─────────────────────────────────
  if (ctx.activeFaction === 'bnox') {
    buildBnoxWave(ctx, game, wave)
  } else if (ctx.activeFaction === 'cnox') {
    buildCnoxWave(ctx, game, wave)
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

