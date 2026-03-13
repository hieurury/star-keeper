import { Graphics } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import { GAME_W, GAME_H } from '../constants'
import { dist2, redrawHpBar, findNearestEnemy } from '../utils'
import { spawnExplosion, screenFlash, spawnDamageText, spawnHeatWave, hitFlash } from './effects'
import { killEnemy } from '../entities/kill'

type GameStore = ReturnType<typeof useGameStore>

interface AbilityTargetPoint {
  x: number
  y: number
}

function pickDistinctTargets(ctx: GameContext, fromX: number, fromY: number, count: number): AbilityTargetPoint[] {
  if (count <= 0 || ctx.enemies.length === 0) return []
  const sorted = [...ctx.enemies].sort((a, b) => dist2(fromX, fromY, a.container.x, a.container.y) - dist2(fromX, fromY, b.container.x, b.container.y))
  const picked = sorted.slice(0, count)
  return picked.map((e) => ({ x: e.container.x, y: e.container.y }))
}

// ─── Missile launcher graphics ────────────────────────────────────────────────
function drawMissileLauncher(g: Graphics): void {
  g.clear()
  g.rect(-6, -9, 12, 18).fill(0x0088cc)
  g.poly([0, -13, 4, -9, -4, -9]).fill(0x44ccff)
  g.rect(-4, 7, 8, 5).fill({ color: 0xff6600, alpha: 0.8 })
  g.circle(0, -1, 4).fill(0x66ddff)
  g.circle(0, -1, 2).fill(0xffffff)
}

function drawPlayerMissile(g: Graphics, small = false): void {
  g.clear()
  const s = small ? 0.65 : 1.0
  g.rect(-2.5*s, -7*s, 5*s, 12*s).fill(0x00ccff)
  g.poly([0, -10*s, 3*s, -7*s, -3*s, -7*s]).fill(0x66eeff)
  g.circle(0, 5*s, 2*s).fill({ color: 0xff8800, alpha: 0.9 })
}

