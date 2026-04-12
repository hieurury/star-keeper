<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Application, Graphics, Container, Text, TextStyle, Ticker } from 'pixi.js'
import { useGameStore } from '../../stores/gameStore'

// --- Modular game system imports ----------------------------------------------
import { createGameContext } from '../../game/context'
import { GAME_W, GAME_H, TOUCH_Y_OFFSET, INTRO_FRAMES, STAGE_TITLE_FRAMES } from '../../game/constants'
import { dist2, redrawHpBar, findNearestEnemy } from '../../game/utils'

import { drawShip, drawBullet, spawnHolderLaser, drawShooterMissile } from '../../game/ship/index'
import { drawFragmentMissile } from '../../game/projectiles/index'
import { drawEnemyBullet, drawBossBullet, drawBossMissile, drawTrumSoMissile } from '../../game/projectiles/index'

import { spawnExplosion, screenFlash, spawnDamageText, spawnHealText, hitFlash, showStageClearBanner, spawnMissileWarning, spawnExpCollectEffect, getExpTierColor } from '../../game/systems/effects'
import { createStar } from '../../game/systems/background'
import { updateMissileLaunchers, updatePeriodicAbilities, activateHeatWave, activateBlackHole, activateParticleAcceleration } from '../../game/systems/abilities'
import { drawArtifactGfx, initArtifactGfx, activateNeutronVacuum, activateManaCoreOverload, activateSoulHarvest } from '../../game/systems/artifacts'
import { audioManager } from '../../game/systems/audio'
import { launchWave } from '../../game/systems/wave'
import { killEnemy } from '../../game/entities/kill'
import { spawnKamikazeAt } from '../../game/entities/Kamikaze'
import { drawDaiLienBullet, spawnDaiLienPair } from '../../game/entities/DaiLien'
import { drawThuHo, spawnThuHoSwarm } from '../../game/entities/ThuHo'
import { drawHealBeam, spawnThuatSi } from '../../game/entities/ThuatSi'
import { drawCnoxGreedy } from '../../game/entities/CnoxGreedy'
import { drawCnoxShieldOrb } from '../../game/entities/CnoxShield'
import { drawDnoxFire, updateDnoxFireHeat, updateDnoxFireAttack } from '../../game/entities/DnoxFire'
import { drawDnoxIce, FREEZE_DURATION, FREEZE_TAP_BREAK } from '../../game/entities/DnoxIce'
import { drawDnoxSoilAttached, getDnoxSoilCoreKind, applyDnoxSoilBonus } from '../../game/entities/DnoxSoil'
import { getThreatProfile, initializeEnemyThreat, updateEnemyThreat, getEnemyDamageScale } from '../../game/systems/threat'
import type { AllyDrone, Enemy, SunWeaponStar } from '../../game/types'

const canvasWrapper = ref<HTMLDivElement>()
const game = useGameStore()

let app: Application | null = null
let starFasterAuraGfx: Graphics | null = null
let autoPaused = false   // tracks pauses triggered by visibility/blur
const ctx = createGameContext()
const enemyWallStuckState = new WeakMap<Enemy, { x: number, y: number, stuckFrames: number }>()
// Dnox - B─âng lam: player frost state
let playerFrostStacks = 0     // 0 = clear, 1 = t├¬ c├│ng, 2 = frozen
let playerFreezeTimer = 0      // frames until thaw
let playerFreezeTapCount = 0   // taps received while frozen
let freezeOverlayGfx: Graphics | null = null
let freezeScreenGfx: Graphics | null = null
let freezeBreakPulse = 0
const INTRO_SHIP_START_Y = GAME_H + 70
const INTRO_SHIP_END_Y = GAME_H * 0.67
let cachedThreatProfile = getThreatProfile(game)
let threatProfileTimer = 0
const MAX_ENEMIES_ON_SCREEN_BASE = 42
const MAX_ENEMY_BULLETS_BASE = 280

function getEnemyCountCap(stage: number): number {
  return Math.min(70, MAX_ENEMIES_ON_SCREEN_BASE + Math.floor(stage * 1.2))
}

function getEnemyBulletCap(stage: number): number {
  return Math.min(420, MAX_ENEMY_BULLETS_BASE + stage * 4)
}

// Zoom indicator (shows when boss zoom is changing)
let zoomIndicatorText: Text | null = null
let zoomIndicatorTimer = 0
let zoomIndicatorLastZoom = 1.0
let fpsFrames = 0
let fpsElapsedMs = 0
let fpsLastTs = 0

function syncGraphicsMode() {
  ctx.lowGraphicsMode = game.graphicsQuality === 'low'
}

function resetFpsTracking() {
  fpsFrames = 0
  fpsElapsedMs = 0
  fpsLastTs = 0
  game.setCurrentFps(0)
}

function renderFreezeEffects() {
  if (!freezeScreenGfx) return
  const frozen = playerFrostStacks >= 2 && playerFreezeTimer > 0
  if (!frozen) {
    freezeScreenGfx.clear()
    freezeScreenGfx.visible = false
    if (freezeOverlayGfx) freezeOverlayGfx.visible = false
    return
  }

  if (freezeOverlayGfx && ctx.playerShip) {
    freezeOverlayGfx.visible = true
    freezeOverlayGfx.x = ctx.playerShip.x
    freezeOverlayGfx.y = ctx.playerShip.y
    freezeOverlayGfx.clear()
    const crackRatio = Math.min(1, playerFreezeTapCount / FREEZE_TAP_BREAK)
    freezeOverlayGfx.circle(0, 0, 26).fill({ color: 0x8feeff, alpha: 0.40 })
    freezeOverlayGfx.circle(0, 0, 20).fill({ color: 0xd6fbff, alpha: 0.55 })
    freezeOverlayGfx.circle(0, 0, 27).stroke({ color: 0xeaffff, width: 2, alpha: 0.84 })
    if (crackRatio > 0) {
      const crackLen = 32 * crackRatio
      freezeOverlayGfx.moveTo(-14, -14).lineTo(-14 + crackLen, -14 + crackLen).stroke({ color: 0xffffff, width: 2 })
      freezeOverlayGfx.moveTo(14, -14).lineTo(14 - crackLen, -14 + crackLen).stroke({ color: 0xffffff, width: 2 })
      freezeOverlayGfx.moveTo(-2, 2).lineTo(-2 + crackLen * 0.8, 2 - crackLen * 0.35).stroke({ color: 0xe8fdff, width: 1.6, alpha: 0.9 })
    }
  }

  const crackRatio = Math.min(1, playerFreezeTapCount / FREEZE_TAP_BREAK)
  const pulse = freezeBreakPulse > 0 ? (freezeBreakPulse / 12) : 0
  freezeScreenGfx.visible = true
  freezeScreenGfx.clear()
  freezeScreenGfx.rect(0, 0, GAME_W, GAME_H).fill({ color: 0x7cd6ff, alpha: 0.14 + crackRatio * 0.06 })
  freezeScreenGfx.rect(0, 0, GAME_W, GAME_H).stroke({ color: 0xc9f5ff, width: 6, alpha: 0.20 + pulse * 0.25 })

  const centerX = GAME_W / 2
  const centerY = GAME_H * 0.56
  for (let i = 0; i < 7; i++) {
    const a = i * (Math.PI * 2 / 7) + pulse * 0.22
    const len = 60 + crackRatio * 125 + pulse * 38
    freezeScreenGfx.moveTo(centerX, centerY)
      .lineTo(centerX + Math.cos(a) * len, centerY + Math.sin(a) * len)
      .stroke({ color: 0xe9fcff, width: 1.6 + crackRatio * 1.4, alpha: 0.20 + crackRatio * 0.55 })
  }
}

function applyFreezeBreakTap() {
  freezeBreakPulse = 12
  playerFreezeTapCount++
  if (playerFreezeTapCount >= FREEZE_TAP_BREAK) {
    playerFrostStacks = 0
    playerFreezeTapCount = 0
    playerFreezeTimer = 0
    freezeBreakPulse = 0
    if (freezeOverlayGfx) freezeOverlayGfx.visible = false
    if (freezeScreenGfx) {
      freezeScreenGfx.clear()
      freezeScreenGfx.visible = false
    }
    if (ctx.playerShip) spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 30, 'BREAK!')
  }
}

// --- Auto-pause on tab switch / window blur -----------------------------------
function handleVisibilityChange() {
  if (document.hidden) {
    if (game.isPlaying && !game.isPaused) {
      game.isPaused = true
      autoPaused = true
    }
  } else if (autoPaused) {
    // Game stays paused ├»┬┐┬╜ player must press "Ti?p T?c" manually
    autoPaused = false
  }
}
function handleWindowBlur() {
  if (game.isPlaying && !game.isPaused) {
    game.isPaused = true
    autoPaused = true
  }
}
function handleWindowFocus() {
  // Game stays paused ├»┬┐┬╜ player must press "Ti?p T?c" manually
  if (autoPaused) autoPaused = false
}

// --- Shoot --------------------------------------------------------------------
function shoot(offsetX = 0, vxDrift = 0, speedMul = 1) {
  if (!ctx.playerShip) return
  const g = new Graphics()
  drawBullet(g, game.upgrades.bulletSpeed, game.selectedShip as any)
  g.x = ctx.playerShip.x + offsetX
  g.y = ctx.playerShip.y - 22
  ctx.gameLayer.addChild(g)
  const pierceLeft = game.cardStats.bulletPierceOnKill ? 2 : undefined
  const pierceDmgMult = game.cardStats.bulletPierceOnKill ? 1.0 : undefined
  ctx.bullets.push({ gfx: g, vy: 8 * game.upgrades.bulletSpeed * speedMul, vx: vxDrift, pierceLeft, pierceDmgMult })
}

function drawAllyDrone(g: Graphics, isUltimate = false) {
  g.clear()
  const coreColor = isUltimate ? 0xff6666 : 0xffdd66
  const auraColor = isUltimate ? 0xff2233 : 0xffcc55
  if (!ctx.lowGraphicsMode) g.circle(0, 0, 6).fill({ color: auraColor, alpha: 0.2 })
  g.poly([0, -7, 6, 2, 0, 7, -6, 2]).fill(0xffffff)
  g.poly([0, -7, 6, 2, 0, 7, -6, 2]).stroke({ color: 0xcfd5ff, width: 1.2, alpha: 0.85 })
  g.circle(0, 0, 2).fill(coreColor)
}

function drawDroneBullet(g: Graphics, isUltimate = false) {
  g.clear()
  const color = isUltimate ? 0xff4455 : 0xfff3c6
  const glow = isUltimate ? 0xff1122 : 0xffcc66
  g.roundRect(-1.1, -8.5, 2.2, 14.5, 0.9).fill({ color, alpha: 0.95 })
  if (!ctx.lowGraphicsMode) g.roundRect(-0.45, -11.5, 0.9, 6.2, 0.45).fill({ color: glow, alpha: 0.72 })
}

function drawTracerSword(g: Graphics, variant: 'main' | 'sub' = 'main') {
  g.clear()
  const isSub = variant === 'sub'
  const scale = 1.08
  g.poly([
    0, -15 * scale,
    3.8 * scale, -3 * scale,
    2.5 * scale, 10 * scale,
    0, 13 * scale,
    -2.5 * scale, 10 * scale,
    -3.8 * scale, -3 * scale,
  ]).fill(isSub ? 0xf3f7ff : 0x53e3b7)
  g.rect(-0.9 * scale, -13 * scale, 1.8 * scale, 26 * scale).fill({ color: isSub ? 0xffffff : 0xecfff8, alpha: 0.85 })
  g.rect(-5 * scale, 8.5 * scale, 10 * scale, 2 * scale).fill(isSub ? 0xcfd8f6 : 0x1a8b70)
  if (!ctx.lowGraphicsMode) g.circle(0, 9.5 * scale, 1.2 * scale).fill(0xe5fff8)
}

function activateThienHaTram() {
  if (!ctx.playerShip) return
  ctx.tracerFreezeTimer = 120
  ctx.tracerSlashDone = false
  if (ctx.tracerSlashWaveGfx) {
    if (!ctx.tracerSlashWaveGfx.destroyed) ctx.gameLayer.removeChild(ctx.tracerSlashWaveGfx)
    ctx.tracerSlashWaveGfx = null
  }
  for (const m of ctx.shooterMissiles) {
    const mm = m as typeof m & { mode?: 'missile' | 'tracer' | 'tracer_small'; hitCooldown?: number; life?: number; turnDelay?: number }
    if (mm.mode !== 'tracer' && mm.mode !== 'tracer_small') continue
    m.targetEnemy = undefined
    m.targetX = ctx.playerShip.x
    m.targetY = ctx.playerShip.y
    m.vx *= 0.5
    m.vy *= 0.5
  }
  screenFlash(ctx, 0xa40018, 0.46, 420)
}

function pointDistanceToRay(px: number, py: number, ox: number, oy: number, angle: number): { perp: number, dot: number } {
  const lx = Math.cos(angle)
  const ly = Math.sin(angle)
  const dx = px - ox
  const dy = py - oy
  const dot = dx * lx + dy * ly
  const perpX = dx - dot * lx
  const perpY = dy - dot * ly
  return { perp: Math.sqrt(perpX * perpX + perpY * perpY), dot }
}

function pointDistanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const ab2 = abx * abx + aby * aby || 1
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2))
  const cx = ax + abx * t
  const cy = ay + aby * t
  return Math.sqrt(dist2(px, py, cx, cy))
}

function getEnemyCollisionRadius(e: Enemy): number {
  if (e.kind === 'boss_cnox_sun') return 52
  if (e.kind === 'boss_tinhvan') return 60
  if (e.kind === 'boss_stardestroyer' || e.kind === 'boss_invader' || e.kind === 'boss_trumso') return 45
  if (e.kind === 'cnox_shield') return 18
  return 15
}

function getCollisionDamageToPlayer(e: Enemy, stage: number): number {
  const base = e.kind.startsWith('boss_')
    ? 24 + stage * 2
    : e.kind === 'cnox_spark'
      ? 20 + stage
      : e.kind === 'cnox_shield'
        ? 18 + stage
        : 14 + stage
  return Math.max(1, Math.round(base * getEnemyDamageScale(e, cachedThreatProfile)))
}

function getCollisionDamageToEnemy(gameDamage: number, e: Enemy): number {
  const base = Math.max(10, Math.round(gameDamage * 0.6))
  if (e.kind.startsWith('boss_')) return Math.max(6, Math.round(base * 0.35))
  if (e.kind === 'cnox_shield') return Math.max(8, Math.round(base * 0.75))
  return base
}

function isTracerSkillInvulnerable(): boolean {
  return game.selectedShip === 'thien_ha_truy' && ctx.tracerFreezeTimer > 0
}

function applyLaserHitToPlayer(dmg: number, opts?: {
  cooldownFrames?: number
  flashColor?: number
  flashAlpha?: number
  flashMs?: number
  shieldOuterColor?: number
  shieldInnerColor?: number
  force?: boolean
  sourceEnemy?: Enemy
}) {
  if (!ctx.playerShip) return false
  if (isTracerSkillInvulnerable()) return false
  if (!opts?.force && ctx.playerLaserDamageCd > 0) return false
  const scaledDmg = Math.max(1, Math.round(dmg * (opts?.sourceEnemy ? getEnemyDamageScale(opts.sourceEnemy, cachedThreatProfile) : cachedThreatProfile.damageMult)))

  if (!game.absorbShieldHit()) {
    game.takeDamage(scaledDmg)
    if (opts?.flashColor !== undefined) screenFlash(ctx, opts.flashColor, opts.flashAlpha ?? 0.24, opts.flashMs ?? 120)
    else screenFlash(ctx)
    spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, scaledDmg)
  } else {
    spawnExplosion(ctx, ctx.playerShip.x, ctx.playerShip.y, 9, opts?.shieldOuterColor ?? 0x44aaff, opts?.shieldInnerColor ?? 0xffffff)
    if (opts?.flashColor !== undefined) screenFlash(ctx, opts.flashColor, Math.min(0.45, (opts.flashAlpha ?? 0.24) + 0.06), Math.max(120, opts.flashMs ?? 120))
  }

  if (!opts?.force) ctx.playerLaserDamageCd = opts?.cooldownFrames ?? 8
  return true
}

function clampEnemyInsideHorizontalView(e: Enemy, padding = 18): void {
  const minX = (GAME_W * (1 - 1 / ctx.bossZoom) / 2) + padding
  const maxX = (GAME_W * (1 + 1 / ctx.bossZoom) / 2) - padding
  e.container.x = Math.max(minX, Math.min(maxX, e.container.x))
}

function getCurrentViewBounds(paddingX = 0, paddingY = 0) {
  const minX = (GAME_W * (1 - 1 / ctx.bossZoom) / 2) + paddingX
  const maxX = (GAME_W * (1 + 1 / ctx.bossZoom) / 2) - paddingX
  const minY = (GAME_H * (1 - 1 / ctx.bossZoom) / 2) + paddingY
  const maxY = (GAME_H * (1 + 1 / ctx.bossZoom) / 2) - paddingY
  return { minX, maxX, minY, maxY }
}

function resolveEnemyWallStuck(e: Enemy): void {
  const view = getCurrentViewBounds(18, 18)
  const prev = enemyWallStuckState.get(e) ?? { x: e.container.x, y: e.container.y, stuckFrames: 0 }
  const dx = e.container.x - prev.x
  const dy = e.container.y - prev.y
  const moved2 = dx * dx + dy * dy
  const nearLeft = e.container.x <= view.minX + 0.7
  const nearRight = e.container.x >= view.maxX - 0.7
  const pressingWall = nearLeft || nearRight
  if (pressingWall && moved2 < 0.03) {
    prev.stuckFrames++
  } else {
    prev.stuckFrames = Math.max(0, prev.stuckFrames - 3)
  }

  if (prev.stuckFrames >= 24) {
    const inward = nearLeft ? 8 : -8
    e.container.x = Math.max(view.minX, Math.min(view.maxX, e.container.x + inward))

    if (e.formTargetX !== undefined) e.formTargetX = Math.max(view.minX + 10, Math.min(view.maxX - 10, e.formTargetX + inward * 2))
    if (e.enterTargetX !== undefined) e.enterTargetX = Math.max(view.minX + 10, Math.min(view.maxX - 10, e.enterTargetX + inward * 2))
    if (e.dodgeTarget !== undefined) e.dodgeTarget = Math.max(view.minX + 10, Math.min(view.maxX - 10, e.dodgeTarget + inward * 1.6))
    if (e.targetX !== undefined) e.targetX = Math.max(view.minX + 10, Math.min(view.maxX - 10, e.targetX + inward * 1.6))
    prev.stuckFrames = 0
  }

  prev.x = e.container.x
  prev.y = e.container.y
  enemyWallStuckState.set(e, prev)
}

function removeDisplayObject(obj?: Graphics | Text | null) {
  if (!obj || obj.destroyed) return
  if ('clear' in obj && typeof obj.clear === 'function') obj.clear()
  if (obj.parent) obj.parent.removeChild(obj)
}

function removeEnemyDetachedGraphics(e: Enemy) {
  removeDisplayObject(e.aimLine)
  removeDisplayObject(e.warnSign)
  removeDisplayObject(e.healBeamGfx)
  removeDisplayObject(e.threatAura)
  removeDisplayObject(e.threatSigil)
  removeDisplayObject(e.threatAlphaShell)
  removeDisplayObject(e.threatAlphaCore)
  removeDisplayObject(e.cnoxLaserGfx)
  removeDisplayObject(e.cnoxWarnGfx)
  removeDisplayObject(e.sunLinkGfx)
  removeDisplayObject(e.sunCoreLaserGfx)
  removeDisplayObject(e.trumSoPhase2LaserGfx)
  removeDisplayObject(e.trumSoChargeLineGfx)
  removeDisplayObject(e.summonPortalGfx)

  if (e.bossTurrets) {
    for (const t of e.bossTurrets) removeDisplayObject(t.laserGfx)
  }
  if (e.trumSoLasers) {
    for (const laser of e.trumSoLasers) removeDisplayObject(laser.gfx)
  }
  if (e.blackHoles) {
    for (const bh of e.blackHoles) removeDisplayObject(bh.gfx)
    e.blackHoles = []
  }
  if (e.sunStars) {
    for (const s of e.sunStars) {
      removeDisplayObject(s.warningGfx)
      removeDisplayObject(s.beamGfx)
    }
  }
  if (e.sunEnergyCrystals) {
    for (const c of e.sunEnergyCrystals) removeDisplayObject(c.gfx)
    e.sunEnergyCrystals = []
  }
}

function clearTransientCombatGraphics() {
  for (const b of ctx.bullets) if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
  for (const d of ctx.allyDrones) if (!d.gfx.destroyed) ctx.gameLayer.removeChild(d.gfx)
  for (const b of ctx.enemyBullets) if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
  for (const m of ctx.playerMissiles) if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
  for (const m of ctx.shooterMissiles) if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
  for (const m of ctx.fragmentMissiles) if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
  for (const p of ctx.expCollectParticles) if (!p.gfx.destroyed) ctx.gameLayer.removeChild(p.gfx)

  ctx.bullets = []
  ctx.allyDrones = []
  ctx.enemyBullets = []
  ctx.playerMissiles = []
  ctx.shooterMissiles = []
  ctx.fragmentMissiles = []
  ctx.expCollectParticles = []

  if (ctx.shooterBlackHoleGfx && !ctx.shooterBlackHoleGfx.destroyed) ctx.gameLayer.removeChild(ctx.shooterBlackHoleGfx)
  ctx.shooterBlackHoleGfx = null
  ctx.shooterBlackHoleDamageTick = 0
  if (ctx.shooterBlackHoleProjGfx && !ctx.shooterBlackHoleProjGfx.destroyed) ctx.gameLayer.removeChild(ctx.shooterBlackHoleProjGfx)
  ctx.shooterBlackHoleProjGfx = null
  if (ctx.tracerLockGfx && !ctx.tracerLockGfx.destroyed) ctx.gameLayer.removeChild(ctx.tracerLockGfx)
  ctx.tracerLockGfx = null
  if (ctx.tracerSlashWaveGfx && !ctx.tracerSlashWaveGfx.destroyed) ctx.gameLayer.removeChild(ctx.tracerSlashWaveGfx)
  ctx.tracerSlashWaveGfx = null
  ctx.tracerFreezeTimer = 0
  ctx.tracerSlashDone = false

  if (ctx.sfGfx) { ctx.sfGfx.clear(); ctx.sfGfx.visible = false }
  if (ctx.shieldGfx) { ctx.shieldGfx.clear(); ctx.shieldGfx.visible = false }
  if (starFasterAuraGfx) { starFasterAuraGfx.clear(); starFasterAuraGfx.visible = false }

  for (const e of ctx.enemies) {
    removeEnemyDetachedGraphics(e)

    if (e.aimLine) e.aimLine.visible = false
    if (e.warnSign) e.warnSign.visible = false
    if (e.laserLine) e.laserLine.clear()

    if (e.bossTurrets) {
      for (const t of e.bossTurrets) {
        t.laserGfx.clear()
      }
    }
  }
}

function updateCnoxGreedyEvolution(e: Enemy): void {
  const stolen = Math.min(300, e.cnoxStolenExp ?? 0)
  const powerMult = 1 + Math.min(7, stolen / 40)
  const sizeMult = 1 + Math.min(1.45, stolen / 165)
  const baseMaxHp = e.cnoxBaseMaxHp ?? e.maxHp
  const nextMaxHp = Math.round(baseMaxHp * powerMult)
  const hpDelta = nextMaxHp - e.maxHp
  e.maxHp = nextMaxHp
  e.hp = Math.min(e.maxHp, e.hp + Math.max(0, hpDelta))
  e.cnoxPowerMult = powerMult
  e.barW = (e.cnoxBaseBarW ?? e.barW) * sizeMult
  drawCnoxGreedy(e.body, (e.cnoxBaseSize ?? 11) * sizeMult, stolen)
  redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
  e.hpBarBg.y = -(e.cnoxBaseSize ?? 11) * sizeMult - 8
  e.hpBar.y = e.hpBarBg.y
}

function drawCnoxRay(g: Graphics, ox: number, oy: number, angle: number, width: number, color: number, alpha: number, clearFirst = true): void {
  const len = (GAME_W + GAME_H) * 2
  if (clearFirst) g.clear()
  g.moveTo(ox, oy).lineTo(ox + Math.cos(angle) * len, oy + Math.sin(angle) * len).stroke({ color, width, alpha })
}

function drawCnoxCone(g: Graphics, ox: number, oy: number, angle: number, spread: number, len: number, alpha: number, clearFirst = true): void {
  if (clearFirst) g.clear()
  g.moveTo(ox, oy)
  g.lineTo(ox + Math.cos(angle - spread) * len, oy + Math.sin(angle - spread) * len)
  g.lineTo(ox + Math.cos(angle + spread) * len, oy + Math.sin(angle + spread) * len)
  g.closePath().fill({ color: 0xffc8ff, alpha: alpha * 0.15 })
  g.moveTo(ox, oy).lineTo(ox + Math.cos(angle - spread) * len, oy + Math.sin(angle - spread) * len).stroke({ color: 0xffb0ff, width: 2, alpha })
  g.moveTo(ox, oy).lineTo(ox + Math.cos(angle + spread) * len, oy + Math.sin(angle + spread) * len).stroke({ color: 0xffb0ff, width: 2, alpha })
}

function ensureCnoxShieldOrbitCount(e: Enemy, count: number): void {
  if (e.kind !== 'cnox_shield') return
  if (!e.cnoxShields) e.cnoxShields = []

  const estSize = Math.max(9, Math.min(16, Math.abs((e.hpBar.y ?? -20) + 8)))
  while (e.cnoxShields.length < count) {
    const orb = new Graphics()
    drawCnoxShieldOrb(orb, estSize * 0.95)
    e.container.addChild(orb)
    e.cnoxShields.push(orb)
  }
  while (e.cnoxShields.length > count) {
    const removed = e.cnoxShields.pop()
    removeDisplayObject(removed)
  }
}

function pickCnoxSparkAlphaAngles(baseAngle: number): number[] {
  const angles: number[] = []
  for (let idx = 0; idx < 3; idx++) {
    const randomSpread = (Math.random() - 0.5) * 1.9
    const laneOffset = (idx - 1) * 0.22
    angles.push(baseAngle + randomSpread + laneOffset)
  }
  return angles
}

function hitCnoxShieldAlphaBarrier(_e: Enemy, _hitX: number, _hitY: number, _damage: number): boolean {
  // Alpha Cnox Shield no longer uses a horizontal barrier.
  return false
}

function spawnAlphaProjectile(
  sx: number,
  sy: number,
  angle: number,
  speed: number,
  damage: number,
  tint: number,
  opts?: { homing?: boolean, homingLife?: number, homingSpeed?: number, aoe?: boolean, targetX?: number, targetY?: number },
) {
  if (ctx.enemyBullets.length >= getEnemyBulletCap(game.currentStage)) return
  const bg = new Graphics()
  drawEnemyBullet(bg)
  bg.tint = tint
  if (!ctx.lowGraphicsMode) bg.circle(0, 0, 1.5).fill({ color: 0xffffff, alpha: 0.85 })
  bg.scale.set(1.08)
  bg.x = sx
  bg.y = sy
  ctx.gameLayer.addChild(bg)
  ctx.enemyBullets.push({
    gfx: bg,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage,
    homing: opts?.homing,
    homingLife: opts?.homingLife,
    homingSpeed: opts?.homingSpeed,
    aoe: opts?.aoe,
    targetX: opts?.targetX,
    targetY: opts?.targetY,
  })
}

function getAlphaAttackCooldownFrames(e: Enemy): number {
  if (e.kind === 'dai_lien') return 132
  if (e.kind === 'sniper') return 112
  if (e.kind === 'kamikaze') return 96
  if (e.kind === 'thu_ho') return 126
  if (e.kind === 'thuat_si') return 128
  if (e.kind === 'cnox_shield') return 116
  if (e.kind === 'cnox_spark') return 98
  if (e.kind === 'dnox_fire') return 94
  if (e.kind === 'dnox_ice') return 106
  if (e.kind === 'dnox_soil') return 110
  return 98
}

function updateAlphaActiveAttack(e: Enemy, dt: number): void {
  if (!e.threatAlpha || e.kind.startsWith('boss_') || !ctx.playerShip) return
  if (e.isDyingMeteor) return
  if (e.kind === 'kamikaze' && (e.kamiState === 'prexplode' || e.kamiState === 'dead')) return

  const tier = e.threatTier ?? 0
  const attackRate = 1 + tier * 0.12
  e.threatAlphaAttackTimer = (e.threatAlphaAttackTimer ?? (110 + Math.random() * 110)) - dt * attackRate
  if ((e.threatAlphaAttackTimer ?? 0) > 0) return

  const sx = e.container.x
  const sy = e.container.y + 8
  const dx = ctx.playerShip.x - sx
  const dy = ctx.playerShip.y - sy
  const baseAngle = Math.atan2(dy, dx)
  const stage = game.currentStage
  const baseDamage = Math.max(7, Math.round(8 + stage * 0.82 + tier * 1.9))
  const baseSpeed = 3.4 + tier * 0.28

  if (e.kind === 'pioneer') {
    for (const spread of [-0.18, 0, 0.18]) {
      spawnAlphaProjectile(sx, sy, baseAngle + spread, baseSpeed + 0.7, baseDamage + 2, 0xff4d89)
    }
  } else if (e.kind === 'sniper') {
    spawnAlphaProjectile(sx, sy, baseAngle, baseSpeed + 2.6, baseDamage + 8, 0x2ff07d)
  } else if (e.kind === 'kamikaze') {
    for (let n = 0; n < 5; n++) {
      const a = baseAngle + (n - 2) * 0.24
      spawnAlphaProjectile(sx, sy, a, baseSpeed + 1.4, baseDamage + 1, 0xff6b21)
    }
  } else if (e.kind === 'dai_lien') {
    for (let n = 0; n < 3; n++) {
      const spread = (n - 1) * 0.13
      spawnAlphaProjectile(sx, sy, baseAngle + spread, baseSpeed + 0.9, baseDamage + 2, 0xffc56a)
    }
  } else if (e.kind === 'thu_ho') {
    for (let n = 0; n < 6; n++) {
      const a = (n / 6) * Math.PI * 2
      spawnAlphaProjectile(sx, sy, a, baseSpeed + 0.4, baseDamage + 2, 0xffd447)
    }
  } else if (e.kind === 'thuat_si') {
    spawnAlphaProjectile(sx, sy, baseAngle, baseSpeed + 0.9, baseDamage + 5, 0x57f2ad, {
      homing: true,
      homingLife: 180,
      homingSpeed: baseSpeed + 1.2,
    })
  } else if (e.kind === 'cnox_greedy') {
    spawnAlphaProjectile(sx, sy, baseAngle - 0.1, baseSpeed + 1.2, baseDamage + 4, 0xff8f3b)
    spawnAlphaProjectile(sx, sy, baseAngle + 0.1, baseSpeed + 1.2, baseDamage + 4, 0xff8f3b)
  } else if (e.kind === 'cnox_shield') {
    for (let n = 0; n < 8; n++) {
      const a = (n / 8) * Math.PI * 2
      spawnAlphaProjectile(sx, sy, a, baseSpeed + 0.5, baseDamage + 2, 0x3fa7ff)
    }
  } else if (e.kind === 'cnox_spark') {
    for (const spread of [-0.22, 0, 0.22]) {
      spawnAlphaProjectile(sx, sy, baseAngle + spread, baseSpeed + 1.5, baseDamage + 4, 0xc36aff)
    }
  } else if (e.kind === 'dnox_fire') {
    for (const spread of [-0.17, 0, 0.17]) {
      spawnAlphaProjectile(sx, sy, baseAngle + spread, baseSpeed + 1.3, baseDamage + 5, 0xff6126)
    }
  } else if (e.kind === 'dnox_ice') {
    spawnAlphaProjectile(sx, sy, baseAngle - 0.08, baseSpeed + 0.95, baseDamage + 3, 0x51c8ff, {
      homing: true,
      homingLife: 130,
      homingSpeed: baseSpeed + 1,
    })
    spawnAlphaProjectile(sx, sy, baseAngle + 0.08, baseSpeed + 0.95, baseDamage + 3, 0x51c8ff, {
      homing: true,
      homingLife: 130,
      homingSpeed: baseSpeed + 1,
    })
  } else if (e.kind === 'dnox_soil') {
    if (e.cnoxLaserState === 'link_firing' && e.healTarget && ctx.enemies.includes(e.healTarget)) {
      const hx = e.healTarget.container.x
      const hy = e.healTarget.container.y
      for (let n = 0; n < 5; n++) {
        const a = baseAngle + (n - 2) * 0.2
        spawnAlphaProjectile(hx, hy, a, baseSpeed + 0.8, baseDamage + 2, 0xd2a14c)
      }
    } else {
      spawnAlphaProjectile(sx, sy, baseAngle - 0.12, baseSpeed + 0.9, baseDamage + 2, 0xd2a14c)
      spawnAlphaProjectile(sx, sy, baseAngle + 0.12, baseSpeed + 0.9, baseDamage + 2, 0xd2a14c)
    }
  } else {
    spawnAlphaProjectile(sx, sy, baseAngle - 0.12, baseSpeed + 1, baseDamage + 2, 0xff4b88)
    spawnAlphaProjectile(sx, sy, baseAngle + 0.12, baseSpeed + 1, baseDamage + 2, 0xff4b88)
  }

  const cooldown = getAlphaAttackCooldownFrames(e)
  const nextCd = cooldown * (1 - Math.min(0.18, tier * 0.045))
  e.threatAlphaAttackTimer = Math.max(34, nextCd + (Math.random() * 20 - 10))
}

