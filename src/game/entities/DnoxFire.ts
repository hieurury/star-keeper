import { Container, Graphics } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_H, GAME_W } from '../constants'
import { redrawHpBar } from '../utils'

type GameStore = ReturnType<typeof useGameStore>

const DNOX_FIRE_WARNING_FRAMES = 45 // 0.75s @ 60fps
const DNOX_FIRE_BEAM_FRAMES = 40
const DNOX_FIRE_COOL_DELAY = 60
const DNOX_FIRE_COOL_PER_FRAME = 0.006

// ─── Colour palette ───────────────────────────────────────────────────────────
// Heat-state 0 = red (đỏ), 1 = orange (cam), 2 = yellow (vàng), 3 = blue (lam)
export type DnoxFireHeatState = 0 | 1 | 2 | 3

export function getDnoxFireBodyColor(heat: number): { body: number; crystal: number; halo: number } {
  // heat is 0-1 normalised within current stage palette
  if (heat < 0.33) return { body: 0xcc2200, crystal: 0xff6633, halo: 0xff4411 } // đỏ
  if (heat < 0.66) return { body: 0xdd7700, crystal: 0xffcc00, halo: 0xffaa22 } // vàng cam
  return { body: 0x1144bb, crystal: 0x44bbff, halo: 0x2277ff }                    // lam
}

// heat 0-1 (0 = fresh, 1 = fully charged = blue)
export function drawDnoxFire(g: Graphics, size: number, heat: number): void {
  const { body, crystal, halo } = getDnoxFireBodyColor(heat)
  g.clear()
  // Hào quang (aura) pulse ring
  const auraAlpha = 0.18 + heat * 0.22
  g.circle(0, 0, size * 1.55).fill({ color: halo, alpha: auraAlpha })
  g.circle(0, 0, size * 1.25).fill({ color: halo, alpha: auraAlpha * 0.6 })
  // Thân chính – khối lục giác bo góc
  g.poly([
    0, -size,
    size * 0.88, -size * 0.48,
    size * 0.88,  size * 0.48,
    0,            size,
    -size * 0.88, size * 0.48,
    -size * 0.88, -size * 0.48,
  ]).fill(body)
  // Lớp pha lê bên trong
  g.poly([
    0, -size * 0.62,
    size * 0.54, -size * 0.30,
    size * 0.54,  size * 0.30,
    0,            size * 0.62,
    -size * 0.54, size * 0.30,
    -size * 0.54, -size * 0.30,
  ]).fill(crystal)
  // Lõi sáng
  g.circle(0, 0, size * 0.22).fill({ color: 0xffffff, alpha: 0.90 })
  // Trang trí cạnh
  for (const [px, py] of [[-0.82, -0.22], [0.82, -0.22], [0, 0.9]]) {
    g.circle(size * px, size * py, size * 0.07).fill({ color: 0xffffff, alpha: 0.4 })
  }
}

export function spawnDnoxFire(ctx: GameContext, game: GameStore, overrideX?: number, overrideY?: number): void {
  const size = 13 + Math.random() * 3
  const barW = size * 2.6
  const maxHp = 95 + game.currentStage * 28   // tank-chịu-đòn
  const body = new Graphics()
  drawDnoxFire(body, size, 0)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 10
  hpBar.y = -size - 10
  const fireballGfx = new Graphics()   // hoả cầu / hiệu ứng phóng (detached)
  const container = new Container()
  container.addChild(body, hpBarBg, hpBar)
  container.x = overrideX ?? (GAME_W * 0.12 + Math.random() * GAME_W * 0.76)
  container.y = overrideY ?? -40
  ctx.gameLayer.addChild(container)
  ctx.gameLayer.addChild(fireballGfx)

  const enterTargetY = GAME_H * 0.32 + Math.random() * GAME_H * 0.18

  const e: Enemy = {
    container, body, hpBarBg, hpBar,
    kind: 'dnox_fire',
    vy: 1.4 + Math.random() * 0.4,
    vx: 0,
    hp: maxHp,
    maxHp,
    barW,
    cnoxBaseSize: size,
    pioneerPhase: 'enter',
    enterTargetX: container.x,
    enterTargetY,
    formTargetX: container.x,
    formTargetY: enterTargetY,
    cnoxLaserGfx: fireballGfx,       // hoả cầu graphics (detached)
    cnoxLaserTimer: 0,
    cnoxLaserState: 'idle',
    cnoxLaserAngle: 0,
    dnoxFireCoolTimer: 0,
  }
  ctx.enemies.push(e)
  game.stageEnemiesTotal++
}

/** Called every frame from GameCanvas after bullet/damage is applied.
 *  Returns true if the fireball fired (causes the fireball to fly). */
export function updateDnoxFireHeat(e: Enemy, damageDealt: number, ctx: GameContext, game: GameStore): void {
  if (e.kind !== 'dnox_fire') return
  if (e.cnoxLaserState === 'firing' || e.cnoxLaserState === 'warning') return

  // Rage gain scales with incoming damage; large burst hits fill noticeably faster.
  const damageRatio = damageDealt / Math.max(1, e.maxHp)
  const burstBoost = 1 + Math.min(1.2, damageRatio * 3.2)
  const heatGain = damageRatio * 0.95 * burstBoost
  const prevHeat = e.cnoxLaserAngle ?? 0
  const newHeat = Math.min(1, prevHeat + heatGain)
  e.cnoxLaserAngle = newHeat
  e.dnoxFireCoolTimer = 0

  // Redraw body colour
  drawDnoxFire(e.body, e.cnoxBaseSize ?? 13, newHeat)

  if (prevHeat < 1 && newHeat >= 1) {
    e.cnoxLaserState = 'warning'
    e.cnoxLaserTimer = DNOX_FIRE_WARNING_FRAMES
  }
}

