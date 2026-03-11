import { Graphics } from 'pixi.js'
import type { GameContext } from '../context'
import type { OrbTier, EnemyKind } from '../types'
import { ORB_CONFIG } from '../constants'
import { drawFragmentOrb } from '../projectiles/index'

export function spawnExpOrb(ctx: GameContext, x: number, y: number, tier: OrbTier): void {
  const cfg = ORB_CONFIG[tier]
  const g = new Graphics()
  g.circle(0, 0, cfg.r).fill(cfg.outer)
  g.circle(0, 0, cfg.r * 0.55).fill({ color: cfg.inner, alpha: 0.9 })
  const ox = x + (Math.random() - 0.5) * 28
  g.x = ox
  g.y = y
  ctx.gameLayer.addChild(g)
  ctx.expOrbs.push({ gfx: g, x: ox, y, vy: 0.55 + Math.random() * 0.45, amount: cfg.exp, tier })
}

export function spawnFragmentOrb(ctx: GameContext, x: number, y: number): void {
  const g = new Graphics()
  drawFragmentOrb(g)
  const ox = x + (Math.random() - 0.5) * 24
  g.x = ox
  g.y = y
  ctx.gameLayer.addChild(g)
  ctx.fragmentOrbs.push({ gfx: g, x: ox, y, vy: 0.45 + Math.random() * 0.4, age: 0 })
}

export function spawnEnemyOrbs(ctx: GameContext, x: number, y: number, kind: EnemyKind): void {
  if (kind === 'pioneer') {
    const count = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) spawnExpOrb(ctx, x, y, 'white')
  } else if (kind === 'kamikaze') {
    const count = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) spawnExpOrb(ctx, x, y, Math.random() < 0.3 ? 'blue' : 'white')
  } else if (kind === 'sniper') {
    const count = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) spawnExpOrb(ctx, x, y, Math.random() < 0.25 ? 'purple' : 'white')
  } else if (kind === 'boss_stardestroyer') {
    for (let i = 0; i < 10; i++) spawnExpOrb(ctx, x + (Math.random()-0.5)*40, y + (Math.random()-0.5)*20, 'gold')
    for (let i = 0; i < 6; i++) spawnExpOrb(ctx, x + (Math.random()-0.5)*30, y + (Math.random()-0.5)*20, 'purple')
    for (let i = 0; i < 4; i++) spawnExpOrb(ctx, x + (Math.random()-0.5)*20, y, 'blue')
  } else if (kind === 'boss_invader') {
    for (let i = 0; i < 12; i++) spawnExpOrb(ctx, x + (Math.random()-0.5)*50, y + (Math.random()-0.5)*25, 'gold')
    for (let i = 0; i < 8; i++) spawnExpOrb(ctx, x + (Math.random()-0.5)*35, y + (Math.random()-0.5)*20, 'purple')
    for (let i = 0; i < 5; i++) spawnExpOrb(ctx, x + (Math.random()-0.5)*20, y, 'blue')
  }
}