// --- Game loop ----------------------------------------------------------------
function gameLoop(ticker: Ticker) {
  if (!app || !game.isPlaying || game.isGameOverSequence) return
  const dt = ticker.deltaTime
  if (game.showFps) {
    const now = performance.now()
    if (fpsLastTs > 0) {
      const elapsed = now - fpsLastTs
      if (elapsed > 0 && elapsed < 1000) {
        fpsElapsedMs += elapsed
        fpsFrames += 1
      }
    }
    fpsLastTs = now
    if (fpsElapsedMs >= 260) {
      const fps = Math.max(0, Math.round((fpsFrames * 1000) / fpsElapsedMs))
      game.setCurrentFps(fps)
      fpsElapsedMs = 0
      fpsFrames = 0
    }
  } else if (fpsLastTs > 0 || fpsFrames > 0 || fpsElapsedMs > 0 || game.currentFps > 0) {
    resetFpsTracking()
  }
  const hasActiveBoss = ctx.enemies.some((e) => e.kind.startsWith('boss_') && !e.isDyingMeteor)
  audioManager.setBossActive(hasActiveBoss)
  ctx.playerLaserDamageCd = Math.max(0, ctx.playerLaserDamageCd - dt)
  threatProfileTimer += dt
  if (threatProfileTimer >= 30) {
    cachedThreatProfile = getThreatProfile(game)
    threatProfileTimer = 0
  }

  // Stars always scroll
  for (const s of ctx.stars) {
    s.gfx.y += s.vy * dt
    if (s.gfx.y > GAME_H) s.gfx.y = -4
  }

  // -- INTRO PHASE ----------------------------------------------------------
  if (ctx.gamePhase === 'intro') {
    ctx.introTimer += dt
    const progress = Math.min(ctx.introTimer / INTRO_FRAMES, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    if (ctx.playerShip) {
      ctx.playerShip.y = INTRO_SHIP_START_Y + (INTRO_SHIP_END_Y - INTRO_SHIP_START_Y) * eased
    }
    if (progress >= 1) {
      ctx.gamePhase = 'stageTitle'
      ctx.stageTitleTimer = 0
      const style = new TextStyle({
        fill: 0xffd700, fontSize: 26,
        fontFamily: "'Chakra Petch', sans-serif",
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 4 },
        dropShadow: { color: 0xff8800, blur: 12, distance: 0, angle: 0, alpha: 0.9 },
      })
      ctx.stageTitleText = new Text({ text: 'CHß║╛ ─Éß╗ÿ V├ö Tß║¼N', style })
      ctx.stageTitleText.anchor.set(0.5, 0.5)
      ctx.stageTitleText.x = GAME_W / 2
      ctx.stageTitleText.y = GAME_H * 0.38
      ctx.stageTitleText.alpha = 0
      ctx.uiLayer.addChild(ctx.stageTitleText)
    }
    return
  }

  // -- STAGE TITLE PHASE ----------------------------------------------------
  if (ctx.gamePhase === 'stageTitle') {
    ctx.stageTitleTimer += dt
    if (ctx.stageTitleText) {
      const fadeIn = STAGE_TITLE_FRAMES * 0.2
      const fadeOut = STAGE_TITLE_FRAMES * 0.8
      if (ctx.stageTitleTimer < fadeIn) {
        ctx.stageTitleText.alpha = ctx.stageTitleTimer / fadeIn
      } else if (ctx.stageTitleTimer < fadeOut) {
        ctx.stageTitleText.alpha = 1
      } else {
        ctx.stageTitleText.alpha = 1 - (ctx.stageTitleTimer - fadeOut) / (STAGE_TITLE_FRAMES - fadeOut)
      }
    }
    if (ctx.stageTitleTimer >= STAGE_TITLE_FRAMES) {
      if (ctx.stageTitleText) {
        ctx.uiLayer.removeChild(ctx.stageTitleText)
        ctx.stageTitleText = null
      }
      ctx.gamePhase = 'playing'
      launchWave(ctx, game)
    }
    if (ctx.playerShip && ctx.isDragging) {
      const _bz = ctx.bossZoom
      const _blx = GAME_W * (1 - _bz) / 2; const _bly = GAME_H * (1 - _bz) / 2
      const dx = (ctx.touchX - _blx) / _bz - ctx.playerShip.x
      const dy = ((ctx.touchY - _bly) / _bz - TOUCH_Y_OFFSET) - ctx.playerShip.y
      const hpPenalty = Math.max(0.7, Math.pow(100 / game.playerMaxHp, 0.15))
      const shipSpeedMult = Math.max(0.35, game.upgrades.shipSpeed)
      const dragResponse = Math.max(0.2, Math.min(1.45, Math.pow(shipSpeedMult, 1.35)))
      const spd = 5.5 * shipSpeedMult * hpPenalty
      ctx.playerShip.x += dx * 0.055 * spd * dragResponse * dt * 0.5
      ctx.playerShip.y += dy * 0.055 * spd * dragResponse * dt * 0.5
      const _xmin = GAME_W * (1 - 1 / _bz) / 2 + 20
      const _xmax = GAME_W * (1 + 1 / _bz) / 2 - 20
      const _ymin = GAME_H * (1 - 1 / _bz) / 2 + 60
      const _ymax = GAME_H * (1 + 1 / _bz) / 2 - 60
      ctx.playerShip.x = Math.max(_xmin, Math.min(_xmax, ctx.playerShip.x))
      ctx.playerShip.y = Math.max(_ymin, Math.min(_ymax, ctx.playerShip.y))
    }
    return
  }

  // -- BOSS INTRO PHASE: keep cinematic entry but do not freeze other systems --
  const isBossIntro = ctx.gamePhase === 'bossIntro'
  if (isBossIntro) {
    // Ch?y entry animation + post-entry timer cho boss
    let battleReady = false
    for (const e of ctx.enemies) {
      if (!e.kind.startsWith('boss')) continue
      if (!e.bossEntered) {
        if (e.kind === 'boss_tinhvan') {
          e.container.y += 1.0 * dt
          const targetY = e.bossTargetY ?? GAME_H * 0.20
          if (e.container.y >= targetY) {
            e.container.y = targetY; e.bossEntered = true
            e.bossBattleReady = false; e.bossBattleTimer = 180
          }
          if (e.body) e.body.rotation += 0.003 * dt
        } else {
          const speed = e.kind === 'boss_invader' ? 1.2 : 1.2
          e.container.y += speed * dt
          const targetY = e.bossTargetY ?? GAME_H * 0.20
          if (e.container.y >= targetY) {
            e.container.y = targetY; e.bossEntered = true
            e.bossBattleTimer = 60  // th├»┬┐┬╜m 1s delay sau khi v├»┬┐┬╜o v? tr├»┬┐┬╜
          }
        }
      } else {
        // ├»┬┐┬╜├»┬┐┬╜ v├»┬┐┬╜o v? tr├»┬┐┬╜, ch? timer tru?c khi b?t d?u chi?n d?u
        if (e.kind === 'boss_tinhvan') {
          if (e.body) e.body.rotation += 0.003 * dt
          e.bossBattleTimer = (e.bossBattleTimer ?? 180) - dt
          if ((e.bossBattleTimer ?? 0) <= 0) {
            e.bossBattleReady = true
            battleReady = true
            screenFlash(ctx, 0x6600aa, 0.3, 400)
          }
        } else {
          e.bossBattleTimer = (e.bossBattleTimer ?? 60) - dt
          if ((e.bossBattleTimer ?? 0) <= 0) battleReady = true
        }
      }
    }
    // Boss zoom update
    const _tinhVanAlive = ctx.enemies.some(e => e.kind === 'boss_tinhvan' && e.bossEntered)
    const _sunAlive = ctx.enemies.some(e => e.kind === 'boss_cnox_sun' && e.bossEntered)
    ctx.bossZoomTarget = _sunAlive ? 0.68 : (_tinhVanAlive ? 0.75 : 1.0)
    if (Math.abs(ctx.bossZoom - ctx.bossZoomTarget) > 0.001) {
      const zSpeed = 0.006 * dt
      ctx.bossZoom += Math.sign(ctx.bossZoomTarget - ctx.bossZoom) * Math.min(zSpeed, Math.abs(ctx.bossZoomTarget - ctx.bossZoom))
    }
    ctx.gameLayer.scale.set(ctx.bossZoom)
    ctx.gameLayer.position.set(GAME_W * (1 - ctx.bossZoom) / 2, GAME_H * (1 - ctx.bossZoom) / 2)
    // Chuy?n sang 'playing' sau khi h?t delay ├»┬┐┬╜ reset shootTimer d? kh├»┬┐┬╜ng b?n ngay l?p t?c
    if (battleReady) {
      ctx.gamePhase = 'playing'
      ctx.shootTimer = 0
      ctx.keeperBurstShotsLeft = 0
      ctx.keeperBurstDelay = 0
      ctx.bossAttackLockTimer = 60
    }

    // Auto-return ship to home position; player has no control during boss intro
    if (ctx.playerShip) {
      const prevX = ctx.playerShip.x
      const prevY = ctx.playerShip.y
      const homeX = GAME_W / 2
      const homeY = GAME_H * 0.67
      ctx.playerShip.x += (homeX - ctx.playerShip.x) * 0.04 * dt
      ctx.playerShip.y += (homeY - ctx.playerShip.y) * 0.04 * dt
      const ddx = ctx.playerShip.x - prevX
      const ddy = ctx.playerShip.y - prevY
      if (Math.abs(ddx) > 0.001 || Math.abs(ddy) > 0.001) {
        for (const launcher of ctx.missileLaunchers) {
          launcher.gfx.x += ddx
          launcher.gfx.y += ddy
        }
        if (ctx.sfGfx) {
          ctx.sfGfx.x += ddx
          ctx.sfGfx.y += ddy
        }
      }
    }
  }

  // -- PLAYING PHASE --------------------------------------------------------
  if (game.isPaused) return

  game.tickSkillCooldown(dt / 60)
  game.tickShield(dt / 60)
  if (ctx.bossAttackLockTimer > 0) ctx.bossAttackLockTimer = Math.max(0, ctx.bossAttackLockTimer - dt)

  // Frost & Freeze logic (Dnox B─âng lam)
  if (playerFrostStacks >= 2) {
    playerFreezeTimer -= dt
    if (playerFreezeTimer <= 0) {
      playerFrostStacks = 0
      playerFreezeTimer = 0
      playerFreezeTapCount = 0
      freezeBreakPulse = 0
    }
  }
  if (freezeBreakPulse > 0) freezeBreakPulse = Math.max(0, freezeBreakPulse - dt)
  renderFreezeEffects()

  const isFrozen = playerFrostStacks >= 2

  if (ctx.starFasterSkillTimer > 0) {
    ctx.starFasterSkillTimer = Math.max(0, ctx.starFasterSkillTimer - dt)
    if (ctx.starFasterSkillTimer <= 0) {
      ctx.starFasterEnemySlowFactor = 1
      ctx.starFasterFireRateBoost = 1
    }
  }
  if (ctx.tracerFreezeTimer > 0) {
    ctx.tracerFreezeTimer = Math.max(0, ctx.tracerFreezeTimer - dt)
  }
  const starFasterSkillActive = game.selectedShip === 'star_faster' && ctx.starFasterSkillTimer > 0
  const tracerFreezeActive = game.selectedShip === 'thien_ha_truy' && ctx.tracerFreezeTimer > 0
  const enemyTimeScale = tracerFreezeActive ? 0 : (starFasterSkillActive ? ctx.starFasterEnemySlowFactor : 1)
  const enemyBulletDt = dt * enemyTimeScale
  const starFasterFireBoost = starFasterSkillActive ? ctx.starFasterFireRateBoost : 1

  if (ctx.playerShip && game.selectedShip === 'thien_ha_truy') {
    if (tracerFreezeActive) {
      const pulse = 1.75 + Math.sin(Date.now() * 0.012) * 0.22
      ctx.playerShip.scale.set(pulse)
      ctx.playerShip.tint = 0xff4c4c
    } else {
      ctx.playerShip.scale.set(1)
      ctx.playerShip.tint = 0xffffff
    }
  } else if (ctx.playerShip) {
    ctx.playerShip.scale.set(1)
    ctx.playerShip.tint = 0xffffff
  }

  // Neutron Star vacuum timer
  if (game.artifactStats.neutronVacuumActive) {
    const cooldownFactor = Math.max(0.35, 1 - game.cardStats.cdReductionPct)
    const neutronCooldownSec = 20 * cooldownFactor
    ctx.neutronVacuumTimer += dt / 60
    if (ctx.neutronVacuumTimer >= neutronCooldownSec) {
      ctx.neutronVacuumTimer = 0
      activateNeutronVacuum(ctx, game)
    }
    game.neutronVacuumPct = Math.min(1, ctx.neutronVacuumTimer / neutronCooldownSec)
  }

  // Mana core laser trigger (stays charged until there is at least one target)
  if (ctx.manaCoreOverloadPending) {
    const didFire = activateManaCoreOverload(ctx, game)
    if (didFire) ctx.manaCoreOverloadPending = false
  }

  // Artifact gfx orbit ship (supports multiple equipped cores)
  if (ctx.playerShip) {
    const equipped = game.equippedArtifacts[game.selectedShip] ?? []
    if (equipped.length > 0 && ctx.artifactGfxList.length !== equipped.length) {
      initArtifactGfx(ctx, game)
    }
    if (ctx.artifactGfxList.length > 0) {
      ctx.artifactOrbitAngle += 0.022 * dt
      const orbitR = 36
      const count = Math.min(ctx.artifactGfxList.length, equipped.length)
      for (let ai = 0; ai < count; ai++) {
        const g = ctx.artifactGfxList[ai]!
        const artifactId = equipped[ai] ?? ''
        const phase = ctx.artifactOrbitAngle + (Math.PI * 2 * ai) / Math.max(1, count)
        g.x = ctx.playerShip.x + Math.cos(phase) * orbitR
        g.y = ctx.playerShip.y + Math.sin(phase) * orbitR * 0.55
        let pulse = 0
        if (artifactId === 'neutron_star') pulse = game.neutronVacuumPct
        if (artifactId === 'mana_core') pulse = game.manaCorePct
        drawArtifactGfx(g, artifactId, pulse)
      }
      ctx.artifactGfx = ctx.artifactGfxList[0] ?? null
    }
  }

  // Skill activation
  if (game.consumeSkillActivation()) {
    if (game.selectedShip === 'star_holder') {
      activateSoulHarvest(ctx, game)
    } else if (game.selectedShip === 'star_shooter') {
      activateBlackHole(ctx, game)
    } else if (game.selectedShip === 'star_faster') {
      activateParticleAcceleration(ctx, game)
    } else if (game.selectedShip === 'thien_ha_truy') {
      activateThienHaTram()
    } else {
      activateHeatWave(ctx, game)
    }
  }

  if (tracerFreezeActive && !ctx.tracerSlashDone && ctx.tracerFreezeTimer <= 46) {
    ctx.tracerSlashDone = true
    const slashGfx = new Graphics()
    slashGfx.x = GAME_W * 0.5
    slashGfx.y = GAME_H * 0.52
    ctx.gameLayer.addChild(slashGfx)
    ctx.tracerSlashWaveGfx = slashGfx
    screenFlash(ctx, 0xff2a2a, 0.65, 260)

    for (const b of ctx.enemyBullets) {
      if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
    }
    ctx.enemyBullets = []

    const slashDamage = Math.round(game.upgrades.damage * 16)
    for (let i = ctx.enemies.length - 1; i >= 0; i--) {
      const e = ctx.enemies[i]!
      e.hp = Math.max(0, e.hp - slashDamage)
      updateDnoxFireHeat(e, slashDamage, ctx, game)
      hitFlash(e.body)
      spawnDamageText(ctx, e.container.x, e.container.y - (e.kind.startsWith('boss_') ? 56 : 16), slashDamage)
      redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
      if (e.hp <= 0) killEnemy(ctx, game, e, i)
    }
    for (const boss of ctx.enemies) {
      if (boss.kind !== 'boss_cnox_sun') continue
      const crystals = boss.sunEnergyCrystals ?? []
      for (let ci = crystals.length - 1; ci >= 0; ci--) {
        const c = crystals[ci]!
        c.hp = Math.max(0, c.hp - slashDamage)
        spawnDamageText(ctx, c.x, c.y - 14, slashDamage)
        if (c.hp <= 0) {
          spawnExplosion(ctx, c.x, c.y, 20, 0x66c7ff, 0xe9f8ff)
          if (!c.gfx.destroyed) ctx.gameLayer.removeChild(c.gfx)
          crystals.splice(ci, 1)
        }
      }
    }
  }

  if (ctx.tracerSlashWaveGfx) {
    const sweepT = Math.max(0, Math.min(1, (46 - ctx.tracerFreezeTimer) / 24))
    ctx.tracerSlashWaveGfx.clear()
    if (sweepT >= 1) {
      if (!ctx.tracerSlashWaveGfx.destroyed) ctx.gameLayer.removeChild(ctx.tracerSlashWaveGfx)
      ctx.tracerSlashWaveGfx = null
    }
    if (ctx.tracerSlashWaveGfx && ctx.tracerFreezeTimer > 0 && sweepT > 0) {
      const ease = sweepT * sweepT * (3 - 2 * sweepT)
      const alpha = Math.max(0.15, 1 - ease * 0.85)
      const angleDeg = 135 - 120 * ease
      ctx.tracerSlashWaveGfx.rotation = angleDeg * Math.PI / 180
      ctx.tracerSlashWaveGfx.x = GAME_W * 0.5
      ctx.tracerSlashWaveGfx.y = GAME_H * 0.52

      // Giant sword body (flipped orientation: tip and tail swapped)
      ctx.tracerSlashWaveGfx.poly([
        48, -28,
        -338, -26,
        -438, -6,
        -478, 0,
        -438, 6,
        -338, 26,
        48, 28,
        96, 0,
      ]).fill({ color: 0xff5c5c, alpha: 0.96 * alpha })
      ctx.tracerSlashWaveGfx.poly([
        -340, -8,
        -430, -2,
        -430, 2,
        -340, 8,
      ]).fill({ color: 0xfff8ef, alpha: 0.92 * alpha })
      ctx.tracerSlashWaveGfx.rect(-360, -7, 360, 4).fill({ color: 0xfff0e0, alpha: 0.92 * alpha })
      ctx.tracerSlashWaveGfx.roundRect(28, -40, 48, 80, 10).fill({ color: 0x741829, alpha: 0.95 * alpha })
      ctx.tracerSlashWaveGfx.roundRect(76, -12, 44, 24, 7).fill({ color: 0x4d0f1a, alpha: 0.92 * alpha })

      // Slash energy and spark particles
      ctx.tracerSlashWaveGfx.roundRect(-320, -22, 360, 44, 16).stroke({ color: 0xff897d, width: 4, alpha: 0.22 * alpha })
      for (let p = 0; p < 14; p++) {
        const t = p / 13
        const px = -420 + t * 440 + Math.sin((ease * 10) + p) * 10
        const py = (Math.cos((ease * 11) + p * 1.7) * 14)
        const r = 1.4 + (1 - t) * 2.2
        ctx.tracerSlashWaveGfx.circle(px, py, r).fill({ color: 0xffe6db, alpha: (0.18 + (1 - t) * 0.32) * alpha })
      }
    }
    if (ctx.tracerSlashWaveGfx && ctx.tracerFreezeTimer <= 0) {
      if (!ctx.tracerSlashWaveGfx.destroyed) ctx.gameLayer.removeChild(ctx.tracerSlashWaveGfx)
      ctx.tracerSlashWaveGfx = null
    }
  }

  const pendingHeal = game.consumePendingHealPopup()
  if (pendingHeal > 0 && ctx.playerShip) {
    spawnHealText(ctx, ctx.playerShip.x, ctx.playerShip.y - 22, pendingHeal)
  }

  // Card abilities (blocked during boss entry animation)
  if (!isBossIntro) {
    updateMissileLaunchers(ctx, game, dt)
    updatePeriodicAbilities(ctx, game, dt)
  }

  // Soul missile firing (Star Holder) - blocked during boss entry
  if (!isBossIntro && ctx.soulMissileQueue > 0 && ctx.playerShip) {
    ctx.soulMissileFireTimer -= dt
    if (ctx.soulMissileFireTimer <= 0) {
      ctx.soulMissileFireTimer = 6
      ctx.soulMissileQueue--
      const target = findNearestEnemy(ctx.enemies, ctx.playerShip.x, ctx.playerShip.y)
      const mg = new Graphics()
      drawFragmentMissile(mg)
      mg.x = ctx.playerShip.x + (Math.random() - 0.5) * 20
      mg.y = ctx.playerShip.y - 12
      ctx.gameLayer.addChild(mg)
      const mdx = target ? (target.container.x - mg.x) : 0
      const mdy = target ? (target.container.y - mg.y) : -1
      const md = Math.sqrt(mdx * mdx + mdy * mdy) || 1
      ctx.fragmentMissiles.push({ gfx: mg, vx: (mdx / md) * 7, vy: (mdy / md) * 7 })
    }
  }

  // Shield visual
  if (ctx.shieldGfx && ctx.playerShip) {
    if (game.shieldActive) {
      ctx.shieldGfx.visible = true
      ctx.shieldGfx.x = ctx.playerShip.x
      ctx.shieldGfx.y = ctx.playerShip.y
      ctx.shieldGfx.clear()
      const pulse = 0.65 + Math.sin(Date.now() * 0.006) * 0.35
      ctx.shieldGfx.circle(0, 0, 32).stroke({ color: 0x44aaff, width: 3, alpha: pulse })
      ctx.shieldGfx.circle(0, 0, 32).fill({ color: 0x2266ff, alpha: 0.10 * pulse })
    } else {
      ctx.shieldGfx.visible = false
    }
  }

  if (starFasterAuraGfx && ctx.playerShip) {
    if (starFasterSkillActive) {
      starFasterAuraGfx.visible = true
      starFasterAuraGfx.x = ctx.playerShip.x
      starFasterAuraGfx.y = ctx.playerShip.y
      starFasterAuraGfx.clear()
      const pulse = 0.6 + Math.sin(Date.now() * 0.012) * 0.4
      const r1 = 24 + pulse * 4
      const r2 = 32 + pulse * 6
      starFasterAuraGfx.circle(0, 0, r2).stroke({ color: 0xb894ff, width: 2, alpha: 0.35 + pulse * 0.15 })
      starFasterAuraGfx.circle(0, 0, r1).stroke({ color: 0x66eeff, width: 2.2, alpha: 0.55 + pulse * 0.2 })
      starFasterAuraGfx.circle(0, 0, r1 - 9).fill({ color: 0x8b5fff, alpha: 0.10 + pulse * 0.05 })
      for (let i = 0; i < 6; i++) {
        const a = (Date.now() * 0.006) + (i * Math.PI * 2 / 6)
        const x = Math.cos(a) * (r2 + 3)
        const y = Math.sin(a) * (r2 + 3)
        starFasterAuraGfx.circle(x, y, 1.8).fill({ color: 0xdcc7ff, alpha: 0.8 })
      }
    } else {
      starFasterAuraGfx.visible = false
      starFasterAuraGfx.clear()
    }
  }

  // Ally drones (─Éß╗ông Minh Hß╗ù Trß╗ú)
  if (ctx.playerShip) {
    const droneCount = Math.max(0, Math.floor(game.cardStats.allyDroneCount))
    while (ctx.allyDrones.length > droneCount) {
      const removed = ctx.allyDrones.pop()
      if (removed && !removed.gfx.destroyed) ctx.gameLayer.removeChild(removed.gfx)
    }
    while (ctx.allyDrones.length < droneCount) {
      const dg = new Graphics()
      drawAllyDrone(dg, game.cardStats.allyDroneUltimate)
      dg.x = ctx.playerShip.x
      dg.y = ctx.playerShip.y - 22
      ctx.gameLayer.addChild(dg)
      ctx.allyDrones.push({ gfx: dg, angle: 0, shootTimer: Math.random() * 20, burstRemaining: 0, burstTimer: 0 })
    }

    const now = Date.now()
    const isUltimateDrone = game.cardStats.allyDroneUltimate
    const burstCount = Math.max(1, Math.floor(game.cardStats.allyDroneBurstCount))
    const beamCount = Math.max(1, Math.floor(game.cardStats.allyDroneBeamCount))
    const fireRateMult = Math.max(0.5, game.cardStats.allyDroneFireRateMult)
    const cooldownFactor = Math.max(0.35, 1 - game.cardStats.cdReductionPct)
    const droneShotInterval = Math.max(6, (44 / fireRateMult) * cooldownFactor)
    const droneBurstGap = 6 // 0.1s at 60fps between shots in a burst
    const droneBulletSpeed = isUltimateDrone ? 14.2 : 11.6
    const droneDamage = Math.round(game.upgrades.damage * 0.442 * (1 + game.cardStats.damageBonusPct / 100) * game.cardStats.allyDroneDamageMult)

    for (let i = 0; i < ctx.allyDrones.length; i++) {
      const drone = ctx.allyDrones[i] as AllyDrone
      const baseAngle = (i / Math.max(1, droneCount)) * Math.PI * 2
      const orbitA = now * 0.0019 + baseAngle
      const orbitR = droneCount > 1 ? 26 : 22
      const targetX = ctx.playerShip.x + Math.cos(orbitA) * orbitR
      const targetY = ctx.playerShip.y - 20 + Math.sin(orbitA) * (orbitR * 0.55)
      drone.gfx.x += (targetX - drone.gfx.x) * Math.min(1, 0.18 * dt)
      drone.gfx.y += (targetY - drone.gfx.y) * Math.min(1, 0.18 * dt)
      drawAllyDrone(drone.gfx, isUltimateDrone)

      if (drone.burstRemaining > 0) {
        drone.burstTimer -= dt
      } else {
        drone.shootTimer -= dt
      }

      if (!isBossIntro && (drone.burstRemaining > 0 ? drone.burstTimer <= 0 : drone.shootTimer <= 0)) {
        const target = findNearestEnemy(ctx.enemies, drone.gfx.x, drone.gfx.y)
        if (!target) continue

        if (drone.burstRemaining <= 0) {
          drone.burstRemaining = burstCount
          drone.burstTimer = 0
          drone.shootTimer = droneShotInterval
        }

        drone.burstRemaining -= 1
        drone.burstTimer = drone.burstRemaining > 0 ? droneBurstGap : 0

        const baseDx = target.container.x - drone.gfx.x
        const baseDy = target.container.y - drone.gfx.y
        const baseMag = Math.sqrt(baseDx * baseDx + baseDy * baseDy) || 1
        const dirX = baseDx / baseMag
        const dirY = baseDy / baseMag

        const directionSpreads = beamCount === 1 ? [0] : [-0.10, 0.10]
        for (const spread of directionSpreads) {
          const cos = Math.cos(spread)
          const sin = Math.sin(spread)
          const shotDirX = dirX * cos - dirY * sin
          const shotDirY = dirX * sin + dirY * cos
          const bg = new Graphics()
          drawDroneBullet(bg, isUltimateDrone)
          bg.x = drone.gfx.x
          bg.y = drone.gfx.y
          bg.rotation = Math.atan2(shotDirY, shotDirX) + Math.PI / 2
          ctx.gameLayer.addChild(bg)
          ctx.bullets.push({
            gfx: bg,
            vx: shotDirX * droneBulletSpeed,
            vy: -shotDirY * droneBulletSpeed,
            damage: droneDamage,
          })
        }
      }
    }
  }

  // Player movement (disabled during boss intro or frozen)
  if (!isBossIntro && !isFrozen && !tracerFreezeActive && ctx.isDragging && ctx.playerShip) {
    const _bz2 = ctx.bossZoom
    const _blx2 = GAME_W * (1 - _bz2) / 2; const _bly2 = GAME_H * (1 - _bz2) / 2
    const dx = (ctx.touchX - _blx2) / _bz2 - ctx.playerShip.x
    const dy = ((ctx.touchY - _bly2) / _bz2 - TOUCH_Y_OFFSET) - ctx.playerShip.y
    const hpPenalty = Math.max(0.7, Math.pow(100 / game.playerMaxHp, 0.15))
    const shipSpeedMult = Math.max(0.35, game.upgrades.shipSpeed * (1 + game.cardStats.speedCardPct / 100))
    const dragResponse = Math.max(0.2, Math.min(1.45, Math.pow(shipSpeedMult, 1.35)))
    const spd = 5.5 * shipSpeedMult * hpPenalty
    ctx.playerShip.x += dx * 0.055 * spd * dragResponse * dt * 0.5
    ctx.playerShip.y += dy * 0.055 * spd * dragResponse * dt * 0.5
    const _xmin2 = GAME_W * (1 - 1 / _bz2) / 2 + 20
    const _xmax2 = GAME_W * (1 + 1 / _bz2) / 2 - 20
    const _ymin2 = GAME_H * (1 - 1 / _bz2) / 2 + 60
    const _ymax2 = GAME_H * (1 + 1 / _bz2) / 2 - 60
    ctx.playerShip.x = Math.max(_xmin2, Math.min(_xmax2, ctx.playerShip.x))
    ctx.playerShip.y = Math.max(_ymin2, Math.min(_ymax2, ctx.playerShip.y))
  }

  // Shooting
  const isHolder = game.selectedShip === 'star_holder'
  const isShooter = game.selectedShip === 'star_shooter'
  const isFaster = game.selectedShip === 'star_faster'
  const isTracer = game.selectedShip === 'thien_ha_truy'
  const isKeeper = game.selectedShip === 'star_keeper'
  const tracerMode = game.cardStats.tracerSwordUltimateMode
  const tracerFixedCount = tracerMode === 'tu_kiem' ? 4 : (tracerMode === 'van_kiem' ? 1 : null)
  const tracerBaseCount = Math.max(1, game.upgrades.bulletCount + game.cardStats.tracerSwordBonus)
  const tracerSwordCount = tracerFixedCount ?? tracerBaseCount
  const maxPrimaryBullets = isFaster ? 5 : (isShooter ? 4 : 3)
  const baselineBullets = isFaster ? Math.max(2, game.upgrades.bulletCount) : game.upgrades.bulletCount
  const effectiveBulletCount = (isShooter || isTracer) ? 1 : Math.min(maxPrimaryBullets, baselineBullets + game.cardStats.arsenalBulletBonus)
  const effectiveMissileCount = isShooter ? (game.upgrades.bulletCount + game.cardStats.shooterMissileBonus) : 1
  ctx.shootTimer += dt
  const baseShootInterval = isHolder ? 60 : (isShooter ? 160 : (isTracer ? 18 : (isFaster ? 12 : 18)))
  const shootCount = isShooter ? effectiveMissileCount : effectiveBulletCount
  const shootInterval = (baseShootInterval / Math.sqrt(shootCount)) / ((1 + game.permUpgrades.fireRate * 0.15 + game.cardStats.arsenalFireRatePct / 100 + game.cardStats.turboFireRatePct / 100 + game.artifactStats.fireRateBonus) * game.selectedShipFireRateMult * starFasterFireBoost)
  const fireStandardBulletVolley = (cnt: number) => {
    audioManager.playShipShoot(isFaster ? 'star_faster' : 'star_keeper')
    const perShotSpreadDeg = isFaster ? 1.35 : 3
    const maxHalfAngle = Math.min(Math.PI * 12 / 180, (cnt - 1) * Math.PI * perShotSpreadDeg / 180)
    const bulletSpeedMul = isFaster ? 1.45 : 1.15
    const bulletVy = 8 * game.upgrades.bulletSpeed * bulletSpeedMul
    for (let i = 0; i < cnt; i++) {
      const norm = cnt > 1 ? (i - (cnt - 1) / 2) / ((cnt - 1) / 2) : 0
      const vxDrift = Math.tan(norm * maxHalfAngle) * bulletVy
      shoot((i - (cnt - 1) / 2) * 12, vxDrift, bulletSpeedMul)
    }
  }

  if (!isBossIntro && !isFrozen && !tracerFreezeActive) {
    const cnt = isShooter ? effectiveMissileCount : effectiveBulletCount

    if (isKeeper && ctx.playerShip) {
      const keeperIntraBurstDelay = Math.max(3, shootInterval * 0.35)
      const keeperPostBurstDelay = Math.max(24, shootInterval * 2.4)
      ctx.keeperBurstDelay = Math.max(0, ctx.keeperBurstDelay - dt)
      if (ctx.keeperBurstDelay <= 0) {
        fireStandardBulletVolley(cnt)
        if (ctx.keeperBurstShotsLeft <= 0) {
          ctx.keeperBurstShotsLeft = 2
          ctx.keeperBurstDelay = keeperIntraBurstDelay
        } else {
          ctx.keeperBurstShotsLeft -= 1
          ctx.keeperBurstDelay = ctx.keeperBurstShotsLeft > 0 ? keeperIntraBurstDelay : keeperPostBurstDelay
        }
      }
    } else if (ctx.shootTimer >= shootInterval) {
      ctx.shootTimer = 0
      if (isHolder && ctx.playerShip) {
      audioManager.playShipShoot('star_holder')
      const laserDmg = Math.round(
        game.upgrades.damage
        * (1 + game.cardStats.arsenalDamagePct / 100)
        * (1 + game.cardStats.damageBonusPct / 100)
      )
      screenFlash(ctx, 0xff4400, 0.15, 200)
      const step = Math.PI / 18
      for (let i = 0; i < cnt; i++) {
        const angle = (i - (cnt - 1) / 2) * step
        spawnHolderLaser(ctx, game, ctx.playerShip.x, ctx.playerShip.y - 18, angle, laserDmg)
      }
      } else if (isTracer && ctx.playerShip) {
      const crystalTargets = ctx.enemies
        .filter(e => e.kind === 'boss_cnox_sun')
        .flatMap(e => (e.sunEnergyCrystals ?? []).map(c => ({ x: c.x, y: c.y, enemy: undefined as Enemy | undefined })))
      const enemyTargets = [...ctx.enemies]
        .sort((a, b) => dist2(ctx.playerShip!.x, ctx.playerShip!.y, a.container.x, a.container.y) - dist2(ctx.playerShip!.x, ctx.playerShip!.y, b.container.x, b.container.y))
      const orderedTargets = [
        ...crystalTargets,
        ...enemyTargets.map(e => ({ x: e.container.x, y: e.container.y, enemy: e as Enemy | undefined })),
      ]
      if (orderedTargets.length > 0) {
        const tracerCurrent = ctx.shooterMissiles.filter(m => (m as typeof m & { mode?: string }).mode === 'tracer')
        let playedShotCue = false
        while (tracerCurrent.length < tracerSwordCount) {
          if (!playedShotCue) {
            audioManager.playShipShoot('thien_ha_truy')
            playedShotCue = true
          }
          const mg = new Graphics()
          drawTracerSword(mg, 'main')
          const idx = tracerCurrent.length
          mg.x = ctx.playerShip.x + (idx - (tracerSwordCount - 1) / 2) * 10
          mg.y = ctx.playerShip.y - 20
          ctx.gameLayer.addChild(mg)
          const target = orderedTargets[idx % orderedTargets.length]!
          const dx = target.x - mg.x
          const dy = target.y - mg.y
          const d = Math.sqrt(dx * dx + dy * dy) || 1
          const sword = {
            gfx: mg,
            vx: (dx / d) * 7,
            vy: (dy / d) * 7,
            damage: Math.round(game.upgrades.damage * game.cardStats.tracerSwordDmgMult * (1 + game.cardStats.damageBonusPct / 100)),
            aoe: false,
            targetEnemy: target.enemy,
            targetX: target.x,
            targetY: target.y,
            mode: 'tracer' as const,
            hitCooldown: 0,
          }
          ctx.shooterMissiles.push(sword)
          tracerCurrent.push(sword)
        }
      }
      } else if (isShooter && ctx.playerShip) {
      const cs = game.cardStats
      const mSpd = 6 * cs.shooterMissileSpdMult
      const missileDmg = Math.round(game.upgrades.damage * cs.shooterMissileDmgMult * (1 + cs.damageBonusPct / 100))
      const crystalTargets = ctx.enemies
        .filter(e => e.kind === 'boss_cnox_sun')
        .flatMap(e => (e.sunEnergyCrystals ?? []).map(c => ({ x: c.x, y: c.y })))
      const sortedTargets = [
        ...ctx.enemies.map(e => ({ x: e.container.x, y: e.container.y, enemy: e as Enemy | undefined })),
        ...crystalTargets.map(c => ({ x: c.x, y: c.y, enemy: undefined as Enemy | undefined })),
      ].sort((a, b) => dist2(ctx.playerShip!.x, ctx.playerShip!.y, a.x, a.y) - dist2(ctx.playerShip!.x, ctx.playerShip!.y, b.x, b.y))
      if (sortedTargets.length > 0) {
        audioManager.playShipShoot('star_shooter')
        for (let i = 0; i < cnt; i++) {
          const offX = (i - (cnt - 1) / 2) * 14
          const mg = new Graphics()
          drawShooterMissile(mg)
          mg.x = ctx.playerShip.x + offX; mg.y = ctx.playerShip.y - 22
          ctx.gameLayer.addChild(mg)
          const target = sortedTargets[i % sortedTargets.length]
          const dx = target ? target.x - mg.x : 0
          const dy = target ? target.y - mg.y : -1
          const d = Math.sqrt(dx * dx + dy * dy) || 1
          ctx.shooterMissiles.push({
            gfx: mg,
            vx: (dx / d) * mSpd,
            vy: (dy / d) * mSpd,
            damage: missileDmg,
            aoe: cs.shooterMissileAoe,
            targetEnemy: target?.enemy,
            targetX: target?.x,
            targetY: target?.y,
          })
        }
      }
      } else {
        fireStandardBulletVolley(cnt)
      }
    }
  }

  if (isTracer) {
    const lockPoints: Array<{ x: number; y: number }> = []
    const lockKeys = new Set<string>()
    for (const m of ctx.shooterMissiles) {
      const mm = m as typeof m & { mode?: 'missile' | 'tracer' | 'tracer_small' }
      if (mm.mode !== 'tracer' && mm.mode !== 'tracer_small') continue

      if (m.targetEnemy && ctx.enemies.includes(m.targetEnemy)) {
        const key = `enemy:${ctx.enemies.indexOf(m.targetEnemy)}`
        if (lockKeys.has(key)) continue
        lockKeys.add(key)
        lockPoints.push({ x: m.targetEnemy.container.x, y: m.targetEnemy.container.y })
      }
    }

    if (lockPoints.length > 0) {
      if (!ctx.tracerLockGfx) {
        const g = new Graphics()
        ctx.gameLayer.addChild(g)
        ctx.tracerLockGfx = g
      }
      ctx.tracerLockGfx.clear()
      const pulse = 0.74 + Math.sin(Date.now() * 0.014) * 0.26
      for (const p of lockPoints) {
        ctx.tracerLockGfx.circle(p.x, p.y, 19 * pulse).stroke({ color: 0xff7a7a, width: 1.8, alpha: 0.82 })
        ctx.tracerLockGfx.moveTo(p.x - 13, p.y).lineTo(p.x - 6, p.y).stroke({ color: 0xffb3b3, width: 1.4, alpha: 0.8 })
        ctx.tracerLockGfx.moveTo(p.x + 13, p.y).lineTo(p.x + 6, p.y).stroke({ color: 0xffb3b3, width: 1.4, alpha: 0.8 })
        ctx.tracerLockGfx.moveTo(p.x, p.y - 13).lineTo(p.x, p.y - 6).stroke({ color: 0xffb3b3, width: 1.4, alpha: 0.8 })
        ctx.tracerLockGfx.moveTo(p.x, p.y + 13).lineTo(p.x, p.y + 6).stroke({ color: 0xffb3b3, width: 1.4, alpha: 0.8 })
      }
    } else if (ctx.tracerLockGfx) {
      ctx.tracerLockGfx.clear()
    }
  } else if (ctx.tracerLockGfx) {
    ctx.tracerLockGfx.clear()
  }

  // Star Shooter black hole projectile (in-flight phase)
  if (isShooter && ctx.shooterBlackHoleProjGfx) {
    const proj = ctx.shooterBlackHoleProjGfx
    const pdx = ctx.shooterBlackHoleProjTX - proj.x
    const pdy = ctx.shooterBlackHoleProjTY - proj.y
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy) || 1
    const projSpd = 11 * dt
    if (pdist <= projSpd + 2) {
      // Arrived ├»┬┐┬╜ spawn black hole at target position
      if (!proj.destroyed) ctx.gameLayer.removeChild(proj)
      ctx.shooterBlackHoleProjGfx = null
      const g = new Graphics()
      g.x = ctx.shooterBlackHoleProjTX
      g.y = ctx.shooterBlackHoleProjTY
      ctx.gameLayer.addChild(g)
      ctx.shooterBlackHoleGfx = g
      ctx.shooterBlackHoleTimer = 300
      ctx.shooterBlackHoleDamageTick = 60
    } else {
      proj.x += (pdx / pdist) * projSpd
      proj.y += (pdy / pdist) * projSpd
      proj.clear()
      const ppulse = 0.75 + Math.sin(Date.now() * 0.015) * 0.25
      proj.circle(0, 0, 9 * ppulse).fill(0x1a0033)
      proj.circle(0, 0, 9 * ppulse).stroke({ color: 0xaa33ff, width: 2.5, alpha: 0.9 })
      proj.circle(0, 0, 4 * ppulse).fill({ color: 0x9900ff, alpha: 0.7 })
    }
  }

  // Star Shooter black hole
  if (isShooter && ctx.shooterBlackHoleGfx) {
    ctx.shooterBlackHoleTimer -= dt
    ctx.shooterBlackHoleDamageTick -= dt
    let blackHoleDamageTicks = 0
    while (ctx.shooterBlackHoleDamageTick <= 0) {
      blackHoleDamageTicks++
      ctx.shooterBlackHoleDamageTick += 60
    }
    const bhg = ctx.shooterBlackHoleGfx
    bhg.clear()
    const bhPulse = 0.7 + Math.sin(Date.now() * 0.003) * 0.3
    bhg.circle(0, 0, 55 * bhPulse).fill({ color: 0x110022, alpha: 0.92 })
    bhg.circle(0, 0, 55 * bhPulse).stroke({ color: 0x8800ff, width: 2.5, alpha: 0.9 })
    bhg.circle(0, 0, (55 + 14) * bhPulse).stroke({ color: 0x4400aa, width: 1.5, alpha: 0.5 })
    bhg.circle(0, 0, (55 + 28) * bhPulse).stroke({ color: 0x220055, width: 1, alpha: 0.3 })
    for (let i = ctx.enemies.length - 1; i >= 0; i--) {
      const e = ctx.enemies[i]
      const isBoss = e.kind.startsWith('boss')
      const bdx = bhg.x - e.container.x; const bdy = bhg.y - e.container.y
      const bd = Math.sqrt(bdx * bdx + bdy * bdy) || 1
      if (!isBoss && bd < 185) {
        const pull = (1 - bd / 185) * 4 * dt
        e.container.x += (bdx / bd) * pull; e.container.y += (bdy / bd) * pull
      }
      if (blackHoleDamageTicks > 0) {
        const dmgRate = isBoss ? 0.04 : 0.10
        const bhDmg = Math.max(1, Math.round(e.maxHp * dmgRate)) * blackHoleDamageTicks
        e.hp = Math.max(0, e.hp - bhDmg)
        hitFlash(e.body)
        updateDnoxFireHeat(e, bhDmg, ctx, game)
        spawnDamageText(ctx, e.container.x, e.container.y - (isBoss ? 60 : 16), bhDmg)
        redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
        if (e.hp <= 0) { killEnemy(ctx, game, e, i); continue }
      }
    }
    for (const e of ctx.enemies) {
      if (e.kind !== 'boss_cnox_sun') continue
      const crystals = e.sunEnergyCrystals ?? []
      for (let ci = crystals.length - 1; ci >= 0; ci--) {
        const c = crystals[ci]!
        const bdx = bhg.x - c.x; const bdy = bhg.y - c.y
        const bd = Math.sqrt(bdx * bdx + bdy * bdy) || 1
        if (bd < 185) {
          const pull = (1 - bd / 185) * 4 * dt
          c.x += (bdx / bd) * pull
          c.y += (bdy / bd) * pull
          c.gfx.x = c.x
          c.gfx.y = c.y
        }
        if (blackHoleDamageTicks > 0) {
          const bhDmg = Math.max(1, Math.round(c.maxHp * 0.04)) * blackHoleDamageTicks
          c.hp = Math.max(0, c.hp - bhDmg)
          spawnDamageText(ctx, c.x, c.y - 14, bhDmg)
          if (c.hp <= 0) {
            spawnExplosion(ctx, c.x, c.y, 20, 0x66c7ff, 0xe9f8ff)
            if (!c.gfx.destroyed) ctx.gameLayer.removeChild(c.gfx)
            crystals.splice(ci, 1)
          }
        }
      }
    }
    for (let i = ctx.enemyBullets.length - 1; i >= 0; i--) {
      const b = ctx.enemyBullets[i]
      if (dist2(b.gfx.x, b.gfx.y, bhg.x, bhg.y) < 80 * 80) {
        if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
        ctx.enemyBullets.splice(i, 1)
      }
    }
    if (ctx.shooterBlackHoleTimer <= 0) {
      if (!bhg.destroyed) ctx.gameLayer.removeChild(bhg)
      ctx.shooterBlackHoleGfx = null
      ctx.shooterBlackHoleTimer = 0
      ctx.shooterBlackHoleDamageTick = 0
    }
  }

  // Move player bullets
  for (let i = ctx.bullets.length - 1; i >= 0; i--) {
    const b = ctx.bullets[i]
    b.gfx.y -= b.vy * dt
    if (b.vx) b.gfx.x += b.vx * dt
    if (b.gfx.y < (GAME_H * (1 - 1 / ctx.bossZoom) / 2) - 20 || b.gfx.x < (GAME_W * (1 - 1 / ctx.bossZoom) / 2) - 10 || b.gfx.x > (GAME_W * (1 + 1 / ctx.bossZoom) / 2) + 10) {
      if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
      ctx.bullets.splice(i, 1)
    }
  }

  // Keep enemy bullet count bounded to avoid frame drops when multiple packs overlap.
  const enemyBulletCap = getEnemyBulletCap(game.currentStage)
  if (ctx.enemyBullets.length > enemyBulletCap) {
    const removeCount = ctx.enemyBullets.length - enemyBulletCap
    for (let ri = 0; ri < removeCount; ri++) {
      const removed = ctx.enemyBullets.shift()
      if (removed && !removed.gfx.destroyed) ctx.gameLayer.removeChild(removed.gfx)
    }
  }

  // Move enemy bullets
  for (let i = ctx.enemyBullets.length - 1; i >= 0; i--) {
    const b = ctx.enemyBullets[i]
    if (b.homing && (b.homingLife ?? 0) > 0 && ctx.playerShip) {
      const homingRange = b.homingRange
      const inHomingRange = homingRange === undefined
        || dist2(b.gfx.x, b.gfx.y, ctx.playerShip.x, ctx.playerShip.y) <= homingRange * homingRange
      if (inHomingRange) {
        b.homingLife! -= enemyBulletDt
        const spd = b.homingSpeed ?? 3.5
        const dx = ctx.playerShip.x - b.gfx.x
        const dy = ctx.playerShip.y - b.gfx.y
        const mag = Math.sqrt(dx * dx + dy * dy) || 1
        const steer = Math.min(0.2, 0.045 * enemyBulletDt)
        b.vx += (dx / mag * spd - b.vx) * steer
        b.vy += (dy / mag * spd - b.vy) * steer
        const vmag = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1
        b.vx = (b.vx / vmag) * spd
        b.vy = (b.vy / vmag) * spd
        const targetRot = Math.atan2(b.vy, b.vx) + Math.PI / 2
        let diff = targetRot - b.gfx.rotation
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        b.gfx.rotation += diff * Math.min(1, 0.22 * dt)
      }
    } else if (b.missileTrail) {
      const targetRot = Math.atan2(b.vy, b.vx) + Math.PI / 2
      let diff = targetRot - b.gfx.rotation
      while (diff > Math.PI) diff -= Math.PI * 2
      while (diff < -Math.PI) diff += Math.PI * 2
      b.gfx.rotation += diff * Math.min(1, 0.2 * dt)
    }
    if (b.missileTrail && b.gfx.children.length > 0) {
      const flame = b.gfx.children[0] as Graphics
      const pulse = 0.72 + Math.abs(Math.sin(Date.now() * 0.018 + (b.trailPulse ?? 0))) * 0.45
      flame.clear()
      flame.poly([0, 2, 3.2, 10.5, 0, 24 + pulse * 4, -3.2, 10.5]).fill({ color: b.missileTrailColor ?? 0xffa3ff, alpha: 0.64 + pulse * 0.16 })
    }
    b.gfx.x += b.vx * enemyBulletDt
    b.gfx.y += b.vy * enemyBulletDt
    if (b.gfx.y > (GAME_H * (1 + 1 / ctx.bossZoom) / 2) + 40 || b.gfx.y < (GAME_H * (1 - 1 / ctx.bossZoom) / 2) - 40 || b.gfx.x < (GAME_W * (1 - 1 / ctx.bossZoom) / 2) - 40 || b.gfx.x > (GAME_W * (1 + 1 / ctx.bossZoom) / 2) + 40) {
      if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
      ctx.enemyBullets.splice(i, 1)
      continue
    }
    const bHitR = b.homing ? 14 : 12
    // AOE missile: explode when reaching target position
    if (b.aoe && b.targetX !== undefined && b.targetY !== undefined) {
      if (dist2(b.gfx.x, b.gfx.y, b.targetX, b.targetY) < 18 * 18) {
        // Snap to target so warning ring and actual explosion center are pixel-perfect aligned.
        b.gfx.x = b.targetX
        b.gfx.y = b.targetY
        const ex = b.targetX
        const ey = b.targetY
        spawnExplosion(ctx, ex, ey, 22, 0xcc44ff, 0xffffff)
        screenFlash(ctx, 0x8800ff, 0.12, 200)
        if (b.sunShardBurst) {
          const shardCount = b.sunShardCount ?? 12
          const base = Math.random() * Math.PI * 2
          for (let si = 0; si < shardCount; si++) {
            const sg = new Graphics()
            drawEnemyBullet(sg)
            sg.tint = 0xffa84a
            sg.x = ex
            sg.y = ey
            ctx.gameLayer.addChild(sg)
            const ang = base + (si / shardCount) * Math.PI * 2
            ctx.enemyBullets.push({
              gfx: sg,
              vx: Math.cos(ang) * 3.8,
              vy: Math.sin(ang) * 3.8,
              damage: 12 + game.currentStage * 2,
            })
          }
        }
        if (ctx.playerShip && dist2(ex, ey, ctx.playerShip.x, ctx.playerShip.y) < 55 * 55) {
          if (isTracerSkillInvulnerable()) {
            // Thi├¬n H├á Truy is invulnerable while skill is active.
          } else if (game.absorbShieldHit()) {
            spawnExplosion(ctx, ctx.playerShip.x, ctx.playerShip.y, 10, 0x44aaff, 0x88ddff)
            screenFlash(ctx, 0x4488ff, 0.28, 200)
          } else {
            const dmg = Math.max(1, Math.round((b.damage ?? (20 + game.currentStage * 3)) * cachedThreatProfile.damageMult))
            game.takeDamage(dmg); screenFlash(ctx)
            spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, dmg)
          }
        }
        if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
        ctx.enemyBullets.splice(i, 1)
        continue
      }
    }
    if (ctx.playerShip && dist2(b.gfx.x, b.gfx.y, ctx.playerShip.x, ctx.playerShip.y) < bHitR * bHitR) {
      if (isTracerSkillInvulnerable()) {
        // Thi├¬n H├á Truy is invulnerable while skill is active.
      } else if (game.absorbShieldHit()) {
        spawnExplosion(ctx, b.gfx.x, b.gfx.y, 9, 0x44aaff, 0x88ddff)
        screenFlash(ctx, 0x4488ff, 0.28, 200)
      } else {
        const dmg = Math.max(1, Math.round((b.damage ?? (15 + game.currentStage * 3)) * cachedThreatProfile.damageMult))
        game.takeDamage(dmg)
        screenFlash(ctx)
        spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, dmg)
      }
      b.onHitPlayer?.()
      if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
      ctx.enemyBullets.splice(i, 1)
    }
  }

  // Wave dispatch
  if (!ctx.waveIsClearing && ctx.waveQueue.length > 0) {
    ctx.waveDispatchTimer += dt
    const baseDispatchInterval = Math.max(60, 180 - game.currentStage * 8)
    const dispatchInterval = Math.max(38, baseDispatchInterval / cachedThreatProfile.spawnMult)
    const enemyCap = getEnemyCountCap(game.currentStage)
    if (ctx.waveDispatchTimer >= dispatchInterval && ctx.enemies.length < enemyCap) {
      ctx.waveDispatchTimer = 0
      const beforeCount = ctx.enemies.length
      const spawner = ctx.waveQueue.shift()!
      spawner()
      if (ctx.enemies.length > beforeCount) {
        let packId: number | undefined
        for (let ni = beforeCount; ni < ctx.enemies.length; ni++) {
          const ne = ctx.enemies[ni]!
          if (ne.squadId !== undefined) continue
          if (packId === undefined) packId = ctx.nextSquadId++
          ne.squadId = packId
        }
      }
      if (ctx.waveQueue.length === 0) ctx.waveIsClearing = true
    } else if (ctx.enemies.length >= enemyCap) {
      // Keep queue pending while too many enemies are still alive.
      ctx.waveDispatchTimer = Math.min(ctx.waveDispatchTimer, dispatchInterval * 0.85)
    }
  }

  // Stage clear check
  if (ctx.waveIsClearing && ctx.enemies.length === 0) {
    if (ctx.stageClearTimer === 0) {
      game.stageComplete = true
      ctx.stageClearTimer = 180
      if (!ctx.stageAnnouncePending) {
        ctx.stageAnnouncePending = true
        showStageClearBanner(ctx)
      }
    }
  }
  if (ctx.stageClearTimer > 0) {
    ctx.stageClearTimer -= dt
    if (ctx.stageClearTimer <= 0) {
      ctx.stageClearTimer = 0
      ctx.stageAnnouncePending = false
      game.currentStage++
      game.onStageAdvanced()
      audioManager.notifyStageStart()
      launchWave(ctx, game)
    }
  }

  // Bullet damage
  const bulletDmg = Math.round(
    game.upgrades.damage * Math.pow(0.8, effectiveBulletCount - 1)
    * (1 + game.cardStats.arsenalDamagePct / 100)
    * (1 + game.cardStats.damageBonusPct / 100)
  )

  // Advance flock anchors
  const flockSpeed = 1.4 + game.currentStage * 0.05
  for (const fs of ctx.flockStates.values()) {
    const view = getCurrentViewBounds(46, 30)
    const maxPatrolY = Math.min(view.maxY - 90, view.minY + (view.maxY - view.minY) * 0.78)
    fs.timer -= dt
    const dx = fs.tx - fs.x
    const dy = fs.ty - fs.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < 18 || fs.timer <= 0) {
      fs.tx = view.minX + Math.random() * Math.max(1, (view.maxX - view.minX))
      fs.ty = view.minY + Math.random() * Math.max(1, (maxPatrolY - view.minY))
      fs.timer = 140 + Math.random() * 100
    }
    const nx = dx / (d || 1)
    const ny = dy / (d || 1)
    fs.x += nx * flockSpeed * dt
    fs.y += ny * flockSpeed * dt
    fs.x = Math.max(view.minX, Math.min(view.maxX, fs.x))
    fs.y = Math.max(view.minY, Math.min(maxPatrolY, fs.y))
  }

  // Update enemies (entity modules handle their own AI)
  // Pioneer, Kamikaze, Sniper, BossStarDestroyer, BossInvader are updated inline here
  // since they reach into ctx directly for PixiJS ops and shared state.

  // -- Boss zoom: smooth scale-out when Tinh V├ón boss is alive ------------------
  const tinhVanAlive = ctx.enemies.some(e => e.kind === 'boss_tinhvan' && e.bossEntered)
  const sunBossAlive = ctx.enemies.some(e => e.kind === 'boss_cnox_sun' && e.bossEntered)
  ctx.bossZoomTarget = sunBossAlive ? 0.68 : (tinhVanAlive ? 0.75 : 1.0)
  if (Math.abs(ctx.bossZoom - ctx.bossZoomTarget) > 0.001) {
    const zSpeed = 0.006 * dt  // ch?m hon ├»┬┐┬╜ zoom mu?t hon
    ctx.bossZoom += Math.sign(ctx.bossZoomTarget - ctx.bossZoom) * Math.min(zSpeed, Math.abs(ctx.bossZoomTarget - ctx.bossZoom))
  }
  const bz = ctx.bossZoom
  ctx.gameLayer.scale.set(bz)
  ctx.gameLayer.position.set(GAME_W * (1 - bz) / 2, GAME_H * (1 - bz) / 2)

  // Zoom change indicator
  if (zoomIndicatorText) {
    if (Math.abs(bz - zoomIndicatorLastZoom) > 0.002) {
      zoomIndicatorLastZoom = bz
      zoomIndicatorText.text = `T?M NH├»┬┐┬╜N: ${Math.round(bz * 100)}%`
      zoomIndicatorText.alpha = 1
      zoomIndicatorTimer = 150
    } else if (zoomIndicatorTimer > 0) {
      zoomIndicatorTimer -= dt
      if (zoomIndicatorTimer <= 0) zoomIndicatorText.alpha = Math.max(0, zoomIndicatorText.alpha - 0.03 * dt)
    } else {
      zoomIndicatorText.alpha = Math.max(0, zoomIndicatorText.alpha - 0.03 * dt)
    }
  }

  // -- Th? H? swarm reflect (global) ------------------------------------------
  const thuHoAlive = ctx.enemies.filter(e => e.kind === 'thu_ho').length
  if (thuHoAlive >= 4) {
    ctx.thuHoReflectTimer -= dt
    if (!ctx.thuHoReflecting && ctx.thuHoReflectTimer <= 0) {
      ctx.thuHoReflecting = true
      ctx.thuHoReflectGlow = 30             // 0.5 s at 60 fps
      ctx.thuHoReflectTimer = 300 + Math.random() * 120  // 5├»┬┐┬╜7 s
      for (const _e of ctx.enemies) {
        if (_e.kind === 'thu_ho') drawThuHo(_e.body, 13, true)
      }
    }
    if (ctx.thuHoReflecting) {
      ctx.thuHoReflectGlow -= dt
      if (ctx.thuHoReflectGlow <= 0) {
        ctx.thuHoReflecting = false
        for (const _e of ctx.enemies) {
          if (_e.kind === 'thu_ho') drawThuHo(_e.body, 13, false)
        }
      }
    }
  } else {
    ctx.thuHoReflecting = false
  }

  const shieldPack = ctx.enemies.filter(e => e.kind === 'cnox_shield')
  const shieldSlotTargets = new Map<Enemy, { x: number, y: number }>()
  if (shieldPack.length > 0) {
    const view = getCurrentViewBounds(24, 24)
    const laneYs = [
      view.minY + (view.maxY - view.minY) * 0.30,
      view.minY + (view.maxY - view.minY) * 0.46,
      view.minY + (view.maxY - view.minY) * 0.62,
    ]
    const rowCenters: number[] = []
    const rowThreshold = 24
    const byY = [...shieldPack].sort((a, b) => (a.formTargetY ?? a.container.y) - (b.formTargetY ?? b.container.y))
    for (const s of byY) {
      const y = s.formTargetY ?? s.container.y
      const existing = rowCenters.find(rc => Math.abs(rc - y) <= rowThreshold)
      if (existing === undefined) rowCenters.push(y)
    }
    const rows = rowCenters.map(y => {
      let lane = laneYs[0]!
      let best = Number.POSITIVE_INFINITY
      for (const ly of laneYs) {
        const d = Math.abs(ly - y)
        if (d < best) { best = d; lane = ly }
      }
      return { y: lane, members: [] as Enemy[] }
    })
    for (const s of shieldPack) {
      const y = s.formTargetY ?? s.container.y
      let best = 0
      let bestD = Number.POSITIVE_INFINITY
      for (let ri = 0; ri < rows.length; ri++) {
        const d = Math.abs(rows[ri]!.y - y)
        if (d < bestD) { bestD = d; best = ri }
      }
      rows[best]!.members.push(s)
    }

    // Hard cap: each formation row can contain at most 6 shields.
    const maxRowCount = 6
    for (const row of rows) {
      while (row.members.length > maxRowCount) {
        const moved = row.members.pop()
        if (!moved) break
        let target = rows.find(r => r !== row && r.members.length < maxRowCount)
        if (!target) {
          const laneUsage = laneYs.map(ly => ({ ly, rows: rows.filter(r => Math.abs(r.y - ly) < 1).length }))
          laneUsage.sort((a, b) => a.rows - b.rows)
          target = { y: laneUsage[0]!.ly, members: [] as Enemy[] }
          rows.push(target)
        }
        moved.formTargetY = target.y
        target.members.push(moved)
      }
    }

    // Keep rows at 4+ when possible by borrowing units from rows with surplus.
    const minRowCount = 4
    for (let loop = 0; loop < 12; loop++) {
      let changed = false
      for (const row of rows) {
        while (row.members.length < minRowCount) {
          let donor: typeof rows[number] | null = null
          for (const cand of rows) {
            if (cand === row || cand.members.length <= minRowCount) continue
            if (!donor || Math.abs(cand.y - row.y) < Math.abs(donor.y - row.y)) donor = cand
          }
          if (!donor) break
          donor.members.sort((a, b) => a.container.x - b.container.x)
          const moved = donor.members.pop()
          if (!moved) break
          moved.formTargetY = row.y
          row.members.push(moved)
          changed = true
        }
      }
      if (!changed) break
    }

    for (const row of rows) {
      row.members.sort((a, b) => a.container.x - b.container.x)
      const count = Math.max(1, row.members.length)
      const centerX = GAME_W * 0.5
      const minSpacing = 26
      const maxSpacing = count >= 4 ? 44 : Math.max(28, 44 - (4 - count) * 5)
      const usableWidth = GAME_W - 48
      const fitSpacing = count > 1 ? usableWidth / (count - 1) : maxSpacing
      const spacing = Math.max(minSpacing, Math.min(maxSpacing, fitSpacing))
      const leftBound = view.minX
      const rightBound = view.maxX
      for (let idx = 0; idx < row.members.length; idx++) {
        const m = row.members[idx]!
        const rawX = centerX - ((count - 1) * spacing) / 2 + idx * spacing
        const tx = Math.max(leftBound, Math.min(rightBound, rawX))
        const ty = Math.max(view.minY + (view.maxY - view.minY) * 0.24, Math.min(view.maxY - 72, row.y + (idx % 2 === 0 ? -3 : 3)))
        shieldSlotTargets.set(m, { x: tx, y: ty })
      }
    }
  }
  const sparkPack = ctx.enemies.filter(e => e.kind === 'cnox_spark' && !e.threatAlpha).sort((a, b) => a.container.x - b.container.x).slice(0, 4)

  for (let i = ctx.enemies.length - 1; i >= 0; i--) {
    const e = ctx.enemies[i]
    initializeEnemyThreat(ctx, game, e, cachedThreatProfile)
    updateEnemyThreat(ctx, e, dt, cachedThreatProfile)
    const enemyPrevX = e.container.x
    const enemyPrevY = e.container.y
    game.markEnemyEncountered(e.kind)
    if ((e.contactDamageCd ?? 0) > 0) e.contactDamageCd = Math.max(0, (e.contactDamageCd ?? 0) - enemyBulletDt)

    if (isBossIntro && e.kind.startsWith('boss')) {
      continue
    }
    if (!isBossIntro && ctx.bossAttackLockTimer > 0 && e.kind.startsWith('boss')) {
      continue
    }

    updateAlphaActiveAttack(e, dt)

    if (e.kind === 'pioneer') {
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
        const fs = e.squadId != null ? ctx.flockStates.get(e.squadId) : null
        if (fs) {
          const view = getCurrentViewBounds(26, 24)
          const txRaw = fs.x + (e.formOffsetX ?? 0)
          const tyRaw = fs.y + (e.formOffsetY ?? 0)
          const tx = Math.max(view.minX, Math.min(view.maxX, txRaw))
          const ty = Math.max(view.minY, Math.min(view.maxY - 90, tyRaw))
          const dx = tx - e.container.x
          const dy = ty - e.container.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const speed = 1.6 + game.currentStage * 0.06
          if (dist > 3) {
            e.container.x += (dx / dist) * speed * dt
            e.container.y += (dy / dist) * speed * dt
          }
        }
      }
      if (e.container.y > (GAME_H * (1 + 1 / ctx.bossZoom) / 2) + 60) {
        if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
        ctx.enemies.splice(i, 1)
        game.stageEnemiesKilled++
        continue
      }
    }

    else if (e.kind === 'kamikaze') {
      e.kamiTimer = (e.kamiTimer ?? 0) + dt
      if (e.kamiState === 'descend') {
        e.container.y += e.vy * dt
        if (ctx.playerShip && e.container.y > 0 &&
          Math.abs(e.container.x - ctx.playerShip.x) < 140 &&
          e.container.y < ctx.playerShip.y - 40) {
          e.kamiState = 'aim'; e.kamiTimer = 0
          e.targetX = ctx.playerShip.x; e.targetY = ctx.playerShip.y
          if (e.warnSign) e.warnSign.visible = true
          if (e.aimLine) e.aimLine.visible = true
        }
        if (e.container.y > (GAME_H * (1 + 1 / ctx.bossZoom) / 2) + 40) {
          if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
          ctx.enemies.splice(i, 1); continue
        }
      }
      else if (e.kamiState === 'aim') {
        e.container.y += e.vy * 0.2 * dt
        if (e.aimLine && ctx.playerShip) {
          const tx = ctx.playerShip.x - e.container.x
          const ty = ctx.playerShip.y - e.container.y
          e.aimLine.clear()
          e.aimLine.moveTo(0, 0).lineTo(tx, ty).stroke({ color: 0xff4400, width: 1, alpha: 0.6 })
          e.targetX = ctx.playerShip.x; e.targetY = ctx.playerShip.y
        }
        if (e.warnSign) e.warnSign.alpha = Math.sin(e.kamiTimer * 0.25) > 0 ? 1 : 0.2
        if (e.kamiTimer >= 60) {
          e.kamiState = 'charge'; e.kamiTimer = 0
          if (e.warnSign) e.warnSign.visible = false
          if (e.aimLine) e.aimLine.visible = false
          const tx = (e.targetX ?? GAME_W / 2) - e.container.x
          const ty = (e.targetY ?? GAME_H / 2) - e.container.y
          const mag = Math.sqrt(tx * tx + ty * ty) || 1
          e.vx = (tx / mag) * 11.5; e.vy = (ty / mag) * 11.5
        }
      }
      else if (e.kamiState === 'charge') {
        e.container.x += e.vx * dt
        e.container.y += e.vy * dt
        if (ctx.playerShip && dist2(e.container.x, e.container.y, ctx.playerShip.x, ctx.playerShip.y) < 22 * 22) {
          e.kamiState = 'dead'
        } else if (
          dist2(e.container.x, e.container.y, e.targetX ?? 0, e.targetY ?? 0) < 20 * 20 ||
          e.kamiTimer >= 90 || e.container.y > (GAME_H * (1 + 1 / ctx.bossZoom) / 2) + 60 || e.container.y < (GAME_H * (1 - 1 / ctx.bossZoom) / 2) - 60
        ) {
          e.kamiState = 'prexplode'; e.kamiTimer = 0; e.vx = 0; e.vy = 0
        }
      }
      else if (e.kamiState === 'prexplode') {
        const lowAlpha = e.threatAlpha || (e.threatTier ?? 0) > 0 ? 0.72 : 0.12
        e.body.alpha = Math.floor(e.kamiTimer / 4) % 2 === 0 ? 1 : lowAlpha
        if (e.kamiTimer >= 30) { e.body.alpha = 1; e.kamiState = 'dead' }
      }
      if (e.kamiState === 'dead') {
        spawnExplosion(ctx, e.container.x, e.container.y, 18, 0xff4400, 0xffcc00)
        if (e.threatAlpha) {
          const burstCount = 12
          const baseAngle = Math.random() * Math.PI * 2
          const burstDamage = Math.max(8, Math.round((9 + game.currentStage * 1.6) * getEnemyDamageScale(e, cachedThreatProfile)))
          for (let bi = 0; bi < burstCount; bi++) {
            const bg = new Graphics()
            drawEnemyBullet(bg)
            bg.tint = 0xff7b2a
            bg.x = e.container.x
            bg.y = e.container.y
            ctx.gameLayer.addChild(bg)
            const angle = baseAngle + (bi / burstCount) * Math.PI * 2
            ctx.enemyBullets.push({
              gfx: bg,
              vx: Math.cos(angle) * 3.7,
              vy: Math.sin(angle) * 3.7,
              damage: burstDamage,
            })
          }
        }
        if (ctx.playerShip) {
          const d = Math.sqrt(dist2(e.container.x, e.container.y, ctx.playerShip.x, ctx.playerShip.y))
          if (d < 70) {
            const aoe = Math.max(1, Math.round(35 * (1 - d / 70) * getEnemyDamageScale(e, cachedThreatProfile)))
            if (!isTracerSkillInvulnerable()) {
              game.takeDamage(aoe)
              screenFlash(ctx, 0xff6600, 0.5, 220)
              spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, aoe)
            }
          }
        }
        game.addScore(15 + game.currentStage * 6)
        game.stageEnemiesKilled++
        if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
        ctx.enemies.splice(i, 1); continue
      }
    }

    else if (e.kind === 'sniper') {
      if (e.pioneerPhase === 'enter') {
        const dx = (e.enterTargetX ?? e.container.x) - e.container.x
        const dy = (e.enterTargetY ?? e.container.y) - e.container.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const speed = 2.8
        if (dist < speed * dt * 2) {
          e.container.x = e.enterTargetX ?? e.container.x
          e.container.y = e.enterTargetY ?? e.container.y
          e.pioneerPhase = 'patrol'
        } else {
          e.container.x += (dx / dist) * speed * dt
          e.container.y += (dy / dist) * speed * dt
        }
      } else {
        const t = Date.now() / 1000
        e.container.x += Math.sin(t * 0.75 + (e.formTargetX ?? 0) * 0.011) * 0.65 * dt
        e.container.x = Math.max(30, Math.min(GAME_W - 30, e.container.x))
      }
      e.shootTimer = (e.shootTimer ?? 300) - dt
      if (e.shootTimer <= 0) {
        e.shootTimer = 290 + Math.random() * 60
        if (ctx.playerShip) {
          const tx = ctx.playerShip.x - e.container.x
          const ty = ctx.playerShip.y - e.container.y
          const baseAngle = Math.atan2(ty, tx)
          for (const spread of [-0.07, 0.07]) {
            const bg = new Graphics()
            drawEnemyBullet(bg)
            bg.x = e.container.x; bg.y = e.container.y + 10
            ctx.gameLayer.addChild(bg)
            const a = baseAngle + spread
            ctx.enemyBullets.push({ gfx: bg, vx: Math.cos(a) * 3.5, vy: Math.sin(a) * 3.5 })
          }
        }
      }
      if (e.dodgeTarget !== undefined) {
        const ddx = e.dodgeTarget - e.container.x
        const step = Math.min(Math.abs(ddx), 9 * dt) * Math.sign(ddx)
        e.container.x += step
        if (Math.abs(ddx) < 1.5) { e.container.x = e.dodgeTarget; e.dodgeTarget = undefined }
      }
      e.dodgeCooldown = Math.max(0, (e.dodgeCooldown ?? 0) - dt)
      if (e.dodgeCooldown <= 0 && e.dodgeTarget === undefined) {
        for (const b of ctx.bullets) {
          if (dist2(b.gfx.x, b.gfx.y, e.container.x, e.container.y) < 55 * 55) {
            if (Math.random() < 0.10) {
              const dir = Math.random() < 0.5 ? -1 : 1
              e.dodgeTarget = Math.max(30, Math.min(GAME_W - 30, e.container.x + dir * 50))
              e.dodgeCooldown = 100
            }
            break
          }
        }
      }
      if (e.container.y > (GAME_H * (1 + 1 / ctx.bossZoom) / 2) + 40) {
        if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
        ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
      }
    }

    else if (e.kind === 'dai_lien') {
      // Enter phase
      if (e.pioneerPhase === 'enter') {
        const dx = (e.enterTargetX ?? e.container.x) - e.container.x
        const dy = (e.enterTargetY ?? e.container.y) - e.container.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const speed = 3.0
        if (dist < speed * dt * 2) {
          e.container.x = e.enterTargetX ?? e.container.x
          e.container.y = e.enterTargetY ?? e.container.y
          e.pioneerPhase = 'patrol'
        } else {
          e.container.x += (dx / dist) * speed * dt
          e.container.y += (dy / dist) * speed * dt
        }
      } else {
        const t = Date.now() / 1000 + (e.formTargetX ?? 0) * 0.009
        e.container.x += Math.sin(t * 1.8) * 0.55 * dt
        e.container.x = Math.max(25, Math.min(GAME_W - 25, e.container.x))
      }
      // Fast burst fire (-30% fire rate)
      e.shootTimer = (e.shootTimer ?? 25) - dt
      if (e.shootTimer <= 0 && ctx.playerShip) {
      e.shootTimer = (24 + Math.random() * 16 + Math.max(0, 12 - game.currentStage)) * 2.95
        if (ctx.enemyBullets.length >= getEnemyBulletCap(game.currentStage) * 0.92) {
          continue
        }
        const bg = new Graphics()
        drawDaiLienBullet(bg)
        bg.x = e.container.x
        bg.y = e.container.y + 8
        ctx.gameLayer.addChild(bg)
        const tx = ctx.playerShip.x - e.container.x
        const ty = ctx.playerShip.y - e.container.y
        const mag = Math.sqrt(tx * tx + ty * ty) || 1
        const spd = 3.85 + game.currentStage * 0.075
        ctx.enemyBullets.push({ gfx: bg, vx: (tx / mag) * spd, vy: (ty / mag) * spd })
      }
      if (e.container.y > GAME_H + 50) {
        if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
        ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
      }
    }

    else if (e.kind === 'thu_ho') {
      // Enter phase: slide in from side
      if (e.pioneerPhase === 'enter') {
        const dx = (e.enterTargetX ?? e.container.x) - e.container.x
        const dy = (e.enterTargetY ?? e.container.y) - e.container.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const speed = 3.2
        if (dist < speed * dt * 2) {
          e.container.x = e.enterTargetX ?? e.container.x
          e.container.y = e.enterTargetY ?? e.container.y
          e.pioneerPhase = 'patrol'
        } else {
          e.container.x += (dx / dist) * speed * dt
          e.container.y += (dy / dist) * speed * dt
        }
      } else {
        // Gentle vertical drift once in place
        const t = Date.now() / 1000 + (e.formTargetX ?? 0) * 0.012
        e.container.y += Math.sin(t * 0.6) * 0.3 * dt
        e.container.y = Math.max(20, Math.min(GAME_H - 80, e.container.y))
      }
      // Swarm reflect countdown (global reflect handled at top of enemy loop)
      if (e.container.y > GAME_H + 50) {
        if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
        ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
      }
    }

    else if (e.kind === 'thuat_si') {
      if (e.isDyingMeteor) {
        // Meteorite phase: fly toward player
        e.container.x += (e.meteorVx ?? 0) * dt
        e.container.y += (e.meteorVy ?? 0) * dt
        e.body.alpha = 0.85 + Math.sin(Date.now() * 0.025) * 0.15
        if (ctx.playerShip && dist2(e.container.x, e.container.y, ctx.playerShip.x, ctx.playerShip.y) < 20 * 20) {
          // Hit player
          if (isTracerSkillInvulnerable()) {
            // Thi├¬n H├á Truy is invulnerable while skill is active.
          } else if (game.absorbShieldHit()) {
            screenFlash(ctx, 0x88ff88, 0.25, 180)
          } else {
            const meteorDmg = Math.max(1, Math.round(20 * getEnemyDamageScale(e, cachedThreatProfile)))
            game.takeDamage(meteorDmg); screenFlash(ctx)
            spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, meteorDmg)
          }
          spawnExplosion(ctx, e.container.x, e.container.y, 14, 0x886644, 0xff6600)
          if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
          ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
        }
        if (e.container.y > (GAME_H * (1 + 1 / ctx.bossZoom) / 2) + 60 || e.container.x < (GAME_W * (1 - 1 / ctx.bossZoom) / 2) - 60 || e.container.x > (GAME_W * (1 + 1 / ctx.bossZoom) / 2) + 60) {
          if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
          ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
        }
        continue // skip further updates (bullet collision etc.) for dying meteor
      }
      // Enter phase
      if (e.pioneerPhase === 'enter') {
        const dx = (e.enterTargetX ?? e.container.x) - e.container.x
        const dy = (e.enterTargetY ?? e.container.y) - e.container.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const speed = 2.8
        if (dist < speed * dt * 2) {
          e.container.x = e.enterTargetX ?? e.container.x
          e.container.y = e.enterTargetY ?? e.container.y
          e.pioneerPhase = 'patrol'
        } else {
          e.container.x += (dx / dist) * speed * dt
          e.container.y += (dy / dist) * speed * dt
        }
      } else {
        // Patrol: follow & hide behind a shield enemy (away from player), keep distance
        const shieldTarget = e.healTarget && e.healTarget !== e && !e.healTarget.isDyingMeteor
          && ctx.enemies.includes(e.healTarget) ? e.healTarget : null
        if (shieldTarget && ctx.playerShip) {
          const dx = shieldTarget.container.x - ctx.playerShip.x
          const dy = shieldTarget.container.y - ctx.playerShip.y
          const mag = Math.sqrt(dx * dx + dy * dy) || 1
          const hideX = shieldTarget.container.x + (dx / mag) * 60
          const hideY = shieldTarget.container.y + (dy / mag) * 60
          const ddx = hideX - e.container.x
          const ddy = hideY - e.container.y
          const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1
          const step = Math.min(2.8 * dt, d)
          e.container.x += (ddx / d) * step
          e.container.y += (ddy / d) * step
          e.container.x = Math.max(15, Math.min(GAME_W - 15, e.container.x))
          e.container.y = Math.max(15, Math.min(GAME_H - 60, e.container.y))
        } else {
          // No shield available ├»┬┐┬╜ gentle oscillation while looking for one
          const t = Date.now() / 1000 + (e.formTargetX ?? 0) * 0.008
          e.container.x += Math.sin(t * 0.9) * 0.4 * dt
          e.container.x = Math.max(20, Math.min(GAME_W - 20, e.container.x))
        }
      }
      // Healing beam: alpha heals 3 targets at once, normal heals 1 target.
      if (e.pioneerPhase === 'patrol' && ctx.enemies.length > 1) {
        const canMultiHeal = !!e.threatAlpha
        const maxTargets = canMultiHeal ? 3 : 1
        const searchRadius = canMultiHeal ? 270 : 230
        const searchR2 = searchRadius * searchRadius

        const currentTarget = e.healTarget ?? null
        const isValidTarget = currentTarget && currentTarget !== e
          && currentTarget.kind !== 'thuat_si' && !currentTarget.isDyingMeteor
          && currentTarget.hp < currentTarget.maxHp
          && ctx.enemies.includes(currentTarget)
          && dist2(e.container.x, e.container.y, currentTarget.container.x, currentTarget.container.y) < searchR2

        if (!isValidTarget) {
          let bestTarget: Enemy | null = null
          let bestRatio = 1.0
          for (let k = 0; k < ctx.enemies.length; k++) {
            const t2 = ctx.enemies[k]!
            if (t2 === e || t2.kind === 'thuat_si' || t2.isDyingMeteor) continue
            if (t2.hp >= t2.maxHp) continue
            const d2 = dist2(e.container.x, e.container.y, t2.container.x, t2.container.y)
            if (d2 > searchR2) continue
            const ratio = t2.hp / t2.maxHp
            if (ratio < bestRatio) {
              bestRatio = ratio
              bestTarget = t2
            }
          }
          e.healTarget = bestTarget
        }

        const healTargets: Enemy[] = []
        if (canMultiHeal) {
          const candidates = ctx.enemies
            .filter(target => (
              target !== e
              && target.kind !== 'thuat_si'
              && !target.isDyingMeteor
              && target.hp < target.maxHp
              && dist2(e.container.x, e.container.y, target.container.x, target.container.y) <= searchR2
            ))
            .sort((a, b) => {
              const ratioDiff = (a.hp / a.maxHp) - (b.hp / b.maxHp)
              if (Math.abs(ratioDiff) > 0.001) return ratioDiff
              return dist2(e.container.x, e.container.y, a.container.x, a.container.y)
                - dist2(e.container.x, e.container.y, b.container.x, b.container.y)
            })

          for (let idx = 0; idx < Math.min(maxTargets, candidates.length); idx++) {
            healTargets.push(candidates[idx]!)
          }
          e.healTarget = healTargets[0] ?? null
        } else if (e.healTarget) {
          healTargets.push(e.healTarget)
        }

        if (healTargets.length > 0 && e.healBeamGfx) {
          e.healBeamGfx.clear()
          const seedBase = Date.now() * 0.05
          for (let idx = 0; idx < healTargets.length; idx++) {
            const healTarget = healTargets[idx]!
            const toX = healTarget.container.x - e.container.x
            const toY = healTarget.container.y - e.container.y
            drawHealBeam(e.healBeamGfx, toX, toY, seedBase + idx * 1.7)

            const isBoss = healTarget.kind === 'boss_stardestroyer'
              || healTarget.kind === 'boss_invader'
              || healTarget.kind === 'boss_tinhvan'
              || healTarget.kind === 'boss_trumso'
            const healRate = isBoss ? 0.02 / 60 : 0.10 / 60
            healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healTarget.maxHp * healRate * dt)
            redrawHpBar(healTarget.hpBarBg, healTarget.hpBar, healTarget.hp / healTarget.maxHp, healTarget.barW)
          }
        } else if (e.healBeamGfx) {
          e.healBeamGfx.clear()
        }
      }
      if (e.container.y > GAME_H + 50) {
        if (e.healBeamGfx) e.healBeamGfx.clear()
        if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
        ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
      }
    }

    else if (e.kind === 'cnox_greedy') {
      if (e.pioneerPhase === 'enter') {
        const dx = (e.enterTargetX ?? e.container.x) - e.container.x
        const dy = (e.enterTargetY ?? e.container.y) - e.container.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const speed = 1.8
        if (dist < speed * dt * 2) {
          e.container.x = e.enterTargetX ?? e.container.x
          e.container.y = e.enterTargetY ?? e.container.y
          e.pioneerPhase = 'patrol'
        } else {
          e.container.x += (dx / dist) * speed * dt
          e.container.y += (dy / dist) * speed * dt
        }
      } else {
        const stolenNow = Math.max(0, Math.min(300, e.cnoxStolenExp ?? 0))
        const canStealMore = stolenNow < 300
        let targetOrb = null as typeof ctx.expOrbs[number] | null
        let bestOrbD2 = 330 * 330
        const stealPower = Math.max(1, e.cnoxPowerMult ?? 1)
        const orbPullSpeed = 3.8 + (stealPower - 1) * 2.4
        if (canStealMore) {
          for (const orb of ctx.expOrbs) {
            const d2 = dist2(orb.x, orb.y, e.container.x, e.container.y)
            if (d2 < bestOrbD2) {
              bestOrbD2 = d2
              targetOrb = orb
            }
          }
        }
        if (targetOrb) {
          const odx = e.container.x - targetOrb.x
          const ody = e.container.y - targetOrb.y
          const od = Math.sqrt(odx * odx + ody * ody) || 1
          targetOrb.x += (odx / od) * orbPullSpeed * dt
          targetOrb.y += (ody / od) * orbPullSpeed * dt
          targetOrb.gfx.x = targetOrb.x
          targetOrb.gfx.y = targetOrb.y
          if (od < 20) {
            const capLeft = Math.max(0, 300 - (e.cnoxStolenExp ?? 0))
            if (capLeft > 0) {
              const gained = Math.min(capLeft, Math.max(0, targetOrb.amount))
              if (gained > 0) {
                e.cnoxStolenExp = Math.min(300, (e.cnoxStolenExp ?? 0) + gained)
                spawnExpCollectEffect(ctx, targetOrb.x, targetOrb.y, e.container.x, e.container.y, Math.max(1, gained), getExpTierColor(targetOrb.tier))
                targetOrb.amount = Math.max(0, targetOrb.amount - gained)
                if (targetOrb.amount <= 0) {
                  if (!targetOrb.gfx.destroyed) ctx.gameLayer.removeChild(targetOrb.gfx)
                  const orbIdx = ctx.expOrbs.indexOf(targetOrb)
                  if (orbIdx >= 0) ctx.expOrbs.splice(orbIdx, 1)
                }
                updateCnoxGreedyEvolution(e)
              }
            }
          }
        } else if (ctx.playerShip) {
          const shields = ctx.enemies.filter(other => other.kind === 'cnox_shield')
          const nearestShield = shields.sort((a, b) => dist2(a.container.x, a.container.y, e.container.x, e.container.y) - dist2(b.container.x, b.container.y, e.container.x, e.container.y))[0] ?? null
          let tx = e.formTargetX ?? e.container.x
          let ty = e.formTargetY ?? e.container.y
          if (nearestShield) {
            const hx = nearestShield.container.x - ctx.playerShip.x
            const hy = nearestShield.container.y - ctx.playerShip.y
            const hm = Math.sqrt(hx * hx + hy * hy) || 1
            tx = nearestShield.container.x + (hx / hm) * 52
            ty = nearestShield.container.y + (hy / hm) * 52
          }
          const mdx = tx - e.container.x
          const mdy = ty - e.container.y
          const md = Math.sqrt(mdx * mdx + mdy * mdy) || 1
          e.container.x += (mdx / md) * 1.35 * dt
          e.container.y += (mdy / md) * 1.35 * dt
        }
        e.container.x = Math.max(20, Math.min(GAME_W - 20, e.container.x))
        e.container.y = Math.max(20, Math.min(GAME_H - 90, e.container.y))
      }
      e.shootTimer = (e.shootTimer ?? 220) - dt
      if ((e.shootTimer ?? 0) <= 0 && ctx.playerShip) {
        const greedPower = Math.max(1, e.cnoxPowerMult ?? 1)
        const greedStep = greedPower - 1
        const fireScale = 1 + greedStep * 0.45 + greedStep * greedStep * 0.12
        e.shootTimer = Math.max(46, (180 + Math.random() * 90) / fireScale)
        const bg = new Graphics()
        drawEnemyBullet(bg)
        bg.tint = 0xff5533
        bg.x = e.container.x
        bg.y = e.container.y + 10
        ctx.gameLayer.addChild(bg)
        const tx = ctx.playerShip.x - e.container.x
        const ty = ctx.playerShip.y - e.container.y
        const mag = Math.sqrt(tx * tx + ty * ty) || 1
        const bulletSpeed = Math.min(8.6, 2.6 * (1 + greedStep * 0.55 + greedStep * greedStep * 0.10))
        const greedDamage = Math.round((12 + game.currentStage * 2) * (e.cnoxPowerMult ?? 1))
        ctx.enemyBullets.push({ gfx: bg, vx: (tx / mag) * bulletSpeed, vy: (ty / mag) * bulletSpeed, damage: greedDamage })
      }
      if (e.container.y > GAME_H + 50) {
        if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
        ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
      }
    }

    else if (e.kind === 'cnox_shield') {
      if (e.pioneerPhase === 'enter') {
        const dx = (e.enterTargetX ?? e.container.x) - e.container.x
        const dy = (e.enterTargetY ?? e.container.y) - e.container.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const speed = 2.4
        if (dist < speed * dt * 2) {
          e.container.x = e.enterTargetX ?? e.container.x
          e.container.y = e.enterTargetY ?? e.container.y
          e.pioneerPhase = 'patrol'
        } else {
          e.container.x += (dx / dist) * speed * dt
          e.container.y += (dy / dist) * speed * dt
        }
      } else {
        const slot = shieldSlotTargets.get(e)
        const targetX = slot?.x ?? e.container.x
        const targetY = slot?.y ?? e.container.y
        const dx = targetX - e.container.x
        const dy = targetY - e.container.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const speed = 1.8
        const step = Math.min(speed * dt, dist)
        e.container.x += (dx / dist) * step
        e.container.y += (dy / dist) * step
        e.formTargetX = targetX
        e.formTargetY = targetY
      }

      const desiredShieldCount = e.threatAlpha ? 3 : 2
      ensureCnoxShieldOrbitCount(e, desiredShieldCount)
      if (e.cnoxAlphaBarrierGfx) e.cnoxAlphaBarrierGfx.clear()
      e.cnoxAlphaBarrierHp = 0
      e.cnoxAlphaBarrierMaxHp = 0

      const shieldSpinSpeedBase = starFasterSkillActive ? 0.05 * enemyTimeScale : 0.05
      const shieldSpinSpeed = e.threatAlpha ? shieldSpinSpeedBase * 1.22 : shieldSpinSpeedBase
      e.cnoxShieldAngle = (e.cnoxShieldAngle ?? 0) + shieldSpinSpeed * dt
      if (e.cnoxShields?.length) {
        const radius = e.threatAlpha ? 28 : 22
        const shieldCount = Math.max(1, e.cnoxShields.length)
        const step = (Math.PI * 2) / shieldCount
        for (let si = 0; si < e.cnoxShields.length; si++) {
          const angle = (e.cnoxShieldAngle ?? 0) + (si * step)
          e.cnoxShields[si].visible = true
          e.cnoxShields[si].x = Math.cos(angle) * radius
          e.cnoxShields[si].y = Math.sin(angle) * radius
          e.cnoxShields[si].rotation = angle
          e.cnoxShields[si].scale.set(e.threatAlpha ? 1.08 : 1)
        }
      }
      if (e.container.y > (GAME_H * (1 + 1 / ctx.bossZoom) / 2) + 60) {
        if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
        ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
      }
    }

    else if (e.kind === 'cnox_spark') {
      if (e.pioneerPhase === 'enter') {
        const dx = (e.enterTargetX ?? e.container.x) - e.container.x
        const dy = (e.enterTargetY ?? e.container.y) - e.container.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const speed = 2.2
        if (dist < speed * dt * 2) {
          e.container.x = e.enterTargetX ?? e.container.x
          e.container.y = e.enterTargetY ?? e.container.y
          e.pioneerPhase = 'patrol'
        } else {
          e.container.x += (dx / dist) * speed * dt
          e.container.y += (dy / dist) * speed * dt
        }
      } else {
        const t = Date.now() / 1000 + (e.formTargetX ?? 0) * 0.01
        e.container.x += Math.sin(t * 1.25) * 0.42 * dt
        e.container.y += Math.cos(t * 0.95) * 0.22 * dt
      }

      if (e.threatAlpha) {
        e.cnoxLaserTimer = (e.cnoxLaserTimer ?? 140) - dt
        if ((e.cnoxLaserState === 'idle' || e.cnoxLaserState === undefined) && (e.cnoxLaserTimer ?? 0) <= 0 && ctx.playerShip) {
          const base = Math.atan2(ctx.playerShip.y - e.container.y, ctx.playerShip.x - e.container.x)
          e.cnoxAlphaLaserAngles = pickCnoxSparkAlphaAngles(base)
          e.cnoxLaserState = 'alpha_warning'
          e.cnoxLaserTimer = 56
        }

        if (e.cnoxLaserState === 'alpha_warning' && e.cnoxWarnGfx) {
          e.cnoxLaserTimer = (e.cnoxLaserTimer ?? 56) - dt
          e.cnoxWarnGfx.clear()
          const al = 0.24 + Math.abs(Math.sin((e.cnoxLaserTimer ?? 0) * 0.15)) * 0.35
          for (const angle of e.cnoxAlphaLaserAngles ?? []) {
            drawCnoxRay(e.cnoxWarnGfx, 0, 0, angle, 2, 0xff91d9, al, false)
          }
          e.cnoxWarnGfx.circle(0, 0, 14).stroke({ color: 0xffb6ff, width: 2, alpha: 0.52 + al * 0.2 })
          if ((e.cnoxLaserTimer ?? 0) <= 0) {
            e.cnoxWarnGfx.clear()
            e.cnoxLaserState = 'alpha_firing'
            e.cnoxLaserTimer = 22
          }
        } else if (e.cnoxLaserState === 'alpha_firing' && e.cnoxLaserGfx) {
          e.cnoxLaserTimer = (e.cnoxLaserTimer ?? 22) - dt
          const al = Math.max(0, (e.cnoxLaserTimer ?? 0) / 22)
          e.cnoxLaserGfx.clear()
          for (const angle of e.cnoxAlphaLaserAngles ?? []) {
            drawCnoxRay(e.cnoxLaserGfx, 0, 0, angle, 9, 0xff6cff, al * 0.75, false)
            drawCnoxRay(e.cnoxLaserGfx, 0, 0, angle, 3, 0xffffff, al * 0.95, false)
            if (ctx.playerShip) {
              const hit = pointDistanceToRay(ctx.playerShip.x, ctx.playerShip.y, e.container.x, e.container.y, angle)
              if (hit.perp < 14 && hit.dot > 0) {
                const dmg = 12 + game.currentStage * 2
                applyLaserHitToPlayer(dmg, { flashColor: 0xff88ff, flashAlpha: 0.24, flashMs: 120, shieldOuterColor: 0xff88ff, shieldInnerColor: 0xffffff })
              }
            }
          }
          if ((e.cnoxLaserTimer ?? 0) <= 0) {
            e.cnoxLaserGfx.clear()
            e.cnoxLaserState = 'idle'
            e.cnoxLaserTimer = 160 + Math.random() * 90
          }
        } else {
          e.cnoxWarnGfx?.clear()
          e.cnoxLaserGfx?.clear()
        }
      } else {
        if (e.cnoxLaserState === 'alpha_warning' || e.cnoxLaserState === 'alpha_firing') {
          e.cnoxWarnGfx?.clear()
          e.cnoxLaserGfx?.clear()
          e.cnoxLaserState = 'idle'
          e.cnoxLaserTimer = 150
        }

        const sparkIdx = sparkPack.indexOf(e)
        const nextSpark = sparkIdx >= 0 ? sparkPack[sparkIdx + 1] : undefined
        const isLastSpark = sparkIdx === sparkPack.length - 1
        e.cnoxLaserTimer = (e.cnoxLaserTimer ?? 150) - dt

        if ((e.cnoxLaserState === 'idle' || e.cnoxLaserState === undefined) && (e.cnoxLaserTimer ?? 0) <= 0 && ctx.playerShip) {
          if (sparkPack.length >= 2 && sparkIdx === 0 && Math.random() < 0.38) {
            const sweepSpan = 0.22
            const playerAngle = Math.atan2(ctx.playerShip.y - sparkPack[sparkPack.length - 1].container.y, ctx.playerShip.x - sparkPack[sparkPack.length - 1].container.x)
            sparkPack.forEach((spark, idx) => {
              spark.cnoxLinkOrder = idx
              spark.cnoxLaserState = 'link_warning'
              spark.cnoxLaserTimer = 120
              spark.cnoxLaserAngle = idx === sparkPack.length - 1 ? playerAngle - sweepSpan * 0.5 : undefined
            })
          } else {
            e.cnoxLaserState = 'warning'
            e.cnoxLaserTimer = 120
            e.cnoxLaserAngle = Math.atan2(ctx.playerShip.y - e.container.y, ctx.playerShip.x - e.container.x)
          }
        }

        if (e.cnoxLaserState === 'warning' && e.cnoxWarnGfx) {
          e.cnoxLaserTimer = (e.cnoxLaserTimer ?? 120) - dt
          const angle = e.cnoxLaserAngle ?? 0
          const al = 0.22 + Math.abs(Math.sin((e.cnoxLaserTimer ?? 0) * 0.15)) * 0.38
          drawCnoxRay(e.cnoxWarnGfx, 0, 0, angle, 2, 0xff66aa, al)
          e.cnoxWarnGfx.circle(0, 0, 14).stroke({ color: 0xff99ff, width: 2, alpha: 0.45 + al * 0.25 })
          if (e.cnoxLaserTimer <= 0) {
            e.cnoxWarnGfx.clear()
            e.cnoxLaserState = 'firing'
            e.cnoxLaserTimer = 18
          }
        } else if (e.cnoxLaserState === 'firing' && e.cnoxLaserGfx) {
          e.cnoxLaserTimer = (e.cnoxLaserTimer ?? 18) - dt
          const angle = e.cnoxLaserAngle ?? 0
          const al = Math.max(0, (e.cnoxLaserTimer ?? 0) / 18)
          e.cnoxLaserGfx.clear()
          drawCnoxRay(e.cnoxLaserGfx, 0, 0, angle, 10, 0xff88ff, al * 0.85, false)
          drawCnoxRay(e.cnoxLaserGfx, 0, 0, angle, 3, 0xffffff, al * 0.95, false)
          if (ctx.playerShip) {
            const hit = pointDistanceToRay(ctx.playerShip.x, ctx.playerShip.y, e.container.x, e.container.y, angle)
            if (hit.perp < 18 && hit.dot > 0) {
              const dmg = 15 + game.currentStage * 2
              applyLaserHitToPlayer(dmg, { flashColor: 0xff88ff, flashAlpha: 0.3, flashMs: 160, shieldOuterColor: 0xff88ff, shieldInnerColor: 0xffffff })
            }
          }
          if (e.cnoxLaserTimer <= 0) {
            e.cnoxLaserGfx.clear()
            e.cnoxLaserState = 'idle'
            e.cnoxLaserTimer = 150 + Math.random() * 110
          }
        } else if (e.cnoxLaserState === 'link_warning' && e.cnoxWarnGfx) {
          const sweepSpan = 0.22
          e.cnoxLaserTimer = (e.cnoxLaserTimer ?? 120) - dt
          e.cnoxWarnGfx.clear()
          if (!isLastSpark && nextSpark) {
            const al = 0.18 + Math.abs(Math.sin((e.cnoxLaserTimer ?? 0) * 0.17)) * 0.34
            const tx = nextSpark.container.x - e.container.x
            const ty = nextSpark.container.y - e.container.y
            e.cnoxWarnGfx.moveTo(0, 0).lineTo(tx, ty).stroke({ color: 0xff99ff, width: 2, alpha: al })
            e.cnoxWarnGfx.moveTo(0, 0).lineTo(tx, ty).stroke({ color: 0xffffff, width: 1, alpha: al * 0.55 })
          } else {
            const start = e.cnoxLaserAngle ?? 0
            const base = start + sweepSpan * 0.5
            drawCnoxCone(e.cnoxWarnGfx, 0, 0, base, sweepSpan * 0.5, Math.max(GAME_H * 1.2, 520), 0.52)
            drawCnoxRay(e.cnoxWarnGfx, 0, 0, start, 2, 0xffb9ff, 0.6, false)
            drawCnoxRay(e.cnoxWarnGfx, 0, 0, start + sweepSpan, 2, 0xffb9ff, 0.6, false)
          }
          if (e.cnoxLaserTimer <= 0) {
            e.cnoxWarnGfx.clear()
            e.cnoxLaserState = 'link_firing'
            e.cnoxLaserTimer = 32
          }
        } else if (e.cnoxLaserState === 'link_firing' && e.cnoxLaserGfx) {
          const sweepSpan = 0.22
          const firingDuration = 32
          e.cnoxLaserTimer = (e.cnoxLaserTimer ?? 32) - dt
          e.cnoxLaserGfx.clear()
          if (!isLastSpark && nextSpark) {
            const tx = nextSpark.container.x - e.container.x
            const ty = nextSpark.container.y - e.container.y
            e.cnoxLaserGfx.moveTo(0, 0).lineTo(tx, ty).stroke({ color: 0xff7aff, width: 6, alpha: 0.75 })
            e.cnoxLaserGfx.moveTo(0, 0).lineTo(tx, ty).stroke({ color: 0xffffff, width: 2, alpha: 0.9 })
            const pulseT = (Date.now() * 0.0011 + sparkIdx * 0.27) % 1
            e.cnoxLaserGfx.circle(tx * pulseT, ty * pulseT, 3.2).fill({ color: 0xffd5ff, alpha: 0.9 })
            if (ctx.playerShip) {
              const d = pointDistanceToSegment(ctx.playerShip.x, ctx.playerShip.y, e.container.x, e.container.y, nextSpark.container.x, nextSpark.container.y)
              if (d < 16) {
                const dmg = 8 + game.currentStage
                applyLaserHitToPlayer(dmg, { flashColor: 0xff66ff, flashAlpha: 0.2, flashMs: 100, shieldOuterColor: 0xff88ff, shieldInnerColor: 0xffffff })
              }
            }
          } else {
            const p = 1 - Math.max(0, e.cnoxLaserTimer ?? 0) / firingDuration
            const angle = (e.cnoxLaserAngle ?? 0) + sweepSpan * p
            drawCnoxRay(e.cnoxLaserGfx, 0, 0, angle, 20, 0xff66ff, 0.28, false)
            drawCnoxRay(e.cnoxLaserGfx, 0, 0, angle, 7, 0xffffff, 0.9, false)
            if (ctx.playerShip) {
              const hit = pointDistanceToRay(ctx.playerShip.x, ctx.playerShip.y, e.container.x, e.container.y, angle)
              if (hit.perp < 16 && hit.dot > 0) {
                const dmg = 10 + game.currentStage * 2
                applyLaserHitToPlayer(dmg, { flashColor: 0xff88ff, flashAlpha: 0.26, flashMs: 120, shieldOuterColor: 0xff88ff, shieldInnerColor: 0xffffff })
              }
            }
          }
          if (e.cnoxLaserTimer <= 0) {
            e.cnoxLaserGfx.clear()
            e.cnoxLaserState = 'idle'
            e.cnoxLaserTimer = 180 + Math.random() * 110
          }
        }
      }

      if (e.container.y > GAME_H + 50) {
        e.cnoxWarnGfx?.clear()
        e.cnoxLaserGfx?.clear()
        if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
        ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
      }
    }

    // ΓöÇΓöÇΓöÇ Dnox - Hoß║ú chß╗ºng ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    else if (e.kind === 'dnox_fire') {
      if (e.pioneerPhase === 'enter') {
        const dx = (e.enterTargetX ?? e.container.x) - e.container.x
        const dy = (e.enterTargetY ?? e.container.y) - e.container.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const speed = 1.6
        if (dist < speed * dt * 2) {
          e.container.x = e.enterTargetX ?? e.container.x
          e.container.y = e.enterTargetY ?? e.container.y
          e.pioneerPhase = 'patrol'
        } else {
          e.container.x += (dx / dist) * speed * dt
          e.container.y += (dy / dist) * speed * dt
        }
      } else {
        // Patrol: hold formation row and drift gently.
        const haste = e.dnoxSoilHasteMult ?? 1
        const t = Date.now() / 1000 + (e.formTargetX ?? 0) * 0.009
        e.container.x += Math.sin(t * 0.85 * haste) * 0.45 * dt * haste
        e.container.x = Math.max(22, Math.min(GAME_W - 22, e.container.x))
      }
      updateDnoxFireAttack(e, ctx, game, dt)
      // Aura pulse redraw (heat stored in cnoxLaserAngle)
      if (e.cnoxLaserState !== 'firing' && e.cnoxLaserState !== 'warning') {
        const heat = e.cnoxLaserAngle ?? 0
        drawDnoxFire(e.body, e.cnoxBaseSize ?? 13, heat)
      }
      if (e.container.y > GAME_H + 50) {
        if (e.cnoxLaserGfx) { e.cnoxLaserGfx.clear(); if (e.cnoxLaserGfx.parent) e.cnoxLaserGfx.parent.removeChild(e.cnoxLaserGfx) }
        if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
        ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
      }
    }

    // ΓöÇΓöÇΓöÇ Dnox - B─âng lam ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    else if (e.kind === 'dnox_ice') {
      if (e.pioneerPhase === 'enter') {
        const dx = (e.enterTargetX ?? e.container.x) - e.container.x
        const dy = (e.enterTargetY ?? e.container.y) - e.container.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const speed = 2.0
        if (dist < speed * dt * 2) {
          e.container.x = e.enterTargetX ?? e.container.x
          e.container.y = e.enterTargetY ?? e.container.y
          e.pioneerPhase = 'patrol'
        } else {
          e.container.x += (dx / dist) * speed * dt
          e.container.y += (dy / dist) * speed * dt
        }
      } else {
        // Patrol: hide behind Hoß║ú chß╗ºng when possible, otherwise strafe + dodge bullets.
        const haste = e.dnoxSoilHasteMult ?? 1
        const fireTank = ctx.enemies.find(other => other.kind === 'dnox_fire')
        if (fireTank && ctx.playerShip) {
          const hx = fireTank.container.x - ctx.playerShip.x
          const hy = fireTank.container.y - ctx.playerShip.y
          const hm = Math.sqrt(hx * hx + hy * hy) || 1
          const hideX = fireTank.container.x + (hx / hm) * 60
          const hideY = fireTank.container.y + (hy / hm) * 110
          const ddx = hideX - e.container.x
          const ddy = hideY - e.container.y
          const dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1
          const step = Math.min(2.2 * dt * haste, dd)
          e.container.x += (ddx / dd) * step
          e.container.y += (ddy / dd) * step
          e.container.x = Math.max(18, Math.min(GAME_W - 18, e.container.x))
          e.container.y = Math.max(10, Math.min(GAME_H * 0.33, e.container.y))
        } else {
          const t = Date.now() / 1000 + (e.formTargetX ?? 0) * 0.011
          const anchorX = Math.max(24, Math.min(GAME_W - 24, (e.formTargetX ?? e.container.x) + Math.sin(t * 0.85) * 48))
          const anchorY = Math.max(14, Math.min(GAME_H * 0.36, (e.formTargetY ?? (GAME_H * 0.18)) + Math.sin(t * 0.42) * 18))
          let moveX = (anchorX - e.container.x) * 0.07
          let moveY = (anchorY - e.container.y) * 0.06

          // React to nearby player bullets so the unit does not stand still when no tank cover exists.
          let evadeX = 0
          let evadeY = 0
          for (const b of ctx.bullets) {
            const bx = b.gfx.x
            const by = b.gfx.y
            const dx = e.container.x - bx
            const dy = e.container.y - by
            if (dy > -36 && dy < 145 && Math.abs(dx) < 52) {
              const side = dx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx)
              const proximity = 1 - Math.min(1, Math.abs(dx) / 52)
              evadeX += side * (0.85 + proximity * 0.75)
              evadeY -= Math.max(0, (145 - dy) / 145) * 0.35
            }
          }

          // Add a mild side strafe so idle motion stays alive even without direct threats.
          moveX += Math.sin(t * 1.9) * 0.4
          moveX += evadeX
          moveY += evadeY
          const moveMag = Math.sqrt(moveX * moveX + moveY * moveY) || 1
          const baseSpeed = 1.55
          const step = Math.min(baseSpeed * dt * haste, moveMag)
          e.container.x += (moveX / moveMag) * step
          e.container.y += (moveY / moveMag) * step
          e.container.x = Math.max(20, Math.min(GAME_W - 20, e.container.x))
          e.container.y = Math.max(10, Math.min(GAME_H * 0.36, e.container.y))
        }
      }
      // Spin ice orbs
      const iceSpinSpeed = 0.038
      e.cnoxShieldAngle = (e.cnoxShieldAngle ?? 0) + iceSpinSpeed * dt
      if (e.cnoxShields?.length) {
        const radius = 20
        for (let si = 0; si < e.cnoxShields.length; si++) {
          const angle = (e.cnoxShieldAngle ?? 0) + si * Math.PI
          e.cnoxShields[si].x = Math.cos(angle) * radius
          e.cnoxShields[si].y = Math.sin(angle) * radius
          e.cnoxShields[si].rotation = angle + Math.PI / 4
        }
      }
      // Shoot frost projectile
      const haste = e.dnoxSoilHasteMult ?? 1
      e.cnoxLaserTimer = (e.cnoxLaserTimer ?? 110) - dt * haste * 1.2
      if ((e.cnoxLaserTimer ?? 0) <= 0 && ctx.playerShip && e.pioneerPhase === 'patrol') {
        e.cnoxLaserTimer = (110 + Math.random() * 55) / haste
        const bg = new Graphics()
        drawDnoxIce(bg, 7)
        bg.x = e.container.x
        bg.y = e.container.y + 8
        ctx.gameLayer.addChild(bg)
        const tx = ctx.playerShip.x - e.container.x
        const ty = ctx.playerShip.y - e.container.y
        const mag = Math.sqrt(tx * tx + ty * ty) || 1
        const stageSpeed = 3.6 + Math.min(1.7, game.currentStage * 0.05)
        const hasteShotMult = 1 + Math.max(0, haste - 1) * 0.2
        const spd = stageSpeed * hasteShotMult
        const dmgMult = e.cnoxPowerMult ?? 1
        const isFrosted = playerFrostStacks >= 1
        ctx.enemyBullets.push({
          gfx: bg,
          vx: (tx / mag) * spd,
          vy: (ty / mag) * spd,
          damage: Math.round((10 + game.currentStage * 2) * dmgMult),
          onHitPlayer: () => {
            if (isFrosted) {
              // Second hit while frost = freeze
              playerFrostStacks = 2
              playerFreezeTimer = FREEZE_DURATION
              playerFreezeTapCount = 0
              freezeBreakPulse = 0
              // Freeze overlays
              if (!freezeOverlayGfx) {
                freezeOverlayGfx = new Graphics()
                ctx.uiLayer.addChild(freezeOverlayGfx)
              }
              if (!freezeScreenGfx) {
                freezeScreenGfx = new Graphics()
                ctx.uiLayer.addChild(freezeScreenGfx)
              }
            } else {
              // First hit = t├¬ c├│ng
              playerFrostStacks = 1
            }
          },
        })
      }
      if (e.container.y > GAME_H + 50) {
        if (e.cnoxWarnGfx) { e.cnoxWarnGfx.clear(); if (e.cnoxWarnGfx.parent) e.cnoxWarnGfx.parent.removeChild(e.cnoxWarnGfx) }
        if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
        ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
      }
    }

    // ΓöÇΓöÇΓöÇ Dnox - Thß╗ò nh╞░ß╗íng (ky╠ü sinh) ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    else if (e.kind === 'dnox_soil') {
      if (e.pioneerPhase === 'enter') {
        const dx = (e.enterTargetX ?? e.container.x) - e.container.x
        const dy = (e.enterTargetY ?? e.container.y) - e.container.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const speed = 1.8
        if (dist < speed * dt * 2) {
          e.container.x = e.enterTargetX ?? e.container.x
          e.container.y = e.enterTargetY ?? e.container.y
          e.pioneerPhase = 'patrol'
          e.cnoxLaserTimer = 90 + Math.random() * 60  // delay before seeking
        } else {
          e.container.x += (dx / dist) * speed * dt
          e.container.y += (dy / dist) * speed * dt
        }
      } else if (e.cnoxLaserState === 'idle') {
        // Drift gently, wait to find a host
        e.cnoxLaserTimer = (e.cnoxLaserTimer ?? 90) - dt
        const t = Date.now() / 1000 + (e.formTargetX ?? 0) * 0.008
        e.container.x += Math.sin(t * 0.7) * 0.3 * dt
        e.container.x = Math.max(18, Math.min(GAME_W - 18, e.container.x))

        if ((e.cnoxLaserTimer ?? 0) <= 0) {
          // Pick host by parasite core utility first, then distance.
          const coreKind = getDnoxSoilCoreKind(e)
          let bestHost: Enemy | null = null
          let bestScore = -Infinity
          for (const other of ctx.enemies) {
            if (other === e || other.kind !== 'dnox_fire' && other.kind !== 'dnox_ice') continue
            const occupied = ctx.enemies.some((p) => (
              p !== e
              && p.kind === 'dnox_soil'
              && p.healTarget === other
              && (p.cnoxLaserState === 'link_warning' || p.cnoxLaserState === 'link_firing')
            ))
            if (occupied) continue
            const d2 = dist2(e.container.x, e.container.y, other.container.x, other.container.y)
            if (d2 > 300 * 300) continue

            const hpRatio = other.hp / Math.max(1, other.maxHp)
            const lowHpNeed = 1 - hpRatio
            let suitability = 0
            if (coreKind === 'shield') {
              suitability += other.kind === 'dnox_fire' ? 2.25 : 1.35
              suitability += lowHpNeed * 1.9
            } else if (coreKind === 'sword') {
              suitability += other.kind === 'dnox_ice' ? 2.2 : 1.45
              suitability += hpRatio * 1.15
            } else {
              suitability += other.kind === 'dnox_ice' ? 2.1 : 1.55
              suitability += (other.kind === 'dnox_ice' ? 0.55 : 0.2)
            }

            const distanceScore = 1 - Math.min(1, Math.sqrt(d2) / 300)
            const score = suitability + distanceScore * 0.9
            if (score > bestScore) { bestScore = score; bestHost = other }
          }
          if (bestHost) {
            e.healTarget = bestHost
            e.cnoxLaserState = 'link_warning'
            e.cnoxLaserTimer = 84
          } else {
            e.cnoxLaserTimer = 70 + Math.random() * 40
          }
        }
      } else if (e.cnoxLaserState === 'link_warning') {
        // Draw gold energy link beam toward host, move closer
        e.cnoxLaserTimer = (e.cnoxLaserTimer ?? 90) - dt
        const host = e.healTarget
        if (!host || !ctx.enemies.includes(host)) {
          // Host gone, reset
          if (e.healBeamGfx) e.healBeamGfx.clear()
          e.healTarget = null; e.cnoxLaserState = 'idle'; e.cnoxLaserTimer = 60
        } else {
          // Move toward host
          const ddx = host.container.x - e.container.x
          const ddy = host.container.y - e.container.y
          const dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1
          const step = Math.min(3.6 * dt, dd)
          e.container.x += (ddx / dd) * step
          e.container.y += (ddy / dd) * step
          // Draw link beam (gold) in healBeamGfx (absolute coords)
          if (e.healBeamGfx) {
            const t2 = (Date.now() * 0.0012) % 1
            const al = 0.55 + Math.abs(Math.sin(Date.now() * 0.012)) * 0.35
            e.healBeamGfx.clear()
            e.healBeamGfx.moveTo(e.container.x, e.container.y)
              .lineTo(host.container.x, host.container.y)
              .stroke({ color: 0xffd700, width: 3, alpha: al })
            // Traveling dot
            const bx = e.container.x + (host.container.x - e.container.x) * t2
            const by = e.container.y + (host.container.y - e.container.y) * t2
            e.healBeamGfx.circle(bx, by, 4).fill({ color: 0xffee88, alpha: 0.9 })
          }
          if ((e.cnoxLaserTimer ?? 0) <= 0 || dd < 12) {
            const occupiedByOther = ctx.enemies.some((p) => (
              p !== e
              && p.kind === 'dnox_soil'
              && p.healTarget === host
              && (p.cnoxLaserState === 'link_warning' || p.cnoxLaserState === 'link_firing')
            ))
            if (occupiedByOther) {
              if (e.healBeamGfx) e.healBeamGfx.clear()
              e.healTarget = null
              e.cnoxLaserState = 'idle'
              e.cnoxLaserTimer = 55
              continue
            }

            // Attach!
            if (e.healBeamGfx) e.healBeamGfx.clear()
            e.cnoxLaserState = 'link_firing' // reuse as 'attached'
            applyDnoxSoilBonus(host, getDnoxSoilCoreKind(e))
            // Reparent parasite body to host container so it moves with host
            if (e.body.parent) e.body.parent.removeChild(e.body)
            host.container.addChild(e.body)
            // Redraw attached shell and merged core on host.
            drawDnoxSoilAttached(e.body, host.kind === 'dnox_fire' ? 12 : 10.5, getDnoxSoilCoreKind(e))
            // Move entity position to host (the container becomes invisible placeholder)
            e.container.visible = false
            e.hpBarBg.visible = true
            e.hpBar.visible = true
          }
        }
      } else if (e.cnoxLaserState === 'link_firing') {
        // Attached: ride with host, keep own HP bar floating
        const host = e.healTarget
        if (!host || !ctx.enemies.includes(host)) {
          // Host died, parasite detaches
          if (e.healBeamGfx) e.healBeamGfx.clear()
          e.cnoxLaserState = 'idle'
          e.healTarget = null
          e.container.visible = true
          e.container.x = host?.container.x ?? e.container.x
          e.container.y = host?.container.y ?? e.container.y
          if (e.body.parent && e.body.parent !== e.container) e.body.parent.removeChild(e.body)
          if (e.body.parent !== e.container) e.container.addChildAt(e.body, 0)
          e.cnoxLaserTimer = 90
        } else {
          // Follow host
          e.container.x = host.container.x
          e.container.y = host.container.y - 8 // slightly above
          e.body.x = 0
          e.body.y = host.kind === 'dnox_fire' ? -3 : 0
          e.body.rotation = 0
          drawDnoxSoilAttached(e.body, host.kind === 'dnox_fire' ? 12 : 10.5, getDnoxSoilCoreKind(e))

          // Static yellow electric beam from parasite core to host core.
          if (e.healBeamGfx) {
            const pulse = 0.5 + Math.abs(Math.sin(Date.now() * 0.02)) * 0.5
            const fromX = host.container.x
            const fromY = host.container.y - (host.kind === 'dnox_fire' ? 15 : 10)
            const toX = host.container.x
            const toY = host.container.y
            e.healBeamGfx.clear()
            e.healBeamGfx.moveTo(fromX, fromY).lineTo(toX, toY).stroke({ color: 0xffd84d, width: 4.4, alpha: 0.82 })
            e.healBeamGfx.moveTo(fromX, fromY).lineTo(toX, toY).stroke({ color: 0xfff3ae, width: 2.2, alpha: 0.9 })
            for (let z = 0; z < 3; z++) {
              const t3 = (Date.now() * 0.0018 + z * 0.31) % 1
              const bx = fromX + (toX - fromX) * t3
              const by = fromY + (toY - fromY) * t3
              e.healBeamGfx.circle(bx + (Math.random() - 0.5) * 1.8, by + (Math.random() - 0.5) * 1.8, 1.8 + pulse).fill({ color: 0xffef8e, alpha: 0.84 })
            }
          }
          // Keep HP bar visible above host
          e.hpBarBg.y = -20
          e.hpBar.y = -20
        }
      }

      if (e.container.y > GAME_H + 50) {
        if (e.healBeamGfx) { e.healBeamGfx.clear(); if (e.healBeamGfx.parent) e.healBeamGfx.parent.removeChild(e.healBeamGfx) }
        if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
        ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
      }
    }

    else if (e.kind === 'boss_cnox_sun') {
      const worldW = GAME_W / ctx.bossZoom
      const worldH = GAME_H / ctx.bossZoom
      const worldMinX = GAME_W * (1 - 1 / ctx.bossZoom) / 2
      const worldMinY = GAME_H * (1 - 1 / ctx.bossZoom) / 2
      if (!e.bossEntered) {
        e.container.y += 0.95 * dt
        if (e.container.y >= (e.bossTargetY ?? GAME_H * 0.12)) {
          e.container.y = e.bossTargetY ?? GAME_H * 0.12
          e.bossEntered = true
        }
        continue
      }

      if ((e.bossPhase ?? 1) === 1 && e.hp <= e.maxHp * 0.5) {
        e.bossPhase = 2
        screenFlash(ctx, 0xff9a3a, 0.5, 600)
        for (const st of e.sunStars ?? []) {
          st.state = 'idle'
          st.timer = 30
          st.warningGfx.clear()
          st.beamGfx.clear()
        }
        e.sunActiveStars = []
        e.sunCoreLaserState = 'warning'
        e.sunCoreLaserTimer = 100
        const phase2Base = Math.atan2((ctx.playerShip?.y ?? (worldMinY + worldH * 0.7)) - e.container.y, (ctx.playerShip?.x ?? GAME_W / 2) - e.container.x)
        e.sunCoreLaserStartAngle = phase2Base - Math.PI / 24
        e.sunCoreLaserSweepSpan = Math.PI / 12
        e.sunCoreLaserAngle = e.sunCoreLaserStartAngle
      }

      e.sunCoreSpin = (e.sunCoreSpin ?? 0) + 0.0014 * dt
      e.body.rotation = Math.sin((e.sunCoreSpin ?? 0) * 1.7) * 0.05

      e.bossDriftTimer = (e.bossDriftTimer ?? 0) - dt
      if ((e.bossDriftTimer ?? 0) <= 0) {
        e.bossDriftTarget = worldMinX + worldW * 0.17 + Math.random() * worldW * 0.66
        e.bossDriftTimer = 180 + Math.random() * 130
      }
      if (e.bossDriftTarget !== undefined) {
        const ddx = e.bossDriftTarget - e.container.x
        e.container.x += Math.min(Math.abs(ddx), 1.9 * dt) * Math.sign(ddx)
      }

      const stars = e.sunStars ?? []
      e.sunCrystalSpawnCd = (e.sunCrystalSpawnCd ?? 0) - dt
      for (let si = 0; si < stars.length; si++) {
        const st = stars[si]!
        const spd = 0.010 + si * 0.002
        st.orbitAngle += spd * dt
        st.gfx.x = Math.cos(st.orbitAngle) * st.orbitRadius
        st.gfx.y = Math.sin(st.orbitAngle) * st.orbitRadius
        const activeNow = (e.sunActiveStars ?? []).includes(st.kind)
        st.attackPush = (st.attackPush ?? 0) + ((activeNow ? 22 : 0) - (st.attackPush ?? 0)) * 0.14 * dt
        st.gfx.y += st.attackPush ?? 0
        const sc = 1 + (st.attackPush ?? 0) / 90
        st.gfx.scale.set(sc)
        st.gfx.rotation += 0.02 * dt
      }

      const crystals = e.sunEnergyCrystals ?? []
      e.sunLinkGfx?.clear()
      if (crystals.length > 0) {
        const healPerCrystalPerFrame = e.maxHp * 0.01 / 60
        e.hp = Math.min(e.maxHp, e.hp + healPerCrystalPerFrame * crystals.length * dt)
        redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
        const healPulse = 0.55 + Math.abs(Math.sin(Date.now() * 0.008)) * 0.35
        const tNow = Date.now() * 0.0015
        for (let ci = 0; ci < crystals.length; ci++) {
          const c = crystals[ci]!
          const floatY = c.y + Math.sin(tNow * 1.2 + ci * 0.8) * 1.8
          c.gfx.y = floatY
          c.gfx.rotation = Math.sin(tNow + ci) * 0.06
          e.sunLinkGfx?.circle(c.x, floatY, 16 + healPulse * 4).stroke({ color: 0x98ebff, width: 2, alpha: 0.45 })
          e.sunLinkGfx?.circle(c.x, floatY, 7 + healPulse * 1.5).fill({ color: 0x9ce2ff, alpha: 0.14 })
          e.sunLinkGfx?.moveTo(c.x, floatY).lineTo(e.container.x, e.container.y).stroke({ color: 0x7de2ff, width: 2, alpha: 0.55 * healPulse })
          const linkT = (tNow * 0.55 + ci * 0.23) % 1
          const bx = c.x + (e.container.x - c.x) * linkT
          const by = floatY + (e.container.y - floatY) * linkT
          e.sunLinkGfx?.circle(bx, by, 3).fill({ color: 0xcdf4ff, alpha: 0.88 })
        }
      }
      if ((e.bossPhase ?? 1) >= 2 && crystals.length >= 2) {
        for (let ci = 0; ci < crystals.length - 1; ci++) {
          const a = crystals[ci]!
          const b = crystals[ci + 1]!
          e.sunLinkGfx?.moveTo(a.x, a.gfx.y).lineTo(b.x, b.gfx.y).stroke({ color: 0x88d7ff, width: 3, alpha: 0.72 })
          const t = (Date.now() * 0.001 + ci * 0.31) % 1
          const ex = a.x + (b.x - a.x) * t
          const ey = a.gfx.y + (b.gfx.y - a.gfx.y) * t
          e.sunLinkGfx?.circle(ex, ey, 2.6).fill({ color: 0xf0fbff, alpha: 0.86 })
        }
      }

      e.sunActiveStars = e.sunActiveStars ?? []
      e.sunAttackQueue = e.sunAttackQueue ?? []
      e.sunDiamondCooldownPicks = Math.max(0, e.sunDiamondCooldownPicks ?? 4)
      const desiredActive = (e.bossPhase ?? 1) === 1 ? 1 : 2
      if (e.sunAttackQueue.length === 0) {
        const seq: SunWeaponStar['kind'][] = ['triangle', 'circle', 'pentagon', 'diamond']
        for (let qi = seq.length - 1; qi > 0; qi--) {
          const qj = Math.floor(Math.random() * (qi + 1))
          const tmp = seq[qi]!
          seq[qi] = seq[qj]!
          seq[qj] = tmp
        }
        e.sunAttackQueue.push(...seq)
      }
      while (e.sunActiveStars.length < desiredActive) {
        let picked: SunWeaponStar['kind'] | undefined
        for (let qi = 0; qi < e.sunAttackQueue.length; qi++) {
          const cand = e.sunAttackQueue[qi]!
          if (cand === 'diamond' && (e.sunDiamondCooldownPicks ?? 0) > 0) continue
          if (!e.sunActiveStars.includes(cand)) {
            picked = cand
            e.sunAttackQueue.splice(qi, 1)
            break
          }
        }
        if (!picked) break
        e.sunActiveStars.push(picked)
        if (picked === 'diamond') {
          // Strongly throttle crystal-heal pattern so it cannot chain too often.
          e.sunDiamondCooldownPicks = (e.bossPhase ?? 1) === 1 ? 7 : 5
        } else if ((e.sunDiamondCooldownPicks ?? 0) > 0) {
          e.sunDiamondCooldownPicks!--
        }
        const star = stars.find(s => s.kind === picked)
        if (!star) continue
        star.state = 'warning'
        star.timer = picked === 'circle' ? ((e.bossPhase ?? 1) === 1 ? 60 : 120)
          : picked === 'pentagon' ? 40
          : picked === 'triangle' ? ((e.bossPhase ?? 1) === 1 ? 24 : 40)
          : ((e.bossPhase ?? 1) === 1 ? 72 : 54)
        star.burstLeft = picked === 'triangle' ? ((e.bossPhase ?? 1) === 1 ? 3 : 1)
          : picked === 'pentagon' ? 4
          : picked === 'diamond' ? Math.max(0, 4 - (e.sunEnergyCrystals ?? []).length)
          : undefined
        star.targetX = ctx.playerShip?.x ?? GAME_W / 2
        star.targetY = ctx.playerShip?.y ?? (worldMinY + worldH * 0.72)
        star.attackAngle = Math.atan2((ctx.playerShip?.y ?? (worldMinY + worldH * 0.7)) - (e.container.y + star.gfx.y), (ctx.playerShip?.x ?? GAME_W / 2) - (e.container.x + star.gfx.x))
        if (picked === 'diamond') {
          const count = star.burstLeft ?? 0
          const targets: Array<{ x: number, y: number }> = []
          for (let ni = 0; ni < count; ni++) {
            const cx = worldMinX + worldW * 0.12 + Math.random() * worldW * 0.76
            const minY = Math.max(worldMinY + worldH * 0.22, e.container.y + 24)
            const maxY = worldMinY + worldH * 0.50
            const cy = minY + Math.random() * Math.max(20, maxY - minY)
            targets.push({ x: cx, y: cy })
          }
          star.missileTargets = targets
          star.missileIndex = 0
        } else {
          star.missileTargets = undefined
          star.missileIndex = undefined
        }
      }

      const finishStar = (kind: SunWeaponStar['kind']) => {
        e.sunActiveStars = (e.sunActiveStars ?? []).filter(k => k !== kind)
        e.sunAttackQueue = e.sunAttackQueue ?? []
        if (!e.sunAttackQueue.includes(kind)) e.sunAttackQueue.push(kind)
      }

      for (const st of stars) {
        const wx = e.container.x + st.gfx.x
        const wy = e.container.y + st.gfx.y

        if (!e.sunActiveStars.includes(st.kind)) {
          st.warningGfx.clear()
          st.beamGfx.clear()
          st.state = 'idle'
          continue
        }

        if (st.kind === 'diamond' && st.state === 'firing') {
          st.warningGfx.clear()
          const idx = st.missileIndex ?? 0
          const nextPoint = st.missileTargets?.[idx]
          if (nextPoint) {
            const pulse = 0.45 + Math.abs(Math.sin(Date.now() * 0.012 + idx * 0.9)) * 0.35
            const rings = Math.max(1, Math.ceil(Math.max(0, st.timer ?? 0) / 32))
            for (let ri = 0; ri < rings; ri++) {
              st.warningGfx.circle(nextPoint.x, nextPoint.y, 9 + ri * 6 + pulse * 2).stroke({ color: 0x7be4ff, width: 2, alpha: 0.25 + ri * 0.12 })
            }
          }
          st.timer -= dt
          if (st.timer <= 0) {
            const left = st.burstLeft ?? 0
            const cd = e.sunCrystalSpawnCd ?? 0
            const nodes = e.sunEnergyCrystals ?? []
            if (left <= 0 || cd > 0 || nodes.length >= 4) {
              st.warningGfx.clear()
              st.missileTargets = undefined
              st.missileIndex = undefined
              st.state = 'cooldown'
              st.timer = (e.bossPhase ?? 1) === 1 ? 120 : 95
              continue
            }
            const idx = st.missileIndex ?? 0
            const p = st.missileTargets?.[idx]
            if (p) {
              const nodes = e.sunEnergyCrystals ?? []
              const cg = new Graphics()
              cg.poly([0, -15, 11, -4, 8, 11, 0, 16, -8, 11, -11, -4]).fill(0xd8f5ff)
              cg.poly([0, -9, 5, -2, 4, 7, 0, 10, -4, 7, -5, -2]).fill(0x4fb6ff)
              cg.x = p.x
              cg.y = p.y
              ctx.gameLayer.addChild(cg)
              nodes.push({ gfx: cg, x: p.x, y: p.y, hp: 40 + game.currentStage * 6, maxHp: 40 + game.currentStage * 6 })
              e.sunEnergyCrystals = nodes
              st.missileIndex = idx + 1
            }
            st.burstLeft = Math.max(0, left - 1)
            if ((st.burstLeft ?? 0) > 0) {
              st.timer = 180
            } else {
              // Longer lockout after a diamond cycle to prevent near-continuous healing.
              e.sunCrystalSpawnCd = (e.bossPhase ?? 1) === 1 ? 560 : 430
              st.warningGfx.clear()
              st.missileTargets = undefined
              st.missileIndex = undefined
              st.state = 'cooldown'
              st.timer = (e.bossPhase ?? 1) === 1 ? 120 : 95
            }
          }
        } else if (st.state === 'warning') {
          st.timer -= dt
          st.warningGfx.clear()
          const pulse = 0.45 + Math.abs(Math.sin((Date.now() + wx * 2) * 0.01)) * 0.35
          st.warningGfx.circle(wx, wy, 20 + pulse * 3).stroke({ color: 0xffc36a, width: 2, alpha: 0.72 })
          st.warningGfx.circle(wx, wy, 12 + pulse * 2).fill({ color: 0xffaa44, alpha: 0.16 })
          if (st.kind === 'circle') {
            const ang = st.attackAngle ?? 0
            if ((e.bossPhase ?? 1) === 1) {
              drawCnoxRay(st.warningGfx, wx, wy, ang, 2, 0x99ddff, 0.55)
            } else {
              drawCnoxCone(st.warningGfx, wx, wy, ang, 0.14, Math.max(worldH * 1.5, 520), 0.62)
            }
          } else if (st.kind === 'triangle') {
            const tx = st.targetX ?? wx
            const ty = st.targetY ?? wy
            st.warningGfx.circle(tx, ty, 14 + Math.sin((st.timer ?? 0) * 0.2) * 4).stroke({ color: 0xffc557, width: 2, alpha: 0.7 })
          } else if (st.kind === 'diamond') {
            const idx = st.missileIndex ?? 0
            const p = st.missileTargets?.[idx]
            const rings = Math.max(1, Math.ceil(Math.max(0, st.timer) / 18))
            if (p) {
              for (let ri = 0; ri < rings; ri++) {
                st.warningGfx.circle(p.x, p.y, 8 + ri * 5).stroke({ color: 0x7be4ff, width: 2, alpha: 0.22 + ri * 0.12 })
              }
            }
          } else if (st.kind === 'pentagon') {
            const px = ctx.playerShip?.x ?? GAME_W / 2
            const py = ctx.playerShip?.y ?? (worldMinY + worldH * 0.72)
            st.warningGfx.circle(px, py, 14 + pulse * 2).stroke({ color: 0xff88ff, width: 2, alpha: 0.65 })
          }
          if (st.timer <= 0) {
            st.warningGfx.clear()
            st.state = 'firing'
            st.timer = st.kind === 'circle' ? ((e.bossPhase ?? 1) === 1 ? 24 : 58)
              : st.kind === 'diamond' ? 1
              : st.kind === 'pentagon' ? 0
              : 0
          }
        } else if (st.state === 'firing') {
          st.warningGfx.clear()
          const pulse = 0.55 + Math.abs(Math.sin((Date.now() + wy * 3) * 0.012)) * 0.4
          st.warningGfx.circle(wx, wy, 22 + pulse * 3).stroke({ color: 0xffdd88, width: 2, alpha: 0.7 })
          if (st.kind === 'triangle') {
            st.timer -= dt
            if ((st.timer ?? 0) <= 0) {
              if ((st.burstLeft ?? 0) > 0) {
                if ((e.bossPhase ?? 1) === 1) {
                  const base = Math.atan2((ctx.playerShip?.y ?? (worldMinY + worldH * 0.75)) - wy, (ctx.playerShip?.x ?? GAME_W / 2) - wx)
                  for (let bi = 0; bi < 5; bi++) {
                    const bg = new Graphics()
                    drawEnemyBullet(bg)
                    bg.tint = 0xffd24f
                    bg.x = wx
                    bg.y = wy
                    ctx.gameLayer.addChild(bg)
                    const ang = base + (bi - 2) * 0.16
                    ctx.enemyBullets.push({ gfx: bg, vx: Math.cos(ang) * 3.9, vy: Math.sin(ang) * 3.9, damage: 14 + game.currentStage * 2 })
                  }
                  st.burstLeft = (st.burstLeft ?? 0) - 1
                  st.timer = 16
                } else {
                  const bg = new Graphics()
                  drawBossMissile(bg, true)
                  bg.tint = 0xffb247
                  bg.scale.set(1.55)
                  bg.x = wx
                  bg.y = wy
                  ctx.gameLayer.addChild(bg)
                  const tx = ctx.playerShip?.x ?? GAME_W / 2
                  const highLineY = worldMinY + worldH * 0.45
                  const ty = Math.max(worldMinY + 30, Math.min(highLineY, (ctx.playerShip?.y ?? (worldMinY + worldH * 0.78)) - 120))
                  const dx = tx - wx
                  const dy = ty - wy
                  const d = Math.sqrt(dx * dx + dy * dy) || 1
                  ctx.enemyBullets.push({
                    gfx: bg,
                    vx: (dx / d) * 4.4,
                    vy: (dy / d) * 4.4,
                    aoe: true,
                    targetX: tx,
                    targetY: ty,
                    damage: 46 + game.currentStage * 3,
                    sunShardBurst: true,
                    sunShardCount: 14,
                  })
                  st.burstLeft = 0
                  st.timer = 80
                }
              } else {
                st.state = 'cooldown'
                st.timer = 90
              }
            }
          } else if (st.kind === 'circle') {
            st.timer -= dt
            st.beamGfx.clear()
            let ang = st.attackAngle ?? 0
            if ((e.bossPhase ?? 1) === 2) {
              const p = 1 - Math.max(0, st.timer) / 58
              ang = (st.attackAngle ?? 0) - 0.14 + p * 0.28
            }
            drawCnoxRay(st.beamGfx, wx, wy, ang, (e.bossPhase ?? 1) === 1 ? 10 : 12, 0x8fd9ff, 0.35, false)
            drawCnoxRay(st.beamGfx, wx, wy, ang, (e.bossPhase ?? 1) === 1 ? 4 : 5, 0xffffff, 0.9, false)
            if (ctx.playerShip) {
              const hit = pointDistanceToRay(ctx.playerShip.x, ctx.playerShip.y, wx, wy, ang)
              const hitR = (e.bossPhase ?? 1) === 1 ? 12 : 14
              if (hit.perp < hitR && hit.dot > 0) {
                const dmg = 16 + game.currentStage * 2
                applyLaserHitToPlayer(dmg, { flashColor: 0x88ddff, flashAlpha: 0.24, flashMs: 120, shieldOuterColor: 0x88ddff, shieldInnerColor: 0xffffff })
              }
            }
            if (st.timer <= 0) {
              st.beamGfx.clear()
              st.state = 'cooldown'
              st.timer = 95
            }
          } else if (st.kind === 'pentagon') {
            st.timer -= dt
            if ((st.timer ?? 0) <= 0) {
              if ((st.burstLeft ?? 0) > 0) {
                const tx = ctx.playerShip?.x ?? GAME_W / 2
                const ty = ctx.playerShip?.y ?? (worldMinY + worldH * 0.72)
                if ((e.bossPhase ?? 1) === 1) spawnMissileWarning(ctx, tx, ty)
                const mg = new Graphics()
                drawBossMissile(mg)
                mg.tint = 0xcc79ff
                mg.x = wx
                mg.y = wy
                ctx.gameLayer.addChild(mg)
                const dx = tx - wx
                const dy = ty - wy
                const d = Math.sqrt(dx * dx + dy * dy) || 1
                const phase2Homing = (e.bossPhase ?? 1) === 2
                mg.rotation = Math.atan2(dy, dx) + Math.PI / 2
                const tail = new Graphics()
                tail.poly([0, 2, 3, 10, 0, 24, -3, 10]).fill({ color: 0xffa3ff, alpha: 0.75 })
                tail.y = 10
                mg.addChild(tail)
                ctx.enemyBullets.push({
                  gfx: mg,
                  vx: (dx / d) * ((e.bossPhase ?? 1) === 1 ? 3.8 : 6.0),
                  vy: (dy / d) * ((e.bossPhase ?? 1) === 1 ? 3.8 : 6.0),
                  aoe: (e.bossPhase ?? 1) === 1,
                  targetX: (e.bossPhase ?? 1) === 1 ? tx : undefined,
                  targetY: (e.bossPhase ?? 1) === 1 ? ty : undefined,
                  homing: phase2Homing,
                  homingLife: phase2Homing ? 260 : undefined,
                  homingSpeed: phase2Homing ? 6.4 : undefined,
                  homingRange: phase2Homing ? 360 : undefined,
                  damage: 18 + game.currentStage * 2,
                  missileTrail: true,
                  missileTrailColor: 0xffa3ff,
                  trailPulse: Math.random() * Math.PI * 2,
                })
                st.burstLeft = (st.burstLeft ?? 0) - 1
                st.timer = 12
              } else {
                st.missileTargets = undefined
                st.missileIndex = undefined
                st.state = 'cooldown'
                st.timer = 100
              }
            }
          }
        } else if (st.state === 'cooldown') {
          st.timer -= dt
          st.warningGfx.clear()
          st.beamGfx.clear()
          if (st.timer <= 0) {
            st.state = 'idle'
            finishStar(st.kind)
          }
        }
      }

      if ((e.bossPhase ?? 1) >= 2 && e.sunCoreLaserGfx) {
        e.sunCoreLaserTimer = (e.sunCoreLaserTimer ?? 0) - dt
        if (e.sunCoreLaserState === 'idle' && (e.sunCoreLaserTimer ?? 0) <= 0) {
          e.sunCoreLaserState = 'warning'
          e.sunCoreLaserTimer = 100
          const base = Math.atan2((ctx.playerShip?.y ?? (worldMinY + worldH * 0.7)) - e.container.y, (ctx.playerShip?.x ?? GAME_W / 2) - e.container.x)
          e.sunCoreLaserStartAngle = base - Math.PI / 24
          e.sunCoreLaserSweepSpan = Math.PI / 12
          e.sunCoreLaserAngle = e.sunCoreLaserStartAngle
        }
        if (e.sunCoreLaserState === 'warning') {
          const al = 0.2 + Math.abs(Math.sin((e.sunCoreLaserTimer ?? 0) * 0.14)) * 0.35
          e.sunCoreLaserGfx.clear()
          const sweep = e.sunCoreLaserSweepSpan ?? Math.PI / 12
          for (let ri = 0; ri < 3; ri++) {
            const a0 = (e.sunCoreLaserStartAngle ?? -Math.PI / 2) + ri * (Math.PI * 2 / 3)
            const a1 = a0 + sweep
            drawCnoxCone(e.sunCoreLaserGfx, e.container.x, e.container.y, (a0 + a1) * 0.5, sweep * 0.5, Math.max(worldH * 1.45, 520), 0.35, false)
            drawCnoxRay(e.sunCoreLaserGfx, e.container.x, e.container.y, a0, 2, 0xffc058, al, false)
            drawCnoxRay(e.sunCoreLaserGfx, e.container.x, e.container.y, a1, 2, 0xffc058, al * 0.95, false)
          }
          if ((e.sunCoreLaserTimer ?? 0) <= 0) {
            e.sunCoreLaserState = 'firing'
            e.sunCoreLaserTimer = 90
          }
        } else if (e.sunCoreLaserState === 'firing') {
          const p = 1 - Math.max(0, e.sunCoreLaserTimer ?? 0) / 90
          const base = (e.sunCoreLaserStartAngle ?? -Math.PI / 2) + (e.sunCoreLaserSweepSpan ?? Math.PI / 12) * p
          e.sunCoreLaserGfx.clear()
          for (let ri = 0; ri < 3; ri++) {
            const a = base + ri * (Math.PI * 2 / 3)
            drawCnoxRay(e.sunCoreLaserGfx, e.container.x, e.container.y, a, 11, 0xffb852, 0.28, false)
            drawCnoxRay(e.sunCoreLaserGfx, e.container.x, e.container.y, a, 4, 0xffffff, 0.9, false)
            if (ctx.playerShip) {
              const hit = pointDistanceToRay(ctx.playerShip.x, ctx.playerShip.y, e.container.x, e.container.y, a)
              if (hit.perp < 13 && hit.dot > 0) {
                const dmg = 12 + game.currentStage * 2
                applyLaserHitToPlayer(dmg, { flashColor: 0xffbb55, flashAlpha: 0.2, flashMs: 90, shieldOuterColor: 0xffbb55, shieldInnerColor: 0xffffff })
              }
            }
          }
          if ((e.sunCoreLaserTimer ?? 0) <= 0) {
            e.sunCoreLaserState = 'idle'
            e.sunCoreLaserTimer = 160
            e.sunCoreLaserGfx.clear()
          }
        }
      }

      redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
    }

    else if (e.kind === 'boss_stardestroyer') {
      if (!e.bossEntered) {
        e.container.y += 1.2 * dt
        if (e.container.y >= (e.bossTargetY ?? GAME_H * 0.18)) {
          e.container.y = e.bossTargetY ?? GAME_H * 0.18
          e.bossEntered = true
        }
        continue  // chua v├»┬┐┬╜o v? tr├»┬┐┬╜, kh├»┬┐┬╜ng t?n c├»┬┐┬╜ng
      }
      if (e.bossEntered) {
        if ((e.bossPhase ?? 1) === 1 && e.hp <= e.maxHp * 0.5) {
          e.bossPhase = 2
          screenFlash(ctx, 0x4466ff, 0.5, 600)
          spawnExplosion(ctx, e.container.x, e.container.y, 28, 0x4466ff, 0xaaccff)
          if (e.bossLabel) {
            e.bossLabel.text = 'Anox - Kß║╗ ─ân sao [PHASE 2]'
            e.bossLabel.style = new TextStyle({ fill: 0xff88cc, fontSize: 10, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 'bold', stroke: { color: 0x000022, width: 3 } })
          }
          if (e.laserLine) { e.laserLine.clear(); e.laserLine.visible = false }
          e.bossAttack2State = 'ready'; e.attack2Timer = 300
        }
        e.bossDriftTimer = (e.bossDriftTimer ?? 0) - dt
        if ((e.bossDriftTimer ?? 0) <= 0) {
          e.bossDriftTarget = Math.random() * (GAME_W - 120) + 60
          e.bossDriftTimer = 180 + Math.random() * 120
        }
        if (e.bossDriftTarget !== undefined) {
          const ddx = e.bossDriftTarget - e.container.x
          e.container.x += Math.min(Math.abs(ddx), 2.5 * dt) * Math.sign(ddx)
        }
        e.attack1Timer = (e.attack1Timer ?? 100) - dt
        if ((e.attack1Timer ?? 0) <= 0) {
          e.attack1Timer = 85
          if (ctx.playerShip) {
            const baseAngle = Math.atan2(ctx.playerShip.y - e.container.y, ctx.playerShip.x - e.container.x)
            const capturedEnemy = e
            for (let k = 0; k < 6; k++) {
              const angle = baseAngle + (k - 2.5) * 0.20
              const bg = new Graphics()
              drawBossBullet(bg)
              bg.x = e.container.x; bg.y = e.container.y + 20
              ctx.gameLayer.addChild(bg)
              ctx.enemyBullets.push({
                gfx: bg, vx: Math.cos(angle) * 5.5, vy: Math.sin(angle) * 5.5,
                onHitPlayer: () => {
                  if (!capturedEnemy.body || capturedEnemy.body.destroyed) return
                  capturedEnemy.hp = Math.min(capturedEnemy.maxHp, capturedEnemy.hp + capturedEnemy.maxHp * 0.05)
                  redrawHpBar(capturedEnemy.hpBarBg, capturedEnemy.hpBar, capturedEnemy.hp / capturedEnemy.maxHp, capturedEnemy.barW)
                },
              })
            }
          }
        }
        if ((e.bossPhase ?? 1) === 1) {
          if (e.bossAttack2State === 'ready') {
            e.attack2Timer = (e.attack2Timer ?? 600) - dt
            if ((e.attack2Timer ?? 0) <= 0) {
              e.bossAttack2State = 'locking'; e.laserLockTimer = 80
              if (e.laserLine) e.laserLine.visible = true
            }
          } else {
            e.laserLockTimer = (e.laserLockTimer ?? 0) - dt
            if (e.laserLine && ctx.playerShip) {
              const ltx = ctx.playerShip.x - e.container.x
              const lty = ctx.playerShip.y - e.container.y
              e.laserTargetX = ctx.playerShip.x; e.laserTargetY = ctx.playerShip.y
              const alpha = 0.35 + Math.sin((120 - (e.laserLockTimer ?? 0)) * 0.25) * 0.3
              e.laserLine.clear()
              e.laserLine.moveTo(0, 20).lineTo(ltx, lty).stroke({ color: 0x4488ff, width: 2, alpha })
              e.laserLine.circle(ltx, lty, 8 + Math.sin((e.laserLockTimer ?? 0) * 0.3) * 3).stroke({ color: 0x4488ff, width: 1.5, alpha })
            }
            if ((e.laserLockTimer ?? 0) <= 0) {
              if (e.laserLine) { e.laserLine.clear(); e.laserLine.visible = false }
              for (let k = 0; k < 2; k++) {
                const offX = (k - 0.5) * 30
                const mlx = (e.laserTargetX ?? ctx.playerShip?.x ?? GAME_W / 2) - (e.container.x + offX)
                const mly = (e.laserTargetY ?? ctx.playerShip?.y ?? GAME_H / 2) - (e.container.y + 20)
                const mmag = Math.sqrt(mlx * mlx + mly * mly) || 1
                const mg = new Graphics()
                drawBossMissile(mg)
                mg.x = e.container.x + offX; mg.y = e.container.y + 20
                ctx.gameLayer.addChild(mg)
                ctx.enemyBullets.push({ gfx: mg, vx: (mlx / mmag) * 4.5, vy: (mly / mmag) * 4.5, homing: true, homingLife: 180, homingSpeed: 4.5 })
              }
              e.bossAttack2State = 'ready'; e.attack2Timer = 380
            }
          }
        } else {
          if ((e.pendingMissiles ?? 0) > 0) {
            e.missileFireTimer = (e.missileFireTimer ?? 0) - dt
            if ((e.missileFireTimer ?? 0) <= 0) {
              const mox = (Math.random() - 0.5) * 60
              const mdx = (ctx.playerShip?.x ?? GAME_W / 2) - (e.container.x + mox)
              const mdy = (ctx.playerShip?.y ?? GAME_H) - (e.container.y + 20)
              const mmag = Math.sqrt(mdx * mdx + mdy * mdy) || 1
              const smg = new Graphics()
              drawBossMissile(smg, true)
              smg.x = e.container.x + mox; smg.y = e.container.y + 20
              ctx.gameLayer.addChild(smg)
              ctx.enemyBullets.push({ gfx: smg, vx: (mdx / mmag) * 5.4, vy: (mdy / mmag) * 5.4, homing: true, homingLife: 240, homingSpeed: 5.4 })
              e.pendingMissiles!--; e.missileFireTimer = 4
            }
          }
          e.attack2Timer = (e.attack2Timer ?? 600) - dt
          if ((e.attack2Timer ?? 0) <= 0 && (e.pendingMissiles ?? 0) === 0) {
            e.pendingMissiles = 14; e.missileFireTimer = 0; e.attack2Timer = 320
          }
        }
      }
    }

    else if (e.kind === 'boss_invader') {
      if (!e.bossEntered) {
        e.container.y += 1.2 * dt
        if (e.container.y >= (e.bossTargetY ?? GAME_H * 0.22)) {
          e.container.y = e.bossTargetY ?? GAME_H * 0.22
          e.bossEntered = true
        }
        continue  // chua v├»┬┐┬╜o v? tr├»┬┐┬╜, kh├»┬┐┬╜ng t?n c├»┬┐┬╜ng
      }
      if (e.bossEntered) {
        if ((e.bossPhase ?? 1) === 1 && e.hp <= e.maxHp * 0.5) {
          e.bossPhase = 2
          screenFlash(ctx, 0x2255ff, 0.5, 600)
          spawnExplosion(ctx, e.container.x, e.container.y, 28, 0x2255ff, 0x88bbff)
          if (e.bossLabel) {
            e.bossLabel.text = 'Anox - Kß║╗ x├óm l─âng [PHASE 2]'
            e.bossLabel.style = new TextStyle({ fill: 0xff88cc, fontSize: 10, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 'bold', stroke: { color: 0x000022, width: 3 } })
          }
          if (e.bossTurrets) {
            e.bossTurrets[0]!.attached = true; e.bossTurrets[1]!.attached = true
            for (const ti of [0, 1]) {
              const t = e.bossTurrets[ti]!
              if (t.laserState !== 'idle') { t.laserState = 'idle'; t.laserWarnTimer = 0; t.laserGfx.clear() }
            }
          }
        }
        e.bossDriftTimer = (e.bossDriftTimer ?? 0) - dt
        if ((e.bossDriftTimer ?? 0) <= 0) {
          e.bossDriftTarget = Math.random() * (GAME_W - 120) + 60
          e.bossDriftTimer = 180 + Math.random() * 120
        }
        if (e.bossDriftTarget !== undefined) {
          const ddx = e.bossDriftTarget - e.container.x
          e.container.x += Math.min(Math.abs(ddx), 2.0 * dt) * Math.sign(ddx)
        }
        if (e.bossTurrets) {
          for (const t of e.bossTurrets) {
            if (t.stunTimer > 0) {
              t.stunTimer -= dt; t.laserGfx.clear()
              if (t.stunTimer <= 0) {
                t.stunTimer = 0; t.hp = t.maxHp
                // redraw turret as healthy
                t.gfx.clear()
                t.gfx.circle(0, 0, 10).fill(0x2266cc)
                t.gfx.circle(0, 0, 6).fill(0x44aaff)
                t.gfx.rect(-2.2, 0, 4.4, 8.5).fill(0x335599)
                t.gfx.circle(0, 0, 2.5).fill({ color: 0xffffff, alpha: 0.8 })
                redrawHpBar(t.hpBarBg, t.hpBar, 1, 24)
              }
              continue
            }
            if (ctx.playerShip && t.laserState === 'idle') {
              const adx = ctx.playerShip.x - (e.container.x + t.offsetX)
              const ady = ctx.playerShip.y - (e.container.y + t.offsetY)
              t.gfx.rotation = Math.atan2(ady, adx) - Math.PI / 2
            }
            if (t.attached) {
              t.kamiTimer += dt
              if (t.kamiTimer >= 300) {
                t.kamiTimer = 0
                // spawnKamikazeAt is invoked indirectly via import in BossInvader spawn
                // Here we do an inline minimal setup to avoid heavy import
                spawnKamikazeAt(ctx, game, e.container.x + t.offsetX, e.container.y + t.offsetY)
              }
            } else {
              if (t.laserState !== 'idle') {
                const wx = e.container.x + t.offsetX
                const wy = e.container.y + t.offsetY
                const len = GAME_W + GAME_H
                if (t.laserState === 'warning') {
                  t.laserWarnTimer -= dt
                  t.gfx.rotation = t.laserAngle + Math.PI / 2
                  const alpha = 0.25 + Math.abs(Math.sin(t.laserWarnTimer * 0.15)) * 0.4
                  t.laserGfx.clear()
                  t.laserGfx.moveTo(wx, wy).lineTo(wx + Math.cos(t.laserAngle) * len, wy + Math.sin(t.laserAngle) * len).stroke({ color: 0x4499ff, width: 2, alpha })
                  if (t.laserWarnTimer <= 0) {
                    t.laserState = 'firing'; t.laserWarnTimer = 18
                    screenFlash(ctx, 0x2255ff, 0.18, 180)
                  }
                } else {
                  t.laserWarnTimer -= dt
                  t.gfx.rotation = t.laserAngle + Math.PI / 2
                  const alpha = Math.max(0, t.laserWarnTimer / 18) * 0.85
                  t.laserGfx.clear()
                  t.laserGfx.moveTo(wx, wy).lineTo(wx + Math.cos(t.laserAngle) * len, wy + Math.sin(t.laserAngle) * len).stroke({ color: 0x44aaff, width: 5, alpha })
                  if (ctx.playerShip) {
                    const hit = pointDistanceToRay(ctx.playerShip.x, ctx.playerShip.y, wx, wy, t.laserAngle)
                    if (hit.perp < 22 && hit.dot > 0) {
                      const dmg = 18 + game.currentStage * 2
                      applyLaserHitToPlayer(dmg, { shieldOuterColor: 0x44aaff, shieldInnerColor: 0x88ddff })
                    }
                  }
                  if (t.laserWarnTimer <= 0) {
                    t.laserState = 'idle'; t.laserTimer = 200 + Math.random() * 120; t.laserGfx.clear()
                  }
                }
              }
              if (t.laserState === 'idle') {
                t.laserTimer -= dt
                if (t.laserTimer <= 0 && ctx.playerShip) {
                  t.laserState = 'warning'; t.laserWarnTimer = 60
                  const wx = e.container.x + t.offsetX; const wy = e.container.y + t.offsetY
                  t.laserAngle = Math.atan2(ctx.playerShip.y - wy, ctx.playerShip.x - wx) + (Math.random() - 0.5) * Math.PI * 0.55
                }
                t.shootTimer -= dt
                if (t.shootTimer <= 0 && ctx.playerShip) {
                  t.shootTimer = 60 + Math.random() * 35
                  const wx = e.container.x + t.offsetX; const wy = e.container.y + t.offsetY
                  const tdx = ctx.playerShip.x - wx; const tdy = ctx.playerShip.y - wy
                  for (let k = 0; k < 2; k++) {
                    const angle = Math.atan2(tdy, tdx) + (k - 0.5) * 0.12
                    const bg = new Graphics()
                    drawEnemyBullet(bg)
                    bg.x = wx; bg.y = wy
                    ctx.gameLayer.addChild(bg)
                    ctx.enemyBullets.push({ gfx: bg, vx: Math.cos(angle) * 3.5, vy: Math.sin(angle) * 3.5 })
                  }
                }
              }
            }
          }
        }
      }
    }

    else if (e.kind === 'boss_tinhvan') {
      // -- Entry -------------------------------------------------------------
      if (!e.bossEntered) {
        e.container.y += 1.0 * dt
        if (e.container.y >= (e.bossTargetY ?? GAME_H * 0.20)) {
          e.container.y = e.bossTargetY ?? GAME_H * 0.20
          e.bossEntered = true
          e.bossBattleReady = false
          e.bossBattleTimer = 180  // 3s: ch? zoom xong + delay tru?c khi t?n c├»┬┐┬╜ng
        }
        continue  // chua v├»┬┐┬╜o v? tr├»┬┐┬╜, kh├»┬┐┬╜ng l├»┬┐┬╜m g├»┬┐┬╜ c?
      }

      // Ch? timer d?m xu?ng 0 tru?c khi b?t d?u tr?n chi?n
      if (!e.bossBattleReady) {
        e.body.rotation += 0.003 * dt
        e.bossBattleTimer = (e.bossBattleTimer ?? 180) - dt
        if ((e.bossBattleTimer ?? 0) <= 0) {
          e.bossBattleReady = true
          screenFlash(ctx, 0x6600aa, 0.3, 400)
        }
        continue  // chua s?n s├»┬┐┬╜ng, b? qua to├»┬┐┬╜n b? logic t?n c├»┬┐┬╜ng
      }

      if (e.bossEntered && e.bossBattleReady) {
        // Body slow rotation
        e.body.rotation += 0.003 * dt

        // Phase 1 ? 2 transition at 50% HP
        if ((e.bossPhase ?? 1) === 1 && e.hp <= e.maxHp * 0.5) {
          e.bossPhase = 2
          screenFlash(ctx, 0x660099, 0.6, 700)
          spawnExplosion(ctx, e.container.x, e.container.y, 36, 0x6600aa, 0xcc44ff)
          if (e.bossLabel) {
            e.bossLabel.text = 'Bnox - Tinh v├ón hß║»c ├ím [PHASE 2]'
            e.bossLabel.style = new TextStyle({ fill: 0xff44ff, fontSize: 10, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 'bold', stroke: { color: 0x000011, width: 3 } })
          }
          // Remove lingering black holes
          if (e.blackHoles) {
            for (const bh of e.blackHoles) { bh.gfx.clear(); if (!bh.gfx.destroyed) ctx.gameLayer.removeChild(bh.gfx) }
            e.blackHoles = []
          }
          e.attack2Timer = 420  // first summon in 7s
          e.pendingMissiles = 0
        }

        // Drift
        e.bossDriftTimer = (e.bossDriftTimer ?? 0) - dt
        if ((e.bossDriftTimer ?? 0) <= 0) {
          e.bossDriftTarget = GAME_W * 0.15 + Math.random() * GAME_W * 0.7
          e.bossDriftTimer = 220 + Math.random() * 150
        }
        if (e.bossDriftTarget !== undefined) {
          const ddx = e.bossDriftTarget - e.container.x
          e.container.x += Math.min(Math.abs(ddx), 1.5 * dt) * Math.sign(ddx)
        }

        // -- Gun burst fire (both phases) ------------------------------------
        if (e.tinhVanGuns) {
          const phase2 = (e.bossPhase ?? 1) === 2
          const spd = 3.5 + (phase2 ? 1.2 : 0) + game.currentStage * 0.1
          const spread = phase2 ? 0.20 : 0.13
          for (const gun of e.tinhVanGuns) {
            if (gun.burstLeft > 0) {
              // ├»┬┐┬╜ang trong burst: d?m cooldown gi?a m?i lo?t
              gun.shootTimer -= dt
              if (gun.shootTimer <= 0 && ctx.playerShip) {
                gun.shootTimer = phase2 ? 40 : 36  // 0.67s / 0.6s gi?a m?i lo?t
                gun.burstLeft--
                const worldX = e.container.x + gun.offsetX
                const worldY = e.container.y + gun.offsetY
                const baseAngle = Math.atan2(ctx.playerShip.y - (worldY + 10), ctx.playerShip.x - worldX)
                for (const ao of [-spread, spread]) {
                  const bg = new Graphics()
                  drawEnemyBullet(bg)
                  bg.x = worldX; bg.y = worldY + 10
                  ctx.gameLayer.addChild(bg)
                  ctx.enemyBullets.push({ gfx: bg, vx: Math.cos(baseAngle + ao) * spd, vy: Math.sin(baseAngle + ao) * spd })
                }
                if (phase2) {
                  // Vi├»┬┐┬╜n gi?a b?n th?ng v├»┬┐┬╜o ngu?i choi
                  const bgC = new Graphics()
                  drawEnemyBullet(bgC)
                  bgC.x = worldX; bgC.y = worldY + 10
                  ctx.gameLayer.addChild(bgC)
                  ctx.enemyBullets.push({ gfx: bgC, vx: Math.cos(baseAngle) * spd, vy: Math.sin(baseAngle) * spd })
                }
                if (gun.burstLeft === 0) gun.shootTimer = phase2 ? 240 : 240  // ngh? 4s sau burst
              }
            } else {
              // Ngh?: d?m cooldown, khi xong k├»┬┐┬╜ch ho?t burst
              gun.shootTimer -= dt
              if (gun.shootTimer <= 0) {
                gun.burstLeft = phase2 ? 3 : 2
                gun.shootTimer = 0  // b?n ngay tick sau
              }
            }
          }
        }

        // -- Phase 1: Black hole spawn ----------------------------------------
        if ((e.bossPhase ?? 1) === 1) {
          e.attack1Timer = (e.attack1Timer ?? 600) - dt
          if ((e.attack1Timer ?? 0) <= 0) {
            e.attack1Timer = 600
            const bhX = GAME_W * 0.18 + Math.random() * GAME_W * 0.64
            const bhY = GAME_H * 0.28 + Math.random() * GAME_H * 0.38
            const bhG = new Graphics()
            bhG.x = bhX; bhG.y = bhY
            ctx.gameLayer.addChild(bhG)
            e.blackHoles = e.blackHoles ?? []
            e.blackHoles.push({ gfx: bhG, x: bhX, y: bhY, r: 26, age: 0, maxAge: 180 })
          }
        }

        // -- Black hole update (both phases) ---------------------------------
        if (e.blackHoles) {
          for (let bhi = e.blackHoles.length - 1; bhi >= 0; bhi--) {
            const bh = e.blackHoles[bhi]!
            bh.age += dt
            const lifeR = bh.age / bh.maxAge
            const apparentR = bh.r * Math.min(1, bh.age / 60)
            const fadeA = lifeR > 0.82 ? (1 - lifeR) / 0.18 : 1

            // Portal (phase 2 summon): animate as purple vortex, no age removal, no pull
            if (bh.portal) {
              const pt = bh.age * 0.05
              bh.gfx.clear()
              const pr = apparentR + Math.sin(pt * 2) * 4
              bh.gfx.circle(0, 0, pr * 1.6).fill({ color: 0x330044, alpha: 0.35 })
              bh.gfx.circle(0, 0, pr).fill({ color: 0x440066, alpha: 0.78 })
              bh.gfx.circle(0, 0, pr).stroke({ color: 0xcc44ff, width: 2.5, alpha: 0.9 })
              bh.gfx.circle(0, 0, pr * 0.55).fill({ color: 0x6600aa, alpha: 0.9 })
              bh.gfx.circle(0, 0, pr * 0.28).fill({ color: 0xaa33ff, alpha: 1 })
              continue  // skip age-removal and pull logic
            }

            if (bh.age >= bh.maxAge) {
              if (!bh.gfx.destroyed) ctx.gameLayer.removeChild(bh.gfx)
              e.blackHoles.splice(bhi, 1)
              continue
            }
            const t = bh.age
            const pulse = 0.4 + Math.sin(t * 0.12) * 0.2
            bh.gfx.clear()
            // Pull range indicator (faint ring)
            bh.gfx.circle(0, 0, apparentR * 5).stroke({ color: 0xcc44ff, width: 1, alpha: 0.18 * fadeA })
            bh.gfx.circle(0, 0, apparentR * 1.5).fill({ color: 0x330044, alpha: pulse * 0.5 * fadeA })
            bh.gfx.circle(0, 0, apparentR * 1.2).fill({ color: 0x550066, alpha: pulse * 0.65 * fadeA })
            bh.gfx.circle(0, 0, apparentR).fill({ color: 0x000000, alpha: 0.97 })
            bh.gfx.circle(0, 0, apparentR * 1.05).stroke({ color: 0xcc44ff, width: 1.5, alpha: (0.7 + Math.sin(t * 0.18) * 0.3) * fadeA })

            const pullR = apparentR * 5
            // Pull player toward black hole (harder to escape)
            if (ctx.playerShip) {
              const pdx = bh.x - ctx.playerShip.x
              const pdy = bh.y - ctx.playerShip.y
              const pd = Math.sqrt(pdx * pdx + pdy * pdy) || 1
              if (pd < pullR) {
                // N?u ngu?i choi dang di chuy?n ra ngo├»┬┐┬╜i, kh├»┬┐┬╜ng l?i m?t ph?n
                if (bh.lastPlayerX !== undefined && bh.lastPlayerY !== undefined) {
                  const moveDx = ctx.playerShip.x - bh.lastPlayerX
                  const moveDy = ctx.playerShip.y - bh.lastPlayerY
                  // Th├»┬┐┬╜nh ph?n hu?ng ra ngo├»┬┐┬╜i: duong = dang tho├»┬┐┬╜t kh?i h? den
                  const outwardDot = moveDx * (-pdx / pd) + moveDy * (-pdy / pd)
                  if (outwardDot > 0) {
                    const resistFactor = (1 - pd / pullR) * 0.6 * fadeA
                    ctx.playerShip.x -= (-pdx / pd) * outwardDot * resistFactor
                    ctx.playerShip.y -= (-pdy / pd) * outwardDot * resistFactor
                  }
                }
                const force = (1 - pd / pullR) * 4.0 * dt * fadeA
                ctx.playerShip.x += (pdx / pd) * force
                ctx.playerShip.y += (pdy / pd) * force
                const _xminBh = GAME_W * (1 - 1 / ctx.bossZoom) / 2 + 10
                const _xmaxBh = GAME_W * (1 + 1 / ctx.bossZoom) / 2 - 10
                const _yminBh = GAME_H * (1 - 1 / ctx.bossZoom) / 2 + 40
                const _ymaxBh = GAME_H * (1 + 1 / ctx.bossZoom) / 2 - 40
                ctx.playerShip.x = Math.max(_xminBh, Math.min(_xmaxBh, ctx.playerShip.x))
                ctx.playerShip.y = Math.max(_yminBh, Math.min(_ymaxBh, ctx.playerShip.y))
                bh.lastPlayerX = ctx.playerShip.x
                bh.lastPlayerY = ctx.playerShip.y
              } else {
                bh.lastPlayerX = undefined
                bh.lastPlayerY = undefined
              }
            }
            // Pull non-boss enemies toward black hole
            for (const oe of ctx.enemies) {
              if (oe.kind.startsWith('boss')) continue
              const edx = bh.x - oe.container.x; const edy = bh.y - oe.container.y
              const ed = Math.sqrt(edx * edx + edy * edy) || 1
              if (ed < pullR) {
                const eForce = (1 - ed / pullR) * 2.8 * dt * fadeA
                oe.container.x += (edx / ed) * eForce
                oe.container.y += (edy / ed) * eForce
              }
            }
            // Pull player bullets toward black hole, absorb at core
            for (let bi = ctx.bullets.length - 1; bi >= 0; bi--) {
              const b = ctx.bullets[bi]!
              const bdx = bh.x - b.gfx.x; const bdy = bh.y - b.gfx.y
              const bd = Math.sqrt(bdx * bdx + bdy * bdy) || 1
              if (bd < pullR) {
                const bhPull = (1 - bd / pullR) * 5 * dt
                b.vx = (b.vx ?? 0) + (bdx / bd) * bhPull
                b.vy -= (bdy / bd) * bhPull  // player bullet gfx.y -= vy*dt
              }
              if (bd < apparentR * 1.8) {
                if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
                ctx.bullets.splice(bi, 1)
              }
            }
            // Pull shooter missiles toward black hole, absorb at core
            for (let mi = ctx.shooterMissiles.length - 1; mi >= 0; mi--) {
              const m = ctx.shooterMissiles[mi]!
              const mdx = bh.x - m.gfx.x; const mdy = bh.y - m.gfx.y
              const md = Math.sqrt(mdx * mdx + mdy * mdy) || 1
              if (md < pullR) {
                const mPull = (1 - md / pullR) * 5 * dt
                m.vx += (mdx / md) * mPull
                m.vy += (mdy / md) * mPull
              }
              if (md < apparentR * 1.8) {
                if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
                ctx.shooterMissiles.splice(mi, 1)
              }
            }
            // Pull fragment missiles toward black hole, absorb at core
            for (let mi = ctx.fragmentMissiles.length - 1; mi >= 0; mi--) {
              const m = ctx.fragmentMissiles[mi]!
              const mdx = bh.x - m.gfx.x; const mdy = bh.y - m.gfx.y
              const md = Math.sqrt(mdx * mdx + mdy * mdy) || 1
              if (md < pullR) {
                const mPull = (1 - md / pullR) * 5 * dt
                m.vx += (mdx / md) * mPull
                m.vy += (mdy / md) * mPull
              }
              if (md < apparentR * 1.8) {
                if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
                ctx.fragmentMissiles.splice(mi, 1)
              }
            }
            // Pull player card missiles toward black hole, absorb at core
            for (let mi = ctx.playerMissiles.length - 1; mi >= 0; mi--) {
              const m = ctx.playerMissiles[mi]!
              const mdx = bh.x - m.gfx.x; const mdy = bh.y - m.gfx.y
              const md = Math.sqrt(mdx * mdx + mdy * mdy) || 1
              if (md < pullR) {
                const mPull = (1 - md / pullR) * 5 * dt
                m.vx += (mdx / md) * mPull
                m.vy += (mdy / md) * mPull
              }
              if (md < apparentR * 1.8) {
                if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
                ctx.playerMissiles.splice(mi, 1)
              }
            }
            // Enemy bullets are NOT pulled by black holes ├»┬┐┬╜ only player projectiles are affected
          }
        }

        // -- Phase 2: Nebula portal summon (30s cooldown) ---------------------
        if ((e.bossPhase ?? 1) === 2) {
          if ((e.pendingMissiles ?? 0) === 0) {
            e.attack2Timer = (e.attack2Timer ?? 1800) - dt
            if ((e.attack2Timer ?? 0) <= 0) {
              e.pendingMissiles = 4   // 4 spawn calls ? ~7 Bnox enemies
              e.missileFireTimer = 50
              // Create 2 portal black holes at random screen positions
              e.blackHoles = e.blackHoles ?? []
              for (let pi = 0; pi < 2; pi++) {
                const pX = GAME_W * 0.15 + Math.random() * GAME_W * 0.70
                const pY = GAME_H * 0.02 + Math.random() * GAME_H * 0.10  // m? c?ng ? tr├»┬┐┬╜n c├»┬┐┬╜ng
                const pGfx = new Graphics()
                pGfx.x = pX; pGfx.y = pY
                ctx.gameLayer.addChild(pGfx)
                e.blackHoles.push({ gfx: pGfx, x: pX, y: pY, r: 28, age: 0, maxAge: 99999, portal: true })
              }
              screenFlash(ctx, 0x440066, 0.35, 400)
            }
          } else {
            e.missileFireTimer = (e.missileFireTimer ?? 0) - dt
            if ((e.missileFireTimer ?? 0) <= 0) {
              e.missileFireTimer = 22
              e.pendingMissiles!--
              if (ctx.enemies.length >= getEnemyCountCap(game.currentStage)) {
                e.missileFireTimer = 28
                continue
              }
              // Pick a random portal position and spawn enemies from it
              const portals = (e.blackHoles ?? []).filter(bh => bh.portal)
              const portal = portals[Math.floor(Math.random() * portals.length)]
              const spawnX = portal ? portal.x : e.container.x
              const spawnY = portal ? portal.y : (e.container.y + 60)
              const beforeCount = ctx.enemies.length
              const r = Math.random()
              let spawnType: string
              if (r < 0.3) { spawnDaiLienPair(ctx, game); spawnType = 'dai_lien' }
              else if (r < 0.72) { spawnThuatSi(ctx, game); spawnType = 'thuat_si' }
              else { spawnThuHoSwarm(ctx, game); spawnType = 'thu_ho' }
              const summonedPackId = ctx.nextSquadId++
              // Teleport newly spawned enemies to portal, m?i lo?i gi? v? tr├»┬┐┬╜ chi?n thu?t c?a m├»┬┐┬╜nh
              for (let ni = beforeCount; ni < ctx.enemies.length; ni++) {
                const ne = ctx.enemies[ni]!
                ne.container.x = spawnX + (Math.random() - 0.5) * 30
                ne.container.y = spawnY
                const atkX = GAME_W * 0.10 + Math.random() * GAME_W * 0.80
                // Li├»┬┐┬╜n x?: gi? t?m cao; Th? h?: t?m gi?a ch?n d?n; Thu?t si: t?m du?i d? h?i m├»┬┐┬╜u
                const atkY = spawnType === 'dai_lien'
                  ? GAME_H * 0.15 + Math.random() * GAME_H * 0.15
                  : spawnType === 'thu_ho'
                  ? GAME_H * 0.35 + Math.random() * GAME_H * 0.18
                  : GAME_H * 0.48 + Math.random() * GAME_H * 0.18
                ne.enterTargetX = atkX
                ne.enterTargetY = atkY
                ne.formTargetX = atkX
                ne.formTargetY = atkY
                ne.pioneerPhase = 'enter'
                ne.squadId = summonedPackId
              }

              if ((e.pendingMissiles ?? 0) === 0) {
                // Remove portals from blackHoles
                if (e.blackHoles) {
                  for (let pi = e.blackHoles.length - 1; pi >= 0; pi--) {
                    if (e.blackHoles[pi]!.portal) {
                      if (!e.blackHoles[pi]!.gfx.destroyed) ctx.gameLayer.removeChild(e.blackHoles[pi]!.gfx)
                      e.blackHoles.splice(pi, 1)
                    }
                  }
                }
                e.attack2Timer = 1800  // 30s cooldown
              }
            }
          }
        }
      }
    }

    else if (e.kind === 'boss_trumso') {
      // -- Entry --------------------------------------------------------------
      if (!e.bossEntered) {
        e.container.y += 1.2 * dt
        if (e.container.y >= (e.bossTargetY ?? GAME_H * 0.20)) {
          e.container.y = e.bossTargetY ?? GAME_H * 0.20
          e.bossEntered = true
        }
        // B?t t? khi t├»┬┐┬╜i xu?t: h?p th? d?n (kh├»┬┐┬╜ng xuy├»┬┐┬╜n qua) nhung kh├»┬┐┬╜ng nh?n s├»┬┐┬╜t thuong
        for (let j = ctx.bullets.length - 1; j >= 0; j--) {
          if (dist2(ctx.bullets[j].gfx.x, ctx.bullets[j].gfx.y, e.container.x, e.container.y) < 45 * 45) {
            spawnExplosion(ctx, ctx.bullets[j].gfx.x, ctx.bullets[j].gfx.y, 4, 0x8888bb, 0xaaaadd)
            if (!ctx.bullets[j].gfx.destroyed) ctx.gameLayer.removeChild(ctx.bullets[j].gfx)
            ctx.bullets.splice(j, 1)
          }
        }
        continue  // chua v├»┬┐┬╜o v? tr├»┬┐┬╜, kh├»┬┐┬╜ng t?n c├»┬┐┬╜ng
      }
      if (e.bossEntered) {
        // -- Phase 2 transition at 50% HP ----------------------------------
        if ((e.bossPhase ?? 1) === 1 && e.hp <= e.maxHp * 0.5) {
          e.bossPhase = 2
          screenFlash(ctx, 0x6600cc, 0.55, 700)
          spawnExplosion(ctx, e.container.x, e.container.y, 34, 0x6600cc, 0xcc44ff)
          if (e.bossLabel) {
            e.bossLabel.text = 'Bnox - Tr├╣m s├▓ [PHASE 2]'
            e.bossLabel.style = new TextStyle({ fill: 0xff88ff, fontSize: 10, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 'bold', stroke: { color: 0x000011, width: 3 } })
          }
          if (e.trumSoLasers) {
            for (const laser of e.trumSoLasers) { laser.gfx.clear(); laser.state = 'idle' }
          }
          e.trumSoChargeTimer = 900
          e.trumSoContinuousDmgTimer = 30
        }

        // -- Horizontal drift (skipped during charge) ----------------------
        if (e.trumSoCharge !== 'charging') {
          e.bossDriftTimer = (e.bossDriftTimer ?? 0) - dt
          if ((e.bossDriftTimer ?? 0) <= 0) {
            e.bossDriftTarget = GAME_W * 0.12 + Math.random() * GAME_W * 0.76
            e.bossDriftTimer = 200 + Math.random() * 120
          }
          if (e.bossDriftTarget !== undefined && e.trumSoCharge === 'idle') {
            const ddx = e.bossDriftTarget - e.container.x
            e.container.x += Math.min(Math.abs(ddx), 2.2 * dt) * Math.sign(ddx)
          }
        }

        // -- Machine gun turrets --------------------------------------------
        if (e.trumSoGuns && e.trumSoCharge === 'idle') {
          for (const gun of e.trumSoGuns.filter(g => g.type === 'machinegun')) {
            if (ctx.playerShip) {
              const adx = ctx.playerShip.x - (e.container.x + gun.offsetX)
              const ady = ctx.playerShip.y - (e.container.y + gun.offsetY)
              gun.gfx.rotation = Math.atan2(ady, adx) - Math.PI / 2
            }
            // C? 2 phase: b?n h├»┬┐┬╜nh n├»┬┐┬╜n 2 l?n (c├»┬┐┬╜ch 0.5s), ngh? 3s
            const coneCount = (e.bossPhase ?? 1) === 2 ? 5 : 3  // s? vi├»┬┐┬╜n m?i l?n b?n
            const coneSpread = (e.bossPhase ?? 1) === 2 ? 0.30 : 0.22  // g├»┬┐┬╜c n├»┬┐┬╜n t?ng (rad)
            const spd = ((e.bossPhase ?? 1) === 2 ? 5 : 4.5) + game.currentStage * 0.05
            if (gun.burstLeft > 0) {
              gun.rapidTimer -= dt
              if (gun.rapidTimer <= 0) {
                gun.rapidTimer = 30  // 0.5s gi?a m?i l?n b?n
                gun.burstLeft--
                if (ctx.playerShip) {
                  const wx = e.container.x + gun.offsetX
                  const wy = e.container.y + gun.offsetY
                  const baseAngle = Math.atan2(ctx.playerShip.y - wy, ctx.playerShip.x - wx)
                  for (let ci = 0; ci < coneCount; ci++) {
                    const norm = coneCount > 1 ? (ci / (coneCount - 1) - 0.5) : 0
                    const angle = baseAngle + norm * coneSpread
                    const bg = new Graphics()
                    drawEnemyBullet(bg)
                    bg.x = wx; bg.y = wy
                    ctx.gameLayer.addChild(bg)
                    ctx.enemyBullets.push({ gfx: bg, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd })
                  }
                }
              }
            } else {
              gun.timer -= dt
              if (gun.timer <= 0) { gun.timer = 180; gun.burstLeft = 2; gun.rapidTimer = 30 }  // ngh? 3s
            }
          }
        }

          if (e.trumSoCharge === 'idle') {
          // -- Missile salvos -----------------------------------------------
          if ((e.pendingMissiles ?? 0) > 0) {
            e.missileFireTimer = (e.missileFireTimer ?? 0) - dt
            if ((e.missileFireTimer ?? 0) <= 0) {
              e.missileFireTimer = 25
              const missilePods = e.trumSoGuns!.filter(g => g.type === 'missile')
              const podIdx = 2 - (e.pendingMissiles ?? 1)
              const pod = missilePods[podIdx]
              if (pod) {
                const wx = e.container.x + pod.offsetX
                const wy = e.container.y + pod.offsetY
                const tx = e.laserTargetX ?? GAME_W / 2
                const ty = e.laserTargetY ?? GAME_H / 2
                const dx = tx - wx; const dy = ty - wy
                const mag = Math.sqrt(dx * dx + dy * dy) || 1
                const mg = new Graphics()
                drawTrumSoMissile(mg)
                mg.x = wx; mg.y = wy
                mg.rotation = Math.atan2(dy, dx) + Math.PI / 2
                ctx.gameLayer.addChild(mg)
                ctx.enemyBullets.push({ gfx: mg, vx: (dx / mag) * 4.2, vy: (dy / mag) * 4.2, aoe: true, targetX: tx, targetY: ty })
              }
              e.pendingMissiles!--
            }
          }
          e.attack2Timer = (e.attack2Timer ?? 300) - dt
          if ((e.attack2Timer ?? 0) <= 0 && (e.pendingMissiles ?? 0) === 0) {
            const tx = ctx.playerShip?.x ?? GAME_W / 2
            const ty = ctx.playerShip?.y ?? GAME_H / 2
            e.laserTargetX = tx; e.laserTargetY = ty
            e.pendingMissiles = 2; e.missileFireTimer = 0
            e.attack2Timer = 300
            spawnMissileWarning(ctx, tx, ty)
          }
          }

        // -- Phase 1: Simultaneous salvo lasers (all fire at once) ------------
        if ((e.bossPhase ?? 1) === 1 && e.trumSoLasers) {
          const len = GAME_W + GAME_H
          // Tick idle timers independently
          for (const laser of e.trumSoLasers) {
            if (laser.state === 'idle') laser.timer -= dt
          }
          // When any idle laser is ready and none are active ? trigger ALL at once
          const anyActive = e.trumSoLasers.some(l => l.state !== 'idle')
          if (!anyActive && e.trumSoLasers.some(l => l.timer <= 0) && e.trumSoCharge === 'idle') {
            screenFlash(ctx, 0x5500aa, 0.15, 160)
            for (const laser of e.trumSoLasers) {
              const wx = e.container.x + laser.offsetX
              const wy = e.container.y + laser.offsetY
              const tx = GAME_W * 0.08 + Math.random() * GAME_W * 0.84
              const ty = GAME_H * 0.30 + Math.random() * GAME_H * 0.55
              laser.state = 'warning'; laser.timer = 60
              laser.angle = Math.atan2(ty - wy, tx - wx)
            }
          }
          // Update warning + firing states
          for (const laser of e.trumSoLasers) {
            if (laser.state === 'idle') continue
            const wx = e.container.x + laser.offsetX
            const wy = e.container.y + laser.offsetY
            if (laser.state === 'warning') {
              laser.timer -= dt
              const al = 0.28 + Math.abs(Math.sin(laser.timer * 0.15)) * 0.4
              laser.gfx.clear()
              laser.gfx.moveTo(wx, wy).lineTo(wx + Math.cos(laser.angle) * len, wy + Math.sin(laser.angle) * len).stroke({ color: 0xaa44ff, width: 2, alpha: al })
              if (laser.timer <= 0) { laser.state = 'firing'; laser.timer = 18 }
            } else {
              laser.timer -= dt
              const al = Math.max(0, laser.timer / 18) * 0.9
              laser.gfx.clear()
              laser.gfx.moveTo(wx, wy).lineTo(wx + Math.cos(laser.angle) * len, wy + Math.sin(laser.angle) * len).stroke({ color: 0xcc44ff, width: 6, alpha: al })
              if (ctx.playerShip) {
                const px = ctx.playerShip.x - wx; const py = ctx.playerShip.y - wy
                const lx = Math.cos(laser.angle); const ly = Math.sin(laser.angle)
                const dot = px * lx + py * ly
                const perpX = px - dot * lx; const perpY = py - dot * ly
                if (Math.sqrt(perpX * perpX + perpY * perpY) < 20 && dot > 0) {
                  const dmg = 16 + game.currentStage * 2
                  applyLaserHitToPlayer(dmg, { flashColor: 0x8844ff, flashAlpha: 0.28, flashMs: 200, shieldOuterColor: 0x8844ff, shieldInnerColor: 0xcc88ff })
                }
              }
              if (laser.timer <= 0) { laser.state = 'idle'; laser.timer = 70 + Math.random() * 50; laser.gfx.clear() }
            }
          }
        }

        // -- Phase 2: Core mega-laser (warning ? fire, instant-kill) ----------
        if ((e.bossPhase ?? 1) === 2 && e.trumSoPhase2LaserGfx) {
          const bx = e.container.x; const by = e.container.y
          const len = GAME_W + GAME_H
          if (e.trumSoPhase2LaserState === 'idle' || e.trumSoPhase2LaserState === undefined) {
            e.trumSoContinuousDmgTimer = (e.trumSoContinuousDmgTimer ?? 400) - dt
            e.trumSoPhase2LaserGfx.clear()
            if ((e.trumSoContinuousDmgTimer ?? 0) <= 0 && e.trumSoCharge === 'idle') {
              const tx = GAME_W * 0.06 + Math.random() * GAME_W * 0.88
              const ty = GAME_H * 0.25 + Math.random() * GAME_H * 0.55
              e.trumSoPhase2LaserAngle = Math.atan2(ty - by, tx - bx)
              e.trumSoPhase2LaserState = 'warning'
              e.trumSoContinuousDmgTimer = 70
              screenFlash(ctx, 0x440099, 0.22, 300)
            }
          } else if (e.trumSoPhase2LaserState === 'warning') {
            e.trumSoContinuousDmgTimer = (e.trumSoContinuousDmgTimer ?? 70) - dt
            const angle = e.trumSoPhase2LaserAngle ?? 0
            const al = 0.25 + Math.abs(Math.sin((e.trumSoContinuousDmgTimer ?? 0) * 0.13)) * 0.5
            e.trumSoPhase2LaserGfx.clear()
            e.trumSoPhase2LaserGfx.moveTo(bx, by).lineTo(bx + Math.cos(angle) * len, by + Math.sin(angle) * len).stroke({ color: 0x8800ff, width: 28, alpha: al * 0.3 })
            e.trumSoPhase2LaserGfx.moveTo(bx, by).lineTo(bx + Math.cos(angle) * len, by + Math.sin(angle) * len).stroke({ color: 0xdd44ff, width: 5, alpha: al })
            if ((e.trumSoContinuousDmgTimer ?? 0) <= 0) {
              e.trumSoPhase2LaserState = 'firing'
              e.trumSoContinuousDmgTimer = 22
              screenFlash(ctx, 0x6600cc, 0.4, 200)
            }
          } else {
            // 'firing'
            e.trumSoContinuousDmgTimer = (e.trumSoContinuousDmgTimer ?? 22) - dt
            const angle = e.trumSoPhase2LaserAngle ?? 0
            const al = Math.max(0, (e.trumSoContinuousDmgTimer ?? 0) / 22)
            e.trumSoPhase2LaserGfx.clear()
            e.trumSoPhase2LaserGfx.moveTo(bx, by).lineTo(bx + Math.cos(angle) * len, by + Math.sin(angle) * len).stroke({ color: 0x6600cc, width: 54, alpha: al * 0.28 })
            e.trumSoPhase2LaserGfx.moveTo(bx, by).lineTo(bx + Math.cos(angle) * len, by + Math.sin(angle) * len).stroke({ color: 0xee88ff, width: 18, alpha: al * 0.95 })
            e.trumSoPhase2LaserGfx.moveTo(bx, by).lineTo(bx + Math.cos(angle) * len, by + Math.sin(angle) * len).stroke({ color: 0xffffff, width: 4, alpha: al * 0.85 })
            if (ctx.playerShip) {
              const lx = Math.cos(angle); const ly = Math.sin(angle)
              const px = ctx.playerShip.x - bx; const py = ctx.playerShip.y - by
              const dot = px * lx + py * ly
              const perpX = px - dot * lx; const perpY = py - dot * ly
              if (Math.sqrt(perpX * perpX + perpY * perpY) < 22 && dot > 0) {
                applyLaserHitToPlayer(game.playerMaxHp, {
                  force: true,
                  flashColor: 0x8800ff,
                  flashAlpha: 0.45,
                  flashMs: 300,
                  shieldOuterColor: 0x8800ff,
                  shieldInnerColor: 0xee66ff,
                })
              }
            }
            if ((e.trumSoContinuousDmgTimer ?? 0) <= 0) {
              e.trumSoPhase2LaserGfx.clear()
              e.trumSoPhase2LaserState = 'idle'
              e.trumSoContinuousDmgTimer = 140 + Math.random() * 70
            }
          }
        }

        // -- Phase 2: Charge dash ------------------------------------------
        if ((e.bossPhase ?? 1) === 2) {
          if (e.trumSoCharge === 'idle') {
            e.trumSoChargeTimer = (e.trumSoChargeTimer ?? 900) - dt
            if ((e.trumSoChargeTimer ?? 0) <= 0) {
              e.trumSoCharge = 'warning'; e.trumSoChargeTimer = 90
              e.trumSoChargeLane = GAME_W * 0.12 + Math.random() * GAME_W * 0.76
              e.bossDriftTarget = e.container.x
            }
          } else if (e.trumSoCharge === 'warning') {
            e.trumSoChargeTimer = (e.trumSoChargeTimer ?? 0) - dt
            if (e.trumSoChargeLineGfx) {
              const lane = e.trumSoChargeLane ?? GAME_W / 2
              const al = 0.3 + Math.abs(Math.sin((e.trumSoChargeTimer ?? 0) * 0.18)) * 0.5
              e.trumSoChargeLineGfx.clear()
              // Width matches the boss collision radius (52px each side = 104px total)
              e.trumSoChargeLineGfx.rect(lane - 52, 0, 104, GAME_H).fill({ color: 0xff44ff, alpha: al * 0.18 })
              e.trumSoChargeLineGfx.moveTo(lane - 52, 0).lineTo(lane - 52, GAME_H).stroke({ color: 0xff44ff, width: 1.5, alpha: al })
              e.trumSoChargeLineGfx.moveTo(lane + 52, 0).lineTo(lane + 52, GAME_H).stroke({ color: 0xff44ff, width: 1.5, alpha: al })
            }
            if (e.trumSoChargeLane !== undefined) {
              const ddx = e.trumSoChargeLane - e.container.x
              e.container.x += Math.min(Math.abs(ddx), 3.5 * dt) * Math.sign(ddx)
            }
            if ((e.trumSoChargeTimer ?? 0) <= 0) {
              e.trumSoCharge = 'charging'
              if (e.trumSoChargeLineGfx) e.trumSoChargeLineGfx.clear()
              screenFlash(ctx, 0x8800ff, 0.32, 300)
            }
          } else if (e.trumSoCharge === 'charging') {
            e.container.y += 18 * dt
            if (ctx.playerShip && dist2(e.container.x, e.container.y, ctx.playerShip.x, ctx.playerShip.y) < 52 * 52) {
              if (isTracerSkillInvulnerable()) {
                // Thiên Hà Truy is invulnerable while skill is active.
              } else if (!game.absorbShieldHit()) {
                const dmg = Math.max(1, Math.round((25 + game.currentStage * 2) * getEnemyDamageScale(e, cachedThreatProfile)))
                game.takeDamage(dmg); screenFlash(ctx)
                spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, dmg)
              } else {
                spawnExplosion(ctx, ctx.playerShip.x, ctx.playerShip.y, 12, 0x8800ff, 0xcc66ff)
                screenFlash(ctx, 0x8800ff, 0.35, 200)
              }
            }
            if (e.container.y > GAME_H + 85) {
              e.container.y = -160   // fully off-screen (size=55, wings to 74px)
              e.bossEntered = false  // re-trigger entry slide-in to bossTargetY
              e.trumSoCharge = 'idle'; e.trumSoChargeTimer = 900
              e.bossDriftTimer = 60
            }
          }
        }
      }
    }
    if (!e.kind.startsWith('boss_') && !e.isDyingMeteor && e.kind !== 'kamikaze') {
      clampEnemyInsideHorizontalView(e)
      resolveEnemyWallStuck(e)
    }

    // -- Hit by player bullets ----------------------------------------------
    let killed = false
    // Th? H? reflect: during swarm reflect phase, bullets are bounced back
    if (e.kind === 'thu_ho' && ctx.thuHoReflecting) {
      for (let j = ctx.bullets.length - 1; j >= 0; j--) {
        if (dist2(ctx.bullets[j]!.gfx.x, ctx.bullets[j]!.gfx.y, e.container.x, e.container.y) < 16 * 16) {
          const b = ctx.bullets[j]!
          const rb = new Graphics()
          drawEnemyBullet(rb)
          rb.x = b.gfx.x; rb.y = b.gfx.y
          ctx.gameLayer.addChild(rb)
          // Proper angle reflection: reverse incoming velocity vector; 50% dmg
          ctx.enemyBullets.push({ gfx: rb, vx: -(b.vx ?? 0), vy: Math.abs(b.vy) * 1.1, damage: Math.max(1, Math.round(bulletDmg * 0.5)) })
          if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
          ctx.bullets.splice(j, 1)
        }
      }
      // Reflect shooter missiles (Star Shooter) ├»┬┐┬╜ loses homing
      for (let j = ctx.shooterMissiles.length - 1; j >= 0; j--) {
        const m = ctx.shooterMissiles[j]!
        if (dist2(m.gfx.x, m.gfx.y, e.container.x, e.container.y) < 20 * 20) {
          const rb = new Graphics()
          drawBossMissile(rb, true)
          rb.x = m.gfx.x; rb.y = m.gfx.y
          ctx.gameLayer.addChild(rb)
          ctx.enemyBullets.push({ gfx: rb, vx: -m.vx, vy: Math.abs(m.vy) * 1.1, homing: false, damage: Math.max(1, Math.round(m.damage * 0.5)) })
          if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
          ctx.shooterMissiles.splice(j, 1)
        }
      }
      // Reflect player card missiles ├»┬┐┬╜ loses homing
      for (let j = ctx.playerMissiles.length - 1; j >= 0; j--) {
        const m = ctx.playerMissiles[j]!
        if (dist2(m.gfx.x, m.gfx.y, e.container.x, e.container.y) < 20 * 20) {
          const rb = new Graphics()
          drawBossMissile(rb, true)
          rb.x = m.gfx.x; rb.y = m.gfx.y
          ctx.gameLayer.addChild(rb)
          ctx.enemyBullets.push({ gfx: rb, vx: -m.vx, vy: Math.abs(m.vy) * 1.1, homing: false, damage: Math.max(1, Math.round(m.damage * 0.5)) })
          if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
          ctx.playerMissiles.splice(j, 1)
        }
      }
      // Skip further damage processing this frame
    } else if (e.kind === 'boss_invader' && e.bossTurrets) {
      for (let j = ctx.bullets.length - 1; j >= 0; j--) {
        let tHit = false
        for (const t of e.bossTurrets) {
          if (t.stunTimer > 0) continue
          const wx = e.container.x + t.offsetX; const wy = e.container.y + t.offsetY
          if (dist2(ctx.bullets[j].gfx.x, ctx.bullets[j].gfx.y, wx, wy) < 12 * 12) {
            const bullet = ctx.bullets[j]!
            const bulletBaseDmg = bullet.damage ?? bulletDmg
            const effectiveDmg = Math.round(bulletBaseDmg * (bullet.pierceDmgMult ?? 1))
            t.hp = Math.max(0, t.hp - effectiveDmg)
            spawnDamageText(ctx, wx, wy - 16, effectiveDmg)

            redrawHpBar(t.hpBarBg, t.hpBar, t.hp / t.maxHp, 24)
            // Bosses cannot be pierced
            if (!bullet.gfx.destroyed) ctx.gameLayer.removeChild(bullet.gfx)
            ctx.bullets.splice(j, 1)
            if (t.hp <= 0) {
              t.stunTimer = 200; t.laserState = 'idle'; t.laserGfx.clear()
              t.gfx.clear()
              t.gfx.circle(0, 0, 10).fill(0x444444)
              t.gfx.circle(0, 0, 6).fill(0x777777)
              t.gfx.rect(-2.2, 0, 4.4, 8.5).fill(0x555555)
              const xs = 3.5
              t.gfx.moveTo(-xs, -xs).lineTo(xs, xs).stroke({ color: 0xff4444, width: 2 })
              t.gfx.moveTo(xs, -xs).lineTo(-xs, xs).stroke({ color: 0xff4444, width: 2 })
              spawnExplosion(ctx, wx, wy, 12, 0x4499ff, 0x88ddff)
            }
            tHit = true; break
          }
        }
        if (tHit) break
      }
    } else if (e.kind === 'boss_cnox_sun') {
      const crystals = e.sunEnergyCrystals ?? []
      if ((e.bossPhase ?? 1) === 2 && crystals.length >= 2) {
        for (let j = ctx.bullets.length - 1; j >= 0; j--) {
          const b = ctx.bullets[j]!
          let blocked = false
          for (let ci = 0; ci < crystals.length - 1; ci++) {
            const a = crystals[ci]!
            const c = crystals[ci + 1]!
            const d = pointDistanceToSegment(b.gfx.x, b.gfx.y, a.x, a.y, c.x, c.y)
            if (d < 8) {
              spawnExplosion(ctx, b.gfx.x, b.gfx.y, 7, 0x66d0ff, 0xffffff)
              if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
              ctx.bullets.splice(j, 1)
              blocked = true
              break
            }
          }
          if (blocked) continue
        }
      }

      for (let j = ctx.bullets.length - 1; j >= 0; j--) {
        const b = ctx.bullets[j]!
        let hitCrystal = false
        for (let ci = crystals.length - 1; ci >= 0; ci--) {
          const c = crystals[ci]!
          if (dist2(b.gfx.x, b.gfx.y, c.x, c.y) < 17 * 17) {
            const bulletBaseDmg = b.damage ?? bulletDmg
            const effectiveDmg = Math.round(bulletBaseDmg * (b.pierceDmgMult ?? 1))
            c.hp = Math.max(0, c.hp - effectiveDmg)
            spawnDamageText(ctx, c.x, c.y - 14, effectiveDmg)
            if (c.hp <= 0) {
              spawnExplosion(ctx, c.x, c.y, 20, 0x66c7ff, 0xe9f8ff)
              if (!c.gfx.destroyed) ctx.gameLayer.removeChild(c.gfx)
              crystals.splice(ci, 1)
            }
            if (isKeeper || isFaster) audioManager.playShipHit('star_keeper')
            if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
            ctx.bullets.splice(j, 1)
            hitCrystal = true
            break
          }
        }
        if (hitCrystal) continue
      }

      if (!isBossIntro && ctx.playerShip) {
        for (let ci = crystals.length - 1; ci >= 0; ci--) {
          const c = crystals[ci]!
          c.contactDamageCd = Math.max(0, (c.contactDamageCd ?? 0) - dt)
          if ((c.contactDamageCd ?? 0) > 0) continue
          if (dist2(ctx.playerShip.x, ctx.playerShip.y, c.x, c.y) < 30 * 30) {
            c.contactDamageCd = 14
            const crystalDmg = Math.max(8, Math.round(game.upgrades.damage * 0.55))
            c.hp = Math.max(0, c.hp - crystalDmg)
            spawnDamageText(ctx, c.x, c.y - 14, crystalDmg)
            if (c.hp <= 0) {
              spawnExplosion(ctx, c.x, c.y, 20, 0x66c7ff, 0xe9f8ff)
              if (!c.gfx.destroyed) ctx.gameLayer.removeChild(c.gfx)
              crystals.splice(ci, 1)
            }

            if (game.absorbShieldHit()) {
              spawnExplosion(ctx, ctx.playerShip.x, ctx.playerShip.y, 10, 0x44aaff, 0x88ddff)
              screenFlash(ctx, 0x4488ff, 0.2, 140)
            } else if (!isTracerSkillInvulnerable()) {
              const pDmg = Math.max(1, Math.round((12 + game.currentStage) * cachedThreatProfile.damageMult))
              game.takeDamage(pDmg)
              screenFlash(ctx)
              spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, pDmg)
            }
          }
        }
      }
    } else if (e.kind === 'cnox_shield') {
      if (e.cnoxShields?.length) {
        for (let j = ctx.bullets.length - 1; j >= 0; j--) {
          const bullet = ctx.bullets[j]!
          let blocked = false
          for (const shield of e.cnoxShields) {
            const sx = e.container.x + shield.x
            const sy = e.container.y + shield.y
            if (dist2(bullet.gfx.x, bullet.gfx.y, sx, sy) < 14 * 14) {
              spawnExplosion(ctx, sx, sy, 7, 0x66bbff, 0xe8fbff)
              if (!bullet.gfx.destroyed) ctx.gameLayer.removeChild(bullet.gfx)
              ctx.bullets.splice(j, 1)
              blocked = true
              break
            }
          }
          if (blocked) continue
        }
      }
    }
    for (let j = ctx.bullets.length - 1; j >= 0; j--) {
      const bulletHitR = e.kind === 'boss_tinhvan' ? 68 : (e.kind === 'boss_stardestroyer' || e.kind === 'boss_invader' || e.kind === 'boss_trumso' ? 54 : (e.kind === 'boss_cnox_sun' ? 72 : 15))
      if (dist2(ctx.bullets[j].gfx.x, ctx.bullets[j].gfx.y, e.container.x, e.container.y) < bulletHitR * bulletHitR) {
        const bullet = ctx.bullets[j]!
        const bulletBaseDmg = bullet.damage ?? bulletDmg
        const isBoss = e.kind.startsWith('boss_')
        let woundMult = 1
        if (game.selectedShip === 'star_faster' && game.cardStats.fasterDeepWound && bullet.damage == null) {
          const perHitBonus = isBoss ? 0.025 : 0.05
          const maxBonus = isBoss ? 0.5 : 1.0
          const nextBonus = Math.min(maxBonus, (e.starFasterWoundBonus ?? 0) + perHitBonus)
          e.starFasterWoundBonus = nextBonus
          woundMult += nextBonus
        }
        const effectiveDmg = Math.round(bulletBaseDmg * (bullet.pierceDmgMult ?? 1) * woundMult)
        e.hp = Math.max(0, e.hp - effectiveDmg)
        updateDnoxFireHeat(e, effectiveDmg, ctx, game)
        const dmgOffY = e.kind === 'boss_tinhvan' ? 75 : (e.kind === 'boss_stardestroyer' || e.kind === 'boss_invader' || e.kind === 'boss_trumso' ? 60 : (e.kind === 'boss_cnox_sun' ? 68 : 14))
        spawnDamageText(ctx, e.container.x, e.container.y - dmgOffY, effectiveDmg)
        hitFlash(e.body)
        redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
        if (isKeeper || isFaster) audioManager.playShipHit('star_keeper')

        if (game.cardStats.bulletPierceOnKill && !isBoss) {
          bullet.pierceDmgMult = (bullet.pierceDmgMult ?? 1) * 0.75
          bullet.pierceLeft = Math.max(0, (bullet.pierceLeft ?? 2) - 1)
          if ((bullet.pierceLeft ?? 0) <= 0) {
            if (!bullet.gfx.destroyed) ctx.gameLayer.removeChild(bullet.gfx)
            ctx.bullets.splice(j, 1)
          } else {
            bullet.gfx.y = e.container.y - bulletHitR - 1  // snap past hitbox to prevent re-hit same target
          }
        } else {
          if (!bullet.gfx.destroyed) ctx.gameLayer.removeChild(bullet.gfx)
          ctx.bullets.splice(j, 1)
        }
        if (e.hp <= 0) { killEnemy(ctx, game, e, i); killed = true; break }
      }
    }
    if (killed) continue

    if (starFasterSkillActive || tracerFreezeActive) {
      e.container.x = enemyPrevX + (e.container.x - enemyPrevX) * enemyTimeScale
      e.container.y = enemyPrevY + (e.container.y - enemyPrevY) * enemyTimeScale
    }

    // Contact damage: all hp enemies can damage and be damaged on collision with player
    if (!isBossIntro && ctx.playerShip && (e.contactDamageCd ?? 0) <= 0) {
      const playerCollisionR = 14
      const enemyCollisionR = getEnemyCollisionRadius(e)
      if (dist2(e.container.x, e.container.y, ctx.playerShip.x, ctx.playerShip.y) < (playerCollisionR + enemyCollisionR) * (playerCollisionR + enemyCollisionR)) {
        e.contactDamageCd = 14

        const dmgToEnemy = getCollisionDamageToEnemy(game.upgrades.damage, e)
        e.hp = Math.max(0, e.hp - dmgToEnemy)
        updateDnoxFireHeat(e, dmgToEnemy, ctx, game)
        hitFlash(e.body)
        redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
        const dmgOffY = e.kind === 'boss_tinhvan' ? 75 : (e.kind === 'boss_stardestroyer' || e.kind === 'boss_invader' || e.kind === 'boss_trumso' ? 60 : (e.kind === 'boss_cnox_sun' ? 68 : 14))
        spawnDamageText(ctx, e.container.x, e.container.y - dmgOffY, dmgToEnemy)

        if (isTracerSkillInvulnerable()) {
          // Thi├¬n H├á Truy is invulnerable while skill is active.
        } else if (game.absorbShieldHit()) {
          spawnExplosion(ctx, ctx.playerShip.x, ctx.playerShip.y, 10, 0x44aaff, 0x88ddff)
          screenFlash(ctx, 0x4488ff, 0.2, 140)
        } else {
          const dmgToPlayer = getCollisionDamageToPlayer(e, game.currentStage)
          game.takeDamage(dmgToPlayer)
          screenFlash(ctx)
          spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, dmgToPlayer)
        }

        if (e.hp <= 0) {
          killEnemy(ctx, game, e, i)
          continue
        }
      }
    }
  }

  // Exp orbs
  const collectRange = game.upgrades.collectRange + game.cardStats.expRangeBonus
  const collectR2 = collectRange * collectRange
  for (let i = ctx.expOrbs.length - 1; i >= 0; i--) {
    const o = ctx.expOrbs[i]
    o.y += o.vy * dt; o.gfx.y = o.y
    // Sparkle: scale and alpha pulse
    const t = Date.now() * 0.011 + i * 2.3
    o.gfx.scale.set(0.82 + 0.18 * Math.abs(Math.sin(t)))
    o.gfx.alpha = 0.65 + 0.35 * Math.abs(Math.sin(Date.now() * 0.007 + i * 1.5))
    if (o.y > (GAME_H * (1 + 1 / ctx.bossZoom) / 2) + 20) { if (!o.gfx.destroyed) ctx.gameLayer.removeChild(o.gfx); ctx.expOrbs.splice(i, 1); continue }
    if (ctx.playerShip && dist2(o.gfx.x, o.y, ctx.playerShip.x, ctx.playerShip.y) < collectR2) {
      spawnExpCollectEffect(ctx, o.x, o.y, ctx.playerShip.x, ctx.playerShip.y, o.amount, getExpTierColor(o.tier))
      game.gainSessionExp(o.amount)
      if (!o.gfx.destroyed) ctx.gameLayer.removeChild(o.gfx)
      ctx.expOrbs.splice(i, 1)
    }
  }

  // Fragment orbs (Star Holder)
  if (game.selectedShip === 'star_holder') {
    const skillTargetX = 39; const skillTargetY = GAME_H * 0.67
    for (let i = ctx.fragmentOrbs.length - 1; i >= 0; i--) {
      const o = ctx.fragmentOrbs[i]
      o.age += dt
      if (o.age < 30) {
        o.y += o.vy * dt; o.gfx.y = o.y
        o.gfx.alpha = 0.75 + Math.sin(Date.now() * 0.008 + i) * 0.25
        o.gfx.scale.set(0.88 + 0.12 * Math.abs(Math.sin(Date.now() * 0.013 + i * 1.9)))
        if (o.y > (GAME_H * (1 + 1 / ctx.bossZoom) / 2) + 20) { if (!o.gfx.destroyed) ctx.gameLayer.removeChild(o.gfx); ctx.fragmentOrbs.splice(i, 1) }
      } else {
        const dx = skillTargetX - o.gfx.x; const dy = skillTargetY - o.gfx.y
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        o.gfx.x += (dx / d) * 9 * dt; o.gfx.y += (dy / d) * 9 * dt
        o.gfx.alpha = 0.6 + Math.sin(Date.now() * 0.015 + i) * 0.4
        if (d < 22) {
          game.fragmentCount = Math.min(50, game.fragmentCount + 1)
          if (!o.gfx.destroyed) ctx.gameLayer.removeChild(o.gfx)
          ctx.fragmentOrbs.splice(i, 1)
        }
      }
    }
  }

  // Fragment missiles
  for (let i = ctx.fragmentMissiles.length - 1; i >= 0; i--) {
    const m = ctx.fragmentMissiles[i]
    const nearestEnemy = findNearestEnemy(ctx.enemies, m.gfx.x, m.gfx.y)
    let targetX = nearestEnemy?.container.x
    let targetY = nearestEnemy?.container.y
    let bestD2 = nearestEnemy ? dist2(m.gfx.x, m.gfx.y, nearestEnemy.container.x, nearestEnemy.container.y) : Infinity
    for (const boss of ctx.enemies) {
      if (boss.kind !== 'boss_cnox_sun') continue
      for (const c of boss.sunEnergyCrystals ?? []) {
        const d2 = dist2(m.gfx.x, m.gfx.y, c.x, c.y)
        if (d2 < bestD2) {
          bestD2 = d2
          targetX = c.x
          targetY = c.y
        }
      }
    }
    if (targetX !== undefined && targetY !== undefined) {
      const dx = targetX - m.gfx.x; const dy = targetY - m.gfx.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      m.vx += (dx / dist) * 7 * 0.18; m.vy += (dy / dist) * 7 * 0.18
      const spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy)
      if (spd > 8) { m.vx = (m.vx / spd) * 8; m.vy = (m.vy / spd) * 8 }
    }
    m.gfx.x += m.vx * dt; m.gfx.y += m.vy * dt
    m.gfx.rotation = Math.atan2(m.vy, m.vx) + Math.PI / 2
    if (m.gfx.x < (GAME_W * (1 - 1 / ctx.bossZoom) / 2) - 20 || m.gfx.x > (GAME_W * (1 + 1 / ctx.bossZoom) / 2) + 20 || m.gfx.y < (GAME_H * (1 - 1 / ctx.bossZoom) / 2) - 40 || m.gfx.y > (GAME_H * (1 + 1 / ctx.bossZoom) / 2) + 20) {
      if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
      ctx.fragmentMissiles.splice(i, 1); continue
    }
    let hitCrystal = false
    for (const boss of ctx.enemies) {
      if (boss.kind !== 'boss_cnox_sun') continue
      const crystals = boss.sunEnergyCrystals ?? []
      for (let ci = crystals.length - 1; ci >= 0; ci--) {
        const c = crystals[ci]!
        if (dist2(m.gfx.x, m.gfx.y, c.x, c.y) < 18 * 18) {
          const dmg = Math.round(60 + game.upgrades.damage * 0.5)
          c.hp = Math.max(0, c.hp - dmg)
          spawnDamageText(ctx, c.x, c.y - 14, dmg)
          spawnExplosion(ctx, m.gfx.x, m.gfx.y, 10, 0xff8800, 0xffdd44)
          if (c.hp <= 0) {
            spawnExplosion(ctx, c.x, c.y, 20, 0x66c7ff, 0xe9f8ff)
            if (!c.gfx.destroyed) ctx.gameLayer.removeChild(c.gfx)
            crystals.splice(ci, 1)
          }
          hitCrystal = true
          break
        }
      }
      if (hitCrystal) break
    }
    if (hitCrystal) { if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx); ctx.fragmentMissiles.splice(i, 1); continue }
    let hit = false
    for (let j = ctx.enemies.length - 1; j >= 0; j--) {
      const e = ctx.enemies[j]
      const fragDmg = Math.round(60 + game.upgrades.damage * 0.5)
      if (hitCnoxShieldAlphaBarrier(e, m.gfx.x, m.gfx.y, fragDmg)) {
        hit = true
        break
      }
      const fragHitR = e.kind === 'boss_cnox_sun' ? 42 : (e.kind.startsWith('boss_') ? 30 : 20)
      if (dist2(m.gfx.x, m.gfx.y, e.container.x, e.container.y) < fragHitR * fragHitR) {
        const dmg = fragDmg
        e.hp = Math.max(0, e.hp - dmg); hitFlash(e.body)
        updateDnoxFireHeat(e, dmg, ctx, game)
        spawnDamageText(ctx, e.container.x, e.container.y - 14, dmg)
        redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
        spawnExplosion(ctx, m.gfx.x, m.gfx.y, 10, 0xff8800, 0xffdd44)
        if (e.hp <= 0) killEnemy(ctx, game, e, j)
        hit = true; break
      }
    }
    if (hit) { if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx); ctx.fragmentMissiles.splice(i, 1) }
  }

  // Shooter missiles (Star Shooter)
  const tracerTakenTargets = new Set<Enemy>()
  for (const s of ctx.shooterMissiles) {
    const sm = s as typeof s & { mode?: 'missile' | 'tracer' | 'tracer_small' }
    if (sm.mode === 'tracer' && s.targetEnemy && ctx.enemies.includes(s.targetEnemy)) tracerTakenTargets.add(s.targetEnemy)
  }
  for (let i = ctx.shooterMissiles.length - 1; i >= 0; i--) {
    const m = ctx.shooterMissiles[i]
    const mm = m as typeof m & {
      mode?: 'missile' | 'tracer' | 'tracer_small'
      hitCooldown?: number
      life?: number
      turnDelay?: number
      lastHitEnemy?: Enemy
      lastHitCooldown?: number
      recentHitEnemies?: Enemy[]
      recentHitCooldowns?: number[]
    }
    if (mm.mode === 'tracer' || mm.mode === 'tracer_small') {
      mm.hitCooldown = Math.max(0, (mm.hitCooldown ?? 0) - dt)
      mm.turnDelay = Math.max(0, (mm.turnDelay ?? 0) - dt)
      mm.lastHitCooldown = Math.max(0, (mm.lastHitCooldown ?? 0) - dt)
      if (mm.recentHitEnemies && mm.recentHitCooldowns) {
        for (let ri = mm.recentHitEnemies.length - 1; ri >= 0; ri--) {
          mm.recentHitCooldowns[ri] = Math.max(0, (mm.recentHitCooldowns[ri] ?? 0) - dt)
          if ((mm.recentHitCooldowns[ri] ?? 0) <= 0 || !ctx.enemies.includes(mm.recentHitEnemies[ri]!)) {
            mm.recentHitEnemies.splice(ri, 1)
            mm.recentHitCooldowns.splice(ri, 1)
          }
        }
      }
      if ((mm.life ?? 9999) < 9999) {
        mm.life = Math.max(0, (mm.life ?? 0) - dt)
        if ((mm.life ?? 0) <= 0) {
          if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
          ctx.shooterMissiles.splice(i, 1)
          continue
        }
      }

      const isSmall = mm.mode === 'tracer_small'
      const isInertiaPhase = (mm.turnDelay ?? 0) > 0
      const canPierceThrough = true
      let targetEnemy = m.targetEnemy && ctx.enemies.includes(m.targetEnemy) ? m.targetEnemy : undefined
      if (targetEnemy && !isSmall) tracerTakenTargets.add(targetEnemy)
      if (!targetEnemy && !isInertiaPhase) {
        const crystalCandidates = ctx.enemies
          .filter(e => e.kind === 'boss_cnox_sun')
          .flatMap(e => (e.sunEnergyCrystals ?? []).map(c => ({ x: c.x, y: c.y })))
          .sort((a, b) => dist2(m.gfx.x, m.gfx.y, a.x, a.y) - dist2(m.gfx.x, m.gfx.y, b.x, b.y))
        if (crystalCandidates.length > 0) {
          const crystalTarget = crystalCandidates[0]!
          m.targetEnemy = undefined
          m.targetX = crystalTarget.x
          m.targetY = crystalTarget.y
        } else {
          const candidates = isSmall ? ctx.enemies : ctx.enemies.filter(e => !tracerTakenTargets.has(e))
          const pool = candidates.length > 0 ? candidates : ctx.enemies
          targetEnemy = findNearestEnemy(pool, m.gfx.x, m.gfx.y) ?? undefined
          if (targetEnemy) {
            m.targetEnemy = targetEnemy
            m.targetX = undefined
            m.targetY = undefined
            if (!isSmall) tracerTakenTargets.add(targetEnemy)
          } else if (ctx.playerShip) {
            m.targetEnemy = undefined
            m.targetX = ctx.playerShip.x
            m.targetY = ctx.playerShip.y - 20
          }
        }
      }
      if (targetEnemy) {
        m.targetEnemy = targetEnemy
        m.targetX = undefined
        m.targetY = undefined
      }

      const tracerSpdBase = isSmall ? 8.5 : 7
      const tracerSpd = tracerSpdBase * (isSmall ? 1 : game.cardStats.tracerSwordSpdMult) * 0.7
      if (!isInertiaPhase) {
        const tx = targetEnemy?.container.x ?? m.targetX ?? m.gfx.x
        const ty = targetEnemy?.container.y ?? m.targetY ?? (m.gfx.y - 120)
        const dx = tx - m.gfx.x
        const dy = ty - m.gfx.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        m.vx += (dx / dist * tracerSpd - m.vx) * (isSmall ? 0.26 : 0.19)
        m.vy += (dy / dist * tracerSpd - m.vy) * (isSmall ? 0.26 : 0.19)
      }
      const cur = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 1
      if (cur > tracerSpd * 1.3) {
        m.vx = (m.vx / cur) * tracerSpd * 1.3
        m.vy = (m.vy / cur) * tracerSpd * 1.3
      }

      const prevX = m.gfx.x
      const prevY = m.gfx.y
      m.gfx.x += m.vx * dt
      m.gfx.y += m.vy * dt
      m.gfx.rotation = Math.atan2(m.vy, m.vx) + Math.PI / 2

      if (m.gfx.x < (GAME_W * (1 - 1 / ctx.bossZoom) / 2) - 45 || m.gfx.x > (GAME_W * (1 + 1 / ctx.bossZoom) / 2) + 45 || m.gfx.y < (GAME_H * (1 - 1 / ctx.bossZoom) / 2) - 70 || m.gfx.y > (GAME_H * (1 + 1 / ctx.bossZoom) / 2) + 45) {
        if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
        ctx.shooterMissiles.splice(i, 1)
        continue
      }

      const hitDamage = Math.round(m.damage * (isSmall ? 0.5 : 1))
      let hitAny = false
      const spawnVanKiemSubSword = () => {
        if (isSmall || game.cardStats.tracerSwordUltimateMode !== 'van_kiem') return
        const smallCount = ctx.shooterMissiles.filter(s => (s as typeof s & { mode?: string }).mode === 'tracer_small').length
        if (smallCount >= game.cardStats.tracerSwordSmallMax) return

        const sg = new Graphics()
        drawTracerSword(sg, 'sub')
        const originX = ctx.playerShip?.x ?? m.gfx.x
        const originY = (ctx.playerShip?.y ?? m.gfx.y) - 20
        sg.x = originX
        sg.y = originY
        ctx.gameLayer.addChild(sg)

        let subTargetEnemy: Enemy | undefined
        let subTargetX: number | undefined
        let subTargetY: number | undefined
        const crystalTargets = ctx.enemies
          .filter(e => e.kind === 'boss_cnox_sun')
          .flatMap(e => (e.sunEnergyCrystals ?? []).map(c => ({ x: c.x, y: c.y })))
          .sort((a, b) => dist2(originX, originY, a.x, a.y) - dist2(originX, originY, b.x, b.y))
        if (crystalTargets.length > 0) {
          subTargetX = crystalTargets[0]!.x
          subTargetY = crystalTargets[0]!.y
        } else {
          subTargetEnemy = findNearestEnemy(ctx.enemies, originX, originY) ?? undefined
        }

        const targetX = subTargetEnemy?.container.x ?? subTargetX ?? m.gfx.x
        const targetY = subTargetEnemy?.container.y ?? subTargetY ?? (m.gfx.y - 80)
        const dx = targetX - originX
        const dy = targetY - originY
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        const subSpeed = 8.5

        ctx.shooterMissiles.push({
          gfx: sg,
          vx: (dx / d) * subSpeed,
          vy: (dy / d) * subSpeed,
          damage: m.damage,
          aoe: false,
          mode: 'tracer_small',
          targetEnemy: subTargetEnemy,
          targetX: subTargetX,
          targetY: subTargetY,
          hitCooldown: 0,
        } as typeof m & { mode?: 'missile' | 'tracer' | 'tracer_small'; hitCooldown?: number; life?: number; lastHitEnemy?: Enemy; lastHitCooldown?: number })
      }

      for (const boss of ctx.enemies) {
        if (boss.kind !== 'boss_cnox_sun') continue
        const crystals = boss.sunEnergyCrystals ?? []
        for (let ci = crystals.length - 1; ci >= 0; ci--) {
          const c = crystals[ci]!
          if (!canPierceThrough) {
            if (targetEnemy) continue
            if (m.targetX === undefined || m.targetY === undefined) continue
            if (dist2(c.x, c.y, m.targetX, m.targetY) > 24 * 24) continue
          }
          const hitR = isSmall ? 12 : 16
          const crystalHitByPoint = dist2(m.gfx.x, m.gfx.y, c.x, c.y) < hitR * hitR
          const crystalHitByTrace = isSmall
            ? pointDistanceToSegment(c.x, c.y, prevX, prevY, m.gfx.x, m.gfx.y) < hitR + 4
            : false
          if (!crystalHitByPoint && !crystalHitByTrace) continue
          if ((mm.hitCooldown ?? 0) > 0 && !crystalHitByTrace) continue
          c.hp = Math.max(0, c.hp - hitDamage)
          spawnDamageText(ctx, c.x, c.y - 14, hitDamage)
          if (c.hp <= 0) {
            spawnExplosion(ctx, c.x, c.y, 20, 0x66c7ff, 0xe9f8ff)
            if (!c.gfx.destroyed) ctx.gameLayer.removeChild(c.gfx)
            crystals.splice(ci, 1)
          }
          hitAny = true
          mm.lastHitCooldown = 16
          spawnVanKiemSubSword()

          const vmag = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 1
          const inertiaDistance = 70 + tracerSpd * 12
          const inertiaDelay = Math.round(9 + tracerSpd * 2)
          m.targetEnemy = undefined
          m.targetX = m.gfx.x + (m.vx / vmag) * inertiaDistance
          m.targetY = m.gfx.y + (m.vy / vmag) * inertiaDistance
          mm.turnDelay = inertiaDelay
          break
        }
        if (i >= ctx.shooterMissiles.length || ctx.shooterMissiles[i] !== m) break
      }
      if (i >= ctx.shooterMissiles.length || ctx.shooterMissiles[i] !== m) continue

      for (let j = ctx.enemies.length - 1; j >= 0; j--) {
        const e = ctx.enemies[j]!
        if (!canPierceThrough) {
          if (targetEnemy && e !== targetEnemy) continue
          if (!targetEnemy) continue
        }
        const hitR = e.kind === 'boss_cnox_sun' ? 42 : (e.kind.startsWith('boss_') ? 33 : 17)
        const hitByPoint = dist2(m.gfx.x, m.gfx.y, e.container.x, e.container.y) < (hitR + (isSmall ? 4 : 8)) * (hitR + (isSmall ? 4 : 8))
        const traceCollision = true
        const hitByTrace = traceCollision
          ? pointDistanceToSegment(e.container.x, e.container.y, prevX, prevY, m.gfx.x, m.gfx.y) < hitR + (isSmall ? 8 : 5)
          : false
        if (!hitByPoint && !hitByTrace) continue

        if ((mm.hitCooldown ?? 0) > 0 && !hitByTrace) continue
        const recentHitIdx = (mm.recentHitEnemies ?? []).findIndex(re => re === e)
        if (recentHitIdx >= 0 && (mm.recentHitCooldowns?.[recentHitIdx] ?? 0) > 0) continue
        if (mm.lastHitEnemy === e && (mm.lastHitCooldown ?? 0) > 0) continue

        const executeHp = !isSmall && game.cardStats.tracerSwordExecutePct > 0 ? Math.round(e.maxHp * game.cardStats.tracerSwordExecutePct) : 0
        const finalDmg = executeHp > 0 && e.hp <= executeHp ? Math.max(e.hp, hitDamage) : hitDamage
        e.hp = Math.max(0, e.hp - finalDmg)
        updateDnoxFireHeat(e, finalDmg, ctx, game)
        hitFlash(e.body)
        spawnDamageText(ctx, e.container.x, e.container.y - (e.kind.startsWith('boss_') ? 56 : 14), finalDmg)
        redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
        if (e.hp <= 0) killEnemy(ctx, game, e, j)
        hitAny = true

        spawnVanKiemSubSword()

        // Sword keeps momentum after passing through a target before turning back.
        const vmag = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 1
        const inertiaDistance = 70 + tracerSpd * 12
        const inertiaDelay = Math.round(9 + tracerSpd * 2)
        m.targetEnemy = undefined
        m.targetX = m.gfx.x + (m.vx / vmag) * inertiaDistance
        m.targetY = m.gfx.y + (m.vy / vmag) * inertiaDistance
        mm.turnDelay = inertiaDelay

        mm.lastHitEnemy = e
        mm.lastHitCooldown = 16
        if (!mm.recentHitEnemies) mm.recentHitEnemies = []
        if (!mm.recentHitCooldowns) mm.recentHitCooldowns = []
        const markIdx = mm.recentHitEnemies.findIndex(re => re === e)
        if (markIdx >= 0) {
          mm.recentHitCooldowns[markIdx] = 16
        } else {
          mm.recentHitEnemies.push(e)
          mm.recentHitCooldowns.push(16)
        }
        if (!canPierceThrough) break
      }

      if (hitAny) {
        if (!isSmall) audioManager.playShipHit('thien_ha_truy')
        mm.hitCooldown = 9
      }

      const returningToShip = !!ctx.playerShip
        && m.targetX !== undefined
        && m.targetY !== undefined
        && dist2(m.targetX, m.targetY, ctx.playerShip.x, ctx.playerShip.y - 20) < 30 * 30
      if (!targetEnemy && returningToShip && ctx.playerShip && dist2(m.gfx.x, m.gfx.y, ctx.playerShip.x, ctx.playerShip.y - 20) < 16 * 16) {
        if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
        ctx.shooterMissiles.splice(i, 1)
      }
      continue
    }

    // Non-homing mode: keep initial heading and speed (no retarget/chase)
    const smCurSpd2 = m.vx * m.vx + m.vy * m.vy
    if (smCurSpd2 < 36) {
      if (smCurSpd2 > 0) { const inv = 6 / Math.sqrt(smCurSpd2); m.vx *= inv; m.vy *= inv }
      else { m.vx = 0; m.vy = -6 }
    }

    // Crystal collision: missiles should be blocked and explode on contact (no piercing through crystals)
    let hitCrystal = false
    for (const boss of ctx.enemies) {
      if (boss.kind !== 'boss_cnox_sun') continue
      const crystals = boss.sunEnergyCrystals ?? []
      for (let ci = crystals.length - 1; ci >= 0; ci--) {
        const c = crystals[ci]!
        if (dist2(m.gfx.x, m.gfx.y, c.x, c.y) < 17 * 17) {
          c.hp = Math.max(0, c.hp - m.damage)
          spawnDamageText(ctx, c.x, c.y - 14, m.damage)
          if (c.hp <= 0) {
            spawnExplosion(ctx, c.x, c.y, 20, 0x66c7ff, 0xe9f8ff)
            if (!c.gfx.destroyed) ctx.gameLayer.removeChild(c.gfx)
            crystals.splice(ci, 1)
          }
          spawnExplosion(ctx, m.gfx.x, m.gfx.y, m.aoe ? 28 : 14, 0xff4400, 0xffaa00)
          if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
          ctx.shooterMissiles.splice(i, 1)
          hitCrystal = true
          break
        }
      }
      if (hitCrystal) break
    }
    if (hitCrystal) continue

    if (m.targetX !== undefined && m.targetY !== undefined && dist2(m.gfx.x, m.gfx.y, m.targetX, m.targetY) < 18 * 18) {
      m.gfx.x = m.targetX
      m.gfx.y = m.targetY
      if (m.aoe) {
        const aoeRadius = 45 * (1 + game.cardStats.shooterMissileAoeSizeBonus)
        spawnExplosion(ctx, m.gfx.x, m.gfx.y, 28, 0xff4400, 0xffaa00)
        screenFlash(ctx, 0xff3300, 0.18, 150)
        for (let k = ctx.enemies.length - 1; k >= 0; k--) {
          const ae = ctx.enemies[k]
          if (dist2(m.gfx.x, m.gfx.y, ae.container.x, ae.container.y) < aoeRadius * aoeRadius) {
            ae.hp = Math.max(0, ae.hp - m.damage); hitFlash(ae.body)
            updateDnoxFireHeat(ae, m.damage, ctx, game)
            spawnDamageText(ctx, ae.container.x, ae.container.y - 14, m.damage)
            redrawHpBar(ae.hpBarBg, ae.hpBar, ae.hp / ae.maxHp, ae.barW)

            if (ae.hp <= 0) {
              if (game.cardStats.shooterMissileKillCdReduce > 0) game.reduceSkillCooldown(game.cardStats.shooterMissileKillCdReduce)
              killEnemy(ctx, game, ae, k)
            }
          }
        }
      } else {
        let nearestIdx = -1
        let nearestD2 = Infinity
        for (let k = 0; k < ctx.enemies.length; k++) {
          const d2 = dist2(m.gfx.x, m.gfx.y, ctx.enemies[k]!.container.x, ctx.enemies[k]!.container.y)
          if (d2 < nearestD2) { nearestD2 = d2; nearestIdx = k }
        }
        if (nearestIdx >= 0 && nearestD2 < 28 * 28) {
          const e = ctx.enemies[nearestIdx]!
          if (!hitCnoxShieldAlphaBarrier(e, m.gfx.x, m.gfx.y, m.damage)) {
            e.hp = Math.max(0, e.hp - m.damage); hitFlash(e.body)
            updateDnoxFireHeat(e, m.damage, ctx, game)
            spawnDamageText(ctx, e.container.x, e.container.y - 14, m.damage)
            redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)

            if (e.hp <= 0) {
              if (game.cardStats.shooterMissileKillCdReduce > 0) game.reduceSkillCooldown(game.cardStats.shooterMissileKillCdReduce)
              killEnemy(ctx, game, e, nearestIdx)
            }
          }
        }
        spawnExplosion(ctx, m.gfx.x, m.gfx.y, 14, 0xff4400, 0xffaa00)
      }
      if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
      ctx.shooterMissiles.splice(i, 1)
      continue
    }
    m.gfx.x += m.vx * dt; m.gfx.y += m.vy * dt
    m.gfx.rotation = Math.atan2(m.vy, m.vx) + Math.PI / 2
    if (m.gfx.x < (GAME_W * (1 - 1 / ctx.bossZoom) / 2) - 40 || m.gfx.x > (GAME_W * (1 + 1 / ctx.bossZoom) / 2) + 40 || m.gfx.y < (GAME_H * (1 - 1 / ctx.bossZoom) / 2) - 60 || m.gfx.y > (GAME_H * (1 + 1 / ctx.bossZoom) / 2) + 40) {
      if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
      ctx.shooterMissiles.splice(i, 1); continue
    }
    let hit = false
    for (let j = ctx.enemies.length - 1; j >= 0; j--) {
      const e = ctx.enemies[j]
      if (hitCnoxShieldAlphaBarrier(e, m.gfx.x, m.gfx.y, m.damage)) {
        spawnExplosion(ctx, m.gfx.x, m.gfx.y, 12, 0xff4f22, 0xffbb66)
        hit = true
        break
      }
      const shooterHitR = e.kind === 'boss_cnox_sun' ? 44 : (e.kind.startsWith('boss_') ? 32 : 22)
      if (dist2(m.gfx.x, m.gfx.y, e.container.x, e.container.y) < shooterHitR * shooterHitR) {
        if (m.aoe) {
          const aoeRadius = 45 * (1 + game.cardStats.shooterMissileAoeSizeBonus)
          spawnExplosion(ctx, m.gfx.x, m.gfx.y, 28, 0xff4400, 0xffaa00)
          screenFlash(ctx, 0xff3300, 0.18, 150)
          for (let k = ctx.enemies.length - 1; k >= 0; k--) {
            const ae = ctx.enemies[k]
            if (dist2(m.gfx.x, m.gfx.y, ae.container.x, ae.container.y) < aoeRadius * aoeRadius) {
              ae.hp = Math.max(0, ae.hp - m.damage); hitFlash(ae.body)
              updateDnoxFireHeat(ae, m.damage, ctx, game)
              spawnDamageText(ctx, ae.container.x, ae.container.y - 14, m.damage)
              redrawHpBar(ae.hpBarBg, ae.hpBar, ae.hp / ae.maxHp, ae.barW)

              if (ae.hp <= 0) {
                if (game.cardStats.shooterMissileKillCdReduce > 0) game.reduceSkillCooldown(game.cardStats.shooterMissileKillCdReduce)
                killEnemy(ctx, game, ae, k)
              }
            }
          }
        } else {
          e.hp = Math.max(0, e.hp - m.damage); hitFlash(e.body)
          updateDnoxFireHeat(e, m.damage, ctx, game)
          spawnDamageText(ctx, e.container.x, e.container.y - 14, m.damage)
          redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)

          spawnExplosion(ctx, m.gfx.x, m.gfx.y, 14, 0xff4400, 0xffaa00)
          if (e.hp <= 0) {
            if (game.cardStats.shooterMissileKillCdReduce > 0) game.reduceSkillCooldown(game.cardStats.shooterMissileKillCdReduce)
            killEnemy(ctx, game, e, j)
          }
        }
        hit = true; break
      }
    }
    if (hit) { if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx); ctx.shooterMissiles.splice(i, 1) }
  }

  // Damage texts
  for (let i = ctx.expCollectParticles.length - 1; i >= 0; i--) {
    const p = ctx.expCollectParticles[i]!
    const ax = (p.targetX - p.x) * 0.055
    const ay = (p.targetY - p.y) * 0.055
    p.vx = (p.vx + ax * dt) * 0.9
    p.vy = (p.vy + ay * dt) * 0.9
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.gfx.x = p.x
    p.gfx.y = p.y
    p.life += dt
    const t = Math.min(1, p.life / p.maxLife)
    p.gfx.alpha = 1 - t
    p.gfx.scale.set(0.85 + (1 - t) * 0.35)
    if (t >= 1 || dist2(p.x, p.y, p.targetX, p.targetY) < 8 * 8) {
      if (!p.gfx.destroyed) ctx.gameLayer.removeChild(p.gfx)
      ctx.expCollectParticles.splice(i, 1)
    }
  }

  // Damage texts
  for (let i = ctx.damageTexts.length - 1; i >= 0; i--) {
    const d = ctx.damageTexts[i]
    d.gfx.y -= d.vy * dt; d.life--
    d.gfx.alpha = d.life / 40
    if (d.life <= 0) { if (!d.gfx.destroyed) ctx.gameLayer.removeChild(d.gfx); ctx.damageTexts.splice(i, 1) }
  }
}

