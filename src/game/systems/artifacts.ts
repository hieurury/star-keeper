import { Graphics } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import { screenFlash, spawnDamageText, spawnExpCollectEffect, getExpTierColor } from './effects'
import { killEnemy } from '../entities/kill'
import { updateDnoxFireHeat } from '../entities/DnoxFire'

type GameStore = ReturnType<typeof useGameStore>

export function drawArtifactGfx(g: Graphics, id: string, pulse = 0): void {
  g.clear()
  if (id === 'neutron_star') {
    const r = 7 + pulse * 2
    g.circle(0, 0, r + 3).fill({ color: 0xffd700, alpha: 0.18 + pulse * 0.15 })
    const pts: number[] = []
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2
      const rad = i % 2 === 0 ? r : r * 0.42
      pts.push(Math.cos(a) * rad, Math.sin(a) * rad)
    }
    g.poly(pts).fill({ color: 0xffe566, alpha: 0.95 })
    g.circle(0, 0, 3).fill(0xffffff)
  } else if (id === 'carbon_core') {
    const pts: number[] = []
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3
      pts.push(Math.cos(a) * 6, Math.sin(a) * 6)
    }
    g.poly(pts).fill(0x3a3a5c)
    g.poly(pts).stroke({ color: 0x8888bb, width: 1.2, alpha: 0.9 })
    g.circle(0, 0, 2.5).fill({ color: 0xaaaacc, alpha: 0.7 })
  } else if (id === 'stardust') {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2
      const bx = Math.cos(a) * 7; const by = Math.sin(a) * 7
      g.poly([0, 0, bx - Math.sin(a) * 1.5, by + Math.cos(a) * 1.5,
              bx * 1.5, by * 1.5,
              bx + Math.sin(a) * 1.5, by - Math.cos(a) * 1.5]).fill({ color: 0xffcc44, alpha: 0.85 })
    }
    g.circle(0, 0, 2.5).fill(0xffffff)
  } else if (id === 'mana_core') {
    g.circle(0, 0, 9 + pulse * 3).fill({ color: 0x7700cc, alpha: 0.18 + pulse * 0.2 })
    g.poly([0, -8, 7, 0, 0, 8, -7, 0]).fill({ color: 0x9933ff, alpha: 0.92 })
    g.poly([0, -8, 7, 0, 0, 8, -7, 0]).stroke({ color: 0xdd88ff, width: 1.2 })
    g.circle(0, 0, 2.5).fill({ color: 0xeeccff, alpha: 0.9 })
  }
}

export function initArtifactGfx(ctx: GameContext, game: GameStore): void {
  if (ctx.artifactGfx) {
    if (!ctx.artifactGfx.destroyed) ctx.gameLayer.removeChild(ctx.artifactGfx)
    ctx.artifactGfx = null
  }
  for (const g of ctx.artifactGfxList) {
    if (!g.destroyed) ctx.gameLayer.removeChild(g)
  }
  ctx.artifactGfxList = []

  const equipped = game.equippedArtifacts[game.selectedShip] ?? []
  if (equipped.length === 0 || !ctx.gameLayer) return

  for (const id of equipped) {
    const g = new Graphics()
    drawArtifactGfx(g, id)
    ctx.gameLayer.addChild(g)
    ctx.artifactGfxList.push(g)
  }
  ctx.artifactGfx = ctx.artifactGfxList[0] ?? null
}

export function activateNeutronVacuum(ctx: GameContext, game: GameStore): void {
  if (!ctx.playerShip) return
  for (let i = ctx.expOrbs.length - 1; i >= 0; i--) {
    const o = ctx.expOrbs[i]
    spawnExpCollectEffect(ctx, o.x, o.y, ctx.playerShip.x, ctx.playerShip.y, o.amount, getExpTierColor(o.tier))
    game.gainSessionExp(o.amount)
    if (!o.gfx.destroyed) ctx.gameLayer.removeChild(o.gfx)
  }
  ctx.expOrbs = []
  screenFlash(ctx, 0xffd700, 0.35, 300)
}

