import { Graphics, Container, Text, TextStyle } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy, TrumSoGun, TrumSoLaser } from '../types'
import { GAME_W, GAME_H } from '../constants'
import { redrawHpBar } from '../utils'
import { screenFlash } from '../systems/effects'

type GameStore = ReturnType<typeof useGameStore>

// ─── Graphics ─────────────────────────────────────────────────────────────────
export function drawBossTrumSo(g: Graphics, size: number): void {
  g.clear()
  // Armored head (top angular section)
  g.poly([0, -size*1.05,
          size*0.48, -size*0.72,
          size*0.62, -size*0.08,
          size*0.5,  size*0.28,
         -size*0.5,  size*0.28,
         -size*0.62, -size*0.08,
         -size*0.48, -size*0.72]).fill(0x1a0044)
  // Armor bevel
  g.poly([0, -size*0.9,
          size*0.32, -size*0.62,
          size*0.44, -size*0.1,
         -size*0.44, -size*0.1,
         -size*0.32, -size*0.62]).fill(0x2d0066)
  // Lower body
  g.poly([size*0.5,  size*0.28,
          size*0.7,  size*0.52,
          size*0.52, size*0.88,
         -size*0.52, size*0.88,
         -size*0.7,  size*0.52,
         -size*0.5,  size*0.28]).fill(0x220055)
  // Left wing
  g.poly([-size*0.62, -size*0.08,
          -size*1.35, size*0.05,
          -size*1.15, size*0.52,
          -size*0.7,  size*0.52]).fill(0x180040)
  // Right wing
  g.poly([size*0.62, -size*0.08,
          size*1.35, size*0.05,
          size*1.15, size*0.52,
          size*0.7,  size*0.52]).fill(0x180040)
  // Wing nozzle highlights
  g.rect( size*1.08, size*0.22, size*0.22, size*0.15).fill(0x3d0088)
  g.rect(-size*1.30, size*0.22, size*0.22, size*0.15).fill(0x3d0088)
  // Central energy core
  g.circle(0, size*0.08, size*0.24).fill(0x7700cc)
  g.circle(0, size*0.08, size*0.14).fill({ color: 0xcc55ff, alpha: 0.95 })
  g.circle(0, size*0.08, size*0.07).fill(0xffffff)
  // 2 bottom thrusters
  g.rect(-size*0.26, size*0.80, size*0.20, size*0.30).fill(0x100022)
  g.rect( size*0.06, size*0.80, size*0.20, size*0.30).fill(0x100022)
  g.rect(-size*0.26, size*0.98, size*0.20, size*0.08).fill({ color: 0xaa33ff, alpha: 0.95 })
  g.rect( size*0.06, size*0.98, size*0.20, size*0.08).fill({ color: 0xaa33ff, alpha: 0.95 })
  // Head armor stripe
  g.rect(-size*0.22, -size*1.0, size*0.44, size*0.06).fill(0x6633cc)
}

export function drawTrumSoMachineGun(g: Graphics): void {
  g.clear()
  g.circle(0, 0, 9).fill(0x1a0044)
  g.circle(0, 0, 5.5).fill(0x440099)
  g.rect(-2.2, 0, 4.4, 10).fill(0x220055)
  g.circle(0, 0, 2.5).fill({ color: 0xaa66ff, alpha: 0.9 })
}

export function drawTrumSoMissilePod(g: Graphics): void {
  g.clear()
  g.rect(-9, -10, 18, 28).fill(0x1a0044)
  g.rect(-6, -8, 12, 14).fill(0x2d0066)
  g.circle(0, -3, 6).fill(0x440088)
  g.circle(0, -3, 3.5).fill({ color: 0x9933ff, alpha: 0.9 })
  g.rect(-9, 14, 18, 4).fill(0x0d0022)
}

export function drawTrumSoLaserNode(g: Graphics): void {
  g.clear()
  g.circle(0, 0, 6.5).fill(0x1a0044)
  g.circle(0, 0, 4).fill(0x330077)
  g.circle(0, 0, 2.2).fill({ color: 0xee88ff, alpha: 0.85 })
}