// --- Setup --------------------------------------------------------------------
async function initPixi() {
  app = new Application()
  await app.init({
    width: GAME_W, height: GAME_H,
    backgroundColor: 0x050a18,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })
  ctx.app = app

  if (canvasWrapper.value) canvasWrapper.value.appendChild(app.canvas as HTMLCanvasElement)

  ctx.bgLayer   = new Container(); app.stage.addChild(ctx.bgLayer)
  ctx.gameLayer = new Container(); app.stage.addChild(ctx.gameLayer)
  ctx.uiLayer   = new Container(); app.stage.addChild(ctx.uiLayer)
  syncGraphicsMode()
  resetFpsTracking()

  for (let i = 0; i < 80; i++) {
    const s = createStar()
    ctx.bgLayer.addChild(s.gfx)
    ctx.stars.push(s)
  }

  ctx.playerShip = new Graphics()
  drawShip(ctx.playerShip, game.selectedShip)
  ctx.playerShip.x = GAME_W / 2; ctx.playerShip.y = INTRO_SHIP_START_Y
  ctx.gameLayer.addChild(ctx.playerShip)

  initArtifactGfx(ctx, game)

  ctx.shieldGfx = new Graphics()
  ctx.shieldGfx.visible = false
  ctx.gameLayer.addChild(ctx.shieldGfx)

  starFasterAuraGfx = new Graphics()
  starFasterAuraGfx.visible = false
  ctx.gameLayer.addChild(starFasterAuraGfx)

  freezeScreenGfx = new Graphics()
  freezeScreenGfx.visible = false
  ctx.uiLayer.addChild(freezeScreenGfx)

  freezeOverlayGfx = new Graphics()
  freezeOverlayGfx.visible = false
  ctx.uiLayer.addChild(freezeOverlayGfx)

  // Zoom level indicator
  const zStyle = new TextStyle({
    fill: 0xffdd44, fontSize: 12,
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 'bold',
    stroke: { color: 0x000000, width: 3 },
  })
  zoomIndicatorText = new Text({ text: '', style: zStyle })
  zoomIndicatorText.anchor.set(0.5, 0)
  zoomIndicatorText.x = GAME_W / 2
  zoomIndicatorText.y = 8
  zoomIndicatorText.alpha = 0
  ctx.uiLayer.addChild(zoomIndicatorText)
  zoomIndicatorLastZoom = 1.0

  ctx.gamePhase = 'intro'; ctx.introTimer = 0

  app.canvas.addEventListener('touchstart', onTouchStart, { passive: false })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
  app.canvas.addEventListener('mousedown', onMouseDown)
  app.canvas.addEventListener('mousemove', onMouseMove)
  app.canvas.addEventListener('mouseup', onMouseUp)
  app.canvas.addEventListener('mouseleave', onMouseLeave)
  app.canvas.addEventListener('contextmenu', onContextMenu)
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('blur', handleWindowBlur)
  window.addEventListener('focus', handleWindowFocus)

  app.ticker.add(gameLoop)
}

