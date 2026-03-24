import { Container, Graphics } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_H, GAME_W } from '../constants'
import { redrawHpBar } from '../utils'

type GameStore = ReturnType<typeof useGameStore>

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
  // Drop zone: phần dưới + giữa màn hình
  container.x = overrideX ?? (GAME_W * 0.12 + Math.random() * GAME_W * 0.76)
  container.y = -40
  ctx.gameLayer.addChild(container)
  ctx.gameLayer.addChild(fireballGfx)

  const enterTargetY = overrideY ?? (GAME_H * 0.38 + Math.random() * GAME_H * 0.32)

  const e: Enemy = {
    container, body, hpBarBg, hpBar,
    kind: 'dnox_fire',
    vy: 1.4 + Math.random() * 0.4,
    vx: 0,
    hp: maxHp,
    maxHp,
    barW,
    pioneerPhase: 'enter',
    enterTargetX: container.x,
    enterTargetY,
    formTargetX: container.x,
    formTargetY: enterTargetY,
    // heat state storage via cnoxLaserGfx slot for graphics, heat via cnoxLaserTimer
    cnoxLaserGfx: fireballGfx,       // hoả cầu graphics (detached)
    cnoxLaserTimer: 0,                // heat (0–1) * 1000 stored × 1000 scale
    cnoxLaserState: 'idle',           // 'idle' | 'firing' (hoả cầu đang bay)
    cnoxLaserAngle: 0,                // heat value 0→1
  }
  ctx.enemies.push(e)
  game.stageEnemiesTotal++
}

/** Called every frame from GameCanvas after bullet/damage is applied.
 *  Returns true if the fireball fired (causes the fireball to fly). */
export function updateDnoxFireHeat(e: Enemy, damageDealt: number, ctx: GameContext, game: GameStore): void {
  if (e.kind !== 'dnox_fire') return
  if (e.cnoxLaserState === 'firing') return  // already firing

  // Accumulate heat – 1 point of damage adds heat proportional to maxHp
  const heatGain = damageDealt / (e.maxHp * 0.4)   // ~40 dmg to full cycle
  const prevHeat = e.cnoxLaserAngle ?? 0
  const newHeat = Math.min(1, prevHeat + heatGain)
  e.cnoxLaserAngle = newHeat

  // Redraw body colour
  drawDnoxFire(e.body, 13 + (e.cnoxBaseSize ?? 0), newHeat)

  if (prevHeat < 1 && newHeat >= 1) {
    // PHÓNG HỎA CẦU
    triggerDnoxFireball(e, ctx, game)
  }
}

function triggerDnoxFireball(e: Enemy, ctx: GameContext, game: GameStore): void {
  // Accumulated damage = 20% of damage received while red→lam (approx: 20% maxHp)
  const fireballDmg = Math.round(e.maxHp * 0.20)
  const ex = e.container.x
  const ey = e.container.y
  e.cnoxLaserState = 'firing'

  // Hoả cầu bay thẳng xuống dọc trục Y, chiều rộng = kích cỡ quái, chiều dài = hết map
  const gfx = e.cnoxLaserGfx
  if (!gfx) return

  // Width of fireball = size of the enemy (~13-16px)
  const fireW = 28
  let frame = 0
  const totalFrames = 40

  // immediate: check player collision at position (they can't move out in 0 frames)
  const playerHit = ctx.playerShip
    ? Math.abs(ctx.playerShip.x - ex) < fireW / 2 + 10
    : false

  const tick = () => {
    frame++
    if (!gfx || gfx.destroyed) return
    const alpha = Math.max(0, 1 - frame / totalFrames)
    gfx.clear()
    // Draw fireball beam from enemy to bottom edge
    gfx.rect(ex - fireW / 2, ey, fireW, GAME_H + 80 - ey).fill({ color: 0xff5500, alpha: alpha * 0.45 })
    gfx.rect(ex - fireW / 4, ey, fireW / 2, GAME_H + 80 - ey).fill({ color: 0xffcc00, alpha: alpha * 0.70 })
    // Fireball core at enemy
    gfx.circle(ex, ey, 18 - frame * 0.4).fill({ color: 0xff8800, alpha: alpha })

    if (frame >= totalFrames) {
      if (!gfx.destroyed) gfx.clear()
      ctx.app?.ticker.remove(tick)

      // Reset heat after firing
      e.cnoxLaserAngle = 0
      e.cnoxLaserState = 'idle'
      drawDnoxFire(e.body, 13 + (e.cnoxBaseSize ?? 0), 0)

      // Hồi 50% HP nếu trúng người chơi
      if (playerHit) {
        const heal = Math.round(e.maxHp * 0.50)
        e.hp = Math.min(e.maxHp, e.hp + heal)
        redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
      }
    }
  }

  // Deal damage to player immediately if in beam path
  if (playerHit && ctx.playerShip) {
    if (!game.absorbShieldHit()) {
      game.takeDamage(fireballDmg)
    }
  }

  ctx.app?.ticker.add(tick)
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
  const count = 4 + (Math.random() < 0.5 ? 1 : 0) // 4 to 5
  const spacing = GAME_W / (count + 1)
  const enterY = GAME_H * 0.38 + Math.random() * GAME_H * 0.2

  for (let i = 0; i < count; i++) {
    const x = spacing * (i + 1) + (Math.random() * 20 - 10)
    spawnDnoxFire(ctx, game, x, enterY + (Math.random() * 30 - 15))
  }
}
