import { Container, Graphics } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_H, GAME_W } from '../constants'
import { redrawHpBar } from '../utils'

type GameStore = ReturnType<typeof useGameStore>

export function drawCnoxSpark(g: Graphics, size: number): void {
  g.clear()
  g.poly([0, -size * 1.05, size * 0.3, -size * 0.24, 0, size * 0.16, -size * 0.3, -size * 0.24]).fill(0xffffff)
  g.poly([0, size * 0.98, size * 0.28, size * 0.24, 0, -size * 0.12, -size * 0.28, size * 0.24]).fill(0xf0dbff)
  g.poly([-size * 0.98, 0, -size * 0.24, -size * 0.28, size * 0.12, 0, -size * 0.24, size * 0.28]).fill(0x7d48ff)
  g.poly([size * 0.98, 0, size * 0.24, -size * 0.28, -size * 0.12, 0, size * 0.24, size * 0.28]).fill(0x7d48ff)
  g.circle(0, 0, size * 0.34).fill(0x9c6aff)
  g.circle(0, 0, size * 0.18).fill(0xffffff)
}

export function spawnCnoxSparkGroup(ctx: GameContext, game: GameStore): void {
  const count = 2 + Math.floor(Math.random() * 3)
  const baseX = GAME_W * 0.18 + Math.random() * GAME_W * 0.55
  const baseY = GAME_H * 0.06 + Math.random() * GAME_H * 0.10
  for (let idx = 0; idx < count; idx++) {
    const size = 11 + Math.random() * 3
    const barW = size * 2.5
    const maxHp = 34 + game.currentStage * 14
    const body = new Graphics()
    drawCnoxSpark(body, size)
    const hpBarBg = new Graphics()
    const hpBar = new Graphics()
    redrawHpBar(hpBarBg, hpBar, 1, barW)
    hpBarBg.y = -size - 8
    hpBar.y = -size - 8
    const warn = new Graphics()
    const laser = new Graphics()
    const container = new Container()
    container.addChild(body, warn, laser, hpBarBg, hpBar)
    container.x = baseX + (idx - (count - 1) / 2) * 54
    container.y = -30 - idx * 16
    ctx.gameLayer.addChild(container)
    const e: Enemy = {
      container, body, hpBarBg, hpBar,
      kind: 'cnox_spark',
      vy: 0.8,
      vx: 0,
      hp: maxHp,
      maxHp,
      barW,
      pioneerPhase: 'enter',
      enterTargetX: container.x,
      enterTargetY: baseY + (Math.random() - 0.5) * 18,
      formTargetX: container.x,
      formTargetY: baseY,
      cnoxWarnGfx: warn,
      cnoxLaserGfx: laser,
      cnoxLaserState: 'idle',
      cnoxLaserTimer: 150 + Math.random() * 110,
    }
    ctx.enemies.push(e)
    game.stageEnemiesTotal++
  }
}