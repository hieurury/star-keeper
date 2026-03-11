import { Graphics } from 'pixi.js'
import type { StarBg } from '../types'
import { GAME_W, GAME_H } from '../constants'

export function createStar(): StarBg {
  const g = new Graphics()
  const size = Math.random() * 1.5 + 0.5
  g.rect(0, 0, size, size).fill({ color: 0xffffff, alpha: Math.random() * 0.5 + 0.3 })
  g.x = Math.random() * GAME_W
  g.y = Math.random() * GAME_H
  return { gfx: g, vy: Math.random() * 1.5 + 0.5 }
}