// ─── Homing missile launchers ─────────────────────────────────────────────────
export function updateMissileLaunchers(ctx: GameContext, game: GameStore, dt: number): void {
  if (!ctx.playerShip) return
  const cs = game.cardStats
  const count = cs.missileLaunchers

  while (ctx.missileLaunchers.length < count) {
    const g = new Graphics()
    drawMissileLauncher(g)
    ctx.gameLayer.addChild(g)
    const angle = (ctx.missileLaunchers.length * Math.PI * 2 / Math.max(1, count)) + Math.PI / 4
    const stagger = cs.missileIntervalFrames * (ctx.missileLaunchers.length / Math.max(1, count))
    ctx.missileLaunchers.push({ gfx: g, angle, timer: stagger })
  }
  while (ctx.missileLaunchers.length > count) {
    const ml = ctx.missileLaunchers.pop()!
    if (!ml.gfx.destroyed) ctx.gameLayer.removeChild(ml.gfx)
  }

  for (let idx = 0; idx < ctx.missileLaunchers.length; idx++) {
    const launcher = ctx.missileLaunchers[idx]
    const px = ctx.playerShip.x + (idx === 0 ? -40 : 40)
    const py = ctx.playerShip.y + 8
    launcher.gfx.x = px
    launcher.gfx.y = py
    const aimEnemy = findNearestEnemy(ctx.enemies, px, py)
    if (aimEnemy) {
      const adx = aimEnemy.container.x - px
      const ady = aimEnemy.container.y - py
      launcher.gfx.rotation = Math.atan2(ady, adx) + Math.PI / 2
    } else {
      launcher.gfx.rotation = 0
    }

    launcher.timer -= dt
    if (launcher.timer <= 0) {
      launcher.timer = cs.missileIntervalFrames
      const target = findNearestEnemy(ctx.enemies, px, py)
      if (target) {
        const isSmall = cs.interstellarMissile
        const mg = new Graphics()
        drawPlayerMissile(mg, isSmall)
        mg.x = px; mg.y = py
        ctx.gameLayer.addChild(mg)
        const dx = target.container.x - px
        const dy = target.container.y - py
        const mag = Math.sqrt(dx * dx + dy * dy) || 1
        const spd = 5.5 * cs.missileSpeedMult
        ctx.playerMissiles.push({
          gfx: mg,
          vx: (dx / mag) * spd,
          vy: (dy / mag) * spd,
          damage: Math.round(65 * cs.missileDamageMult),
          aoe: cs.missileAOE,
        })
      }
    }
  }

  // Move & collide player missiles
  const spd = 5.5 * cs.missileSpeedMult
  const turnRate = cs.interstellarMissile ? 0.18 : 0.10
  for (let i = ctx.playerMissiles.length - 1; i >= 0; i--) {
    const m = ctx.playerMissiles[i]
    const target = findNearestEnemy(ctx.enemies, m.gfx.x, m.gfx.y)
    if (target) {
      const dx = target.container.x - m.gfx.x
      const dy = target.container.y - m.gfx.y
      const mag = Math.sqrt(dx * dx + dy * dy) || 1
      m.vx += (dx / mag * spd - m.vx) * turnRate
      m.vy += (dy / mag * spd - m.vy) * turnRate
    }
    m.gfx.x += m.vx * dt
    m.gfx.y += m.vy * dt
    m.gfx.rotation = Math.atan2(m.vy, m.vx) + Math.PI / 2

    if (m.gfx.y < -100 || m.gfx.y > GAME_H + 100 || m.gfx.x < -100 || m.gfx.x > GAME_W + 100) {
      if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
      ctx.playerMissiles.splice(i, 1)
      continue
    }

    let hit = false
    for (let j = ctx.enemies.length - 1; j >= 0; j--) {
      const e = ctx.enemies[j]
      const hitR = e.kind === 'boss_stardestroyer' ? 50 : 14
      if (dist2(m.gfx.x, m.gfx.y, e.container.x, e.container.y) < hitR * hitR) {
        if (m.aoe) {
          spawnExplosion(ctx, m.gfx.x, m.gfx.y, 30, 0xff6600, 0xffee44)
          const AOE_R2 = 65 * 65
          for (let k = ctx.enemies.length - 1; k >= 0; k--) {
            const ae = ctx.enemies[k]
            if (dist2(m.gfx.x, m.gfx.y, ae.container.x, ae.container.y) < AOE_R2) {
              ae.hp = Math.max(0, ae.hp - m.damage)
              hitFlash(ae.body)
              spawnDamageText(ctx, ae.container.x, ae.container.y - (ae.kind === 'boss_stardestroyer' ? 60 : 16), m.damage)
              redrawHpBar(ae.hpBarBg, ae.hpBar, ae.hp / ae.maxHp, ae.barW)
              if (ae.hp <= 0) killEnemy(ctx, game, ae, k)
            }
          }
        } else {
          e.hp = Math.max(0, e.hp - m.damage)
          hitFlash(e.body)
          spawnDamageText(ctx, e.container.x, e.container.y - (e.kind === 'boss_stardestroyer' ? 60 : 16), m.damage)
          redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
          spawnExplosion(ctx, m.gfx.x, m.gfx.y, 8, 0x00ccff, 0x44eeff)
          if (e.hp <= 0) killEnemy(ctx, game, e, j)
        }
        if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
        ctx.playerMissiles.splice(i, 1)
        hit = true
        break
      }
    }
    if (hit) continue
  }
}

