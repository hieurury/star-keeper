import { Graphics, Container } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_W, GAME_H } from '../constants'
import { redrawHpBar } from '../utils'

type GameStore = ReturnType<typeof useGameStore>

// ─── Graphics ─────────────────────────────────────────────────────────────────
export function drawPioneer(g: Graphics, size: number): void {
  g.clear()
  g.poly([0, -size, size * 0.7, 0, 0, size * 0.55, -size * 0.7, 0]).fill(0xcc2266)
  g.poly([0, -size * 0.5, size * 0.35, 0, 0, size * 0.3, -size * 0.35, 0]).fill(0x881144)
  g.circle(0, -size * 0.15, size * 0.2).fill(0xff44aa)
  g.rect(-size * 0.08, size * 0.35, size * 0.16, size * 0.22).fill({ color: 0xff2200, alpha: 0.8 })
}

// ─── Factory ──────────────────────────────────────────────────────────────────
export function makePioneer(
  ctx: GameContext,
  game: GameStore,
  startX: number,
  startY: number,
  formX: number,
  formY: number,
): Enemy {
  const size = Math.random() * 6 + 13
  const barW = size * 2.4
  const maxHp = 28 + game.currentStage * 18
  const body = new Graphics()
  drawPioneer(body, size)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 8
  hpBar.y = -size - 8
  const container = new Container()
  container.addChild(body, hpBarBg, hpBar)
  container.x = startX
  container.y = startY
  ctx.gameLayer.addChild(container)
  return {
    container, body, hpBarBg, hpBar,
    kind: 'pioneer',
    vy: 2.0 + game.currentStage * 0.1,
    vx: 0,
    hp: maxHp, maxHp, barW,
    pioneerPhase: 'enter',
    enterTargetX: formX,
    enterTargetY: formY,
    formTargetX: formX,
    formTargetY: formY,
    approachTimer: 0,
  }
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
export function spawnPioneerSquad(
  ctx: GameContext,
  game: GameStore,
  formation: 'line' | 'diamond' | 'box' = 'line',
  entry: 'top' | 'left' | 'right' = 'top',
): void {
  const count = 6 + Math.floor(Math.random() * 4)
  const stage = game.currentStage
  const positions: [number, number][] = []
  const spacing = 44

  if (formation === 'line') {
    for (let i = 0; i < count; i++) positions.push([(i - (count - 1) / 2) * spacing, 0])
  } else if (formation === 'diamond') {
    const rows = Math.ceil(count / 2)
    let idx = 0
    for (let r = 0; r < rows && idx < count; r++) {
      const inRow = r === 0 || r === rows - 1 ? 1 : 2
      for (let c = 0; c < inRow && idx < count; c++) {
        positions.push([(c - (inRow - 1) / 2) * spacing, (r - (rows - 1) / 2) * spacing])
        idx++
      }
    }
  } else {
    const cols = Math.ceil(Math.sqrt(count))
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols), c = i % cols
      positions.push([(c - (cols - 1) / 2) * spacing, r * spacing])
    }
  }

  const anchorX = GAME_W * 0.2 + Math.random() * GAME_W * 0.6
  const anchorY = GAME_H * 0.12 + Math.random() * GAME_H * 0.18
  const squadId = ctx.nextSquadId++
  ctx.flockStates.set(squadId, {
    x: anchorX, y: anchorY,
    tx: GAME_W * 0.1 + Math.random() * GAME_W * 0.8,
    ty: GAME_H * 0.08 + Math.random() * GAME_H * 0.70,
    timer: 150 + Math.random() * 100,
  })

  for (const [rx, ry] of positions) {
    const formX = anchorX + rx
    const formY = anchorY + Math.abs(ry)
    let startX: number, startY: number
    if (entry === 'top') {
      startX = formX + (Math.random() - 0.5) * 30; startY = -40
    } else if (entry === 'left') {
      startX = -40; startY = formY
    } else {
      startX = GAME_W + 40; startY = formY
    }
    const e = makePioneer(ctx, game, startX, startY, formX, formY)
    e.squadId = squadId
    e.formOffsetX = rx
    e.formOffsetY = Math.abs(ry)
    e.approachTimer = 80 + Math.abs(ry / spacing) * 40 + stage * 2
    ctx.enemies.push(e)
    game.stageEnemiesTotal++
  }
}

// ─── AI Update ────────────────────────────────────────────────────────────────
/** Returns true if the enemy was removed from the array. */
export function updatePioneer(ctx: GameContext, game: GameStore, e: Enemy, i: number, dt: number): boolean {
  if (e.pioneerPhase === 'enter') {
    const dx = (e.enterTargetX ?? e.formTargetX ?? e.container.x) - e.container.x
    const dy = (e.enterTargetY ?? e.formTargetY ?? e.container.y) - e.container.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const speed = 2.2 + game.currentStage * 0.05
    if (dist < speed * dt * 2) {
      e.container.x = e.enterTargetX ?? e.formTargetX ?? e.container.x
      e.container.y = e.enterTargetY ?? e.formTargetY ?? e.container.y
      e.pioneerPhase = 'patrol'
      e.approachTimer = (e.approachTimer ?? 0) || (180 + Math.random() * 120)
    } else {
      e.container.x += (dx / dist) * speed * dt
      e.container.y += (dy / dist) * speed * dt
    }
  } else if (e.pioneerPhase === 'patrol') {
    const t = Date.now() / 1000 + (e.formTargetX ?? 0) * 0.01
    e.container.x += Math.sin(t * 1.3) * 0.4 * dt
    e.container.y += Math.cos(t * 0.9) * 0.25 * dt
    if ((e.approachTimer ?? 0) > 0) {
      e.approachTimer = (e.approachTimer ?? 0) - dt
      if ((e.approachTimer ?? 0) <= 0) e.pioneerPhase = 'approach'
    }
  } else {
    // Flock roam — follow shared squad anchor + own offset
    const fs = e.squadId != null ? ctx.flockStates.get(e.squadId) : null
    if (fs) {
      const tx = fs.x + (e.formOffsetX ?? 0)
      const ty = fs.y + (e.formOffsetY ?? 0)
      const dx = tx - e.container.x
      const dy = ty - e.container.y
      const d = Math.sqrt(dx * dx + dy * dy)
      const speed = 1.6 + game.currentStage * 0.06
      if (d > 3) {
        e.container.x += (dx / d) * speed * dt
        e.container.y += (dy / d) * speed * dt
      }
    }
  }
  if (e.container.y > GAME_H + 60 || e.container.x < -60 || e.container.x > GAME_W + 60) {
    ctx.gameLayer.removeChild(e.container)
    ctx.enemies.splice(i, 1)
    game.stageEnemiesKilled++
    return true
  }
  return false
}
