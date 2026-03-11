import { Graphics, Container, Text, TextStyle } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy, BossTurret } from '../types'
import { GAME_W, GAME_H } from '../constants'
import { redrawHpBar } from '../utils'
import { drawEnemyBullet } from '../projectiles/index'
import { spawnExplosion, screenFlash, spawnDamageText } from '../systems/effects'
import { spawnKamikazeAt } from './Kamikaze'

type GameStore = ReturnType<typeof useGameStore>

// ─── Graphics ─────────────────────────────────────────────────────────────────
export function drawBossInvader(g: Graphics, size: number): void {
  g.clear()
  g.poly([0, -size*0.9, size*0.5, -size*0.3, size*0.62, size*0.38, size*0.28, size*0.82, 0, size*0.65, -size*0.28, size*0.82, -size*0.62, size*0.38, -size*0.5, -size*0.3]).fill(0x1a4a88)
  g.poly([0, -size*0.9, size*0.2, -size*0.5, 0, -size*0.58, -size*0.2, -size*0.5]).fill(0x2266aa)
  g.poly([-size*0.55, -size*0.05, -size*1.3, size*0.28, -size*0.72, size*0.48, -size*0.55, size*0.22]).fill(0x153a77)
  g.poly([size*0.55, -size*0.05, size*1.3, size*0.28, size*0.72, size*0.48, size*0.55, size*0.22]).fill(0x153a77)
  g.poly([-size*0.22, size*0.65, -size*0.5, size*1.1, 0, size*0.78, size*0.5, size*1.1, size*0.22, size*0.65]).fill(0x2266aa)
  g.circle(-size*0.22, -size*0.52, size*0.09).fill(0xff3333)
  g.circle( size*0.22, -size*0.52, size*0.09).fill(0xff3333)
  g.circle(0, size*0.05, size*0.2).fill(0x3366cc)
  g.circle(0, size*0.05, size*0.11).fill({ color: 0x88bbff, alpha: 0.9 })
  g.rect(-size*0.18, -size*0.88, size*0.36, size*0.06).fill(0xaaccff)
}

export function drawTurret(g: Graphics, size: number, stunned = false): void {
  g.clear()
  const bodyColor   = stunned ? 0x444444 : 0x2266cc
  const innerColor  = stunned ? 0x777777 : 0x44aaff
  const barrelColor = stunned ? 0x555555 : 0x335599
  g.circle(0, 0, size).fill(bodyColor)
  g.circle(0, 0, size * 0.6).fill(innerColor)
  g.rect(-size * 0.22, 0, size * 0.44, size * 0.85).fill(barrelColor)
  if (!stunned) {
    g.circle(0, 0, size * 0.25).fill({ color: 0xffffff, alpha: 0.8 })
  } else {
    const xs = size * 0.35
    g.moveTo(-xs, -xs).lineTo(xs, xs).stroke({ color: 0xff4444, width: 2 })
    g.moveTo( xs, -xs).lineTo(-xs, xs).stroke({ color: 0xff4444, width: 2 })
  }
}