// ─── Plasma beam ──────────────────────────────────────────────────────────────
export function spawnPlasmaBeam(ctx: GameContext, game: GameStore, x: number, damage: number): void {
  if (!ctx.app || !ctx.gameLayer) return
  const beamW = Math.round(20 * game.cardStats.plasmaBoltWidthMult)
  const isDevastation = game.cardStats.plasmaClearsBullets
  screenFlash(ctx, 0x4488ff, 0.22, 300)
  for (let i = ctx.enemies.length - 1; i >= 0; i--) {
    const e = ctx.enemies[i]
    if (Math.abs(e.container.x - x) < beamW + 10) {
      const isBoss = e.kind === 'boss_stardestroyer' || e.kind === 'boss_invader'
      if (isDevastation && !isBoss) {
        hitFlash(e.body)
        spawnDamageText(ctx, e.container.x, e.container.y - 16, e.maxHp)
        redrawHpBar(e.hpBarBg, e.hpBar, 0, e.barW)
        e.hp = 0
        killEnemy(ctx, game, e, i)
      } else {
        e.hp = Math.max(0, e.hp - damage)
        hitFlash(e.body)
        spawnDamageText(ctx, e.container.x, e.container.y - (isBoss ? 60 : 16), damage)
        redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
        if (e.hp <= 0) killEnemy(ctx, game, e, i)
      }
    }
  }
  if (isDevastation) {
    for (let i = ctx.enemyBullets.length - 1; i >= 0; i--) {
      if (Math.abs(ctx.enemyBullets[i].gfx.x - x) < beamW + 12) {
        if (!ctx.enemyBullets[i].gfx.destroyed) ctx.gameLayer.removeChild(ctx.enemyBullets[i].gfx)
        ctx.enemyBullets.splice(i, 1)
      }
    }
  }
  const beam = new Graphics()
  beam.x = x
  ctx.gameLayer.addChild(beam)
  let frame = 0
  const tick = () => {
    frame++
    beam.clear()
    const alpha = Math.max(0, 0.5 - frame * 0.033)
    beam.rect(-beamW / 2, 0, beamW, GAME_H).fill({ color: 0x4488ff, alpha })
    if (frame >= 15) {
      if (!beam.destroyed) ctx.gameLayer.removeChild(beam)
      ctx.app?.ticker.remove(tick)
    }
  }
  ctx.app.ticker.add(tick)
}

// ─── Cluster bomb ─────────────────────────────────────────────────────────────
export function dropClusterBomb(ctx: GameContext, game: GameStore, fromX: number, fromY: number, damage: number, target?: AbilityTargetPoint): void {
  if (!ctx.app || !ctx.gameLayer) return
  const fallbackTarget: AbilityTargetPoint = { x: fromX, y: Math.max(80, fromY - 220) }
  const aim = target ?? fallbackTarget
  const tx = Math.max(40, Math.min(GAME_W - 40, aim.x))
  const ty = Math.max(GAME_H * 0.08, Math.min(GAME_H * 0.75, aim.y))
  const bomb = new Graphics()
  bomb.circle(0, 0, 9).fill(0xff6600)
  bomb.circle(0, 0, 5).fill(0xffee44)
  bomb.x = fromX; bomb.y = fromY
  ctx.gameLayer.addChild(bomb)
  let frame = 0
  const maxFrames = 35
  const startX = fromX; const startY = fromY
  const tick = () => {
    frame++
    bomb.x = startX + (tx - startX) * (frame / maxFrames)
    bomb.y = startY + (ty - startY) * (frame / maxFrames)
    if (frame >= maxFrames) {
      spawnExplosion(ctx, bomb.x, bomb.y, 28, 0xff6600, 0xffee44)
      const AOE_R2 = 58 * 58
      for (let i = ctx.enemies.length - 1; i >= 0; i--) {
        const e = ctx.enemies[i]
        if (dist2(bomb.x, bomb.y, e.container.x, e.container.y) < AOE_R2) {
          e.hp = Math.max(0, e.hp - damage)
          hitFlash(e.body)
          spawnDamageText(ctx, e.container.x, e.container.y - 16, damage)
          redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
          if (e.hp <= 0) killEnemy(ctx, game, e, i)
        }
      }
      if (!bomb.destroyed) ctx.gameLayer.removeChild(bomb)
      ctx.app?.ticker.remove(tick)
    }
  }
  ctx.app.ticker.add(tick)
}

