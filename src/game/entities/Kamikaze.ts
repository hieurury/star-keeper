import { Graphics, Container, Text, TextStyle } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_W, GAME_H } from '../constants'
import { redrawHpBar, dist2 } from '../utils'
import { spawnExplosion, screenFlash, spawnDamageText } from '../systems/effects'

type GameStore = ReturnType<typeof useGameStore>

// ─── Graphics ─────────────────────────────────────────────────────────────────
export function drawKamikaze(g: Graphics, size: number): void {
  g.clear()
  g.poly([0, -size, size * 0.55, size * 0.3, size * 0.2, size * 0.5, -size * 0.2, size * 0.5, -size * 0.55, size * 0.3]).fill(0xdd4400)
  g.poly([size * 0.55, size * 0.3, size * 1.1, size * 0.05, size * 0.65, size * 0.5]).fill(0xff6600)
  g.poly([-size * 0.55, size * 0.3, -size * 1.1, size * 0.05, -size * 0.65, size * 0.5]).fill(0xff6600)
  g.circle(0, size * 0.1, size * 0.25).fill(0xffaa00)
}

// ─── Factory ──────────────────────────────────────────────────────────────────
function makeKamikazeEntity(ctx: GameContext, game: GameStore, startX: number, startY: number, initialState: 'descend' | 'aim'): Enemy {
  const size = Math.random() * 5 + 16
  const barW = size * 2.8
  const body = new Graphics()
  drawKamikaze(body, size)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  const maxHp = 30 + game.currentStage * 22
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 10
  hpBar.y = -size - 10
  const warnStyle = new TextStyle({ fill: 0xffdd00, fontSize: 16, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 'bold' })
  const warnSign = new Text({ text: '!!', style: warnStyle })
  warnSign.anchor.set(0.5, 1)
  warnSign.y = -size - 14
  warnSign.visible = false
  const aimLine = new Graphics()
  aimLine.visible = false
  const container = new Container()
  container.addChild(body, hpBarBg, hpBar, warnSign, aimLine)
  container.x = startX
  container.y = startY
  ctx.gameLayer.addChild(container)
  return {
    container, body, hpBarBg, hpBar,
    kind: 'kamikaze',
    vy: 1.2 + Math.random() * 0.6 + game.currentStage * 0.08,
    vx: 0,
    hp: maxHp, maxHp, barW,
    kamiState: initialState,
    kamiTimer: 0,
    warnSign, aimLine,
    targetX: 0, targetY: 0,
  }
}

export function spawnKamikaze(ctx: GameContext, game: GameStore): void {
  const e = makeKamikazeEntity(ctx, game, Math.random() * (GAME_W - 80) + 40, -40, 'descend')
  ctx.enemies.push(e)
  game.stageEnemiesTotal++
}

/** Variant used by boss turrets — starts at a given position and immediately aims. */
export function spawnKamikazeAt(ctx: GameContext, game: GameStore, startX: number, startY: number): void {
  const e = makeKamikazeEntity(ctx, game, startX, startY, 'aim')
  ctx.enemies.push(e)
  game.stageEnemiesTotal++
}

// ─── AI Update ────────────────────────────────────────────────────────────────
/** Returns true if the enemy was removed from the array. */
export function updateKamikaze(ctx: GameContext, game: GameStore, e: Enemy, i: number, dt: number): boolean {
  e.kamiTimer = (e.kamiTimer ?? 0) + dt

  if (e.kamiState === 'descend') {
    e.container.y += e.vy * dt
    if (ctx.playerShip &&
      e.container.y > 0 &&
      Math.abs(e.container.x - ctx.playerShip.x) < 140 &&
      e.container.y < ctx.playerShip.y - 40) {
      e.kamiState = 'aim'
      e.kamiTimer = 0
      e.targetX = ctx.playerShip.x
      e.targetY = ctx.playerShip.y
      if (e.warnSign) e.warnSign.visible = true
      if (e.aimLine) e.aimLine.visible = true
    }
    if (e.container.y > GAME_H + 40) {
      ctx.gameLayer.removeChild(e.container)
      ctx.enemies.splice(i, 1)
      return true
    }
  } else if (e.kamiState === 'aim') {
    e.container.y += e.vy * 0.2 * dt
    if (e.aimLine && ctx.playerShip) {
      const tx = ctx.playerShip.x - e.container.x
      const ty = ctx.playerShip.y - e.container.y
      e.aimLine.clear()
      e.aimLine.moveTo(0, 0).lineTo(tx, ty).stroke({ color: 0xff4400, width: 1, alpha: 0.6 })
      e.targetX = ctx.playerShip.x
      e.targetY = ctx.playerShip.y
    }
    if (e.warnSign) e.warnSign.alpha = Math.sin(e.kamiTimer * 0.25) > 0 ? 1 : 0.2
    if (e.kamiTimer >= 60) {
      e.kamiState = 'charge'
      e.kamiTimer = 0
      if (e.warnSign) e.warnSign.visible = false
      if (e.aimLine) e.aimLine.visible = false
      const tx = (e.targetX ?? GAME_W / 2) - e.container.x
      const ty = (e.targetY ?? GAME_H / 2) - e.container.y
      const mag = Math.sqrt(tx * tx + ty * ty) || 1
      const speed = 11.5
      e.vx = (tx / mag) * speed
      e.vy = (ty / mag) * speed
    }
  } else if (e.kamiState === 'charge') {
    e.container.x += e.vx * dt
    e.container.y += e.vy * dt
    if (ctx.playerShip && dist2(e.container.x, e.container.y, ctx.playerShip.x, ctx.playerShip.y) < 22 * 22) {
      e.kamiState = 'dead'
    } else if (
      dist2(e.container.x, e.container.y, e.targetX ?? 0, e.targetY ?? 0) < 20 * 20 ||
      e.kamiTimer >= 90 ||
      e.container.y > GAME_H + 60 || e.container.y < -60
    ) {
      e.kamiState = 'prexplode'
      e.kamiTimer = 0
      e.vx = 0; e.vy = 0
    }
  } else if (e.kamiState === 'prexplode') {
    e.body.alpha = Math.floor(e.kamiTimer / 4) % 2 === 0 ? 1 : 0.12
    if (e.kamiTimer >= 30) { e.body.alpha = 1; e.kamiState = 'dead' }
  }

  if (e.kamiState === 'dead') {
    spawnExplosion(ctx, e.container.x, e.container.y, 18, 0xff4400, 0xffcc00)
    if (ctx.playerShip) {
      const d = Math.sqrt(dist2(e.container.x, e.container.y, ctx.playerShip.x, ctx.playerShip.y))
      if (d < 70) {
        const aoe = Math.round(35 * (1 - d / 70))
        game.takeDamage(aoe)
        screenFlash(ctx, 0xff6600, 0.5, 220)
        spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, aoe)
      }
    }
    game.addScore(15 + game.currentStage * 6)
    game.stageEnemiesKilled++
    ctx.gameLayer.removeChild(e.container)
    ctx.enemies.splice(i, 1)
    return true
  }
  return false
}
