import { Graphics, ColorMatrixFilter } from 'pixi.js'
import type { useGameStore } from '../../stores/gameStore'
import type { GameContext } from '../context'
import type { Enemy } from '../types'
import { redrawHpBar } from '../utils'
import { spawnExplosion, spawnAlphaEvolutionEffect } from './effects'

type GameStore = ReturnType<typeof useGameStore>

export interface ThreatProfile {
  combatPower: number
  pressure: number
  hpMult: number
  damageMult: number
  spawnMult: number
  alphaChance: number
  tierCap: number
  bossHpMult: number
  bossDamageMult: number
}

interface EvolutionStyle {
  hue: number
  saturation: number
  contrast: number
  brightness: number
  tint: number
  aura: number
  accent: number
}

interface AlphaPalette {
  base: number
  shadow: number
  accent: number
  glow: number
}

interface AlphaBodyMorph {
  sx: number
  sy: number
  skewX: number
  skewY: number
  rotation: number
}

interface EnemyThreatPalette {
  evolved: EvolutionStyle
  alpha: AlphaPalette
}

const BASE_STYLE: EvolutionStyle = {
  hue: 0,
  saturation: 0,
  contrast: 1,
  brightness: 1,
  tint: 0xffffff,
  aura: 0x7aa6ff,
  accent: 0xc9dcff,
}

const DEFAULT_EVOLVED_STYLE: EvolutionStyle = {
  hue: 18,
  saturation: 0.08,
  contrast: 1.04,
  brightness: 1,
  tint: 0xd9e4f4,
  aura: 0x7f9dbd,
  accent: 0xc8d8eb,
}

const DEFAULT_ALPHA_PALETTE: AlphaPalette = {
  base: 0x2f4059,
  shadow: 0x111924,
  accent: 0x4e688e,
  glow: 0x8aa5cb,
}

