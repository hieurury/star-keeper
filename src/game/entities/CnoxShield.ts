import { Container, Graphics } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_H, GAME_W } from '../constants'
import { redrawHpBar } from '../utils'

type GameStore = ReturnType<typeof useGameStore>

export function drawCnoxShieldBody(g: Graphics, size: number): void {
  g.clear()
  g.poly([0, -size, size * 0.72, 0, 0, size, -size * 0.72, 0]).fill(0x1f3355)
  g.poly([0, -size * 0.68, size * 0.42, 0, 0, size * 0.68, -size * 0.42, 0]).fill(0x4f84cc)
  g.circle(0, 0, size * 0.18).fill(0xaed8ff)
}

export function drawCnoxShieldOrb(g: Graphics, size: number): void {
  g.clear()
  g.rect(-size * 0.3, -size * 0.8, size * 0.6, size * 1.6).fill(0x6ab7ff)
  g.rect(-size * 0.18, -size * 0.56, size * 0.36, size * 1.12).fill(0xdff4ff)
}

export function spawnCnoxShieldWall(ctx: GameContext, game: GameStore): void {
  const count = 4 + Math.floor(Math.random() * 4)
  const startX = GAME_W * 0.5 - (count - 1) * 22
  const spawnLowerBand = Math.random() < 0.38
  const targetY = spawnLowerBand
    ? GAME_H * 0.36 + Math.random() * GAME_H * 0.12
    : GAME_H * 0.16 + Math.random() * GAME_H * 0.16
  for (let idx = 0; idx < count; idx++) {
    const size = 11 + Math.random() * 2
    const barW = size * 2.6
    const maxHp = 60 + game.currentStage * 22
    const body = new Graphics()
    drawCnoxShieldBody(body, size)
    const shieldA = new Graphics()
    const shieldB = new Graphics()
    const shieldC = new Graphics()
    const shieldD = new Graphics()
    drawCnoxShieldOrb(shieldA, size * 0.95)
    drawCnoxShieldOrb(shieldB, size * 0.95)
    drawCnoxShieldOrb(shieldC, size * 0.95)
    drawCnoxShieldOrb(shieldD, size * 0.95)
    const hpBarBg = new Graphics()
    const hpBar = new Graphics()
    redrawHpBar(hpBarBg, hpBar, 1, barW)
    hpBarBg.y = -size - 8
    hpBar.y = -size - 8
    const container = new Container()
    container.addChild(body, shieldA, shieldB, shieldC, shieldD, hpBarBg, hpBar)
    container.x = Math.random() < 0.5 ? -40 : GAME_W + 40
    container.y = targetY + (Math.random() - 0.5) * 10
    ctx.gameLayer.addChild(container)
    const e: Enemy = {
      container, body, hpBarBg, hpBar,
      kind: 'cnox_shield',
      vy: 0,
      vx: 0,
      hp: maxHp,
      maxHp,
      barW,
      pioneerPhase: 'enter',
      enterTargetX: startX + idx * 44,
      enterTargetY: targetY + (Math.random() - 0.5) * 8,
      formTargetX: startX + idx * 44,
      formTargetY: targetY,
      cnoxShields: [shieldA, shieldB, shieldC, shieldD],
      cnoxShieldAngle: Math.random() * Math.PI * 2,
    }
    ctx.enemies.push(e)
    game.stageEnemiesTotal++
  }
}