function beginDnoxFireball(e: Enemy, ctx: GameContext, game: GameStore): void {
  const dmgMult = e.cnoxPowerMult ?? 1
  const fireballDmg = Math.round(e.maxHp * 0.20 * dmgMult)
  const ex = e.container.x
  const ey = e.container.y
  e.cnoxLaserState = 'firing'
  e.cnoxLaserTimer = DNOX_FIRE_BEAM_FRAMES

  const fireW = 30
  const playerHit = ctx.playerShip
    ? Math.abs(ctx.playerShip.x - ex) <= fireW * 0.5 + 11
    : false
  if (playerHit && ctx.playerShip) {
    if (!game.absorbShieldHit()) {
      game.takeDamage(fireballDmg)
    }
    const heal = Math.round(e.maxHp * 0.20)
    e.hp = Math.min(e.maxHp, e.hp + heal)
    redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
  }
}

export function updateDnoxFireAttack(e: Enemy, ctx: GameContext, game: GameStore, dt: number): void {
  if (e.kind !== 'dnox_fire') return
  const gfx = e.cnoxLaserGfx
  if (!gfx || gfx.destroyed) return
  const haste = e.dnoxSoilHasteMult ?? 1

  if (e.cnoxLaserState === 'warning') {
    e.cnoxLaserTimer = (e.cnoxLaserTimer ?? DNOX_FIRE_WARNING_FRAMES) - dt * haste
    const pulse = 0.35 + Math.abs(Math.sin(Date.now() * 0.02)) * 0.65
    const ex = e.container.x
    const ey = e.container.y
    const fireW = 30
    gfx.clear()
    gfx.rect(ex - fireW * 0.5, ey, fireW, GAME_H + 80 - ey).fill({ color: 0xff8833, alpha: 0.16 * pulse })
    gfx.rect(ex - fireW * 0.25, ey, fireW * 0.5, GAME_H + 80 - ey).fill({ color: 0xffee88, alpha: 0.22 * pulse })
    gfx.circle(ex, ey, 15 + pulse * 4).stroke({ color: 0xffdd88, width: 2.4, alpha: 0.85 })
    if ((e.cnoxLaserTimer ?? 0) <= 0) {
      beginDnoxFireball(e, ctx, game)
    }
    return
  }

  if (e.cnoxLaserState === 'firing') {
    e.cnoxLaserTimer = (e.cnoxLaserTimer ?? DNOX_FIRE_BEAM_FRAMES) - dt * haste
    const ex = e.container.x
    const ey = e.container.y
    const fireW = 30
    const t = Math.max(0, (e.cnoxLaserTimer ?? 0) / DNOX_FIRE_BEAM_FRAMES)
    const alpha = 0.2 + t * 0.8
    gfx.clear()
    gfx.rect(ex - fireW * 0.5, ey, fireW, GAME_H + 80 - ey).fill({ color: 0xff5500, alpha: alpha * 0.52 })
    gfx.rect(ex - fireW * 0.24, ey, fireW * 0.48, GAME_H + 80 - ey).fill({ color: 0xffcc00, alpha: alpha * 0.76 })
    gfx.circle(ex, ey, 12 + t * 8).fill({ color: 0xffaa44, alpha: alpha * 0.92 })

    if ((e.cnoxLaserTimer ?? 0) <= 0) {
      gfx.clear()
      e.cnoxLaserAngle = 0
      e.cnoxLaserState = 'idle'
      drawDnoxFire(e.body, e.cnoxBaseSize ?? 13, 0)
    }
    return
  }

  if (e.cnoxLaserState === 'idle') {
    e.dnoxFireCoolTimer = (e.dnoxFireCoolTimer ?? 0) + dt
    if ((e.dnoxFireCoolTimer ?? 0) > DNOX_FIRE_COOL_DELAY) {
      const nextHeat = Math.max(0, (e.cnoxLaserAngle ?? 0) - DNOX_FIRE_COOL_PER_FRAME * dt)
      if (nextHeat !== (e.cnoxLaserAngle ?? 0)) {
        e.cnoxLaserAngle = nextHeat
        drawDnoxFire(e.body, e.cnoxBaseSize ?? 13, nextHeat)
      }
    }
  }

  gfx.clear()
}

export function cleanupDnoxFire(e: Enemy, ctx: GameContext): void {
  if (e.cnoxLaserGfx) {
    if (!e.cnoxLaserGfx.destroyed) {
      e.cnoxLaserGfx.clear()
      ctx.gameLayer.removeChild(e.cnoxLaserGfx)
    }
  }
}

export function spawnDnoxFireSquad(ctx: GameContext, game: GameStore): void {
  const count = 5 + Math.floor(Math.random() * 3) // 5 to 7
  const spacing = 44
  const lineY = GAME_H * 0.30 + Math.random() * GAME_H * 0.14
  const lineStartX = GAME_W * 0.5 - ((count - 1) * spacing) * 0.5

  for (let i = 0; i < count; i++) {
    const formX = lineStartX + i * spacing + (Math.random() * 4 - 2)
    const formY = lineY + (Math.random() * 8 - 4)
    const side = i % 2 === 0 ? 'left' : 'right'
    const startX = side === 'left' ? -44 - Math.random() * 12 : GAME_W + 44 + Math.random() * 12
    spawnDnoxFire(ctx, game, startX, formY)
    const spawned = ctx.enemies[ctx.enemies.length - 1]
    if (!spawned || spawned.kind !== 'dnox_fire') continue
    spawned.enterTargetX = formX
    spawned.enterTargetY = formY
    spawned.formTargetX = formX
    spawned.formTargetY = formY
    spawned.vx = side === 'left' ? 2.8 : -2.8
  }
}