let lastTapTime = 0

function onTouchStart(e: TouchEvent) {
  e.preventDefault()
  if (playerFrostStacks >= 2) {
    applyFreezeBreakTap()
    return
  }
  ctx.isDragging = true
  const rect = (app!.canvas as HTMLCanvasElement).getBoundingClientRect()
  ctx.touchX = (e.touches[0].clientX - rect.left) * (GAME_W / rect.width)
  ctx.touchY = (e.touches[0].clientY - rect.top) * (GAME_H / rect.height)
  const now = Date.now()
  if (now - lastTapTime < 300 && game.isPlaying && !game.isPaused && !game.isLevelUpPending) {
    game.activateSkill(); lastTapTime = 0
  } else { lastTapTime = now }
}
function onTouchMove(e: TouchEvent) {
  if (!ctx.isDragging) return
  e.preventDefault()
  const rect = (app!.canvas as HTMLCanvasElement).getBoundingClientRect()
  ctx.touchX = (e.touches[0].clientX - rect.left) * (GAME_W / rect.width)
  ctx.touchY = (e.touches[0].clientY - rect.top) * (GAME_H / rect.height)
}
function onTouchEnd() { ctx.isDragging = false }
function onMouseDown(e: MouseEvent) {
  if (playerFrostStacks >= 2) {
    applyFreezeBreakTap()
    return
  }
  ctx.isDragging = true
  const rect = (app!.canvas as HTMLCanvasElement).getBoundingClientRect()
  ctx.touchX = (e.clientX - rect.left) * (GAME_W / rect.width)
  ctx.touchY = (e.clientY - rect.top) * (GAME_H / rect.height)
}
function onMouseMove(e: MouseEvent) {
  ctx.isDragging = true
  const rect = (app!.canvas as HTMLCanvasElement).getBoundingClientRect()
  ctx.touchX = (e.clientX - rect.left) * (GAME_W / rect.width)
  ctx.touchY = (e.clientY - rect.top) * (GAME_H / rect.height) + TOUCH_Y_OFFSET
}
function onMouseUp() { ctx.isDragging = false }
function onMouseLeave() { ctx.isDragging = false }
function onContextMenu(e: MouseEvent) {
  e.preventDefault()
  if (game.isPlaying && !game.isPaused && !game.isLevelUpPending) game.activateSkill()
}
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.preventDefault(); if (game.isPlaying && !game.isLevelUpPending) game.pauseGame() }
}

