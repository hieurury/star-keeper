import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { spawnExplosion, screenFlash } from '../systems/effects'
import { spawnEnemyOrbs, spawnExpOrb, spawnFragmentOrb } from '../systems/orbs'
import { cleanupBossInvaderTurrets } from './BossInvader'
import { cleanupBossTinhVan } from './BossTinhVan'
import { cleanupBossTrumSo } from './BossTrumSo'
import { cleanupBossCnoxSun } from './BossCnoxSun'
import { drawThuatSiMeteor } from './ThuatSi'
import { cleanupDnoxFire } from './DnoxFire'
import { cleanupDnoxIce } from './DnoxIce'
import { cleanupDnoxSoil, getDnoxSoilCoreKind, removeDnoxSoilBonus, isDnoxSoilProtected } from './DnoxSoil'
import { audioManager } from '../systems/audio'
import { getEnemyRewardScale } from '../systems/threat'

type GameStore = ReturnType<typeof useGameStore>

/**
 * Handles all kill logic:  remove entity from scene + array, award score, spawn orbs.
 * NOTE: does NOT call activateManaCoreOverload directly.
 * Instead it sets ctx.manaCoreOverloadPending = true; the game loop handles the call.
 */
export function killEnemy(ctx: GameContext, game: GameStore, e: Enemy, i: number, laserKill = false): void {
  if (isDnoxSoilProtected(e, ctx)) {
    e.hp = Math.max(1, e.hp)
    return
  }

  const rewardScale = getEnemyRewardScale(e)

  if (e.kind === 'boss_stardestroyer') {
    spawnExplosion(ctx, e.container.x, e.container.y, 50, 0x4466ff, 0xaaccff)
    spawnExplosion(ctx, e.container.x - 30, e.container.y + 20, 28, 0xff4400, 0xffee44)
    spawnExplosion(ctx, e.container.x + 30, e.container.y - 10, 24, 0xff8800, 0xffee44)
    screenFlash(ctx, 0x4466ff, 0.65, 800)
    spawnEnemyOrbs(ctx, e.container.x, e.container.y, 'boss_stardestroyer')
    if (e.laserLine) e.laserLine.clear()
    game.addScore(Math.round((300 + game.currentStage * 50) * rewardScale))
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
    game.addScore(Math.round((400 + game.currentStage * 60) * rewardScale))
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
    game.addScore(Math.round((600 + game.currentStage * 80) * rewardScale))
    game.addBossKill()
  } else if (e.kind === 'boss_trumso') {
    spawnExplosion(ctx, e.container.x, e.container.y, 60, 0x7700cc, 0xcc44ff)
    spawnExplosion(ctx, e.container.x - 45, e.container.y + 20, 30, 0x5500aa, 0xee88ff)
    spawnExplosion(ctx, e.container.x + 45, e.container.y - 15, 26, 0x4400aa, 0xcc77ff)
    spawnExplosion(ctx, e.container.x, e.container.y + 45, 22, 0x6600cc, 0xff88ff)
    screenFlash(ctx, 0x6600cc, 0.7, 900)
    spawnEnemyOrbs(ctx, e.container.x, e.container.y, 'boss_trumso')
    cleanupBossTrumSo(ctx, e)
    game.addScore(Math.round((500 + game.currentStage * 70) * rewardScale))
    game.addBossKill()
  } else if (e.kind === 'boss_cnox_sun') {
    spawnExplosion(ctx, e.container.x, e.container.y, 82, 0xff8b2c, 0xffe2aa)
    spawnExplosion(ctx, e.container.x - 70, e.container.y + 18, 34, 0xffd050, 0xfff2c7)
    spawnExplosion(ctx, e.container.x + 72, e.container.y - 20, 34, 0x67bcff, 0xdff2ff)
    spawnExplosion(ctx, e.container.x, e.container.y - 30, 42, 0xc576ff, 0xefd9ff)
    screenFlash(ctx, 0xff9d33, 0.82, 1000)
    spawnEnemyOrbs(ctx, e.container.x, e.container.y, 'boss_cnox_sun')
    cleanupBossCnoxSun(ctx, e)
    game.addScore(Math.round((980 + game.currentStage * 100) * rewardScale))
    game.addBossKill()
  } else {
    // Thủ Hộ (guardian) dies with a gold flash
    if (e.kind === 'thu_ho') {
      spawnExplosion(ctx, e.container.x, e.container.y, 16, 0xffd700, 0xffffff)
    } else if (e.kind === 'cnox_greedy') {
      spawnExplosion(ctx, e.container.x, e.container.y, 18, 0xff8844, 0xffe0aa)
    } else if (e.kind === 'cnox_shield') {
      spawnExplosion(ctx, e.container.x, e.container.y, 18, 0x55aaff, 0xe8fbff)
    } else if (e.kind === 'cnox_spark') {
      spawnExplosion(ctx, e.container.x, e.container.y, 16, 0xaa66ff, 0xffffff)
    } else if (e.kind === 'dnox_fire') {
      spawnExplosion(ctx, e.container.x, e.container.y, 20, 0xff5500, 0xffcc44)
      cleanupDnoxFire(e, ctx)
    } else if (e.kind === 'dnox_ice') {
      spawnExplosion(ctx, e.container.x, e.container.y, 18, 0x55ccff, 0xe0f8ff)
      cleanupDnoxIce(e)
    } else if (e.kind === 'dnox_soil') {
      spawnExplosion(ctx, e.container.x, e.container.y, 16, 0x8b5c2a, 0xffd700)
      // Remove parasite bonuses from host
      const host = e.healTarget
      if (host && ctx.enemies.includes(host)) {
        removeDnoxSoilBonus(host, getDnoxSoilCoreKind(e))
        // Strip the parasite visual off the host
        if (e.body.parent === host.container) host.container.removeChild(e.body)
      }
      cleanupDnoxSoil(e)
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
      const pts = Math.round((18 + game.currentStage * 8) * rewardScale)
      game.addScore(pts)
      if (game.selectedShip === 'star_holder') {
        const dropChance = (laserKill && game.cardStats.laserKillDropsSoul) ? 1.0 : 0.75
        if (Math.random() < dropChance) spawnFragmentOrb(ctx, e.container.x, e.container.y)
      }

      game.addKill(e.kind, { threatTier: e.threatTier ?? 0, isAlpha: !!e.threatAlpha })
      audioManager.playEnemyKill()
      if (game.artifactStats.manaCoreActive) {
        ctx.manaCoreKillCount++
        game.manaCorePct = ctx.manaCoreKillCount / 10
        if (ctx.manaCoreKillCount >= 10) { ctx.manaCoreKillCount = 0; game.manaCorePct = 0; ctx.manaCoreOverloadPending = true }
      }
      return // keep in ctx.enemies — meteor phase handled by game loop
    }

    const explR = e.kind === 'kamikaze' ? 18 : 14
    spawnExplosion(ctx, e.container.x, e.container.y, explR)
    if (e.threatAlpha) {
      spawnExplosion(ctx, e.container.x, e.container.y, explR + 8, 0xffe8a6, 0xffffff)
      spawnExpOrb(ctx, e.container.x, e.container.y, 'gold')
    }
    if ((e.threatTier ?? 0) >= 2) {
      spawnExpOrb(ctx, e.container.x, e.container.y, 'purple')
    }
    if ((e.threatTier ?? 0) >= 3) {
      spawnExpOrb(ctx, e.container.x, e.container.y, 'gold')
    }
    spawnEnemyOrbs(ctx, e.container.x, e.container.y, e.kind)
    if (e.kind === 'cnox_greedy') {
      let remaining = Math.max(0, Math.round(e.cnoxStolenExp ?? 0))
      while (remaining >= 50) {
        spawnExpOrb(ctx, e.container.x, e.container.y, 'gold')
        remaining -= 50
      }
      while (remaining >= 30) {
        spawnExpOrb(ctx, e.container.x, e.container.y, 'purple')
        remaining -= 30
      }
      while (remaining >= 20) {
        spawnExpOrb(ctx, e.container.x, e.container.y, 'blue')
        remaining -= 20
      }
      while (remaining >= 10) {
        spawnExpOrb(ctx, e.container.x, e.container.y, 'white')
        remaining -= 10
      }
      if (remaining > 0) {
        spawnExpOrb(ctx, e.container.x, e.container.y, 'white')
        const last = ctx.expOrbs[ctx.expOrbs.length - 1]
        if (last) last.amount = remaining
      }
    }
    const pts = e.kind === 'sniper'     ? 20 + game.currentStage * 7
             : e.kind === 'kamikaze'   ? 15 + game.currentStage * 6
             : e.kind === 'dai_lien'   ? 12 + game.currentStage * 5
             : e.kind === 'thu_ho'     ? 18 + game.currentStage * 8
             : e.kind === 'cnox_greedy' ? 24 + game.currentStage * 8 + Math.round((e.cnoxStolenExp ?? 0) * 0.35)
             : e.kind === 'cnox_shield' ? 20 + game.currentStage * 7
             : e.kind === 'cnox_spark'  ? 22 + game.currentStage * 8
             : e.kind === 'dnox_fire'   ? 20 + game.currentStage * 7
             : e.kind === 'dnox_ice'    ? 28 + game.currentStage * 10
             : e.kind === 'dnox_soil'   ? 22 + game.currentStage * 8
             :                          10 + game.currentStage * 5
    game.addScore(Math.round(pts * rewardScale))
    // Star Holder: soul fragment drop
    if (game.selectedShip === 'star_holder') {
      const dropChance = (laserKill && game.cardStats.laserKillDropsSoul) ? 1.0 : 0.75
      if (Math.random() < dropChance) spawnFragmentOrb(ctx, e.container.x, e.container.y)
    }
  }


  ctx.gameLayer.removeChild(e.container)
  ctx.enemies.splice(i, 1)
  game.addKill(e.kind, { threatTier: e.threatTier ?? 0, isAlpha: !!e.threatAlpha })
  audioManager.playEnemyKill()

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
