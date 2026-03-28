import { Graphics } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import { redrawHpBar } from '../utils'
import { spawnDamageText, hitFlash } from '../systems/effects'
import { killEnemy } from '../entities/kill'
import { updateDnoxFireHeat } from '../entities/DnoxFire'

type GameStore = ReturnType<typeof useGameStore>

// ─── Player ship graphics ─────────────────────────────────────────────────────
export function drawShip(g: Graphics, shipId: string): void {
  if (shipId === 'star_holder') {
    g.clear()
    g.rect(-9, -24, 18, 38).fill(0xff9900)
    g.poly([0, -28, 8, -18, -8, -18]).fill(0xffee44)
    g.poly([-9, 4, -30, 20, -9, 14]).fill(0xdd6600)
    g.poly([9, 4, 30, 20, 9, 14]).fill(0xdd6600)
    g.poly([-25, 18, -30, 20, -20, 22]).fill(0xff8800)
    g.poly([25, 18, 30, 20, 20, 22]).fill(0xff8800)
    g.rect(-6, 14, 12, 10).fill({ color: 0xff4400, alpha: 0.9 })
    g.rect(-3, 18, 6, 6).fill({ color: 0xffcc00, alpha: 0.85 })
  } else if (shipId === 'star_shooter') {
    g.clear()
    // Main body — dark steel blue
    g.rect(-7, -24, 14, 42).fill(0x1c2c44)
    // Rear hull taper
    g.poly([-7, 18, 7, 18, 4, 22, -4, 22]).fill(0x151f33)
    // Nose cone (red-orange)
    g.poly([0, -30, 6, -21, -6, -21]).fill(0xff4422)
    // Cockpit window (cyan glass)
    g.rect(-3, -19, 6, 8).fill({ color: 0x66ccff, alpha: 0.88 })
    // Main swept wings
    g.poly([-7, -4, -29, -12, -25, 5, -7, 5]).fill(0x27405f)
    g.poly([7, -4, 29, -12, 25, 5, 7, 5]).fill(0x27405f)
    // Wing leading-edge highlight
    g.poly([-7, -4, -29, -12, -28, -9, -7, -3]).fill({ color: 0x4477aa, alpha: 0.75 })
    g.poly([7, -4, 29, -12, 28, -9, 7, -3]).fill({ color: 0x4477aa, alpha: 0.75 })
    // Tail fins
    g.poly([-7, 9, -20, 15, -18, 21, -7, 17]).fill(0x1a2e48)
    g.poly([7, 9, 20, 15, 18, 21, 7, 17]).fill(0x1a2e48)
    // Missile pods on wings (2 per side)
    g.rect(-28, -10, 7, 4).fill(0xff3333)
    g.rect(-25, -4, 7, 4).fill(0xff3333)
    g.rect(21, -10, 7, 4).fill(0xff3333)
    g.rect(18, -4, 7, 4).fill(0xff3333)
    // Purple-violet center spine
    g.rect(-2, -24, 4, 42).fill({ color: 0x7733cc, alpha: 0.38 })
    // Engine exhaust
    g.rect(-5, 18, 10, 7).fill({ color: 0xff5500, alpha: 0.9 })
    g.rect(-3, 22, 6, 5).fill({ color: 0xffcc22, alpha: 0.95 })
  } else if (shipId === 'star_faster') {
    g.clear()
    // Fuselage - wider, sports car look (F12-inspired) - SCALED UP
    g.rect(-6, -28, 12, 44).fill(0xf5f5ff)
    // Body highlight - glossy effect on left side
    g.rect(-5.5, -28, 2.5, 44).fill({ color: 0xffffff, alpha: 0.5 })
    // Extended nose cone - long pointed muzzle
    g.poly([0, -40, 6, -20, -6, -20]).fill(0x6644bb)
    g.poly([0, -40, 0, -25, 6, -20]).fill({ color: 0x8855dd, alpha: 0.7 })
    // Aggressive cockpit - angular windshield
    g.poly([-4, -20, 4, -20, 3, -10, -3, -10]).fill({ color: 0x4477ff, alpha: 1.0 })
    g.poly([-3.5, -10, 3.5, -10, 2.5, -2, -2.5, -2]).fill({ color: 0x6699ff, alpha: 0.8 })
    // Hood vents (air intake)
    g.rect(-5, -7, 1.8, 5).fill({ color: 0xb8a8dd, alpha: 0.7 })
    g.rect(3.2, -7, 1.8, 5).fill({ color: 0xb8a8dd, alpha: 0.7 })
    // Upper swept wings - pair 1 (primary) - long and swept back
    g.poly([-6, -10, -27, -5, -25, 7, -6, 0]).fill(0xb8a0ff)
    g.poly([6, -10, 27, -5, 25, 7, 6, 0]).fill(0xb8a0ff)
    // Wing upper detail line
    g.poly([-6, -10, -27, -5, -26, -2, -6, -5]).fill({ color: 0xd0c0ff, alpha: 0.6 })
    g.poly([6, -10, 27, -5, 25, -2, 6, -5]).fill({ color: 0xd0c0ff, alpha: 0.6 })
    // Mid wings - pair 2 (canards-like) - longer and curved 90 back
    g.poly([-6, -2, -20, -2, -18, 13, -6, 7]).fill({ color: 0xa08add, alpha: 0.85 })
    g.poly([6, -2, 20, -2, 18, 13, 6, 7]).fill({ color: 0xa08add, alpha: 0.85 })
    // Rear wings - pair 3 (stabilizers)
    g.poly([-6, 5, -15, 5, -13, 10, -6, 7]).fill({ color: 0x8878cc, alpha: 0.8 })
    g.poly([6, 5, 15, 5, 13, 10, 6, 7]).fill({ color: 0x8878cc, alpha: 0.8 })
    // Rear body - muscular curves
    g.poly([-6, 15, 6, 15, 4, 20, -4, 20]).fill(0x9a88cc)
    // Side stripes down the body (accent)
    g.rect(-5.8, -12, 1, 27).fill({ color: 0xc0a8ff, alpha: 0.5 })
    g.rect(4.8, -12, 1, 27).fill({ color: 0xc0a8ff, alpha: 0.5 })
    // Main engine - glowing core
    g.circle(0, 16, 3.8).fill({ color: 0x00eeff, alpha: 0.6 })
    g.circle(0, 16, 2.2).fill({ color: 0x66ffff, alpha: 1.0 })
  } else if (shipId === 'thien_ha_truy') {
    g.clear()
    // Jade flying sword hull
    g.poly([0, -34, 8, -10, 5, 20, 0, 28, -5, 20, -8, -10]).fill(0x39d3a2)
    g.poly([0, -34, 8, -10, 3, -7, 0, -20]).fill({ color: 0x7dffd7, alpha: 0.75 })
    g.poly([0, -30, 5, 16, 0, 24, -5, 16]).fill(0x1f9f7f)
    g.poly([0, -36, 3, -30, -3, -30]).fill(0xd9fff4)
    g.rect(-10, 18, 20, 4).fill(0x0f6f5b)
    g.rect(-5, 20, 10, 5).fill(0x155448)
    g.rect(-1, -32, 2, 58).fill({ color: 0xd5fff4, alpha: 0.55 })
    // Twin side energy trails
    g.poly([-12, 4, -18, 18, -14, 24, -8, 10]).fill({ color: 0x66ffe4, alpha: 0.45 })
    g.poly([12, 4, 18, 18, 14, 24, 8, 10]).fill({ color: 0x66ffe4, alpha: 0.45 })
  } else {
    g.clear()
    g.rect(-10, -22, 20, 34).fill(0x00cfff)
    g.poly([-10, 0, -28, 18, -10, 10]).fill(0x0077bb)
    g.poly([10, 0, 28, 18, 10, 10]).fill(0x0077bb)
    g.rect(-5, -22, 10, 13).fill(0xffd700)
    g.rect(-6, 12, 12, 9).fill({ color: 0xff6600, alpha: 0.85 })
  }
}

