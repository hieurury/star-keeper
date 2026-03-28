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

export function drawDnoxSoilAttached(g: Graphics, size: number, coreKind: DnoxSoilCoreKind): void {
  g.clear()
  // Enlarge both side shields to wrap host body from left/right.
  for (const side of [-1, 1]) {
    const px = side * size * 1.45
    g.poly([
      px + side * size * 0.16, -size * 1.18,
      px + side * size * 0.72, -size * 0.34,
      px + side * size * 0.74,  size * 0.82,
      px,                        size * 1.18,
      px - side * size * 0.42,  size * 0.72,
      px - side * size * 0.34, -size * 0.98,
    ]).fill({ color: 0x3a271b, alpha: 0.96 })
    g.poly([
      px + side * size * 0.10, -size * 0.92,
      px + side * size * 0.45, -size * 0.22,
      px + side * size * 0.45,  size * 0.62,
      px,                        size * 0.86,
      px - side * size * 0.25,  size * 0.48,
      px - side * size * 0.20, -size * 0.80,
    ]).fill({ color: 0x64432d, alpha: 0.92 })
  }

  // Core merges into host core: keep only a bright emblem at center.
  g.circle(0, 0, size * 0.30).fill({ color: 0xfff5c2, alpha: 0.88 })
  _drawCore(g, coreKind, size * 1.2)
}

function _drawCore(g: Graphics, kind: DnoxSoilCoreKind, size: number): void {
  const s = size * 0.28
  if (kind === 'shield') {
    // Shield core: cyan-blue crest, larger and easy to read.
    g.poly([
      0,  -s * 1.55,
       s * 1.25, -s * 0.45,
       s * 0.82,  s * 1.25,
      -s * 0.82,  s * 1.25,
      -s * 1.25, -s * 0.45,
    ]).fill({ color: 0x4ac8ff, alpha: 0.97 })
    g.poly([
      0,  -s * 1.22,
       s * 0.95, -s * 0.36,
       s * 0.60,  s * 0.92,
      -s * 0.60,  s * 0.92,
      -s * 0.95, -s * 0.36,
    ]).fill({ color: 0xe7fbff, alpha: 0.72 })
  } else if (kind === 'sword') {
    // Sword core: warm orange blade with bright guard.
    g.poly([
      0, -s * 1.75,
      s * 0.34, -s * 0.95,
      s * 0.34,  s * 1.05,
      0,  s * 1.45,
      -s * 0.34,  s * 1.05,
      -s * 0.34, -s * 0.95,
    ]).fill({ color: 0xff8c2a, alpha: 0.98 })
    g.rect(-s * 0.95,  s * 0.52,  s * 1.9,  s * 0.40).fill({ color: 0xffc44d, alpha: 0.96 })
    g.circle(0, s * 1.16, s * 0.22).fill({ color: 0xffefbf, alpha: 0.9 })
  } else {
    // Wind core: emerald vortex ring.
    g.circle(0, 0, s * 1.08).fill({ color: 0x35d77a, alpha: 0.94 })
    g.circle(0, 0, s * 0.52).fill({ color: 0xd8ffe8, alpha: 0.82 })
    for (let i = 0; i < 5; i++) {
      const a = (i / 4) * Math.PI * 2
      const cx = Math.cos(a) * s * 0.86
      const cy = Math.sin(a) * s * 0.86
      g.circle(cx, cy, s * 0.20).fill({ color: 0xaef6c8, alpha: 0.88 })
    }
  }
}

export function isDnoxSoilProtected(e: Enemy, ctx: GameContext): boolean {
  if (e.kind !== 'dnox_soil') return false
  if (e.cnoxLaserState !== 'link_firing') return false
  const host = e.healTarget
  return !!host && ctx.enemies.includes(host)
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
const CORE_KINDS: DnoxSoilCoreKind[] = ['shield', 'sword', 'wind']
const SOIL_SHIELD_HP_BONUS_MULT = 1.10
const SOIL_SWORD_POWER_MULT = 2.05
const SOIL_WIND_HASTE_MULT = 1.85

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
    // +110% HP: noticeably stronger host after successful parasite attach.
    const bonus = Math.round(host.maxHp * SOIL_SHIELD_HP_BONUS_MULT)
    host.maxHp += bonus
    host.hp = Math.min(host.maxHp, host.hp + bonus)
    redrawHpBar(host.hpBarBg, host.hpBar, host.hp / host.maxHp, host.barW)
  } else if (coreKind === 'sword') {
    // +105% damage multiplier used by host offensive skills.
    host.cnoxPowerMult = (host.cnoxPowerMult ?? 1) * SOIL_SWORD_POWER_MULT
  } else {
    // +85% action haste for host AI timers and movement.
    host.dnoxSoilHasteMult = (host.dnoxSoilHasteMult ?? 1) * SOIL_WIND_HASTE_MULT
  }
}

/** Remove parasite bonuses when parasite is killed. */
export function removeDnoxSoilBonus(host: Enemy, coreKind: DnoxSoilCoreKind): void {
  if (coreKind === 'shield') {
    const preBonusMaxHp = host.maxHp / (1 + SOIL_SHIELD_HP_BONUS_MULT)
    const bonus = Math.round(preBonusMaxHp * SOIL_SHIELD_HP_BONUS_MULT)
    host.maxHp = Math.max(1, host.maxHp - bonus)
    host.hp = Math.min(host.maxHp, host.hp)
    redrawHpBar(host.hpBarBg, host.hpBar, host.hp / host.maxHp, host.barW)
  } else if (coreKind === 'sword') {
    host.cnoxPowerMult = (host.cnoxPowerMult ?? SOIL_SWORD_POWER_MULT) / SOIL_SWORD_POWER_MULT
  } else {
    host.dnoxSoilHasteMult = Math.max(1, (host.dnoxSoilHasteMult ?? SOIL_WIND_HASTE_MULT) / SOIL_WIND_HASTE_MULT)
  }
}

export function cleanupDnoxSoil(e: Enemy): void {
  if (e.healBeamGfx && !e.healBeamGfx.destroyed) {
    e.healBeamGfx.clear()
    if (e.healBeamGfx.parent) e.healBeamGfx.parent.removeChild(e.healBeamGfx)
  }
}
