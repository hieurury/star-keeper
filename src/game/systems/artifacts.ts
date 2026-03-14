import { Graphics } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import { screenFlash, spawnDamageText } from './effects'
import { killEnemy } from '../entities/kill'

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
  const equipped = game.equippedArtifacts[game.selectedShip] ?? []
  if (equipped.length === 0 || !ctx.gameLayer) return
  const id = equipped[0]!
  const g = new Graphics()
  drawArtifactGfx(g, id)
  ctx.gameLayer.addChild(g)
  ctx.artifactGfx = g
}

export function activateNeutronVacuum(ctx: GameContext, game: GameStore): void {
  if (!ctx.playerShip) return
  for (let i = ctx.expOrbs.length - 1; i >= 0; i--) {
    const o = ctx.expOrbs[i]
    game.gainSessionExp(o.amount)
    if (!o.gfx.destroyed) ctx.gameLayer.removeChild(o.gfx)
  }
  ctx.expOrbs = []
  screenFlash(ctx, 0xffd700, 0.35, 300)
}

export function activateManaCoreOverload(ctx: GameContext, game: GameStore): void {
  if (!ctx.playerShip || !ctx.app || !ctx.gameLayer) return
  const blastRadius = 130
  const blastDmg = Math.round(game.upgrades.damage * 0.5)
  const ring = new Graphics()
  ring.circle(0, 0, blastRadius).stroke({ color: 0x9933ff, width: 4, alpha: 0.9 })
  ring.circle(0, 0, blastRadius).fill({ color: 0x6600cc, alpha: 0.12 })
  ring.x = ctx.playerShip.x
  ring.y = ctx.playerShip.y
  ctx.gameLayer.addChild(ring)
  screenFlash(ctx, 0x9933ff, 0.4, 350)
  for (let i = ctx.enemies.length - 1; i >= 0; i--) {
    const e = ctx.enemies[i]
    const dx = e.container.x - ctx.playerShip.x
    const dy = e.container.y - ctx.playerShip.y
    if (Math.sqrt(dx * dx + dy * dy) <= blastRadius) {
      e.hp = Math.max(0, e.hp - blastDmg)
      spawnDamageText(ctx, e.container.x, e.container.y - 10, blastDmg)
      if (e.hp <= 0) killEnemy(ctx, game, e, i)
    }
  }
  for (const boss of ctx.enemies) {
    if (boss.kind !== 'boss_cnox_sun') continue
    const crystals = boss.sunEnergyCrystals ?? []
    for (let ci = crystals.length - 1; ci >= 0; ci--) {
      const c = crystals[ci]!
      const dx = c.x - ctx.playerShip.x
      const dy = c.y - ctx.playerShip.y
      if (Math.sqrt(dx * dx + dy * dy) <= blastRadius) {
        c.hp = Math.max(0, c.hp - blastDmg)
        spawnDamageText(ctx, c.x, c.y - 14, blastDmg)
        if (c.hp <= 0) {
          if (!c.gfx.destroyed) ctx.gameLayer.removeChild(c.gfx)
          crystals.splice(ci, 1)
        }
      }
    }
  }
  let fadeAlpha = 0.9
  const fadeFn = () => {
    fadeAlpha -= 0.08
    ring.alpha = Math.max(0, fadeAlpha)
    if (fadeAlpha <= 0) {
      if (!ring.destroyed) ctx.gameLayer.removeChild(ring)
      ctx.app!.ticker.remove(fadeFn)
    }
  }
  ctx.app!.ticker.add(fadeFn)
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
