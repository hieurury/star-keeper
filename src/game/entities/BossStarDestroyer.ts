import { Graphics, Container, Text, TextStyle } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy } from '../types'
import { GAME_W, GAME_H } from '../constants'
import { redrawHpBar } from '../utils'
import { drawBossBullet, drawBossMissile } from '../projectiles/index'
import { spawnExplosion, screenFlash } from '../systems/effects'

type GameStore = ReturnType<typeof useGameStore>

// ─── Graphics ─────────────────────────────────────────────────────────────────
export function drawStarDestroyer(g: Graphics, size: number): void {
  g.clear()
  g.poly([0, -size*0.6, size*1.5, size*0.1, size*0.9, size*0.8, -size*0.9, size*0.8, -size*1.5, size*0.1]).fill(0x1a2a88)
  g.rect(-size*0.3, -size*0.55, size*0.6, size*1.1).fill(0x112266)
  g.poly([-size*0.9, size*0.8, -size*1.5, size*0.1, -size*1.5, size*0.5]).fill(0x0d1a55)
  g.poly([size*0.9, size*0.8, size*1.5, size*0.1, size*1.5, size*0.5]).fill(0x0d1a55)
  g.rect(-size*1.45, size*0.05, size*0.22, size*0.5).fill(0x334499)
  g.rect(size*1.23, size*0.05, size*0.22, size*0.5).fill(0x334499)
  g.circle(0, size*0.2, size*0.22).fill(0x2255cc)
  g.circle(0, size*0.2, size*0.12).fill({ color: 0x88aaff, alpha: 0.9 })
  g.rect(-size*0.15, -size*0.5, size*0.3, size*0.22).fill(0x6688dd)
  g.rect(-size*0.5, size*0.75, size*0.18, size*0.22).fill({ color: 0x4466ff, alpha: 0.85 })
  g.rect(-size*0.09, size*0.75, size*0.18, size*0.22).fill({ color: 0x4466ff, alpha: 0.85 })
  g.rect(size*0.32, size*0.75, size*0.18, size*0.22).fill({ color: 0x4466ff, alpha: 0.85 })
}

// ─── Spawn ────────────────────────────────────────────────────────────────────
export function spawnStarDestroyer(ctx: GameContext, game: GameStore): void {
  const size = 50
  const maxHp = 1600 + game.currentStage * 400
  const barW = 260
  const body = new Graphics()
  drawStarDestroyer(body, size)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 16; hpBar.y = -size - 16
  const laserLine = new Graphics()
  laserLine.visible = false
  const labelStyle = new TextStyle({ fill: 0xaaccff, fontSize: 10, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 'bold', stroke: { color: 0x000022, width: 3 } })
  const bossLabel = new Text({ text: 'ANOX - KẾ DIỆT SAO', style: labelStyle })
  bossLabel.anchor.set(0.5, 1)
  bossLabel.y = -size - 18
  const container = new Container()
  container.addChild(body, hpBarBg, hpBar, laserLine, bossLabel)
  container.x = GAME_W / 2
  container.y = -size * 2.5
  ctx.gameLayer.addChild(container)

  // Alert text
  const alertStyle = new TextStyle({ fill: 0xff4444, fontSize: 22, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 'bold', stroke: { color: 0x220000, width: 4 } })
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
  screenFlash(ctx, 0xff2222, 0.3, 500)

  ctx.enemies.push({
    container, body, hpBarBg, hpBar,
    kind: 'boss_stardestroyer',
    vy: 0, vx: 0,
    hp: maxHp, maxHp, barW,
    laserLine, bossLabel,
    bossEntered: false,
    bossTargetY: GAME_H * 0.18,
    bossPhase: 1,
    attack1Timer: 100,
    attack2Timer: 280,
    bossAttack2State: 'ready',
    laserLockTimer: 0,
    pendingMissiles: 0,
    missileFireTimer: 0,
    bossDriftTarget: GAME_W / 2,
    bossDriftTimer: 200,
  })
  game.stageEnemiesTotal++
}

