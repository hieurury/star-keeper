import { Container, Graphics } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_H, GAME_W } from '../constants'
import { redrawHpBar } from '../utils'

type GameStore = ReturnType<typeof useGameStore>

// ─── Drawing ──────────────────────────────────────────────────────────────────
export function drawDnoxIce(g: Graphics, size: number): void {
  g.clear()
  // Vòng xoay băng bên ngoài (2 khối)
  for (const [ax, ay] of [[-1, 0], [1, 0]]) {
    const bx = ax * size * 0.88
    const by = ay * size * 0.88
    // Khối băng hình thoi
    g.poly([
      bx,          by - size * 0.42,
      bx + size * 0.18, by,
      bx,          by + size * 0.42,
      bx - size * 0.18, by,
    ]).fill({ color: 0x88ddff, alpha: 0.82 })
    g.poly([
      bx,          by - size * 0.30,
      bx + size * 0.12, by,
      bx,          by + size * 0.30,
      bx - size * 0.12, by,
    ]).fill({ color: 0xe0f8ff, alpha: 0.75 })
  }
  // Lõi cầu lam
  g.circle(0, 0, size * 0.52).fill({ color: 0x2266cc, alpha: 0.95 })
  g.circle(0, 0, size * 0.40).fill({ color: 0x55aaff, alpha: 0.90 })
  g.circle(0, 0, size * 0.22).fill({ color: 0xccecff, alpha: 0.95 })
  g.circle(0, 0, size * 0.10).fill({ color: 0xffffff, alpha: 0.95 })
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
export function spawnDnoxIce(ctx: GameContext, game: GameStore): void {
  const size = 11 + Math.random() * 3
  const barW = size * 2.4
  const maxHp = 44 + game.currentStage * 16

  const body = new Graphics()
  drawDnoxIce(body, size)

  // Orbital ice shards (spinning decoration)
  const iceA = new Graphics()
  const iceB = new Graphics()
  drawDnoxIceOrb(iceA, size * 0.80)
  drawDnoxIceOrb(iceB, size * 0.80)

  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 10
  hpBar.y = -size - 10

  const warnGfx = new Graphics()   // cảnh báo đạn
  const container = new Container()
  container.addChild(body, iceA, iceB, hpBarBg, hpBar)
  // Spawn từ trên xuống, giữ tầng bay cao để gây áp lực tầm xa.
  container.x = GAME_W * 0.18 + Math.random() * GAME_W * 0.64
  container.y = -36
  ctx.gameLayer.addChild(container)
  ctx.gameLayer.addChild(warnGfx)

  const enterTargetY = GAME_H * 0.05 + Math.random() * GAME_H * 0.12

  const e: Enemy = {
    container, body, hpBarBg, hpBar,
    kind: 'dnox_ice',
    vy: 1.0 + Math.random() * 0.3,
    vx: 0,
    hp: maxHp,
    maxHp,
    barW,
    pioneerPhase: 'enter',
    enterTargetX: container.x,
    enterTargetY,
    formTargetX: container.x,
    formTargetY: enterTargetY,
    // Reuse cnox fields
    cnoxShields: [iceA, iceB],       // rotating ice orbs
    cnoxShieldAngle: Math.random() * Math.PI * 2,
    cnoxWarnGfx: warnGfx,
    cnoxLaserTimer: 110 + Math.random() * 60,  // shoot cooldown
    cnoxLaserState: 'idle',
  }
  ctx.enemies.push(e)
  game.stageEnemiesTotal++
}

function drawDnoxIceOrb(g: Graphics, size: number): void {
  g.clear()
  g.poly([
    0, -size * 0.55,
    size * 0.22, 0,
    0,  size * 0.55,
    -size * 0.22, 0,
  ]).fill({ color: 0x88cfff, alpha: 0.80 })
  g.poly([
    0, -size * 0.38,
    size * 0.14, 0,
    0,  size * 0.38,
    -size * 0.14, 0,
  ]).fill({ color: 0xddf4ff, alpha: 0.80 })
}

export function cleanupDnoxIce(e: Enemy): void {
  if (e.cnoxWarnGfx && !e.cnoxWarnGfx.destroyed) {
    e.cnoxWarnGfx.clear()
    if (e.cnoxWarnGfx.parent) e.cnoxWarnGfx.parent.removeChild(e.cnoxWarnGfx)
  }
}

// ─── Freeze state (player-level state, managed in GameCanvas) ─────────────────
// We expose helpers that GameCanvas can call.

/** Player tê cóng state.  Managed externally in GameCanvas context vars. */
export interface FrostState {
  frostStacks: number        // 0 = nothing, 1 = tê cóng, 2 = đóng băng trigger
  isFrozen: boolean
  freezeTimer: number        // frames remaining frozen
  freezeTapCount: number     // player taps while frozen
}

export const FREEZE_DURATION = 120  // 2s at 60fps
export const FREEZE_TAP_BREAK = 3   // taps needed to break