function destroyPixi() {
  if (app) {
    app.ticker.remove(gameLoop)
    app.canvas.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
    app.canvas.removeEventListener('mousedown', onMouseDown)
    app.canvas.removeEventListener('mousemove', onMouseMove)
    app.canvas.removeEventListener('mouseup', onMouseUp)
    app.canvas.removeEventListener('mouseleave', onMouseLeave)
    app.canvas.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('blur', handleWindowBlur)
    window.removeEventListener('focus', handleWindowFocus)
    app.destroy(true, { children: true })
    app = null; ctx.app = null
  }
  audioManager.setBossActive(false)
  ctx.bullets = []; ctx.allyDrones = []; ctx.enemies = []; ctx.enemyBullets = []; ctx.stars = []
  ctx.damageTexts = []; ctx.expOrbs = []; ctx.expCollectParticles = []; ctx.fragmentOrbs = []; ctx.fragmentMissiles = []
  ctx.soulMissileQueue = 0; ctx.soulMissileFireTimer = 0
  ctx.neutronVacuumTimer = 0; ctx.manaCoreKillCount = 0; ctx.manaCoreOverloadPending = false; ctx.artifactOrbitAngle = 0
  ctx.artifactGfx = null
  ctx.artifactGfxList = []
  game.neutronVacuumPct = 0; game.manaCorePct = 0
  ctx.shooterMissiles = []; ctx.shooterBlackHoleTimer = 0; ctx.shooterBlackHoleGfx = null
  if (ctx.shooterBlackHoleProjGfx && !ctx.shooterBlackHoleProjGfx.destroyed) ctx.gameLayer?.removeChild(ctx.shooterBlackHoleProjGfx)
  ctx.shooterBlackHoleProjGfx = null
  if (ctx.tracerLockGfx && !ctx.tracerLockGfx.destroyed) ctx.gameLayer?.removeChild(ctx.tracerLockGfx)
  ctx.tracerLockGfx = null
  if (ctx.tracerSlashWaveGfx && !ctx.tracerSlashWaveGfx.destroyed) ctx.gameLayer?.removeChild(ctx.tracerSlashWaveGfx)
  ctx.tracerSlashWaveGfx = null
  ctx.tracerFreezeTimer = 0
  ctx.tracerSlashDone = false
  if (starFasterAuraGfx && !starFasterAuraGfx.destroyed) ctx.gameLayer?.removeChild(starFasterAuraGfx)
  starFasterAuraGfx = null
  playerFrostStacks = 0
  playerFreezeTimer = 0
  playerFreezeTapCount = 0
  freezeBreakPulse = 0
  if (freezeOverlayGfx && !freezeOverlayGfx.destroyed) ctx.uiLayer?.removeChild(freezeOverlayGfx)
  freezeOverlayGfx = null
  if (freezeScreenGfx && !freezeScreenGfx.destroyed) ctx.uiLayer?.removeChild(freezeScreenGfx)
  freezeScreenGfx = null
  resetFpsTracking()
}

