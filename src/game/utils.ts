import { Graphics } from 'pixi.js'
import type { Enemy } from './types'

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

export function redrawHpBar(hpBarBg: Graphics, hpBar: Graphics, pct: number, w: number, forceColor?: number, customH?: number): void {
  const h = customH ?? 4
  hpBarBg.clear()
  hpBarBg.rect(-w / 2, 0, w, h).fill(0x222222)
  hpBar.clear()
  if (pct > 0) {
    const color = forceColor ?? (pct > 0.5 ? 0x22dd44 : pct > 0.25 ? 0xffaa00 : 0xff2222)
    hpBar.rect(-w / 2, 0, w * pct, h).fill(color)
  }
}

export function findNearestEnemy(enemies: Enemy[], x: number, y: number): Enemy | null {
  let nearest: Enemy | null = null
  let nearestD2 = Infinity
  for (const e of enemies) {
    const d2 = dist2(x, y, e.container.x, e.container.y)
    if (d2 < nearestD2) { nearestD2 = d2; nearest = e }
  }
  return nearest
}