// ─── Turret cleanup (used by kill.ts) ─────────────────────────────────────────
export function cleanupBossInvaderTurrets(ctx: GameContext, e: Enemy): void {
  if (!e.bossTurrets || !ctx.gameLayer) return
  for (const t of e.bossTurrets) {
    t.laserGfx.clear()
    if (!t.laserGfx.destroyed) ctx.gameLayer.removeChild(t.laserGfx)
  }
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
export function spawnBossInvader(ctx: GameContext, game: GameStore): void {
  const size = 50
  const maxHp = 2000 + game.currentStage * 500
  const barW = 280
  const body = new Graphics()
  drawBossInvader(body, size)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 22; hpBar.y = -size - 22
  const laserLine = new Graphics()
  laserLine.visible = false
  const labelStyle = new TextStyle({ fill: 0x88bbff, fontSize: 10, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 'bold', stroke: { color: 0x000022, width: 3 } })
  const bossLabel = new Text({ text: 'ANOX - KẺ XÂM LĂNG', style: labelStyle })
  bossLabel.anchor.set(0.5, 1); bossLabel.y = -size - 24
  const container = new Container()
  container.addChild(body, hpBarBg, hpBar, laserLine, bossLabel)
  container.x = GAME_W / 2; container.y = -size * 2.5
  ctx.gameLayer.addChild(container)

  // Turrets
  const turretMaxHp = 80 + game.currentStage * 20
  const turretOffsets: [number, number][] = [[-70,-15],[70,-15],[-88,42],[88,42],[0,68]]
  const bossTurrets: BossTurret[] = turretOffsets.map(([offX, offY], ti) => {
    const tg = new Graphics(); drawTurret(tg, 10); tg.x = offX; tg.y = offY
    const thpBg = new Graphics(); thpBg.x = offX; thpBg.y = offY - 20
    const thpBar = new Graphics(); thpBar.x = offX; thpBar.y = offY - 20
    redrawHpBar(thpBg, thpBar, 1, 24)
    container.addChild(tg, thpBg, thpBar)
    const laserGfx = new Graphics(); ctx.gameLayer.addChild(laserGfx)
    return {
      gfx: tg, hpBarBg: thpBg, hpBar: thpBar,
      hp: turretMaxHp, maxHp: turretMaxHp,
      offsetX: offX, offsetY: offY,
      stunTimer: 0,
      shootTimer: 40 + ti * 18 + Math.random() * 30,
      attached: false, kamiTimer: 0,
      laserState: 'idle' as const,
      laserTimer: 150 + ti * 55 + Math.random() * 100,
      laserWarnTimer: 0, laserAngle: 0, laserGfx,
    }
  })

  // Alert text
  const alertStyle = new TextStyle({ fill: 0x4499ff, fontSize: 22, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 'bold', stroke: { color: 0x000022, width: 4 } })
  const alertText = new Text({ text: '⚠ BOSS XUẤT HIỆN ⚠', style: alertStyle })
  alertText.anchor.set(0.5, 0.5); alertText.x = GAME_W / 2; alertText.y = GAME_H * 0.45; alertText.alpha = 0
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
  screenFlash(ctx, 0x2255ff, 0.3, 500)

  ctx.enemies.push({
    container, body, hpBarBg, hpBar,
    kind: 'boss_invader',
    vy: 0, vx: 0,
    hp: maxHp, maxHp, barW,
    laserLine, bossLabel,
    bossEntered: false,
    bossTargetY: GAME_H * 0.22,
    bossPhase: 1,
    attack1Timer: 0, attack2Timer: 0,
    bossDriftTarget: GAME_W / 2, bossDriftTimer: 200,
    bossTurrets,
  })
  game.stageEnemiesTotal++
}

// ─── AI Update ────────────────────────────────────────────────────────────────
export function updateBossInvader(ctx: GameContext, game: GameStore, e: Enemy, _i: number, dt: number): boolean {
  if (!e.bossEntered) {
    e.container.y += 1.2 * dt
    if (e.container.y >= (e.bossTargetY ?? GAME_H * 0.22)) {
      e.container.y = e.bossTargetY ?? GAME_H * 0.22
      e.bossEntered = true
    }
  }
  if (!e.bossEntered) return false

  // Phase 2 transition
  if (e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
    e.bossPhase = 2
    screenFlash(ctx, 0x2255ff, 0.5, 600)
    spawnExplosion(ctx, e.container.x, e.container.y, 28, 0x2255ff, 0x88bbff)
    if (e.bossLabel) {
      e.bossLabel.text = 'ANOX - KẺ XÂM LĂNG [PHASE 2]'
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

  // Drift
  e.bossDriftTimer = (e.bossDriftTimer ?? 0) - dt
  if ((e.bossDriftTimer ?? 0) <= 0) {
    e.bossDriftTarget = Math.random() * (GAME_W - 120) + 60
    e.bossDriftTimer = 180 + Math.random() * 120
  }
  if (e.bossDriftTarget !== undefined) {
    const ddx = e.bossDriftTarget - e.container.x
    e.container.x += Math.min(Math.abs(ddx), 2.0 * dt) * Math.sign(ddx)
  }

  // Turrets
  if (e.bossTurrets) {
    for (const t of e.bossTurrets) {
      if (t.stunTimer > 0) {
        t.stunTimer -= dt; t.laserGfx.clear()
        if (t.stunTimer <= 0) {
          t.stunTimer = 0; t.hp = t.maxHp
          drawTurret(t.gfx, 10, false)
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
        if (t.kamiTimer >= 300) { t.kamiTimer = 0; spawnKamikazeAt(ctx, game, e.container.x + t.offsetX, e.container.y + t.offsetY) }
      } else {
        if (t.laserState !== 'idle') {
          const wx = e.container.x + t.offsetX; const wy = e.container.y + t.offsetY
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
              if (ctx.playerShip) {
                const px = ctx.playerShip.x - wx; const py = ctx.playerShip.y - wy
                const lx = Math.cos(t.laserAngle); const ly = Math.sin(t.laserAngle)
                const dot = px * lx + py * ly
                const perpX = px - dot * lx; const perpY = py - dot * ly
                if (Math.sqrt(perpX * perpX + perpY * perpY) < 22 && dot > 0) {
                  if (!game.absorbShieldHit()) {
                    const dmg = 18 + game.currentStage * 2
                    game.takeDamage(dmg); screenFlash(ctx)
                    spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, dmg)
                  } else {
                    spawnExplosion(ctx, ctx.playerShip.x, ctx.playerShip.y, 9, 0x44aaff, 0x88ddff)
                    screenFlash(ctx, 0x4488ff, 0.28, 200)
                  }
                }
              }
            }
          } else {
            t.laserWarnTimer -= dt
            t.gfx.rotation = t.laserAngle + Math.PI / 2
            const alpha = Math.max(0, t.laserWarnTimer / 18) * 0.85
            t.laserGfx.clear()
            t.laserGfx.moveTo(wx, wy).lineTo(wx + Math.cos(t.laserAngle) * len, wy + Math.sin(t.laserAngle) * len).stroke({ color: 0x44aaff, width: 5, alpha })
            if (t.laserWarnTimer <= 0) { t.laserState = 'idle'; t.laserTimer = 200 + Math.random() * 120; t.laserGfx.clear() }
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
            const spd = 3.5
            for (let k = 0; k < 2; k++) {
              const spread = (k - 0.5) * 0.12
              const angle = Math.atan2(tdy, tdx) + spread
              const bg = new Graphics(); drawEnemyBullet(bg); bg.x = wx; bg.y = wy
              ctx.gameLayer.addChild(bg)
              ctx.enemyBullets.push({ gfx: bg, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd })
            }
          }
        }
      }
    }
  }
  return false
}
