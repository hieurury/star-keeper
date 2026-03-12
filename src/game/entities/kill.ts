import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { spawnExplosion, screenFlash } from '../systems/effects'
import { spawnEnemyOrbs, spawnFragmentOrb } from '../systems/orbs'
import { cleanupBossInvaderTurrets } from './BossInvader'
import { cleanupBossTinhVan } from './BossTinhVan'
import { drawThuatSiMeteor } from './ThuatSi'

type GameStore = ReturnType<typeof useGameStore>

/**
 * Handles all kill logic:  remove entity from scene + array, award score, spawn orbs.
 * NOTE: does NOT call activateManaCoreOverload directly.
 * Instead it sets ctx.manaCoreOverloadPending = true; the game loop handles the call.
 */
export function killEnemy(ctx: GameContext, game: GameStore, e: Enemy, i: number, laserKill = false): void {
  if (e.kind === 'boss_stardestroyer') {
    spawnExplosion(ctx, e.container.x, e.container.y, 50, 0x4466ff, 0xaaccff)
    spawnExplosion(ctx, e.container.x - 30, e.container.y + 20, 28, 0xff4400, 0xffee44)
    spawnExplosion(ctx, e.container.x + 30, e.container.y - 10, 24, 0xff8800, 0xffee44)
    screenFlash(ctx, 0x4466ff, 0.65, 800)
    spawnEnemyOrbs(ctx, e.container.x, e.container.y, 'boss_stardestroyer')
    if (e.laserLine) e.laserLine.clear()
    game.addScore(300 + game.currentStage * 50)
    game.addBossKill()
  } else if (e.kind === 'boss_invader') {
    spawnExplosion(ctx, e.container.x, e.container.y, 55, 0x2255ff, 0x88bbff)
    spawnExplosion(ctx, e.container.x - 40, e.container.y + 25, 28, 0xff4400, 0xffee44)
    spawnExplosion(ctx, e.container.x + 40, e.container.y - 15, 24, 0x2266ff, 0x88bbff)
    spawnExplosion(ctx, e.container.x, e.container.y + 40, 20, 0x4488ff, 0xaaccff)
    screenFlash(ctx, 0x2255ff, 0.65, 800)
    spawnEnemyOrbs(ctx, e.container.x, e.container.y, 'boss_invader')
    if (e.laserLine) e.laserLine.clear()
    cleanupBossInvaderTurrets(ctx, e)
    game.addScore(400 + game.currentStage * 60)
    game.addBossKill()
  } else if (e.kind === 'boss_tinhvan') {
    spawnExplosion(ctx, e.container.x, e.container.y, 70, 0x6600aa, 0xcc44ff)
    spawnExplosion(ctx, e.container.x - 50, e.container.y + 25, 36, 0x440066, 0xee88ff)
    spawnExplosion(ctx, e.container.x + 50, e.container.y - 20, 30, 0x220033, 0xaa33ff)
    spawnExplosion(ctx, e.container.x, e.container.y + 55, 28, 0x660088, 0xff88ff)
    spawnExplosion(ctx, e.container.x - 20, e.container.y - 40, 22, 0x880099, 0xdd66ff)
    screenFlash(ctx, 0x6600aa, 0.75, 1000)
    spawnEnemyOrbs(ctx, e.container.x, e.container.y, 'boss_tinhvan')
    cleanupBossTinhVan(ctx, e)
    game.addScore(600 + game.currentStage * 80)
    game.addBossKill()
  } else {
    // Thủ Hộ (guardian) dies with a gold flash
    if (e.kind === 'thu_ho') {
      spawnExplosion(ctx, e.container.x, e.container.y, 16, 0xffd700, 0xffffff)
    }
    // Thuật Sĩ (healer) transforms into a meteorite instead of instantly dying
    if (e.kind === 'thuat_si' && !e.isDyingMeteor) {
      e.isDyingMeteor = true
      e.hp = 0
      // Convert body to a falling meteorite
      drawThuatSiMeteor(e.body, 11)
      if (e.healBeamGfx) e.healBeamGfx.clear()
      if (ctx.playerShip) {
        const dx = ctx.playerShip.x - e.container.x
        const dy = ctx.playerShip.y - e.container.y
        const mag = Math.sqrt(dx * dx + dy * dy) || 1
        e.meteorVx = (dx / mag) * 5.5
        e.meteorVy = (dy / mag) * 5.5
      } else {
        e.meteorVx = 0
        e.meteorVy = 5.5
      }
      spawnExplosion(ctx, e.container.x, e.container.y, 10, 0x88ff88, 0xffffff)
      spawnEnemyOrbs(ctx, e.container.x, e.container.y, 'thuat_si')
      const pts = 18 + game.currentStage * 8
      game.addScore(pts)
      if (game.selectedShip === 'star_holder') {
        const dropChance = (laserKill && game.cardStats.laserKillDropsSoul) ? 1.0 : 0.75
        if (Math.random() < dropChance) spawnFragmentOrb(ctx, e.container.x, e.container.y)
      }
      if (game.cardStats.vampireKillHeal > 0) game.healPlayer(game.cardStats.vampireKillHeal)
      game.addKill()
      if (game.artifactStats.manaCoreActive) {
        ctx.manaCoreKillCount++
        game.manaCorePct = ctx.manaCoreKillCount / 10
        if (ctx.manaCoreKillCount >= 10) { ctx.manaCoreKillCount = 0; game.manaCorePct = 0; ctx.manaCoreOverloadPending = true }
      }
      return // keep in ctx.enemies — meteor phase handled by game loop
    }

    const explR = e.kind === 'kamikaze' ? 18 : 14
    spawnExplosion(ctx, e.container.x, e.container.y, explR)
    spawnEnemyOrbs(ctx, e.container.x, e.container.y, e.kind)
    const pts = e.kind === 'sniper'    ? 20 + game.currentStage * 7
             : e.kind === 'kamikaze'  ? 15 + game.currentStage * 6
             : e.kind === 'dai_lien'  ? 12 + game.currentStage * 5
             : e.kind === 'thu_ho'    ? 18 + game.currentStage * 8
             :                         10 + game.currentStage * 5
    game.addScore(pts)
    // Star Holder: soul fragment drop
    if (game.selectedShip === 'star_holder') {
      const dropChance = (laserKill && game.cardStats.laserKillDropsSoul) ? 1.0 : 0.75
      if (Math.random() < dropChance) spawnFragmentOrb(ctx, e.container.x, e.container.y)
    }
  }

  if (game.cardStats.vampireKillHeal > 0) game.healPlayer(game.cardStats.vampireKillHeal)
  ctx.gameLayer.removeChild(e.container)
  ctx.enemies.splice(i, 1)
  game.addKill()

  // Mana Core: track kills; DO NOT call activateManaCoreOverload here (avoids circular dep)
  if (game.artifactStats.manaCoreActive) {
    ctx.manaCoreKillCount++
    game.manaCorePct = ctx.manaCoreKillCount / 10
    if (ctx.manaCoreKillCount >= 10) {
      ctx.manaCoreKillCount = 0
      game.manaCorePct = 0
      ctx.manaCoreOverloadPending = true
    }
  }
}
