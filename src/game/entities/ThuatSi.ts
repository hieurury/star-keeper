import { Graphics, Container } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_W, GAME_H } from '../constants'
import { redrawHpBar } from '../utils'

type GameStore = ReturnType<typeof useGameStore>

// ─── Graphics ─────────────────────────────────────────────────────────────────
export function drawThuatSi(g: Graphics, size: number): void {
  g.clear()
  // Diamond 1 — vertical (light gray)
  g.poly([0, -size, size * 0.58, 0, 0, size * 0.85, -size * 0.58, 0]).fill(0xc8c8c8)
  // Diamond 2 — rotated 45° (lighter, semi-transparent overlay)
  g.poly([size * 0.62, -size * 0.38, size * 0.62, size * 0.38,
          -size * 0.62, size * 0.38, -size * 0.62, -size * 0.38]).fill({ color: 0xe0e0e0, alpha: 0.7 })
  // Center energy circle
  g.circle(0, 0, size * 0.26).fill(0x88eeaa)
  g.circle(0, 0, size * 0.15).fill({ color: 0xccffcc, alpha: 0.95 })
  g.circle(0, 0, size * 0.07).fill(0xffffff)
}

/** Redraw body as a meteorite (used when dying). */
export function drawThuatSiMeteor(g: Graphics, size: number): void {
  g.clear()
  g.poly([0, -size * 0.9, size * 0.7, -size * 0.2, size * 0.85, size * 0.4,
          size * 0.2, size * 0.9, -size * 0.4, size * 0.8, -size * 0.8, size * 0.15,
          -size * 0.65, -size * 0.5]).fill(0x886644)
  g.poly([size * 0.1, -size * 0.55, size * 0.5, -size * 0.1, size * 0.3, size * 0.45,
          -size * 0.1, size * 0.35, -size * 0.35, -size * 0.1]).fill(0xaa8855)
  // glowing core
  g.circle(0, 0, size * 0.22).fill({ color: 0xff6600, alpha: 0.8 })
}

// ─── Lightning beam helper ────────────────────────────────────────────────────
/** Draws an animated lightning beam from (0,0) to (toX,toY) on g. */
export function drawHealBeam(g: Graphics, toX: number, toY: number, seed: number): void {
  g.clear()
  const len = Math.sqrt(toX * toX + toY * toY) || 1
  const nx = toX / len
  const ny = toY / len
  const px = -ny  // perpendicular
  const py = nx

  const segments = 7
  const pts: [number, number][] = [[0, 0]]
  for (let k = 1; k < segments; k++) {
    const t = k / segments
    const bx = toX * t
    const by = toY * t
    const offset = Math.sin(seed * 3.7 + k * 1.9) * (4 + 1.5 * Math.sin(seed * 2.1 + k))
    pts.push([bx + px * offset, by + py * offset])
  }
  pts.push([toX, toY])

  // Single lightning bolt (green-white)
  g.moveTo(pts[0]![0], pts[0]![1])
  for (let k = 1; k < pts.length; k++) g.lineTo(pts[k]![0], pts[k]![1])
  g.stroke({ color: 0x88ffbb, width: 1.2, alpha: 0.92 })
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
export function spawnThuatSi(ctx: GameContext, game: GameStore): void {
  const x = GAME_W * 0.15 + Math.random() * GAME_W * 0.7
  const targetY = GAME_H * 0.07 + Math.random() * GAME_H * 0.14
  const size = 10 + Math.random() * 4
  const barW = size * 2.4
  const maxHp = 22 + game.currentStage * 12  // trung bình
  const body = new Graphics()
  drawThuatSi(body, size)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 7
  hpBar.y = -size - 7
  // Heal beam graphics added to container (relative coords)
  const healBeamGfx = new Graphics()
  const container = new Container()
  container.addChild(body, hpBarBg, hpBar, healBeamGfx)
  container.x = x
  container.y = -40
  ctx.gameLayer.addChild(container)
  const e: Enemy = {
    container, body, hpBarBg, hpBar,
    kind: 'thuat_si',
    vy: 1.6 + game.currentStage * 0.06,
    vx: 0,
    hp: maxHp, maxHp, barW,
    pioneerPhase: 'enter',
    enterTargetX: x,
    enterTargetY: targetY,
    formTargetX: x,
    formTargetY: targetY,
    approachTimer: 999999,
    healBeamGfx,
    healTargetIdx: -1,
  }
  ctx.enemies.push(e)
  game.stageEnemiesTotal++
}
