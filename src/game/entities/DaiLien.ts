import { Graphics, Container } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_W, GAME_H } from '../constants'
import { redrawHpBar } from '../utils'

type GameStore = ReturnType<typeof useGameStore>

// ─── Graphics ─────────────────────────────────────────────────────────────────
export function drawDaiLien(g: Graphics, size: number): void {
  g.clear()
  // Main diamond body (light blue)
  g.poly([0, -size, size * 0.55, 0, 0, size * 0.65, -size * 0.55, 0]).fill(0x88ccff)
  // Inner highlight
  g.poly([0, -size * 0.6, size * 0.3, 0, 0, size * 0.4, -size * 0.3, 0]).fill(0xddf0ff)
  // Left wing diamond
  g.poly([-size * 0.55, 0, -size * 1.15, -size * 0.3, -size * 0.85, size * 0.22, -size * 0.4, size * 0.08]).fill(0x66aadd)
  // Right wing diamond
  g.poly([size * 0.55, 0, size * 1.15, -size * 0.3, size * 0.85, size * 0.22, size * 0.4, size * 0.08]).fill(0x66aadd)
  // Top small diamond (antenna)
  g.poly([0, -size * 1.2, size * 0.22, -size * 0.82, 0, -size * 0.6, -size * 0.22, -size * 0.82]).fill(0xbbeeff)
  // Engine glow
  g.rect(-size * 0.08, size * 0.48, size * 0.16, size * 0.18).fill({ color: 0x66ccff, alpha: 0.9 })
}

// ─── Elongated bullet ─────────────────────────────────────────────────────────
export function drawDaiLienBullet(g: Graphics): void {
  g.clear()
  g.rect(-1.8, -7, 3.6, 14).fill(0x55bbff)
  g.rect(-0.9, -7, 1.8, 14).fill({ color: 0xeef8ff, alpha: 0.9 })
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
export function spawnDaiLienPair(ctx: GameContext, game: GameStore): void {
  const stage = game.currentStage
  const count = 1 + (Math.random() < 0.78 ? 1 : 0) + (stage >= 22 && Math.random() < 0.2 ? 1 : 0) // 1-2 (rare 3 at high stage)
  const anchorX = GAME_W * 0.2 + Math.random() * GAME_W * 0.6
  const anchorY = GAME_H * 0.06 + Math.random() * GAME_H * 0.11
  const spacing = 54

  for (let idx = 0; idx < count; idx++) {
    const formX = anchorX + (idx - (count - 1) / 2) * spacing
    const formY = anchorY
    const size = 11 + Math.random() * 4
    const barW = size * 2.5
    const maxHp = 32 + game.currentStage * 17  // trung bình
    const body = new Graphics()
    drawDaiLien(body, size)
    const hpBarBg = new Graphics()
    const hpBar = new Graphics()
    redrawHpBar(hpBarBg, hpBar, 1, barW)
    hpBarBg.y = -size - 7
    hpBar.y = -size - 7
    const container = new Container()
    container.addChild(body, hpBarBg, hpBar)
    container.x = formX + (Math.random() - 0.5) * 30
    container.y = -45
    ctx.gameLayer.addChild(container)
    const e: Enemy = {
      container, body, hpBarBg, hpBar,
      kind: 'dai_lien',
      vy: 2.3 + game.currentStage * 0.07,
      vx: 0,
      hp: maxHp, maxHp, barW,
      pioneerPhase: 'enter',
      enterTargetX: formX,
      enterTargetY: formY,
      formTargetX: formX,
      formTargetY: formY,
      approachTimer: 999999,
      shootTimer: 36 + Math.random() * 24,
    }
    ctx.enemies.push(e)
    game.stageEnemiesTotal++
  }
}