// ─── Cleanup (called by kill.ts) ──────────────────────────────────────────────
export function cleanupBossTrumSo(ctx: GameContext, e: Enemy): void {
  if (e.trumSoLasers) {
    for (const laser of e.trumSoLasers) {
      laser.gfx.clear()
      if (!laser.gfx.destroyed) ctx.gameLayer.removeChild(laser.gfx)
    }
  }
  if (e.trumSoPhase2LaserGfx) {
    e.trumSoPhase2LaserGfx.clear()
    if (!e.trumSoPhase2LaserGfx.destroyed) ctx.gameLayer.removeChild(e.trumSoPhase2LaserGfx)
  }
  if (e.trumSoChargeLineGfx) {
    e.trumSoChargeLineGfx.clear()
    if (!e.trumSoChargeLineGfx.destroyed) ctx.gameLayer.removeChild(e.trumSoChargeLineGfx)
  }
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
export function spawnBossTrumSo(ctx: GameContext, game: GameStore): void {
  const size = 55
  const maxHp = 2200 + game.currentStage * 450
  const barW = 290
  const body = new Graphics()
  drawBossTrumSo(body, size)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 24; hpBar.y = -size - 24

  const labelStyle = new TextStyle({
    fill: 0xcc66ff, fontSize: 10,
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 'bold',
    stroke: { color: 0x000011, width: 3 },
  })
  const bossLabel = new Text({ text: 'BNOX - TRÙM SÒ', style: labelStyle })
  bossLabel.anchor.set(0.5, 1); bossLabel.y = -size - 27

  const container = new Container()
  container.addChild(body, hpBarBg, hpBar, bossLabel)
  container.x = GAME_W / 2; container.y = -size * 2.5
  ctx.gameLayer.addChild(container)

  // ── 2 Machine gun turrets (on wings) ──────────────────────────────────────
  const trumSoGuns: TrumSoGun[] = []
  const mgOffsets: [number, number][] = [[-82, 12], [82, 12]]
  for (const [offX, offY] of mgOffsets) {
    const gg = new Graphics()
    drawTrumSoMachineGun(gg)
    gg.x = offX; gg.y = offY
    container.addChild(gg)
    trumSoGuns.push({
      gfx: gg, offsetX: offX, offsetY: offY,
      type: 'machinegun',
      timer: 60 + Math.random() * 30,
      burstLeft: 0,
      rapidTimer: 4,
    })
  }

  // ── 3 Missile pods ─────────────────────────────────────────────────────────
  const missileOffsets: [number, number][] = [[-38, -28], [0, 28], [38, -28]]
  for (const [offX, offY] of missileOffsets) {
    const pg = new Graphics()
    drawTrumSoMissilePod(pg)
    pg.x = offX; pg.y = offY
    container.addChild(pg)
    trumSoGuns.push({
      gfx: pg, offsetX: offX, offsetY: offY,
      type: 'missile',
      timer: 300 + Math.random() * 60,
      burstLeft: 0,
      rapidTimer: 0,
    })
  }

  // ── 6 Laser emitter nodes (world-space laser graphics) ─────────────────────
  const laserNodeOffsets: [number, number][] = [
    [0, -62], [54, -30], [60, 26], [28, 58], [-28, 58], [-60, 26],
  ]
  const trumSoLasers: TrumSoLaser[] = []
  for (let li = 0; li < laserNodeOffsets.length; li++) {
    const [offX, offY] = laserNodeOffsets[li]!
    const ng = new Graphics()
    drawTrumSoLaserNode(ng)
    ng.x = offX; ng.y = offY
    container.addChild(ng)
    const laserGfx = new Graphics()
    ctx.gameLayer.addChild(laserGfx)
    trumSoLasers.push({
      gfx: laserGfx, offsetX: offX, offsetY: offY,
      state: 'idle',
      timer: 120 + li * 50 + Math.random() * 80,
      angle: 0,
    })
  }

  // ── Phase 2 combined laser & charge line (world-space children) ────────────
  const phase2LaserGfx = new Graphics()
  ctx.gameLayer.addChild(phase2LaserGfx)
  const chargeLineGfx = new Graphics()
  ctx.gameLayer.addChild(chargeLineGfx)

  // ── Alert ──────────────────────────────────────────────────────────────────
  const alertStyle = new TextStyle({
    fill: 0xbb44ff, fontSize: 22,
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 'bold',
    stroke: { color: 0x110022, width: 4 },
  })
  const alertText = new Text({ text: '⚠ BOSS XUẤT HIỆN ⚠', style: alertStyle })
  alertText.anchor.set(0.5, 0.5)
  alertText.x = GAME_W / 2; alertText.y = GAME_H * 0.45; alertText.alpha = 0
  ctx.uiLayer.addChild(alertText)
  let alertFrame = 0
  const alertTick = () => {
    alertFrame++
    if (alertFrame < 30) alertText.alpha = alertFrame / 30
    else if (alertFrame < 120) alertText.alpha = 1
    else alertText.alpha = Math.max(0, 1 - (alertFrame - 120) / 30)
    if (alertFrame >= 150) { ctx.uiLayer.removeChild(alertText); ctx.app?.ticker.remove(alertTick) }
  }
  ctx.app?.ticker.add(alertTick)
  screenFlash(ctx, 0x6600cc, 0.35, 500)

  ctx.enemies.push({
    container, body, hpBarBg, hpBar,
    kind: 'boss_trumso',
    vy: 0, vx: 0,
    hp: maxHp, maxHp, barW,
    bossLabel,
    bossEntered: false,
    bossTargetY: GAME_H * 0.20,
    bossPhase: 1,
    attack1Timer: 0,
    attack2Timer: 300,
    bossDriftTarget: GAME_W / 2,
    bossDriftTimer: 200,
    pendingMissiles: 0,
    missileFireTimer: 0,
    laserTargetX: GAME_W / 2,
    laserTargetY: GAME_H / 2,
    trumSoGuns,
    trumSoLasers,
    trumSoPhase2LaserGfx: phase2LaserGfx,
    trumSoCharge: 'idle',
    trumSoChargeTimer: 900,
    trumSoChargeLane: GAME_W / 2,
    trumSoChargeLineGfx: chargeLineGfx,
    trumSoContinuousDmgTimer: 30,
  })
  game.stageEnemiesTotal++
}