onMounted(async () => { await initPixi(); game.startGame() })
onUnmounted(() => { destroyPixi() })

watch(() => game.graphicsQuality, () => {
  syncGraphicsMode()
})

watch(() => game.showFps, () => {
  if (!game.showFps) resetFpsTracking()
}, { immediate: true })

watch(() => game.isPlaying, (val) => {
  if (!val) resetFpsTracking()
})

watch(() => game.isGameOverSequence, (val) => {
  if (!val || !app || !ctx.playerShip) return
  clearTransientCombatGraphics()
  const px = ctx.playerShip.x; const py = ctx.playerShip.y
  ctx.playerShip.visible = false
  spawnExplosion(ctx, px, py, 26, 0xff4400, 0xffaa00)
  screenFlash(ctx, 0xff2222, 0.65, 350)
  setTimeout(() => { if (!app) return; spawnExplosion(ctx, px + 12, py - 6, 20, 0xff6600, 0xffdd00); screenFlash(ctx, 0xff4400, 0.45, 250) }, 450)
  setTimeout(() => { if (!app) return; spawnExplosion(ctx, px - 8, py + 8, 30, 0xff2200, 0xff8800); spawnExplosion(ctx, px + 4, py - 12, 18, 0xffcc00, 0xffee66); screenFlash(ctx, 0xff1100, 0.55, 400) }, 900)
  setTimeout(() => { game.finalizeGameOver() }, 2000)
})