// ─── Player bullet ────────────────────────────────────────────────────────────
export function drawBullet(g: Graphics, spdScale = 1.0, shipId = 'star_keeper'): void {
  g.clear()
  const sz = Math.max(0.6, 1.0 / Math.pow(spdScale, 0.35))
  
  if (shipId === 'star_faster') {
    // Thin small purple bullet for Star Faster
    const w = Math.max(1, Math.round(2 * sz))
    const h = Math.max(10, Math.round(16 * sz))
    g.rect(-w / 2, -(h * 0.6), w, h).fill(0xd9a7f7)
    g.rect(-w / 3, -(h * 0.6) - Math.round(h * 0.12), Math.max(1, Math.round(w / 1.5)), Math.round(h * 0.25)).fill({ color: 0xf5e6ff, alpha: 0.8 })
  } else if (shipId === 'thien_ha_truy') {
    const w = Math.max(2, Math.round(3 * sz))
    const h = Math.max(11, Math.round(19 * sz))
    g.poly([0, -(h * 0.75), w, -(h * 0.1), w * 0.6, h * 0.35, 0, h * 0.55, -w * 0.6, h * 0.35, -w, -(h * 0.1)]).fill(0x59f2c7)
    g.rect(-1, -(h * 0.7), 2, h * 1.2).fill({ color: 0xe8fff8, alpha: 0.8 })
  } else {
    // Yellow bullet for other ships
    const w = Math.max(2, Math.round(4 * sz))
    const h = Math.max(11, Math.round(18 * sz))
    g.rect(-w / 2, -(h * 0.55), w, h).fill(0xffee22)
    g.rect(-w / 4, -(h * 0.55) - Math.round(h * 0.22), Math.max(1, w / 2), Math.round(h * 0.4)).fill({ color: 0xffffff, alpha: 0.8 })
  }
}