const ENEMY_THREAT_PALETTES: Record<string, EnemyThreatPalette> = {
  pioneer: {
    evolved: { hue: 8, saturation: 0.08, contrast: 1.04, brightness: 1.0, tint: 0xdcaac8, aura: 0xa9678a, accent: 0xe8c7da },
    alpha: { base: 0x5a2342, shadow: 0x1f0d18, accent: 0x8c4d71, glow: 0xc885a8 },
  },
  sniper: {
    evolved: { hue: 14, saturation: 0.07, contrast: 1.04, brightness: 1.01, tint: 0xbfd9c9, aura: 0x5f9a76, accent: 0xd3e9dd },
    alpha: { base: 0x214632, shadow: 0x0b1911, accent: 0x3d7458, glow: 0x76b594 },
  },
  kamikaze: {
    evolved: { hue: -4, saturation: 0.09, contrast: 1.05, brightness: 1.0, tint: 0xe6b188, aura: 0xb56e47, accent: 0xf0ceb4 },
    alpha: { base: 0x5a2a16, shadow: 0x1c0d08, accent: 0x8a4b2f, glow: 0xca875f },
  },
  dai_lien: {
    evolved: { hue: 10, saturation: 0.08, contrast: 1.04, brightness: 1.01, tint: 0xbcd7e8, aura: 0x628eaf, accent: 0xd5e6f2 },
    alpha: { base: 0x1f3f57, shadow: 0x0b1622, accent: 0x3c6582, glow: 0x79aacb },
  },
  thu_ho: {
    evolved: { hue: -4, saturation: 0.08, contrast: 1.03, brightness: 0.95, tint: 0xd2a678, aura: 0xb07342, accent: 0xe7c39e },
    alpha: { base: 0x5a4a20, shadow: 0x1d170a, accent: 0x8c7537, glow: 0xc7b068 },
  },
  thuat_si: {
    evolved: { hue: 16, saturation: 0.07, contrast: 1.03, brightness: 1.01, tint: 0xc8d9cf, aura: 0x6c9d87, accent: 0xdcebe3 },
    alpha: { base: 0x26463d, shadow: 0x0d1916, accent: 0x427165, glow: 0x82b8a8 },
  },
  cnox_greedy: {
    evolved: { hue: 6, saturation: 0.08, contrast: 1.04, brightness: 1.0, tint: 0xd8b694, aura: 0xa8754f, accent: 0xe9d1bd },
    alpha: { base: 0x553321, shadow: 0x1b100b, accent: 0x80563c, glow: 0xb58a6c },
  },
  cnox_shield: {
    evolved: { hue: 14, saturation: 0.08, contrast: 1.05, brightness: 1.0, tint: 0xc0cde3, aura: 0x667ca5, accent: 0xd8deef },
    alpha: { base: 0x223556, shadow: 0x0a1220, accent: 0x3f5e89, glow: 0x7d9fcb },
  },
  cnox_spark: {
    evolved: { hue: 10, saturation: 0.08, contrast: 1.05, brightness: 1.0, tint: 0xd2c3e5, aura: 0x7d62a8, accent: 0xe4d9f2 },
    alpha: { base: 0x332353, shadow: 0x110b1c, accent: 0x5b4186, glow: 0x9a7bc7 },
  },
  dnox_fire: {
    evolved: { hue: 0, saturation: 0.03, contrast: 1.03, brightness: 0.99, tint: 0xffffff, aura: 0xb16a4f, accent: 0xf1d4c4 },
    alpha: { base: 0x5c2c1c, shadow: 0x1e0f09, accent: 0x8e5139, glow: 0xc48768 },
  },
  dnox_ice: {
    evolved: { hue: 8, saturation: 0.07, contrast: 1.04, brightness: 1.01, tint: 0xbad3e8, aura: 0x5f8eaf, accent: 0xd2e4f2 },
    alpha: { base: 0x203d57, shadow: 0x0a1622, accent: 0x3f6586, glow: 0x79a8c7 },
  },
  dnox_soil: {
    evolved: { hue: 10, saturation: 0.07, contrast: 1.04, brightness: 1.0, tint: 0xc9bd9f, aura: 0x8b7d59, accent: 0xe2d8c2 },
    alpha: { base: 0x4a3a27, shadow: 0x18130d, accent: 0x72604a, glow: 0xa79478 },
  },
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getShipPowerFactor(shipId: string): number {
  if (shipId === 'star_shooter') return 1.26
  if (shipId === 'star_holder') return 1.18
  if (shipId === 'star_faster') return 1.16
  return 1.0
}

function getEnemyBaseRadius(enemy: Enemy): number {
  if (enemy.kind === 'boss_cnox_sun') return 66
  if (enemy.kind === 'boss_tinhvan') return 62
  if (enemy.kind.startsWith('boss_')) return 56
  if (enemy.kind === 'cnox_shield') return 24
  if (enemy.kind === 'thu_ho') return 22
  if (enemy.kind === 'dnox_fire') return 20
  if (enemy.kind === 'dnox_ice') return 18
  if (enemy.kind === 'kamikaze') return 19
  return 16
}

function getThreatPalette(enemy: Enemy): EnemyThreatPalette {
  return ENEMY_THREAT_PALETTES[enemy.kind] ?? {
    evolved: DEFAULT_EVOLVED_STYLE,
    alpha: DEFAULT_ALPHA_PALETTE,
  }
}

function getAlphaPalette(enemy: Enemy): AlphaPalette {
  return getThreatPalette(enemy).alpha
}

function getEvolutionTint(enemy: Enemy, tier: number): number {
  if (tier <= 0) return 0xffffff
  return getThreatPalette(enemy).evolved.tint
}

function getAlphaScale(enemy: Enemy): number {
  if (enemy.kind === 'kamikaze') return 1.22
  if (enemy.kind === 'thu_ho' || enemy.kind === 'cnox_shield') return 1.34
  if (enemy.kind === 'dnox_fire' || enemy.kind === 'dnox_soil') return 1.3
  if (enemy.kind === 'dnox_ice') return 1.22
  if (enemy.kind === 'cnox_spark') return 1.26
  if (enemy.kind === 'thuat_si') return 1.26
  return 1.24
}

function getAlphaBodyMorph(enemy: Enemy): AlphaBodyMorph {
  if (enemy.kind === 'pioneer') return { sx: 1.12, sy: 0.95, skewX: -0.06, skewY: 0, rotation: -0.03 }
  if (enemy.kind === 'sniper') return { sx: 0.9, sy: 1.2, skewX: 0.02, skewY: 0, rotation: 0 }
  if (enemy.kind === 'kamikaze') return { sx: 1.18, sy: 0.9, skewX: 0, skewY: 0.01, rotation: 0.03 }
  if (enemy.kind === 'dai_lien') return { sx: 1.16, sy: 0.96, skewX: 0, skewY: 0.05, rotation: 0 }
  if (enemy.kind === 'thu_ho') return { sx: 1.22, sy: 1.02, skewX: 0, skewY: 0, rotation: 0 }
  if (enemy.kind === 'thuat_si') return { sx: 0.95, sy: 1.22, skewX: 0.04, skewY: 0, rotation: 0 }
  if (enemy.kind === 'cnox_greedy') return { sx: 1.16, sy: 1.08, skewX: 0.01, skewY: 0, rotation: 0 }
  if (enemy.kind === 'cnox_shield') return { sx: 1.28, sy: 0.92, skewX: 0, skewY: 0, rotation: 0 }
  if (enemy.kind === 'cnox_spark') return { sx: 1.08, sy: 1.12, skewX: 0, skewY: 0, rotation: 0.08 }
  if (enemy.kind === 'dnox_fire') return { sx: 1.14, sy: 1.06, skewX: 0.03, skewY: 0, rotation: 0 }
  if (enemy.kind === 'dnox_ice') return { sx: 0.92, sy: 1.2, skewX: 0, skewY: 0, rotation: 0 }
  if (enemy.kind === 'dnox_soil') return { sx: 1.2, sy: 0.97, skewX: 0, skewY: -0.04, rotation: 0 }
  return { sx: 1.08, sy: 1.08, skewX: 0, skewY: 0, rotation: 0 }
}

function isBoss(enemy: Enemy): boolean {
  return enemy.kind.startsWith('boss_')
}

function canMutate(enemy: Enemy): boolean {
  return !isBoss(enemy) && !enemy.isDyingMeteor
}

function hasAliveAlphaOfKind(ctx: GameContext, enemy: Enemy): boolean {
  for (const other of ctx.enemies) {
    if (other === enemy) continue
    if (other.kind !== enemy.kind) continue
    if (!other.threatAlpha) continue
    if (other.hp <= 0) continue
    return true
  }
  return false
}

function retimeEnemyCombatLoops(enemy: Enemy, speedupMult: number): void {
  if (speedupMult <= 1) return
  const enemyAny = enemy as unknown as Record<string, unknown>
  const timerKeys = [
    'shootTimer',
    'attack1Timer',
    'attack2Timer',
    'cnoxLaserTimer',
    'laserTimer',
    'rapidTimer',
    'missileFireTimer',
    'laserLockTimer',
  ]
  for (const key of timerKeys) {
    const raw = enemyAny[key]
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    if (raw <= 6) continue
    enemyAny[key] = Math.max(6, raw / speedupMult)
  }
}

function ensureAlphaMorphLayers(enemy: Enemy): void {
  const childCount = enemy.container.children.length
  const bodyIdx = enemy.container.getChildIndex(enemy.body)
  const shellIndex = Math.min(bodyIdx + 1, childCount)
  const coreIndex = Math.min(bodyIdx + 2, childCount + 1)

  if (enemy.threatAlpha && !enemy.threatAlphaShell) {
    enemy.threatAlphaShell = new Graphics()
    enemy.container.addChildAt(enemy.threatAlphaShell, shellIndex)
  }
  if (enemy.threatAlpha && !enemy.threatAlphaCore) {
    enemy.threatAlphaCore = new Graphics()
    enemy.container.addChildAt(enemy.threatAlphaCore, coreIndex)
  }
}

function clearThreatDecor(enemy: Enemy): void {
  enemy.threatAura?.clear()
  enemy.threatSigil?.clear()
  enemy.threatAlphaShell?.clear()
  enemy.threatAlphaCore?.clear()
}

function getEvolutionStyle(enemy: Enemy, tier: number): EvolutionStyle {
  const t = clamp(tier, 0, 3)
  if (t <= 0) return BASE_STYLE
  return getThreatPalette(enemy).evolved
}

function applyEvolutionMorph(enemy: Enemy, tier: number): void {
  if (enemy.threatAlpha || tier <= 0) {
    enemy.body.scale.set(1)
    enemy.body.skew.set(0, 0)
    enemy.body.rotation = 0
    return
  }

  // Keep only 3 visual shape states: normal, evolved, alpha.
  // Evolved shape is fixed per species (no extra tier-based morph variants).
  let sx = 1.08
  let sy = 1.08
  let skewX = 0
  let skewY = 0

  if (enemy.kind === 'pioneer') {
    sx = 1.04
    sy = 1.1
    skewX = -0.02
  } else if (enemy.kind === 'sniper') {
    sx = 0.98
    sy = 1.12
  } else if (enemy.kind === 'kamikaze') {
    sx = 1.12
    sy = 1.03
  } else if (enemy.kind === 'dai_lien') {
    sx = 1.09
    sy = 1.07
    skewY = 0.018
  } else if (enemy.kind === 'thu_ho') {
    sx = 1.1
    sy = 1.05
  } else if (enemy.kind === 'thuat_si') {
    sx = 1.06
    sy = 1.11
    skewX = 0.014
  } else if (enemy.kind === 'cnox_greedy') {
    sx = 1.1
    sy = 1.08
  } else if (enemy.kind === 'cnox_shield') {
    sx = 1.14
    sy = 1.04
  } else if (enemy.kind === 'cnox_spark') {
    sx = 1.11
    sy = 1.08
    skewY = -0.014
  } else if (enemy.kind === 'dnox_fire') {
    sx = 1.08
    sy = 1.1
    skewX = 0.012
  } else if (enemy.kind === 'dnox_ice') {
    sx = 1.05
    sy = 1.12
  } else if (enemy.kind === 'dnox_soil') {
    sx = 1.12
    sy = 1.05
    skewY = 0.012
  }

  enemy.body.scale.set(sx, sy)
  enemy.body.skew.set(skewX, skewY)
  enemy.body.rotation = 0
}

function drawEvolutionAccent(enemy: Enemy): void {
  enemy.threatAura?.clear()
  enemy.threatSigil?.clear()
}

function ensureColorFilter(enemy: Enemy): ColorMatrixFilter {
  if (!enemy.threatColorFilter) {
    enemy.threatColorFilter = new ColorMatrixFilter()
  }
  enemy.body.filters = [enemy.threatColorFilter]
  return enemy.threatColorFilter
}

function clearColorFilter(enemy: Enemy): void {
  if (enemy.body.filters?.length) enemy.body.filters = []
  enemy.threatColorFilter = undefined
}

function applyAlphaMorph(enemy: Enemy): void {
  if (enemy.threatAlphaVisualApplied) return
  enemy.threatAlphaVisualApplied = true

  const scale = getAlphaScale(enemy)
  const morph = getAlphaBodyMorph(enemy)
  enemy.threatAlphaScale = scale
  enemy.body.scale.set(scale * morph.sx, scale * morph.sy)
  enemy.body.skew.set(morph.skewX, morph.skewY)
  enemy.body.rotation = morph.rotation

  const visualScale = Math.max(scale * morph.sx, scale * morph.sy)
  const hpOffset = 5 + Math.round((visualScale - 1) * 18)
  enemy.hpBarBg.y -= hpOffset
  enemy.hpBar.y -= hpOffset

  const palette = getAlphaPalette(enemy)
  const filter = ensureColorFilter(enemy)
  filter.reset()
  filter.hue(-4, true)
  filter.saturate(0.1, true)
  filter.contrast(1.1, true)
  filter.brightness(0.82, true)
  enemy.body.tint = palette.base
  enemy.threatVisualTimer = 0
  enemy.threatAlphaAttackTimer = 120 + Math.random() * 100
}

type AlphaCoreKind = 'diamond' | 'orb' | 'shield' | 'hex'

interface AlphaHullSpec {
  hull: number[]
  plate: number[]
  leftFin?: number[]
  rightFin?: number[]
  core: AlphaCoreKind
}

function scalePoly(points: number[], r: number, sx = 1, sy = 1): number[] {
  const out: number[] = []
  for (let i = 0; i < points.length; i += 2) {
    out.push(points[i]! * r * sx, points[i + 1]! * r * sy)
  }
  return out
}

function getAlphaHullSpec(enemy: Enemy): AlphaHullSpec {
  if (enemy.kind === 'sniper') {
    return {
      hull: [-0.38, -1.28, 0.38, -1.28, 0.52, 0.94, -0.52, 0.94],
      plate: [-0.25, -1.0, 0.25, -1.0, 0.34, 0.7, -0.34, 0.7],
      leftFin: [-0.52, -0.2, -1.28, 0.3, -0.52, 0.22],
      rightFin: [0.52, -0.2, 1.28, 0.3, 0.52, 0.22],
      core: 'shield',
    }
  }
  if (enemy.kind === 'kamikaze') {
    return {
      hull: [0, -1.35, 1.02, -0.08, 0.46, 1.02, -0.46, 1.02, -1.02, -0.08],
      plate: [0, -1.02, 0.68, 0.03, 0.28, 0.76, -0.28, 0.76, -0.68, 0.03],
      leftFin: [-0.74, 0.1, -1.34, 0.44, -0.92, 0.62],
      rightFin: [0.74, 0.1, 1.34, 0.44, 0.92, 0.62],
      core: 'orb',
    }
  }
  if (enemy.kind === 'dai_lien') {
    return {
      hull: [0, -1.34, 0.84, -0.04, 0.2, 1.15, -0.2, 1.15, -0.84, -0.04],
      plate: [0, -1.04, 0.52, 0, 0.12, 0.8, -0.12, 0.8, -0.52, 0],
      leftFin: [-0.84, -0.02, -1.38, -0.36, -1.02, 0.24, -0.48, 0.12],
      rightFin: [0.84, -0.02, 1.38, -0.36, 1.02, 0.24, 0.48, 0.12],
      core: 'diamond',
    }
  }
  if (enemy.kind === 'thu_ho') {
    return {
      hull: [0, -1.25, 1.02, -0.14, 0.74, 0.74, 0, 1.08, -0.74, 0.74, -1.02, -0.14],
      plate: [0, -0.92, 0.66, -0.06, 0.48, 0.5, 0, 0.78, -0.48, 0.5, -0.66, -0.06],
      core: 'shield',
    }
  }
  if (enemy.kind === 'thuat_si') {
    return {
      hull: [0, -1.28, 0.78, 0, 0, 1.18, -0.78, 0],
      plate: [0, -0.98, 0.5, 0, 0, 0.86, -0.5, 0],
      leftFin: [-0.78, 0, -0.1, -0.74, -0.3, 0.12],
      rightFin: [0.78, 0, 0.1, -0.74, 0.3, 0.12],
      core: 'hex',
    }
  }
  if (enemy.kind === 'cnox_greedy') {
    return {
      hull: [0, -1.16, 0.98, -0.24, 0.72, 0.9, 0, 1.08, -0.82, 0.78, -1.04, -0.14],
      plate: [0, -0.86, 0.62, -0.14, 0.48, 0.62, 0, 0.78, -0.56, 0.58, -0.7, -0.08],
      core: 'orb',
    }
  }
  if (enemy.kind === 'cnox_shield') {
    return {
      hull: [0, -1.28, 0.84, -0.04, 0, 1.26, -0.84, -0.04],
      plate: [0, -0.98, 0.5, 0, 0, 0.92, -0.5, 0],
      leftFin: [-0.84, -0.02, -1.2, 0.52, -0.78, 0.78],
      rightFin: [0.84, -0.02, 1.2, 0.52, 0.78, 0.78],
      core: 'shield',
    }
  }
  if (enemy.kind === 'cnox_spark') {
    return {
      hull: [0, -1.34, 0.36, -0.18, 1.22, 0, 0.36, 0.18, 0, 1.34, -0.36, 0.18, -1.22, 0, -0.36, -0.18],
      plate: [0, -1.0, 0.24, -0.12, 0.86, 0, 0.24, 0.12, 0, 1.0, -0.24, 0.12, -0.86, 0, -0.24, -0.12],
      core: 'hex',
    }
  }
  if (enemy.kind === 'dnox_fire') {
    return {
      hull: [0, -1.18, 1.02, -0.58, 1.02, 0.58, 0, 1.18, -1.02, 0.58, -1.02, -0.58],
      plate: [0, -0.78, 0.66, -0.36, 0.66, 0.36, 0, 0.78, -0.66, 0.36, -0.66, -0.36],
      leftFin: [-0.72, -0.22, -1.3, -0.42, -0.96, 0.12],
      rightFin: [0.72, -0.22, 1.3, -0.42, 0.96, 0.12],
      core: 'hex',
    }
  }
  if (enemy.kind === 'dnox_ice') {
    return {
      hull: [0, -1.26, 0.46, -0.46, 1.22, 0, 0.46, 0.46, 0, 1.26, -0.46, 0.46, -1.22, 0, -0.46, -0.46],
      plate: [0, -0.88, 0.32, -0.32, 0.84, 0, 0.32, 0.32, 0, 0.88, -0.32, 0.32, -0.84, 0, -0.32, -0.32],
      core: 'diamond',
    }
  }
  if (enemy.kind === 'dnox_soil') {
    return {
      hull: [-1.16, -0.76, -0.58, -1.08, 0, -0.52, 0.58, -1.08, 1.16, -0.76, 0.98, 0.66, 0, 1.12, -0.98, 0.66],
      plate: [-0.82, -0.56, -0.4, -0.82, 0, -0.38, 0.4, -0.82, 0.82, -0.56, 0.68, 0.46, 0, 0.8, -0.68, 0.46],
      core: 'orb',
    }
  }
  return {
    hull: [0, -1.32, 0.92, -0.12, 0.5, 0.98, 0, 1.2, -0.5, 0.98, -0.92, -0.12],
    plate: [0, -1.0, 0.62, -0.05, 0.34, 0.74, 0, 0.9, -0.34, 0.74, -0.62, -0.05],
    leftFin: [-0.62, 0.2, -1.25, 0.52, -0.66, 0.58],
    rightFin: [0.62, 0.2, 1.25, 0.52, 0.66, 0.58],
    core: 'diamond',
  }
}

function drawAlphaMorph(enemy: Enemy): void {
  if (!enemy.threatAlphaShell || !enemy.threatAlphaCore) return

  const palette = getAlphaPalette(enemy)
  const pulse = 1
  const scale = enemy.threatAlphaScale ?? 1.24
  const baseR = getEnemyBaseRadius(enemy) * scale
  const hull = getAlphaHullSpec(enemy)

  enemy.threatAlphaShell.clear()
  enemy.threatAlphaShell.poly(scalePoly(hull.hull, baseR, pulse, pulse)).fill({ color: palette.shadow, alpha: 0.92 })
  enemy.threatAlphaShell.poly(scalePoly(hull.plate, baseR)).fill({ color: palette.base, alpha: 0.95 })
  enemy.threatAlphaShell.poly(scalePoly(hull.plate, baseR)).stroke({ color: palette.accent, width: 2.1, alpha: 0.9 })
  if (hull.leftFin) enemy.threatAlphaShell.poly(scalePoly(hull.leftFin, baseR, pulse, pulse)).fill({ color: palette.shadow, alpha: 0.94 })
  if (hull.rightFin) enemy.threatAlphaShell.poly(scalePoly(hull.rightFin, baseR, pulse, pulse)).fill({ color: palette.shadow, alpha: 0.94 })

  enemy.threatAlphaCore.clear()
  if (hull.core === 'diamond') {
    enemy.threatAlphaCore.poly(scalePoly([0, -0.32, 0.22, 0, 0, 0.32, -0.22, 0], baseR)).fill({ color: palette.accent, alpha: 0.76 })
    enemy.threatAlphaCore.poly(scalePoly([0, -0.2, 0.12, 0, 0, 0.2, -0.12, 0], baseR)).fill({ color: palette.glow, alpha: 0.9 })
  } else if (hull.core === 'shield') {
    enemy.threatAlphaCore.roundRect(-baseR * 0.22, -baseR * 0.31, baseR * 0.44, baseR * 0.62, baseR * 0.09).fill({ color: palette.accent, alpha: 0.72 })
    enemy.threatAlphaCore.roundRect(-baseR * 0.11, -baseR * 0.17, baseR * 0.22, baseR * 0.34, baseR * 0.05).fill({ color: palette.glow, alpha: 0.82 })
  } else if (hull.core === 'hex') {
    enemy.threatAlphaCore.poly(scalePoly([0, -0.29, 0.24, -0.13, 0.24, 0.13, 0, 0.29, -0.24, 0.13, -0.24, -0.13], baseR)).fill({ color: palette.accent, alpha: 0.74 })
    enemy.threatAlphaCore.poly(scalePoly([0, -0.18, 0.14, -0.08, 0.14, 0.08, 0, 0.18, -0.14, 0.08, -0.14, -0.08], baseR)).fill({ color: palette.glow, alpha: 0.88 })
  } else {
    enemy.threatAlphaCore.circle(0, 0, baseR * 0.2).fill({ color: palette.accent, alpha: 0.74 })
    enemy.threatAlphaCore.circle(0, 0, baseR * 0.11).fill({ color: palette.glow, alpha: 0.9 })
  }
  enemy.threatAlphaCore.rect(-baseR * 0.22, baseR * 0.18, baseR * 0.44, baseR * 0.07).fill({ color: palette.shadow, alpha: 0.48 })
}

function applyEvolutionTint(enemy: Enemy): void {
  if (enemy.threatAlpha) return
  const tier = clamp(Math.floor(enemy.threatTier ?? 0), 0, 3)
  enemy.body.alpha = 1
  enemy.body.tint = 0xffffff
  if (tier <= 0) {
    clearColorFilter(enemy)
    enemy.threatAura?.clear()
    enemy.threatSigil?.clear()
    enemy.body.scale.set(1)
    enemy.body.skew.set(0, 0)
    enemy.body.rotation = 0
    return
  }

  if (enemy.kind === 'dnox_fire') {
    // Keep heat-state colors visible in evolved form so charge->blast telegraph remains readable.
    const filter = ensureColorFilter(enemy)
    filter.reset()
    filter.saturate(0.04, true)
    filter.contrast(1.03, true)
    filter.brightness(0.99, true)
    enemy.body.tint = 0xffffff
    applyEvolutionMorph(enemy, tier)
    drawEvolutionAccent(enemy)
    return
  }

  const style = getEvolutionStyle(enemy, tier)
  const filter = ensureColorFilter(enemy)
  filter.reset()
  filter.hue(style.hue, true)
  filter.saturate(style.saturation, true)
  filter.contrast(style.contrast, true)
  filter.brightness(style.brightness, true)
  enemy.body.tint = style.tint
  applyEvolutionMorph(enemy, tier)
  drawEvolutionAccent(enemy)
}

function triggerEvolutionFlash(ctx: GameContext, enemy: Enemy, color: number): void {
  spawnExplosion(ctx, enemy.container.x, enemy.container.y, 14, color, 0x111111)
}

function promoteToAlpha(ctx: GameContext, enemy: Enemy): void {
  if (enemy.threatAlpha) return
  if (hasAliveAlphaOfKind(ctx, enemy)) return

  enemy.threatAlpha = true
  enemy.threatDamageMult = (enemy.threatDamageMult ?? 1) * 1.16
  enemy.threatMoveMult = (enemy.threatMoveMult ?? 1) * 1.06
  enemy.maxHp = Math.round(enemy.maxHp * 1.42)
  enemy.hp = Math.min(enemy.maxHp, Math.round(enemy.hp + enemy.maxHp * 0.26))
  enemy.barW *= 1.1
  enemy.vx *= 1.06
  enemy.vy *= 1.06
  retimeEnemyCombatLoops(enemy, 1.1)
  clearColorFilter(enemy)
  ensureAlphaMorphLayers(enemy)
  applyAlphaMorph(enemy)
  clearThreatDecor(enemy)
  redrawHpBar(enemy.hpBarBg, enemy.hpBar, enemy.hp / enemy.maxHp, enemy.barW)
  drawAlphaMorph(enemy)
  spawnAlphaEvolutionEffect(ctx, enemy.container.x, enemy.container.y, getAlphaPalette(enemy).accent)
  triggerEvolutionFlash(ctx, enemy, getAlphaPalette(enemy).accent)
}

export function estimatePlayerCombatPower(game: GameStore): number {
  const cs = game.cardStats
  const artifacts = game.artifactStats

  const damageCore = game.upgrades.damage
  const spreadBonus = 1 + Math.max(0, game.upgrades.bulletCount - 1) * 0.36
  const fireRateBonus = 1 + cs.turboFireRatePct / 100 + cs.arsenalFireRatePct / 100
  const cardDamageBonus = 1 + cs.damageBonusPct / 100 + cs.arsenalDamagePct / 100
  const missileBonus = 1 + cs.missileLaunchers * 0.18 + (cs.interstellarMissile ? 0.35 : 0)
  const offensivePower = damageCore * spreadBonus * fireRateBonus * cardDamageBonus * missileBonus

  const sustainCore = game.playerMaxHp * (1 + cs.armorPlatingHpPct / 100)
  const regenFactor = 1 + cs.regenPctPerSec * 0.11
  const mitigationFactor = 1 + artifacts.damageTakenReduction * 1.9
  const sustainPower = sustainCore * regenFactor * mitigationFactor

  const utilityPower =
    (cs.staticField ? 190 : 0)
    + (cs.plasmaClearsBullets ? 120 : 0)
    + (cs.clusterBomb ? 80 : 0)
    + cs.allyDroneCount * 55
    + (artifacts.neutronVacuumActive ? 70 : 0)
    + (artifacts.manaCoreActive ? 90 : 0)

  const cardLevelSum = Object.values(game.activeCards).reduce((sum, lv) => sum + (typeof lv === 'number' ? lv : 0), 0)
  const equippedArtifactCount = (game.equippedArtifacts[game.selectedShip] ?? []).length
  const shipUpgrades = game.shipUpgrades[game.selectedShip as keyof typeof game.shipUpgrades] ?? { hp: 0, fireRate: 0, damage: 0 }
  const progressionPower = game.playerLevel * 26
    + cardLevelSum * 48
    + equippedArtifactCount * 70
    + (shipUpgrades.hp + shipUpgrades.fireRate + shipUpgrades.damage) * 36
  const shipPower = getShipPowerFactor(game.selectedShip)

  const total = (offensivePower * 2.15 + sustainPower * 1.2 + utilityPower + progressionPower) * shipPower
  return Math.max(320, Math.round(total))
}

export function getThreatProfile(game: GameStore): ThreatProfile {
  const stage = Math.max(1, game.currentStage)
  const combatPower = estimatePlayerCombatPower(game)

  const stageCurve = 1 + Math.pow(Math.max(0, stage - 1), 1.08) * 0.015
  const powerCurve = 1 + Math.max(0, combatPower - 950) / 4700
  const pressure = stageCurve * powerCurve

  const hpMult = clamp(1 + (pressure - 1) * 0.56 + Math.max(0, stage - 25) * 0.015, 1, 6.6)
  const damageMult = clamp(1 + (pressure - 1) * 0.3 + Math.max(0, stage - 28) * 0.01, 1, 3.3)
  const spawnMult = clamp(1 + (pressure - 1) * 0.24 + Math.max(0, stage - 30) * 0.006, 1, 2.15)

  const tierCap = stage >= 35 ? 3 : stage >= 22 ? 2 : stage >= 10 ? 1 : 0
  const alphaChance = clamp(0.008 + Math.max(0, stage - 14) * 0.0032 + Math.max(0, pressure - 1.35) * 0.028, 0.008, 0.2)

  const bossHpMult = clamp(1 + (pressure - 1) * 0.42 + Math.max(0, stage - 25) * 0.012, 1, 3.25)
  const bossDamageMult = clamp(1 + (pressure - 1) * 0.26 + Math.max(0, stage - 25) * 0.009, 1, 2.4)

  return {
    combatPower,
    pressure,
    hpMult,
    damageMult,
    spawnMult,
    alphaChance,
    tierCap,
    bossHpMult,
    bossDamageMult,
  }
}

export function initializeEnemyThreat(ctx: GameContext, game: GameStore, enemy: Enemy, profile: ThreatProfile): void {
  if (enemy.threatInitialized) return

  enemy.threatInitialized = true
  enemy.threatPulse = Math.random() * Math.PI * 2
  enemy.threatBaseVx = enemy.vx
  enemy.threatBaseVy = enemy.vy

  if (isBoss(enemy)) {
    if (!enemy.threatBossBoosted) {
      const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1
      enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * profile.bossHpMult))
      enemy.hp = Math.max(1, Math.round(enemy.maxHp * hpRatio))
      enemy.threatBossBoosted = true
      redrawHpBar(enemy.hpBarBg, enemy.hpBar, enemy.hp / enemy.maxHp, enemy.barW)
    }
    enemy.threatTier = clamp(Math.floor((game.currentStage - 1) / 15), 0, 3)
    enemy.threatDamageMult = profile.bossDamageMult
    enemy.threatMoveMult = clamp(1 + (profile.pressure - 1) * 0.08, 1, 1.28)
    return
  }

  if (!canMutate(enemy)) return

  const stage = game.currentStage
  const stageTier = stage >= 34 ? 3 : stage >= 24 ? 2 : stage >= 12 ? 1 : 0
  const pressureTier = profile.pressure >= 2.25 ? 1 : 0
  const tier = clamp(stageTier + pressureTier, 0, profile.tierCap)

  let alphaChance = profile.alphaChance
  if (enemy.kind === 'kamikaze') alphaChance *= 0.55
  if (enemy.kind === 'thuat_si') alphaChance *= 0.72
  const isAlphaUnit = !hasAliveAlphaOfKind(ctx, enemy) && Math.random() < alphaChance

  const tierHpMult = 1 + tier * 0.2
  const tierDamageMult = 1 + tier * 0.13
  const tierMoveMult = 1 + tier * 0.05

  const alphaHpMult = isAlphaUnit ? 1.75 : 1
  const alphaDamageMult = isAlphaUnit ? 1.22 : 1
  const alphaMoveMult = isAlphaUnit ? 1.1 : 1

  const hpMult = clamp(profile.hpMult * tierHpMult * alphaHpMult, 1, 11)
  const damageMult = clamp(profile.damageMult * tierDamageMult * alphaDamageMult, 1, 4.2)
  const moveMult = clamp(tierMoveMult * alphaMoveMult, 1, 2.0)

  const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1
  enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * hpMult))
  enemy.hp = Math.max(1, Math.round(enemy.maxHp * hpRatio))
  enemy.barW *= Math.min(1.9, 1 + tier * 0.08 + (isAlphaUnit ? 0.17 : 0))

  enemy.vx = enemy.vx * moveMult
  enemy.vy = enemy.vy * moveMult

  enemy.threatTier = tier
  enemy.threatAlpha = isAlphaUnit
  enemy.threatDamageMult = damageMult
  enemy.threatMoveMult = moveMult
  enemy.threatAge = 0
  enemy.threatNextEvolveAt = 520 + Math.random() * 280 - stage * 2

  retimeEnemyCombatLoops(enemy, 1 + tier * 0.08 + (isAlphaUnit ? 0.1 : 0))
  if (isAlphaUnit) {
    ensureAlphaMorphLayers(enemy)
    applyAlphaMorph(enemy)
    drawAlphaMorph(enemy)
  } else {
    clearThreatDecor(enemy)
    applyEvolutionTint(enemy)
  }
  redrawHpBar(enemy.hpBarBg, enemy.hpBar, enemy.hp / enemy.maxHp, enemy.barW)

  if (isAlphaUnit) {
    triggerEvolutionFlash(ctx, enemy, getAlphaPalette(enemy).accent)
  } else if (tier > 0) {
    triggerEvolutionFlash(ctx, enemy, getEvolutionTint(enemy, tier))
  }
}