watch(() => game.isPlaying, (val, old) => {
  if (val && !old && app) {
    cachedThreatProfile = getThreatProfile(game)
    threatProfileTimer = 0
    for (const b of ctx.bullets) if (!b.gfx.destroyed) ctx.gameLayer?.removeChild(b.gfx)
    for (const d of ctx.allyDrones) if (!d.gfx.destroyed) ctx.gameLayer?.removeChild(d.gfx)
    for (const e of ctx.enemies) removeEnemyDetachedGraphics(e)
    for (const e of ctx.enemies) if (!e.container.destroyed) ctx.gameLayer?.removeChild(e.container)
    for (const b of ctx.enemyBullets) if (!b.gfx.destroyed) ctx.gameLayer?.removeChild(b.gfx)
    for (const d of ctx.damageTexts) if (!d.gfx.destroyed) ctx.gameLayer?.removeChild(d.gfx)
    for (const o of ctx.expOrbs) if (!o.gfx.destroyed) ctx.gameLayer?.removeChild(o.gfx)
    for (const p of ctx.expCollectParticles) if (!p.gfx.destroyed) ctx.gameLayer?.removeChild(p.gfx)
    for (const o of ctx.fragmentOrbs) if (!o.gfx.destroyed) ctx.gameLayer?.removeChild(o.gfx)
    if (ctx.stageTitleText) { ctx.uiLayer?.removeChild(ctx.stageTitleText); ctx.stageTitleText = null }
    ctx.bullets = []; ctx.allyDrones = []; ctx.enemies = []; ctx.enemyBullets = []; ctx.damageTexts = []; ctx.expOrbs = []; ctx.expCollectParticles = []; ctx.fragmentOrbs = []
    for (const ml of ctx.missileLaunchers) if (!ml.gfx.destroyed) ctx.gameLayer?.removeChild(ml.gfx)
    for (const pm of ctx.playerMissiles) if (!pm.gfx.destroyed) ctx.gameLayer?.removeChild(pm.gfx)
    for (const fm of ctx.fragmentMissiles) if (!fm.gfx.destroyed) ctx.gameLayer?.removeChild(fm.gfx)
    ctx.missileLaunchers = []; ctx.playerMissiles = []
    for (const sm of ctx.shooterMissiles) if (!sm.gfx.destroyed) ctx.gameLayer?.removeChild(sm.gfx)
    ctx.shooterMissiles = []; ctx.fragmentMissiles = []; ctx.shooterBlackHoleTimer = 0
    if (ctx.shooterBlackHoleGfx && !ctx.shooterBlackHoleGfx.destroyed) ctx.gameLayer?.removeChild(ctx.shooterBlackHoleGfx)
    ctx.shooterBlackHoleGfx = null
    if (ctx.shooterBlackHoleProjGfx && !ctx.shooterBlackHoleProjGfx.destroyed) ctx.gameLayer?.removeChild(ctx.shooterBlackHoleProjGfx)
    ctx.shooterBlackHoleProjGfx = null
    if (ctx.tracerLockGfx && !ctx.tracerLockGfx.destroyed) ctx.gameLayer?.removeChild(ctx.tracerLockGfx)
    ctx.tracerLockGfx = null
    if (ctx.tracerSlashWaveGfx && !ctx.tracerSlashWaveGfx.destroyed) ctx.gameLayer?.removeChild(ctx.tracerSlashWaveGfx)
    ctx.tracerSlashWaveGfx = null
    ctx.tracerFreezeTimer = 0
    ctx.tracerSlashDone = false
    ctx.pbTimer = 0; ctx.cbTimer = 0; ctx.lsTimer = 0; ctx.sfDmgTimer = 0
    if (ctx.shieldGfx) ctx.shieldGfx.visible = false
    if (ctx.sfGfx) ctx.sfGfx.visible = false
    if (starFasterAuraGfx) { starFasterAuraGfx.visible = false; starFasterAuraGfx.clear() }
    playerFrostStacks = 0
    playerFreezeTimer = 0
    playerFreezeTapCount = 0
    freezeBreakPulse = 0
    if (freezeOverlayGfx) { freezeOverlayGfx.visible = false; freezeOverlayGfx.clear() }
    if (freezeScreenGfx) { freezeScreenGfx.visible = false; freezeScreenGfx.clear() }
    ctx.starFasterSkillTimer = 0
    ctx.starFasterEnemySlowFactor = 1
    ctx.starFasterFireRateBoost = 1
    ctx.shootTimer = 0; ctx.keeperBurstShotsLeft = 0; ctx.keeperBurstDelay = 0; ctx.playerLaserDamageCd = 0; ctx.bossAttackLockTimer = 0; ctx.waveQueue = []; ctx.waveDispatchTimer = 0
    ctx.waveIsClearing = false; ctx.stageClearTimer = 0; ctx.stageAnnouncePending = false
    ctx.gamePhase = 'intro'; ctx.introTimer = 0
    if (ctx.playerShip) {
      ctx.playerShip.x = GAME_W / 2; ctx.playerShip.y = INTRO_SHIP_START_Y; ctx.playerShip.visible = true
      drawShip(ctx.playerShip, game.selectedShip)
    }
    initArtifactGfx(ctx, game)
  }
})
</script>

<template>
  <div ref="canvasWrapper" class="game-canvas" />
</template>

<style scoped>
.game-canvas {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.game-canvas :deep(canvas) {
  display: block;
  max-width: 100%;
  max-height: 100%;
  image-rendering: pixelated;
}
</style>


