import { Graphics, Container } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_W, GAME_H } from '../constants'
import { redrawHpBar, dist2 } from '../utils'
import { drawEnemyBullet } from '../projectiles/index'
import { makePioneer } from './Pioneer'

type GameStore = ReturnType<typeof useGameStore>

// ─── Graphics ─────────────────────────────────────────────────────────────────
export function drawSniper(g: Graphics, size: number): void {
  g.clear()
  g.rect(-size * 0.25, -size * 0.7, size * 0.5, size * 1.2).fill(0x228833)
  g.poly([-size * 0.25, -size * 0.1, -size * 1.1, size * 0.4, -size * 0.25, size * 0.25]).fill(0x115522)
  g.poly([size * 0.25, -size * 0.1, size * 1.1, size * 0.4, size * 0.25, size * 0.25]).fill(0x115522)
  g.rect(-size * 0.12, -size * 0.7, size * 0.24, size * 0.55).fill(0x44ff88)
  g.circle(-size * 0.7, size * 0.3, size * 0.12).fill({ color: 0x44ff88, alpha: 0.7 })
  g.circle(size * 0.7, size * 0.3, size * 0.12).fill({ color: 0x44ff88, alpha: 0.7 })
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
export function spawnSniperGroup(ctx: GameContext, game: GameStore, withEscort = false): void {
  const size = Math.random() * 5 + 14
  const barW = size * 2.8
  const body = new Graphics()
  drawSniper(body, size)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  const maxHp = 12 + game.currentStage * 10
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 10
  hpBar.y = -size - 10
  const container = new Container()
  container.addChild(body, hpBarBg, hpBar)
  const sniperX = GAME_W * 0.2 + Math.random() * GAME_W * 0.6
  const sniperY = GAME_H * 0.10 + Math.random() * GAME_H * 0.12
  container.x = sniperX
  container.y = -40
  ctx.gameLayer.addChild(container)
  const sniper: Enemy = {
    container, body, hpBarBg, hpBar,
    kind: 'sniper',
    vy: 0.4 + Math.random() * 0.3,
    vx: 0,
    hp: maxHp, maxHp, barW,
    shootTimer: 200 + Math.random() * 100,
    dodgeCooldown: 0,
    formTargetX: sniperX,
    formTargetY: sniperY,
    pioneerPhase: 'enter',
    enterTargetX: sniperX,
    enterTargetY: sniperY,
    approachTimer: 999999,
  }
  ctx.enemies.push(sniper)
  game.stageEnemiesTotal++

  if (withEscort) {
    const escortCount = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < escortCount; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const rank = Math.floor(i / 2)
      const formX = sniperX + side * (55 + rank * 44)
      const formY = sniperY + rank * 30
      const e = makePioneer(ctx, game, -40 + (side < 0 ? 0 : GAME_W + 80), formY - 80, formX, formY)
      e.approachTimer = 999999
      ctx.enemies.push(e)
      game.stageEnemiesTotal++
    }
  }
}

// ─── AI Update ────────────────────────────────────────────────────────────────
/** Returns true if the enemy was removed from the array. */
export function updateSniper(ctx: GameContext, game: GameStore, e: Enemy, i: number, dt: number): boolean {
  if (e.pioneerPhase === 'enter') {
    const dx = (e.enterTargetX ?? e.container.x) - e.container.x
    const dy = (e.enterTargetY ?? e.container.y) - e.container.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const speed = 2.8
    if (dist < speed * dt * 2) {
      e.container.x = e.enterTargetX ?? e.container.x
      e.container.y = e.enterTargetY ?? e.container.y
      e.pioneerPhase = 'patrol'
    } else {
      e.container.x += (dx / dist) * speed * dt
      e.container.y += (dy / dist) * speed * dt
    }
  } else {
    const t = Date.now() / 1000
    e.container.x += Math.sin(t * 0.75 + (e.formTargetX ?? 0) * 0.011) * 0.65 * dt
    e.container.x = Math.max(30, Math.min(GAME_W - 30, e.container.x))
  }

  e.shootTimer = (e.shootTimer ?? 300) - dt
  if (e.shootTimer <= 0) {
    e.shootTimer = 290 + Math.random() * 60
    if (ctx.playerShip) {
      const tx = ctx.playerShip.x - e.container.x
      const ty = ctx.playerShip.y - e.container.y
      const mag = Math.sqrt(tx * tx + ty * ty) || 1
      const spd = 3.5
      const bg = new Graphics()
      drawEnemyBullet(bg)
      bg.x = e.container.x
      bg.y = e.container.y + 10
      ctx.gameLayer.addChild(bg)
      ctx.enemyBullets.push({ gfx: bg, vx: (tx / mag) * spd, vy: (ty / mag) * spd })
    }
  }

  // Smooth dodge toward dodgeTarget
  if (e.dodgeTarget !== undefined) {
    const ddx = e.dodgeTarget - e.container.x
    const step = Math.min(Math.abs(ddx), 9 * dt) * Math.sign(ddx)
    e.container.x += step
    if (Math.abs(ddx) < 1.5) { e.container.x = e.dodgeTarget; e.dodgeTarget = undefined }
  }
  e.dodgeCooldown = Math.max(0, (e.dodgeCooldown ?? 0) - dt)
  if (e.dodgeCooldown <= 0 && e.dodgeTarget === undefined) {
    for (const b of ctx.bullets) {
      if (dist2(b.gfx.x, b.gfx.y, e.container.x, e.container.y) < 55 * 55) {
        if (Math.random() < 0.05) {
          const dir = Math.random() < 0.5 ? -1 : 1
          e.dodgeTarget = Math.max(30, Math.min(GAME_W - 30, e.container.x + dir * 50))
          e.dodgeCooldown = 100
        }
        break
      }
    }
  }

  if (e.container.y > GAME_H + 40) {
    ctx.gameLayer.removeChild(e.container)
    ctx.enemies.splice(i, 1)
    game.stageEnemiesKilled++
    return true
  }
  return false
}
