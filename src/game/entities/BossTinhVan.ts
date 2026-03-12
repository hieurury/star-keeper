import { Graphics, Container, Text, TextStyle } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy, TinhVanGun } from '../types'
import { GAME_W, GAME_H } from '../constants'
import { redrawHpBar } from '../utils'
import { screenFlash } from '../systems/effects'

type GameStore = ReturnType<typeof useGameStore>

// ─── Graphics ─────────────────────────────────────────────────────────────────
export function drawBossTinhVan(g: Graphics, size: number): void {
  g.clear()
  // Outer nebula haze
  g.circle(0, 0, size * 1.18).fill({ color: 0x220033, alpha: 0.35 })
  // Main octagonal body (alternating vertex distances for star-octagon shape)
  const pts: number[] = []
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 - Math.PI / 16
    const r = k % 2 === 0 ? size * 1.0 : size * 0.78
    pts.push(Math.cos(a) * r, Math.sin(a) * r)
  }
  g.poly(pts).fill(0x0c0018)
  // Mid ring fill
  g.circle(0, 0, size * 0.70).fill(0x180028)
  // Accretion band glow
  g.circle(0, 0, size * 0.70).stroke({ color: 0x5500aa, width: 3, alpha: 0.75 })
  // Core
  g.circle(0, 0, size * 0.30).fill({ color: 0x7700cc, alpha: 0.9 })
  g.circle(0, 0, size * 0.16).fill({ color: 0xcc44ff, alpha: 0.95 })
  g.circle(0, 0, size * 0.08).fill({ color: 0xffffff, alpha: 0.85 })
  // Gun mount sockets (visual guides)
  for (const [gx, gy] of [[-55, -20], [55, -20], [-68, 28], [68, 28]] as [number, number][]) {
    g.circle(gx, gy, 12).fill(0x180028)
    g.circle(gx, gy, 12).stroke({ color: 0x440066, width: 1.5, alpha: 0.8 })
  }
}

export function drawTinhVanGun(g: Graphics, size = 9): void {
  g.clear()
  g.circle(0, 0, size).fill(0x1a0033)
  g.circle(0, 0, size * 0.55).fill(0x440066)
  g.rect(-size * 0.26, 0, size * 0.52, size * 1.1).fill(0x220044)
  g.circle(0, 0, size * 0.24).fill({ color: 0xaa33ff, alpha: 0.9 })
}

// ─── Cleanup (called by kill.ts) ──────────────────────────────────────────────
export function cleanupBossTinhVan(ctx: GameContext, e: Enemy): void {
  // tinhVanGuns are container children → removed with container automatically
  if (e.blackHoles) {
    for (const bh of e.blackHoles) {
      bh.gfx.clear()
      if (!bh.gfx.destroyed) ctx.gameLayer.removeChild(bh.gfx)
    }
  }
  if (e.summonPortalGfx) {
    e.summonPortalGfx.clear()
    if (!e.summonPortalGfx.destroyed) ctx.gameLayer.removeChild(e.summonPortalGfx)
  }
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
export function spawnBossTinhVan(ctx: GameContext, game: GameStore): void {
  const size = 64
  const maxHp = 2800 + game.currentStage * 600
  const barW = 300

  const body = new Graphics()
  drawBossTinhVan(body, size)

  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 30; hpBar.y = -size - 30

  const labelStyle = new TextStyle({
    fill: 0xcc44ff, fontSize: 10,
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 'bold',
    stroke: { color: 0x000011, width: 3 },
  })
  const bossLabel = new Text({ text: 'BNOX - TINH VÂN HẮC ÁM', style: labelStyle })
  bossLabel.anchor.set(0.5, 1); bossLabel.y = -size - 32

  const container = new Container()
  container.addChild(body, hpBarBg, hpBar, bossLabel)
  container.x = GAME_W / 2; container.y = -size * 3
  ctx.gameLayer.addChild(container)

  // 4 gun turrets as container children (auto-move with boss)
  const gunOffsets: [number, number][] = [[-55, -20], [55, -20], [-68, 28], [68, 28]]
  const guns: TinhVanGun[] = gunOffsets.map(([offX, offY], idx) => {
    const gg = new Graphics()
    drawTinhVanGun(gg, 9)
    container.addChild(gg)
    gg.x = offX; gg.y = offY
    return {
      gfx: gg, offsetX: offX, offsetY: offY,
      shootTimer: 180, burstLeft: 0,
      pauseTimer: 30 + idx * 30,  // stagger initial bursts
    }
  })

  // Portal for phase 2 summon (separate gameLayer child — world-space positioned)
  const portalGfx = new Graphics()
  portalGfx.visible = false
  ctx.gameLayer.addChild(portalGfx)

  // Alert text
  const alertStyle = new TextStyle({
    fill: 0xcc00ff, fontSize: 22,
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
  screenFlash(ctx, 0x660099, 0.4, 600)

  ctx.enemies.push({
    container, body, hpBarBg, hpBar,
    kind: 'boss_tinhvan',
    vy: 0, vx: 0,
    hp: maxHp, maxHp, barW,
    bossLabel,
    bossEntered: false,
    bossTargetY: GAME_H * 0.20,
    bossPhase: 1,
    attack1Timer: 360,    // first black hole after 6s
    attack2Timer: 1800,   // phase 2 summon cooldown: 30s
    bossDriftTimer: 0,
    tinhVanGuns: guns,
    blackHoles: [],
    summonPortalGfx: portalGfx,
    pendingMissiles: 0,
    missileFireTimer: 0,
  })
}