export function updateEnemyThreat(ctx: GameContext, enemy: Enemy, dt: number, profile: ThreatProfile): void {
  if (!enemy.threatInitialized) return

  enemy.threatPulse = (enemy.threatPulse ?? 0) + dt
  if (enemy.threatAlpha) {
    ensureAlphaMorphLayers(enemy)
    applyAlphaMorph(enemy)
    enemy.threatVisualTimer = (enemy.threatVisualTimer ?? 0) - dt
    if ((enemy.threatVisualTimer ?? 0) <= 0) {
      drawAlphaMorph(enemy)
      enemy.threatVisualTimer = 3
    }
  } else if ((enemy.threatTier ?? 0) > 0) {
    applyEvolutionMorph(enemy, enemy.threatTier ?? 0)
    drawEvolutionAccent(enemy)
  }

  if (!canMutate(enemy)) return

  enemy.threatAge = (enemy.threatAge ?? 0) + dt
  const nextEvolutionAt = enemy.threatNextEvolveAt ?? Number.POSITIVE_INFINITY
  if (enemy.threatAge < nextEvolutionAt) return

  const tierNow = clamp(Math.floor(enemy.threatTier ?? 0), 0, 3)
  if (tierNow >= profile.tierCap) {
    enemy.threatNextEvolveAt = nextEvolutionAt + 280 + Math.random() * 150
    if (!enemy.threatAlpha && !hasAliveAlphaOfKind(ctx, enemy) && profile.alphaChance >= 0.16 && Math.random() < 0.03) {
      promoteToAlpha(ctx, enemy)
    }
    return
  }

  const nextTier = tierNow + 1
  enemy.threatTier = nextTier
  enemy.threatAge = 0
  enemy.threatNextEvolveAt = 460 + Math.random() * 240

  enemy.maxHp = Math.round(enemy.maxHp * 1.28)
  enemy.hp = Math.min(enemy.maxHp, Math.round(enemy.hp + enemy.maxHp * 0.24))
  enemy.barW *= 1.05

  enemy.vx *= 1.04
  enemy.vy *= 1.04
  enemy.threatMoveMult = (enemy.threatMoveMult ?? 1) * 1.04
  enemy.threatDamageMult = (enemy.threatDamageMult ?? 1) * 1.09

  retimeEnemyCombatLoops(enemy, 1.06)
  applyEvolutionTint(enemy)
  redrawHpBar(enemy.hpBarBg, enemy.hpBar, enemy.hp / enemy.maxHp, enemy.barW)
  clearThreatDecor(enemy)
  triggerEvolutionFlash(ctx, enemy, getEvolutionTint(enemy, nextTier))
}

export function getEnemyDamageScale(enemy: Enemy, profile: ThreatProfile): number {
  if (enemy.threatDamageMult !== undefined) return enemy.threatDamageMult
  return isBoss(enemy) ? profile.bossDamageMult : profile.damageMult
}

export function getEnemyRewardScale(enemy: Enemy): number {
  const tierBonus = 1 + (enemy.threatTier ?? 0) * 0.32
  const alphaBonus = enemy.threatAlpha ? 1.75 : 1
  if (isBoss(enemy)) {
    return tierBonus * (enemy.threatAlpha ? 1.2 : 1)
  }
  return tierBonus * alphaBonus
}
