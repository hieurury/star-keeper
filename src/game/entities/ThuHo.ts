import { Graphics, Container } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_W, GAME_H } from '../constants'
import { redrawHpBar } from '../utils'

type GameStore = ReturnType<typeof useGameStore>

// ─── Graphics ─────────────────────────────────────────────────────────────────
export function drawThuHo(g: Graphics, size: number, glowing = false): void {
  g.clear()
  // Front shield (gold / platinum)
  const shieldOuter = glowing ? 0xffffc0 : 0xffd700
  const shieldInner = glowing ? 0xffffff : 0xe8d44d
  g.poly([0, -size * 1.0, size * 0.75, -size * 0.1, size * 0.55, size * 0.35,
          0, size * 0.5, -size * 0.55, size * 0.35, -size * 0.75, -size * 0.1]).fill(shieldOuter)
  // Shield inner bevel
  g.poly([0, -size * 0.75, size * 0.5, -size * 0.05, size * 0.35, size * 0.22,
          0, size * 0.32, -size * 0.35, size * 0.22, -size * 0.5, -size * 0.05]).fill(shieldInner)
  // Body circle (platinum)
  const bodyColor = glowing ? 0xffffff : 0xd8d8e8
  g.circle(0, size * 0.22, size * 0.38).fill(bodyColor)
  g.circle(0, size * 0.22, size * 0.22).fill(glowing ? 0xffee88 : 0xffd700)
  g.circle(0, size * 0.22, size * 0.1).fill(glowing ? 0xffffff : 0xaaaaaa)
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
/** Spawns a swarm of Thủ Hộ that forms a tight blocking line. */
export function spawnThuHoSwarm(ctx: GameContext, game: GameStore): void {
  const count = 4 + Math.floor(Math.random() * 5) // 4-8
  const spacing = 30 // nearly touching
  const lineY = GAME_H * 0.22 + Math.random() * GAME_H * 0.3
  const lineX = GAME_W * 0.5 - (count - 1) * spacing * 0.5
  const side = Math.random() < 0.5 ? 'left' : 'right'

  for (let idx = 0; idx < count; idx++) {
    const formX = lineX + idx * spacing
    const formY = lineY + (Math.random() - 0.5) * 8
    const startX = side === 'left' ? -50 : GAME_W + 50
    const size = 12 + Math.random() * 4
    const barW = size * 2.8
    const maxHp = 55 + game.currentStage * 28
    const body = new Graphics()
    drawThuHo(body, size)
    const hpBarBg = new Graphics()
    const hpBar = new Graphics()
    redrawHpBar(hpBarBg, hpBar, 1, barW)
    hpBarBg.y = -size - 9
    hpBar.y = -size - 9
    const container = new Container()
    container.addChild(body, hpBarBg, hpBar)
    container.x = startX
    container.y = formY
    ctx.gameLayer.addChild(container)
    const e: Enemy = {
      container, body, hpBarBg, hpBar,
      kind: 'thu_ho',
      vy: 0,
      vx: side === 'left' ? 3.2 : -3.2,
      hp: maxHp, maxHp, barW,
      pioneerPhase: 'enter',
      enterTargetX: formX,
      enterTargetY: formY,
      formTargetX: formX,
      formTargetY: formY,
      approachTimer: 999999,
      reflectCooldown: 300 + Math.random() * 120,
    }
    ctx.enemies.push(e)
    game.stageEnemiesTotal++
  }
}