// ─── Laser sweep ──────────────────────────────────────────────────────────────
export function fireLaserSweep(ctx: GameContext, game: GameStore, damage: number, targetY?: number): void {
  if (!ctx.app || !ctx.gameLayer) return
  const sweepY = Math.max(GAME_H * 0.08, Math.min(GAME_H * 0.78, targetY ?? (ctx.playerShip?.y ?? GAME_H * 0.6) - 140))
  screenFlash(ctx, 0xff4400, 0.18, 220)
  for (let i = ctx.enemies.length - 1; i >= 0; i--) {
    const e = ctx.enemies[i]
    if (Math.abs(e.container.y - sweepY) < 26) {
      e.hp = Math.max(0, e.hp - damage)
      hitFlash(e.body)
      spawnDamageText(ctx, e.container.x, e.container.y - 16, damage)
      redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
      if (e.hp <= 0) killEnemy(ctx, game, e, i)
    }
  }
  const laser = new Graphics()
  laser.y = sweepY
  ctx.gameLayer.addChild(laser)
  let frame = 0
  const tick = () => {
    frame++
    laser.clear()
    laser.rect(0, -12, GAME_W, 24).fill({ color: 0xff3300, alpha: Math.max(0, 0.55 - frame * 0.028) })
    if (frame >= 20) {
      if (!laser.destroyed) ctx.gameLayer.removeChild(laser)
      ctx.app?.ticker.remove(tick)
    }
  }
  ctx.app.ticker.add(tick)
}

// ─── Static field ─────────────────────────────────────────────────────────────
export function updateStaticField(ctx: GameContext, game: GameStore, dt: number): void {
  if (!ctx.playerShip || !ctx.gameLayer) return
  const cs = game.cardStats
  if (!cs.staticField) {
    if (ctx.sfGfx) ctx.sfGfx.visible = false
    return
  }
  if (!ctx.sfGfx) {
    ctx.sfGfx = new Graphics()
    ctx.gameLayer.addChild(ctx.sfGfx)
  }
  ctx.sfGfx.visible = true
  ctx.sfGfx.x = ctx.playerShip.x
  ctx.sfGfx.y = ctx.playerShip.y
  ctx.sfGfx.clear()
  const pulse = 0.35 + Math.sin(Date.now() * 0.008) * 0.2
  ctx.sfGfx.circle(0, 0, cs.staticFieldRadius).fill({ color: 0xff2200, alpha: 0.10 + pulse * 0.07 })
  ctx.sfGfx.circle(0, 0, cs.staticFieldRadius).stroke({ color: 0xff4400, width: 2, alpha: 0.4 + pulse * 0.3 })

  ctx.sfDmgTimer -= dt
  if (ctx.sfDmgTimer <= 0) {
    ctx.sfDmgTimer = 30
    const r2 = cs.staticFieldRadius * cs.staticFieldRadius
    for (let i = ctx.enemies.length - 1; i >= 0; i--) {
      const e = ctx.enemies[i]
      if (dist2(ctx.playerShip.x, ctx.playerShip.y, e.container.x, e.container.y) < r2) {
        e.hp = Math.max(0, e.hp - cs.staticFieldDmgPerTick)
        hitFlash(e.body)
        spawnDamageText(ctx, e.container.x, e.container.y - 14, cs.staticFieldDmgPerTick)
        redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
        if (e.hp <= 0) killEnemy(ctx, game, e, i)
      }
    }
  }
}

// ─── Periodic ability orchestrator ───────────────────────────────────────────
export function updatePeriodicAbilities(ctx: GameContext, game: GameStore, dt: number): void {
  if (!ctx.playerShip) return
  const cs = game.cardStats

  if (cs.plasmaBolt) {
    ctx.pbTimer -= dt
    if (ctx.pbTimer <= 0) {
      ctx.pbTimer = cs.plasmaBoltIntervalFrames
      const dmg = Math.round(80 * cs.plasmaBoltDmgMult)
      for (let b = 0; b < cs.plasmaBoltCount; b++) {
        const offX = cs.plasmaBoltCount > 1 ? (b - 0.5) * 30 : 0
        spawnPlasmaBeam(ctx, game, ctx.playerShip.x + offX, dmg)
      }
    }
  }

  if (cs.clusterBomb) {
    ctx.cbTimer -= dt
    if (ctx.cbTimer <= 0) {
      ctx.cbTimer = cs.clusterBombIntervalFrames
      const dmg = Math.round(70 * cs.clusterBombDmgMult)
      const bombCount = cs.clusterBombDouble ? 2 : 1
      const bombTargets = pickDistinctTargets(ctx, ctx.playerShip.x, ctx.playerShip.y, bombCount)
      const capX = ctx.playerShip.x
      const capY = ctx.playerShip.y
      dropClusterBomb(ctx, game, capX, capY - 20, dmg, bombTargets[0])
      if (cs.clusterBombDouble) {
        const secondTarget = bombTargets[1]
        setTimeout(() => { if (ctx.app && ctx.playerShip) dropClusterBomb(ctx, game, capX + 40, capY - 20, dmg, secondTarget) }, 430)
      }
    }
  }

  if (cs.laserSweep) {
    ctx.lsTimer -= dt
    if (ctx.lsTimer <= 0) {
      ctx.lsTimer = cs.laserSweepIntervalFrames
      const dmg = Math.round(50 * cs.laserSweepDmgMult)
      const laserCount = cs.laserSweepDouble ? 2 : 1
      const laserTargets = pickDistinctTargets(ctx, ctx.playerShip.x, ctx.playerShip.y, laserCount)
      fireLaserSweep(ctx, game, dmg, laserTargets[0]?.y)
      if (cs.laserSweepDouble) {
        const secondY = laserTargets[1]?.y
        setTimeout(() => { if (ctx.app) fireLaserSweep(ctx, game, dmg, secondY) }, 380)
      }
    }
  }

  updateStaticField(ctx, game, dt)
}

