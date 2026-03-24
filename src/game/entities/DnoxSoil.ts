import { Container, Graphics } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_W } from '../constants'
import { redrawHpBar } from '../utils'

type GameStore = ReturnType<typeof useGameStore>

// ─── Lõi hình dạng ───────────────────────────────────────────────────────────
export type DnoxSoilCoreKind = 'shield' | 'sword' | 'wind'

export function drawDnoxSoil(g: Graphics, size: number, coreKind: DnoxSoilCoreKind): void {
  g.clear()
  // Hai tấm giáp đối xứng 2 bên
  for (const side of [-1, 1]) {
    const px = side * size * 0.80
    g.poly([
      px + side * size * 0.08, -size * 0.62,
      px + side * size * 0.38, -size * 0.12,
      px + side * size * 0.38,  size * 0.42,
      px,                        size * 0.62,
      px - side * size * 0.20,  size * 0.36,
      px - side * size * 0.18, -size * 0.54,
    ]).fill({ color: 0x3d2b1e, alpha: 0.95 })
    g.poly([
      px + side * size * 0.06, -size * 0.44,
      px + side * size * 0.26, -size * 0.08,
      px + side * size * 0.26,  size * 0.30,
      px,                        size * 0.42,
      px - side * size * 0.12,  size * 0.22,
      px - side * size * 0.12, -size * 0.38,
    ]).fill({ color: 0x5c3e2a, alpha: 0.90 })
  }
  // Tia liên kết năng lượng (nhỏ, đến khi ký sinh sẽ phóng ra)
  // Lõi trắng
  g.circle(0, 0, size * 0.28).fill({ color: 0xffffff, alpha: 0.94 })
  // Lõi hình dạng
  _drawCore(g, coreKind, size)
}

function _drawCore(g: Graphics, kind: DnoxSoilCoreKind, size: number): void {
  const s = size * 0.18
  if (kind === 'shield') {
    // Hình khiên – ngũ giác
    g.poly([
      0,  -s * 1.3,
       s * 1.1, -s * 0.4,
       s * 0.7,  s * 1.1,
      -s * 0.7,  s * 1.1,
      -s * 1.1, -s * 0.4,
    ]).fill({ color: 0x3399ff, alpha: 0.95 })
  } else if (kind === 'sword') {
    // Hình kiếm – thanh dọc có tay cầm
    g.rect(-s * 0.22, -s * 1.5, s * 0.44, s * 2.2).fill({ color: 0xffcc00, alpha: 0.95 })
    g.rect(-s * 0.7,  s * 0.5,  s * 1.4,  s * 0.35).fill({ color: 0xffaa00, alpha: 0.90 })
  } else {
    // Hình gió – tròn có tia xoắn
    g.circle(0, 0, s).fill({ color: 0x88ffaa, alpha: 0.95 })
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      const cx = Math.cos(a) * s * 0.7
      const cy = Math.sin(a) * s * 0.7
      g.circle(cx, cy, s * 0.32).fill({ color: 0xccffdd, alpha: 0.80 })
    }
  }
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
const CORE_KINDS: DnoxSoilCoreKind[] = ['shield', 'sword', 'wind']

export function spawnDnoxSoilGroup(ctx: GameContext, game: GameStore): void {
  const count = 1 + Math.floor(Math.random() * 2)
  for (let idx = 0; idx < count; idx++) {
    const coreKind = CORE_KINDS[Math.floor(Math.random() * CORE_KINDS.length)]!
    const size = 10 + Math.random() * 3
    const barW = size * 2.8
    const maxHp = 70 + game.currentStage * 20  // HP khá cao nhờ giáp

    const body = new Graphics()
    drawDnoxSoil(body, size, coreKind)

    // Tia năng lượng vàng (link beam to host) – sẽ được vẽ lại khi ký sinh
    const linkBeam = new Graphics()

    const hpBarBg = new Graphics()
    const hpBar = new Graphics()
    redrawHpBar(hpBarBg, hpBar, 1, barW)
    hpBarBg.y = -size - 10
    hpBar.y = -size - 10

    const container = new Container()
    container.addChild(body, hpBarBg, hpBar)
    container.x = GAME_W * 0.12 + Math.random() * GAME_W * 0.76
    container.y = -40
    ctx.gameLayer.addChild(container)
    ctx.gameLayer.addChild(linkBeam)

    // Spawn target Y: random từ bất cứ đâu trên map vì chúng ít di chuyển
    const enterTargetY = 60 + Math.random() * 320

    const e: Enemy = {
      container, body, hpBarBg, hpBar,
      kind: 'dnox_soil',
      vy: 0.9 + Math.random() * 0.3,
      vx: 0,
      hp: maxHp,
      maxHp,
      barW,
      pioneerPhase: 'enter',
      enterTargetX: container.x,
      enterTargetY,
      formTargetX: container.x,
      formTargetY: enterTargetY,
      // Reuse fields
      healBeamGfx: linkBeam,           // tia năng lượng liên kết (gold beam)
      cnoxLaserTimer: 90,              // countdown before seeking host
      cnoxLaserState: 'idle' as const, // 'idle' | 'link_warning' | 'link_firing' | 'attached'
      // Store coreKind in cnoxLinkOrder (0=shield,1=sword,2=wind)
      cnoxLinkOrder: ['shield', 'sword', 'wind'].indexOf(coreKind),
      healTarget: null,
    }
    ctx.enemies.push(e)
    game.stageEnemiesTotal++
  }
}

export function getDnoxSoilCoreKind(e: Enemy): DnoxSoilCoreKind {
  const idx = e.cnoxLinkOrder ?? 0
  return CORE_KINDS[idx] ?? 'shield'
}

/** Apply parasite bonuses to host. Call once when attaching. */
export function applyDnoxSoilBonus(host: Enemy, coreKind: DnoxSoilCoreKind): void {
  if (coreKind === 'shield') {
    // +80% HP
    const bonus = Math.round(host.maxHp * 0.80)
    host.maxHp += bonus
    host.hp = Math.min(host.maxHp, host.hp + bonus)
    redrawHpBar(host.hpBarBg, host.hpBar, host.hp / host.maxHp, host.barW)
  } else if (coreKind === 'sword') {
    // +80% damage: stored in cnoxPowerMult
    host.cnoxPowerMult = (host.cnoxPowerMult ?? 1) * 1.80
  } else {
    // +100% speed (vy)
    host.vy *= 2.0
  }
}

/** Remove parasite bonuses when parasite is killed. */
export function removeDnoxSoilBonus(host: Enemy, coreKind: DnoxSoilCoreKind): void {
  if (coreKind === 'shield') {
    const bonus = Math.round((host.maxHp / 1.80) * 0.80)
    host.maxHp = Math.max(1, host.maxHp - bonus)
    host.hp = Math.min(host.maxHp, host.hp)
    redrawHpBar(host.hpBarBg, host.hpBar, host.hp / host.maxHp, host.barW)
  } else if (coreKind === 'sword') {
    host.cnoxPowerMult = (host.cnoxPowerMult ?? 1.80) / 1.80
  } else {
    host.vy = Math.max(0.8, host.vy / 2.0)
  }
}

export function cleanupDnoxSoil(e: Enemy): void {
  if (e.healBeamGfx && !e.healBeamGfx.destroyed) {
    e.healBeamGfx.clear()
    if (e.healBeamGfx.parent) e.healBeamGfx.parent.removeChild(e.healBeamGfx)
  }
}
