import { Container, Graphics } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_W } from '../constants'
import { redrawHpBar } from '../utils'

type GameStore = ReturnType<typeof useGameStore>

export function getCnoxGreedyCoreColor(stolenExp: number): number {
  if (stolenExp >= 140) return 0xff5544
  if (stolenExp >= 70) return 0x55aaff
  return 0xffffff
}

export function drawCnoxGreedy(g: Graphics, size: number, stolenExp: number): void {
  const core = getCnoxGreedyCoreColor(stolenExp)
  g.clear()
  g.poly([
    0, -size,
    size * 0.9, -size * 0.18,
    size * 0.62, size * 0.68,
    0, size * 0.9,
    -size * 0.72, size * 0.58,
    -size * 0.95, -size * 0.12,
  ]).fill(0x9b5627)
  g.poly([
    0, -size * 0.72,
    size * 0.56, -size * 0.12,
    size * 0.4, size * 0.46,
    0, size * 0.62,
    -size * 0.46, size * 0.42,
    -size * 0.62, -size * 0.08,
  ]).fill(0xc57a34)
  g.circle(0, 0, size * 0.26).fill(core)
  g.circle(0, 0, size * 0.14).fill({ color: 0xfff2d4, alpha: 0.92 })
  for (const [sx, sy] of [[-0.78, -0.18], [0.74, -0.1], [0.55, 0.58], [-0.46, 0.68]]) {
    g.poly([
      size * sx, size * sy,
      size * (sx + 0.12), size * (sy + 0.2),
      size * (sx - 0.08), size * (sy + 0.26),
    ]).fill(0x5f2a18)
  }
}

export function spawnCnoxGreedy(ctx: GameContext, game: GameStore): void {
  const size = 10 + Math.random() * 3
  const barW = size * 2.2
  const maxHp = 22 + game.currentStage * 9
  const body = new Graphics()
  drawCnoxGreedy(body, size, 0)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 8
  hpBar.y = -size - 8
  const container = new Container()
  container.addChild(body, hpBarBg, hpBar)
  container.x = GAME_W * 0.15 + Math.random() * GAME_W * 0.7
  container.y = -34
  ctx.gameLayer.addChild(container)
  const e: Enemy = {
    container, body, hpBarBg, hpBar,
    kind: 'cnox_greedy',
    vy: 1.5 + Math.random() * 0.4,
    vx: 0,
    hp: maxHp,
    maxHp,
    barW,
    shootTimer: 180 + Math.random() * 70,
    pioneerPhase: 'enter',
    enterTargetX: container.x,
    enterTargetY: 90 + Math.random() * 120,
    formTargetX: container.x,
    formTargetY: 90 + Math.random() * 120,
    cnoxStolenExp: 0,
    cnoxPowerMult: 1,
    cnoxBaseMaxHp: maxHp,
    cnoxBaseBarW: barW,
    cnoxBaseSize: size,
    cnoxSplitDepth: 0,
  }
  ctx.enemies.push(e)
  game.stageEnemiesTotal++
}