// ─── AI Update ────────────────────────────────────────────────────────────────
/** Returns true if the enemy was removed. */
export function updateBossStarDestroyer(ctx: GameContext, _game: GameStore, e: Enemy, _i: number, dt: number): boolean {
  if (!e.bossEntered) {
    e.container.y += 1.2 * dt
    if (e.container.y >= (e.bossTargetY ?? GAME_H * 0.18)) {
      e.container.y = e.bossTargetY ?? GAME_H * 0.18
      e.bossEntered = true
    }
  }
  if (!e.bossEntered) return false

  // Phase 2 transition
  if (e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
    e.bossPhase = 2
    screenFlash(ctx, 0x4466ff, 0.5, 600)
    spawnExplosion(ctx, e.container.x, e.container.y, 28, 0x4466ff, 0xaaccff)
    if (e.bossLabel) {
      e.bossLabel.text = 'ANOX - DIỆT SAO [PHASE 2]'
      e.bossLabel.style = new TextStyle({ fill: 0xff88cc, fontSize: 10, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 'bold', stroke: { color: 0x000022, width: 3 } })
    }
    if (e.laserLine) { e.laserLine.clear(); e.laserLine.visible = false }
    e.bossAttack2State = 'ready'
    e.attack2Timer = 300
  }

  // Horizontal drift
  e.bossDriftTimer = (e.bossDriftTimer ?? 0) - dt
  if ((e.bossDriftTimer ?? 0) <= 0) {
    e.bossDriftTarget = Math.random() * (GAME_W - 120) + 60
    e.bossDriftTimer = 180 + Math.random() * 120
  }
  if (e.bossDriftTarget !== undefined) {
    const ddx = e.bossDriftTarget - e.container.x
    e.container.x += Math.min(Math.abs(ddx), 2.5 * dt) * Math.sign(ddx)
  }

  // Attack 1 — 6-bullet scatter
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
          gfx: bg,
          vx: Math.cos(angle) * 5.5,
          vy: Math.sin(angle) * 5.5,
          onHitPlayer: () => {
            if (!capturedEnemy.body || capturedEnemy.body.destroyed) return
            capturedEnemy.hp = Math.min(capturedEnemy.maxHp, capturedEnemy.hp + capturedEnemy.maxHp * 0.05)
            redrawHpBar(capturedEnemy.hpBarBg, capturedEnemy.hpBar, capturedEnemy.hp / capturedEnemy.maxHp, capturedEnemy.barW)
          },
        })
      }
    }
  }

  // Attack 2
  if (e.bossPhase === 1) {
    if (e.bossAttack2State === 'ready') {
      e.attack2Timer = (e.attack2Timer ?? 600) - dt
      if ((e.attack2Timer ?? 0) <= 0) {
        e.bossAttack2State = 'locking'
        e.laserLockTimer = 80
        if (e.laserLine) e.laserLine.visible = true
      }
    } else {
      e.laserLockTimer = (e.laserLockTimer ?? 0) - dt
      if (e.laserLine && ctx.playerShip) {
        const ltx = ctx.playerShip.x - e.container.x
        const lty = ctx.playerShip.y - e.container.y
        e.laserTargetX = ctx.playerShip.x
        e.laserTargetY = ctx.playerShip.y
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
        e.bossAttack2State = 'ready'
        e.attack2Timer = 380
      }
    }
  } else {
    // Phase 2: slow homing missiles
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
        ctx.enemyBullets.push({ gfx: smg, vx: (mdx / mmag) * 3.0, vy: (mdy / mmag) * 3.0, homing: true, homingLife: 240, homingSpeed: 3.0 })
        e.pendingMissiles!--
        e.missileFireTimer = 4
      }
    }
    e.attack2Timer = (e.attack2Timer ?? 600) - dt
    if ((e.attack2Timer ?? 0) <= 0 && (e.pendingMissiles ?? 0) === 0) {
      e.pendingMissiles = 14; e.missileFireTimer = 0; e.attack2Timer = 320
    }
  }
  return false
}