export function activateManaCoreOverload(ctx: GameContext, game: GameStore): boolean {
  if (!ctx.playerShip || !ctx.app || !ctx.gameLayer) return false

  let target = null as GameContext['enemies'][number] | null
  let nearestD2 = Infinity
  for (const e of ctx.enemies) {
    const dx = e.container.x - ctx.playerShip.x
    const dy = e.container.y - ctx.playerShip.y
    const d2 = dx * dx + dy * dy
    if (d2 < nearestD2) {
      nearestD2 = d2
      target = e
    }
  }
  if (!target) return false

  const laserDmg = 100
  const sx = ctx.playerShip.x
  const sy = ctx.playerShip.y - 10
  const tx = target.container.x
  const ty = target.container.y
  const aimDx = tx - sx
  const aimDy = ty - sy
  const aimLen = Math.sqrt(aimDx * aimDx + aimDy * aimDy) || 1
  const dirX = aimDx / aimLen
  const dirY = aimDy / aimLen
  const beamLen = 1300
  const ex = sx + dirX * beamLen
  const ey = sy + dirY * beamLen
  const hitHalfWidth = 24

  screenFlash(ctx, 0xa14bff, 0.45, 240)

  for (let i = ctx.enemies.length - 1; i >= 0; i--) {
    const e = ctx.enemies[i]
    const px = e.container.x - sx
    const py = e.container.y - sy
    const dot = px * dirX + py * dirY
    if (dot < 0 || dot > beamLen) continue
    const perpX = px - dot * dirX
    const perpY = py - dot * dirY
    const perpDist = Math.sqrt(perpX * perpX + perpY * perpY)
    if (perpDist > hitHalfWidth) continue

    e.hp = Math.max(0, e.hp - laserDmg)
    updateDnoxFireHeat(e, laserDmg, ctx, game)
    spawnDamageText(ctx, e.container.x, e.container.y - 14, laserDmg)
    if (e.hp <= 0) killEnemy(ctx, game, e, i)
  }

  for (const boss of ctx.enemies) {
    if (boss.kind !== 'boss_cnox_sun') continue
    const crystals = boss.sunEnergyCrystals ?? []
    for (let ci = crystals.length - 1; ci >= 0; ci--) {
      const c = crystals[ci]!
      const px = c.x - sx
      const py = c.y - sy
      const dot = px * dirX + py * dirY
      if (dot < 0 || dot > beamLen) continue
      const perpX = px - dot * dirX
      const perpY = py - dot * dirY
      const perpDist = Math.sqrt(perpX * perpX + perpY * perpY)
      if (perpDist > hitHalfWidth) continue

      c.hp = Math.max(0, c.hp - laserDmg)
      spawnDamageText(ctx, c.x, c.y - 14, laserDmg)
      if (c.hp <= 0) {
        if (!c.gfx.destroyed) ctx.gameLayer.removeChild(c.gfx)
        crystals.splice(ci, 1)
      }
    }
  }

  const beam = new Graphics()
  ctx.gameLayer.addChild(beam)
  let frame = 0
  const beamFn = () => {
    frame++
    const t = frame / 12
    const alpha = Math.max(0, 1 - t)
    beam.clear()
    beam.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: 0xe7c8ff, width: 3, alpha: alpha * 0.95 })
    beam.moveTo(sx, sy).lineTo(ex, ey).stroke({ color: 0xa14bff, width: 12, alpha: alpha * 0.42 })
    if (frame >= 12) {
      if (!beam.destroyed) ctx.gameLayer.removeChild(beam)
      ctx.app?.ticker.remove(beamFn)
    }
  }
  ctx.app.ticker.add(beamFn)

  return true
}

export function activateSoulHarvest(ctx: GameContext, game: GameStore): void {
  if (!ctx.playerShip) return
  const count = game.fragmentCount
  if (count <= 0) return
  game.fragmentCount = 0
  ctx.soulMissileQueue = count
  ctx.soulMissileFireTimer = 0
  screenFlash(ctx, 0xff8800, 0.45, 400)
}