// ─── Star Shooter missile ────────────────────────────────────────────────────
export function drawShooterMissile(g: Graphics): void {
  g.clear()
  // Body (white) — reduced ~25%
  g.rect(-2.5, -7, 5, 12).fill(0xffffff)
  // Nose (red)
  g.poly([0, -10, 2.5, -7, -2.5, -7]).fill(0xff3333)
  // Side fins (red)
  g.poly([-2.5, 2, -5, 6, -2.5, 6]).fill(0xff4444)
  g.poly([2.5, 2, 5, 6, 2.5, 6]).fill(0xff4444)
  // Engine glow
  g.circle(0, 5, 1.6).fill({ color: 0xff6600, alpha: 0.9 })
  g.circle(0, 5, 0.8).fill(0xffee44)
}

// ─── Star Holder laser ────────────────────────────────────────────────────────
/**
 * Fires an angled laser beam from the ship.
 * angle = 0: straight up; positive angles lean right.
 */
export function spawnHolderLaser(
  ctx: GameContext,
  game: GameStore,
  fromX: number,
  fromY: number,
  angle: number,
  damage: number,
): void {
  if (!ctx.app || !ctx.gameLayer) return
  const beamW = Math.max(6, Math.round(10 * (1 + game.cardStats.arsenalLaserSizePct / 100)))
  const beamLen = fromY + 60
  const sinA = Math.sin(angle)
  const cosA = Math.cos(angle)

  for (let i = ctx.enemies.length - 1; i >= 0; i--) {
    const e = ctx.enemies[i]!
    const ex = e.container.x - fromX
    const ey = e.container.y - fromY
    const perpDist = Math.abs(ex * cosA + ey * sinA)
    const along = ex * sinA - ey * cosA
    const hitR = e.kind === 'boss_cnox_sun' ? 66 : (e.kind.startsWith('boss_') ? 52 : 15)
    if (perpDist < beamW / 2 + hitR && along > -hitR && along < beamLen + hitR) {
      e.hp = Math.max(0, e.hp - damage)
      updateDnoxFireHeat(e, damage, ctx, game)
      hitFlash(e.body)
      spawnDamageText(ctx, e.container.x, e.container.y - (e.kind === 'boss_stardestroyer' || e.kind === 'boss_invader' ? 60 : 16), damage)
      redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)

      if (e.hp <= 0) killEnemy(ctx, game, e, i, true)
    }
  }

  for (const boss of ctx.enemies) {
    if (boss.kind !== 'boss_cnox_sun') continue
    const crystals = boss.sunEnergyCrystals ?? []
    for (let ci = crystals.length - 1; ci >= 0; ci--) {
      const c = crystals[ci]!
      const ex = c.x - fromX
      const ey = c.y - fromY
      const perpDist = Math.abs(ex * cosA + ey * sinA)
      const along = ex * sinA - ey * cosA
      const hitR = 12
      if (perpDist < beamW / 2 + hitR && along > -hitR && along < beamLen + hitR) {
        c.hp = Math.max(0, c.hp - damage)
        spawnDamageText(ctx, c.x, c.y - 14, damage)
        if (c.hp <= 0) {
          if (!c.gfx.destroyed) ctx.gameLayer.removeChild(c.gfx)
          crystals.splice(ci, 1)
        }
      }
    }
  }

  const beam = new Graphics()
  beam.x = fromX; beam.y = fromY; beam.rotation = angle
  ctx.gameLayer.addChild(beam)
  let frame = 0
  const tick = () => {
    frame++
    beam.clear()
    const alpha = Math.max(0, 1 - frame / 14)
    beam.rect(-beamW / 2, -beamLen, beamW, beamLen).fill({ color: 0xff2200, alpha: alpha * 0.50 })
    beam.rect(-beamW * 0.4, -beamLen, beamW * 0.8, beamLen).fill({ color: 0xff6600, alpha: alpha * 0.65 })
    beam.rect(-beamW * 0.2, -beamLen, beamW * 0.4, beamLen).fill({ color: 0xffcc88, alpha: alpha * 0.80 })
    if (frame >= 14) { if (!beam.destroyed) ctx.gameLayer.removeChild(beam); ctx.app?.ticker.remove(tick) }
  }
  ctx.app.ticker.add(tick)
}
