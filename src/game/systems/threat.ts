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

const EVOLUTION_COLORS = [0xffffff, 0x5fa1ff, 0xff7b5b, 0x8e5cff]

interface EvolutionStyle {
  hue: number
  saturation: number
  contrast: number
  brightness: number
  tint: number
  aura: number
  accent: number
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

function getAlphaPalette(enemy: Enemy): { base: number, shadow: number, accent: number, glow: number } {
  if (enemy.kind === 'dnox_fire') return { base: 0x8a210d, shadow: 0x2a0904, accent: 0xc93f22, glow: 0xff7a33 }
  if (enemy.kind === 'dnox_ice') return { base: 0x175f8f, shadow: 0x041c2d, accent: 0x2e89c9, glow: 0x61c8ff }
  if (enemy.kind === 'dnox_soil') return { base: 0x6d451a, shadow: 0x241608, accent: 0xa77733, glow: 0xd6ad5a }
  if (enemy.kind === 'cnox_shield') return { base: 0x0f4d8d, shadow: 0x061a33, accent: 0x2479c9, glow: 0x56b8ff }
  if (enemy.kind === 'cnox_spark') return { base: 0x53207a, shadow: 0x180726, accent: 0x8a3bc7, glow: 0xc170ff }
  if (enemy.kind === 'cnox_greedy') return { base: 0x8a3f11, shadow: 0x281306, accent: 0xc96f2e, glow: 0xffaa5f }
  if (enemy.kind === 'thu_ho') return { base: 0x7c6218, shadow: 0x2a1f08, accent: 0xb3962f, glow: 0xe4c85c }
  if (enemy.kind === 'thuat_si') return { base: 0x1f6a4a, shadow: 0x0a2519, accent: 0x32a873, glow: 0x72e6ae }
  if (enemy.kind === 'dai_lien') return { base: 0x1c5f8a, shadow: 0x072131, accent: 0x3596c7, glow: 0x72d2ff }
  if (enemy.kind === 'kamikaze') return { base: 0x8e290d, shadow: 0x2b0904, accent: 0xce4a25, glow: 0xff8a3a }
  if (enemy.kind === 'sniper') return { base: 0x1f6f31, shadow: 0x09230f, accent: 0x33aa52, glow: 0x6fe494 }
  return { base: 0x7a1f49, shadow: 0x250914, accent: 0xb53b72, glow: 0xe36eac }
}

function getEvolutionTint(enemy: Enemy, tier: number): number {
  const t = clamp(tier, 0, 3)
  if (t <= 0) return 0xffffff
  if (enemy.kind === 'sniper') return [0xffffff, 0x59c47c, 0x2f9753, 0x1d6f3b][t]!
  if (enemy.kind === 'kamikaze') return [0xffffff, 0xff7a38, 0xd94c22, 0xb13212][t]!
  if (enemy.kind === 'dai_lien') return [0xffffff, 0x66bfff, 0x4095da, 0x2c6fb2][t]!
  if (enemy.kind === 'thu_ho') return [0xffffff, 0xe0bd48, 0xb49432, 0x8f6f22][t]!
  if (enemy.kind === 'thuat_si') return [0xffffff, 0x67d59a, 0x3ead74, 0x2d8759][t]!
  if (enemy.kind === 'cnox_greedy') return [0xffffff, 0xf0914b, 0xc7682e, 0x9f4a20][t]!
  if (enemy.kind === 'cnox_shield') return [0xffffff, 0x61afff, 0x347cc4, 0x235a9a][t]!
  if (enemy.kind === 'cnox_spark') return [0xffffff, 0xad72ff, 0x7f47d2, 0x5d2ea6][t]!
  if (enemy.kind === 'dnox_fire') return [0xffffff, 0xff7a42, 0xd84a25, 0xad3017][t]!
  if (enemy.kind === 'dnox_ice') return [0xffffff, 0x72ceff, 0x46a6d7, 0x2e7fae][t]!
  if (enemy.kind === 'dnox_soil') return [0xffffff, 0xc48c4c, 0x9a6a35, 0x774f27][t]!
  return EVOLUTION_COLORS[t]!
}

function getEvolutionHue(enemy: Enemy, tier: number): number {
  const t = clamp(tier, 0, 3)
  if (t <= 0) return 0
  if (enemy.kind === 'pioneer') return [0, 135, 215, 286][t]!
  if (enemy.kind === 'sniper') return [0, 48, 92, 128][t]!
  if (enemy.kind === 'kamikaze') return [0, -18, -42, -68][t]!
  if (enemy.kind === 'dai_lien') return [0, 24, 66, 106][t]!
  if (enemy.kind === 'thu_ho') return [0, -12, 18, 42][t]!
  if (enemy.kind === 'thuat_si') return [0, 38, 88, 132][t]!
  if (enemy.kind === 'cnox_greedy') return [0, -8, 28, 54][t]!
  if (enemy.kind === 'cnox_shield') return [0, 24, 60, 96][t]!
  if (enemy.kind === 'cnox_spark') return [0, 18, 44, 74][t]!
  if (enemy.kind === 'dnox_fire') return [0, -16, -36, -58][t]!
  if (enemy.kind === 'dnox_ice') return [0, 12, 32, 56][t]!
  if (enemy.kind === 'dnox_soil') return [0, -10, 24, 44][t]!
  return [0, 40, 84, 132][t]!
}

function getAlphaScale(enemy: Enemy): number {
  if (enemy.kind === 'kamikaze') return 1.2
  if (enemy.kind === 'thu_ho' || enemy.kind === 'cnox_shield') return 1.34
  if (enemy.kind === 'dnox_fire' || enemy.kind === 'dnox_soil') return 1.3
  if (enemy.kind === 'thuat_si') return 1.26
  return 1.24
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
  if (enemy.threatAlpha && !enemy.threatAlphaShell) {
    enemy.threatAlphaShell = new Graphics()
    enemy.container.addChildAt(enemy.threatAlphaShell, 0)
  }
  if (enemy.threatAlpha && !enemy.threatAlphaCore) {
    enemy.threatAlphaCore = new Graphics()
    enemy.container.addChild(enemy.threatAlphaCore)
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
  if (t <= 0) {
    return {
      hue: 0,
      saturation: 0,
      contrast: 1,
      brightness: 1,
      tint: 0xffffff,
      aura: 0x7aa6ff,
      accent: 0xc9dcff,
    }
  }

  const styleByKind: Record<string, [EvolutionStyle, EvolutionStyle, EvolutionStyle]> = {
    pioneer: [
      { hue: 76, saturation: 0.1, contrast: 1.03, brightness: 1.02, tint: 0xdff7e8, aura: 0x5ebd8f, accent: 0xb5efd2 },
      { hue: 118, saturation: 0.16, contrast: 1.06, brightness: 1.02, tint: 0xd2f0ff, aura: 0x55a8d8, accent: 0xaee3ff },
      { hue: 168, saturation: 0.2, contrast: 1.1, brightness: 1.01, tint: 0xe3dcff, aura: 0x8373ce, accent: 0xd4c6ff },
    ],
    sniper: [
      { hue: 42, saturation: 0.1, contrast: 1.03, brightness: 1.02, tint: 0xe4f7dc, aura: 0x7fb56a, accent: 0xd4efc7 },
      { hue: 74, saturation: 0.15, contrast: 1.06, brightness: 1.02, tint: 0xdcf4ec, aura: 0x69b795, accent: 0xc2ebdc },
      { hue: 110, saturation: 0.19, contrast: 1.1, brightness: 1.01, tint: 0xd6e9ff, aura: 0x6a95cf, accent: 0xc7ddff },
    ],
    kamikaze: [
      { hue: -10, saturation: 0.1, contrast: 1.03, brightness: 1.01, tint: 0xffe6d7, aura: 0xcc8f5f, accent: 0xffd0b0 },
      { hue: -22, saturation: 0.15, contrast: 1.07, brightness: 1.0, tint: 0xffdfd2, aura: 0xc17c67, accent: 0xffc7b4 },
      { hue: -36, saturation: 0.2, contrast: 1.1, brightness: 0.99, tint: 0xffd8da, aura: 0xb86f82, accent: 0xffc3cf },
    ],
    dai_lien: [
      { hue: 18, saturation: 0.1, contrast: 1.03, brightness: 1.02, tint: 0xdff3ff, aura: 0x6eaed0, accent: 0xc5e9ff },
      { hue: 42, saturation: 0.15, contrast: 1.06, brightness: 1.01, tint: 0xd9ecff, aura: 0x6b95c7, accent: 0xc1dcff },
      { hue: 68, saturation: 0.19, contrast: 1.1, brightness: 1.0, tint: 0xe0e3ff, aura: 0x7974c8, accent: 0xcfcbff },
    ],
    thu_ho: [
      { hue: -8, saturation: 0.1, contrast: 1.03, brightness: 1.02, tint: 0xfff0d8, aura: 0xc1a55c, accent: 0xffe0a8 },
      { hue: 14, saturation: 0.15, contrast: 1.06, brightness: 1.01, tint: 0xf4efda, aura: 0xa8b06a, accent: 0xe2e7b8 },
      { hue: 30, saturation: 0.18, contrast: 1.09, brightness: 1.0, tint: 0xe4f0de, aura: 0x7fae7d, accent: 0xc8e4c8 },
    ],
    thuat_si: [
      { hue: 30, saturation: 0.1, contrast: 1.03, brightness: 1.02, tint: 0xe2f9ef, aura: 0x65ba92, accent: 0xbeefda },
      { hue: 56, saturation: 0.15, contrast: 1.06, brightness: 1.01, tint: 0xdff4ff, aura: 0x69a8cb, accent: 0xc2e6ff },
      { hue: 82, saturation: 0.19, contrast: 1.1, brightness: 1.0, tint: 0xe3e3ff, aura: 0x7878c9, accent: 0xceceff },
    ],
    cnox_greedy: [
      { hue: -6, saturation: 0.1, contrast: 1.03, brightness: 1.01, tint: 0xffead8, aura: 0xc58a63, accent: 0xffcfb0 },
      { hue: 16, saturation: 0.15, contrast: 1.06, brightness: 1.0, tint: 0xf8e8d8, aura: 0xb49a70, accent: 0xe9d8b8 },
      { hue: 36, saturation: 0.19, contrast: 1.09, brightness: 0.99, tint: 0xe8eadf, aura: 0x94a27b, accent: 0xd7dfc5 },
    ],
    cnox_shield: [
      { hue: 18, saturation: 0.1, contrast: 1.03, brightness: 1.02, tint: 0xe0efff, aura: 0x6f96cb, accent: 0xc5dbff },
      { hue: 38, saturation: 0.15, contrast: 1.06, brightness: 1.01, tint: 0xdfe7ff, aura: 0x747fc7, accent: 0xc9ceff },
      { hue: 60, saturation: 0.19, contrast: 1.1, brightness: 1.0, tint: 0xe7ddff, aura: 0x8769c2, accent: 0xdac4ff },
    ],
    cnox_spark: [
      { hue: 12, saturation: 0.1, contrast: 1.03, brightness: 1.02, tint: 0xe9e2ff, aura: 0x8371c9, accent: 0xd7cbff },
      { hue: 34, saturation: 0.15, contrast: 1.06, brightness: 1.01, tint: 0xede0ff, aura: 0x9d6ac9, accent: 0xe2c5ff },
      { hue: 56, saturation: 0.19, contrast: 1.1, brightness: 1.0, tint: 0xf0dbff, aura: 0xb46ec8, accent: 0xebc7ff },
    ],
    dnox_fire: [
      { hue: -14, saturation: 0.1, contrast: 1.03, brightness: 1.01, tint: 0xffe4d7, aura: 0xc77f63, accent: 0xffc5ae },
      { hue: -30, saturation: 0.15, contrast: 1.06, brightness: 1.0, tint: 0xffddd5, aura: 0xbf6f6f, accent: 0xffbfc0 },
      { hue: -46, saturation: 0.19, contrast: 1.1, brightness: 0.99, tint: 0xffd9df, aura: 0xb66483, accent: 0xffbfd2 },
    ],
    dnox_ice: [
      { hue: 10, saturation: 0.1, contrast: 1.03, brightness: 1.02, tint: 0xdff6ff, aura: 0x6bb5d2, accent: 0xc2ecff },
      { hue: 26, saturation: 0.15, contrast: 1.06, brightness: 1.01, tint: 0xe0f0ff, aura: 0x6f9dc7, accent: 0xc5ddff },
      { hue: 44, saturation: 0.19, contrast: 1.1, brightness: 1.0, tint: 0xe6e5ff, aura: 0x807cc1, accent: 0xd0ccff },
    ],
    dnox_soil: [
      { hue: -6, saturation: 0.1, contrast: 1.03, brightness: 1.01, tint: 0xf8ebda, aura: 0xbf9468, accent: 0xe6d0af },
      { hue: 12, saturation: 0.15, contrast: 1.06, brightness: 1.0, tint: 0xefe9d9, aura: 0xa8a071, accent: 0xd8d3b9 },
      { hue: 28, saturation: 0.19, contrast: 1.1, brightness: 0.99, tint: 0xe2eada, aura: 0x8ea482, accent: 0xcde0c8 },
    ],
  }

  const tiers = styleByKind[enemy.kind]
  if (tiers) return tiers[t - 1]!

  return [
    { hue: 28, saturation: 0.1, contrast: 1.03, brightness: 1.02, tint: 0xe2f1ff, aura: 0x6fa2d0, accent: 0xc5ddf7 },
    { hue: 56, saturation: 0.15, contrast: 1.06, brightness: 1.01, tint: 0xe6e6ff, aura: 0x7f82c2, accent: 0xd2d3ff },
    { hue: 84, saturation: 0.19, contrast: 1.1, brightness: 1.0, tint: 0xeadfff, aura: 0x8f74bc, accent: 0xdcc8ff },
  ][t - 1]!
}

function applyEvolutionMorph(enemy: Enemy, tier: number): void {
  if (enemy.threatAlpha || tier <= 0) {
    enemy.body.scale.set(1)
    enemy.body.skew.set(0, 0)
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
  enemy.threatAlphaScale = scale
  enemy.body.scale.set(scale)
  enemy.body.skew.set(0, 0)

  const hpOffset = 5 + Math.round((scale - 1) * 18)
  enemy.hpBarBg.y -= hpOffset
  enemy.hpBar.y -= hpOffset

  const palette = getAlphaPalette(enemy)
  const filter = ensureColorFilter(enemy)
  filter.reset()
  filter.hue(-8, true)
  filter.saturate(0.4, true)
  filter.contrast(1.24, true)
  filter.brightness(0.86, true)
  enemy.body.tint = palette.base
  enemy.threatAlphaAttackTimer = 120 + Math.random() * 100
}

function drawAlphaMorph(enemy: Enemy): void {
  if (!enemy.threatAlphaShell || !enemy.threatAlphaCore) return

  const palette = getAlphaPalette(enemy)
  const pulse = 0.72 + Math.sin((enemy.threatPulse ?? 0) * 0.1) * 0.2
  const scale = enemy.threatAlphaScale ?? 1.24
  const baseR = getEnemyBaseRadius(enemy) * scale
  const outerR = (baseR + 10) * pulse
  const innerR = baseR * 0.74
  const armorR = baseR * 0.93
  const spikes = enemy.kind === 'kamikaze' ? 12 : enemy.kind === 'cnox_shield' ? 9 : 7

  const outerPts: number[] = []
  const armorPts: number[] = []
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + (enemy.threatPulse ?? 0) * 0.016
    const ro = i % 2 === 0 ? outerR : innerR
    const ra = i % 2 === 0 ? armorR : baseR * 0.6
    outerPts.push(Math.cos(a) * ro, Math.sin(a) * ro)
    armorPts.push(Math.cos(a) * ra, Math.sin(a) * ra)
  }

  enemy.threatAlphaShell.clear()
  enemy.threatAlphaShell.poly(outerPts).fill({ color: palette.shadow, alpha: 0.78 })
  enemy.threatAlphaShell.poly(armorPts).fill({ color: palette.base, alpha: 0.82 })
  enemy.threatAlphaShell.poly(armorPts).stroke({ color: palette.accent, width: 2.2, alpha: 0.9 })

  const hornLen = baseR + 9
  enemy.threatAlphaShell.poly([
    -baseR * 0.35, -baseR * 0.25,
    -hornLen, -baseR * 0.6,
    -baseR * 0.5, baseR * 0.03,
  ]).fill({ color: palette.shadow, alpha: 0.92 })
  enemy.threatAlphaShell.poly([
    baseR * 0.35, -baseR * 0.25,
    hornLen, -baseR * 0.6,
    baseR * 0.5, baseR * 0.03,
  ]).fill({ color: palette.shadow, alpha: 0.92 })

  enemy.threatAlphaCore.clear()
  enemy.threatAlphaCore.roundRect(-baseR * 0.22, -baseR * 0.3, baseR * 0.44, baseR * 0.62, baseR * 0.08).fill({ color: palette.accent, alpha: 0.64 })
  enemy.threatAlphaCore.circle(0, 0, baseR * 0.14).fill({ color: palette.glow, alpha: 0.72 })

  for (let i = 0; i < 3; i++) {
    const a = (enemy.threatPulse ?? 0) * 0.012 + i * (Math.PI * 2 / 3)
    const x = Math.cos(a) * (baseR + 4)
    const y = Math.sin(a) * (baseR + 4)
    enemy.threatAlphaCore.circle(x, y, 2.3).fill({ color: palette.accent, alpha: 0.86 })
  }
}

function applyEvolutionTint(enemy: Enemy): void {
  if (enemy.threatAlpha) return
  const tier = clamp(Math.floor(enemy.threatTier ?? 0), 0, 3)
  enemy.body.tint = 0xffffff
  if (tier <= 0) {
    clearColorFilter(enemy)
    enemy.threatAura?.clear()
    enemy.threatSigil?.clear()
    enemy.body.scale.set(1)
    enemy.body.skew.set(0, 0)
    return
  }
  const style = getEvolutionStyle(enemy, tier)
  const filter = ensureColorFilter(enemy)
  filter.reset()
  filter.hue(style.hue || getEvolutionHue(enemy, tier), true)
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
    clearColorFilter(enemy)
    applyAlphaMorph(enemy)
    drawAlphaMorph(enemy)
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