// ─── Black hole (Star Shooter skill) ──────────────────────────────────────────
export function activateBlackHole(ctx: GameContext, _game: GameStore): void {
  if (!ctx.app || !ctx.gameLayer) return
  // Remove previous black hole if still active
  if (ctx.shooterBlackHoleGfx) {
    if (!ctx.shooterBlackHoleGfx.destroyed) ctx.gameLayer.removeChild(ctx.shooterBlackHoleGfx)
    ctx.shooterBlackHoleGfx = null
    ctx.shooterBlackHoleTimer = 0
  }
  // Remove in-flight projectile if any
  if (ctx.shooterBlackHoleProjGfx) {
    if (!ctx.shooterBlackHoleProjGfx.destroyed) ctx.gameLayer.removeChild(ctx.shooterBlackHoleProjGfx)
    ctx.shooterBlackHoleProjGfx = null
  }
  // Target nearest enemy, fallback to above-center
  const nearest = findNearestEnemy(ctx.enemies, ctx.playerShip?.x ?? GAME_W / 2, ctx.playerShip?.y ?? GAME_H * 0.5)
  ctx.shooterBlackHoleProjTX = nearest ? nearest.container.x : GAME_W / 2
  ctx.shooterBlackHoleProjTY = nearest ? nearest.container.y : GAME_H * 0.35
  // Spawn projectile at ship bow
  const proj = new Graphics()
  proj.circle(0, 0, 9).fill(0x1a0033)
  proj.circle(0, 0, 9).stroke({ color: 0xaa33ff, width: 2.5 })
  proj.circle(0, 0, 4).fill({ color: 0x8800ff, alpha: 0.7 })
  proj.x = ctx.playerShip?.x ?? GAME_W / 2
  proj.y = (ctx.playerShip?.y ?? GAME_H * 0.8) - 26
  ctx.gameLayer.addChild(proj)
  ctx.shooterBlackHoleProjGfx = proj
  screenFlash(ctx, 0x220044, 0.55, 500)
}
export function activateHeatWave(ctx: GameContext, game: GameStore): void {
  if (!ctx.playerShip || !ctx.app) return
  const px = ctx.playerShip.x
  const py = ctx.playerShip.y
  screenFlash(ctx, 0xff6600, 0.55, 450)
  spawnHeatWave(ctx, px, py)

  for (const b of ctx.enemyBullets) {
    if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
  }
  ctx.enemyBullets = []

  const waveDamage = 150
  for (let i = ctx.enemies.length - 1; i >= 0; i--) {
    const e = ctx.enemies[i]
    e.hp = Math.max(0, e.hp - waveDamage)
    hitFlash(e.body)
    spawnDamageText(ctx, e.container.x, e.container.y - (e.kind === 'boss_stardestroyer' || e.kind === 'boss_invader' ? 60 : 16), waveDamage)
    redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
    if (e.hp <= 0) killEnemy(ctx, game, e, i)
  }
}
