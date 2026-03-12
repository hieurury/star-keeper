<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Application, Graphics, Container, Text, TextStyle, Ticker } from 'pixi.js'
import { useGameStore } from '../../stores/gameStore'

// ─── Modular game system imports ──────────────────────────────────────────────
import { createGameContext } from '../../game/context'
import { GAME_W, GAME_H, TOUCH_Y_OFFSET, INTRO_FRAMES, STAGE_TITLE_FRAMES } from '../../game/constants'
import { dist2, redrawHpBar, findNearestEnemy } from '../../game/utils'

import { drawShip, drawBullet, spawnHolderLaser, drawShooterMissile } from '../../game/ship/index'
import { drawFragmentMissile } from '../../game/projectiles/index'
import { drawEnemyBullet, drawBossBullet, drawBossMissile, drawTrumSoMissile } from '../../game/projectiles/index'

import { spawnExplosion, screenFlash, spawnDamageText, hitFlash, showStageClearBanner, spawnMissileWarning } from '../../game/systems/effects'
import { spawnEnemyOrbs } from '../../game/systems/orbs'
import { createStar } from '../../game/systems/background'
import { updateMissileLaunchers, updatePeriodicAbilities, activateHeatWave, activateBlackHole } from '../../game/systems/abilities'
import { drawArtifactGfx, initArtifactGfx, activateNeutronVacuum, activateManaCoreOverload, activateSoulHarvest } from '../../game/systems/artifacts'
import { launchWave } from '../../game/systems/wave'
import { killEnemy } from '../../game/entities/kill'
import { spawnKamikazeAt } from '../../game/entities/Kamikaze'
import { drawDaiLienBullet, spawnDaiLienPair } from '../../game/entities/DaiLien'
import { drawThuHo, spawnThuHoSwarm } from '../../game/entities/ThuHo'
import { drawHealBeam, spawnThuatSi } from '../../game/entities/ThuatSi'
import type { Enemy } from '../../game/types'

const canvasWrapper = ref<HTMLDivElement>()
const game = useGameStore()

let app: Application | null = null
let autoPaused = false   // tracks pauses triggered by visibility/blur
const ctx = createGameContext()

// Zoom indicator (shows when boss zoom is changing)
let zoomIndicatorText: Text | null = null
let zoomIndicatorTimer = 0
let zoomIndicatorLastZoom = 1.0

// ─── Auto-pause on tab switch / window blur ───────────────────────────────────
function handleVisibilityChange() {
  if (document.hidden) {
    if (game.isPlaying && !game.isPaused) {
      game.isPaused = true
      autoPaused = true
    }
  } else if (autoPaused) {
    // Game stays paused — player must press "Tiếp Tục" manually
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
  // Game stays paused — player must press "Tiếp Tục" manually
  if (autoPaused) autoPaused = false
}

// ─── Shoot ────────────────────────────────────────────────────────────────────
function shoot(offsetX = 0, vxDrift = 0) {
  if (!ctx.playerShip) return
  const g = new Graphics()
  drawBullet(g, game.upgrades.bulletSpeed)
  g.x = ctx.playerShip.x + offsetX
  g.y = ctx.playerShip.y - 22
  ctx.gameLayer.addChild(g)
  ctx.bullets.push({ gfx: g, vy: 8 * game.upgrades.bulletSpeed, vx: vxDrift })
}

// ─── Game loop ────────────────────────────────────────────────────────────────
function gameLoop(ticker: Ticker) {
  if (!app || !game.isPlaying || game.isGameOverSequence) return
  const dt = ticker.deltaTime

  // Stars always scroll
  for (const s of ctx.stars) {
    s.gfx.y += s.vy * dt
    if (s.gfx.y > GAME_H) s.gfx.y = -4
  }

  // ── INTRO PHASE ──────────────────────────────────────────────────────────
  if (ctx.gamePhase === 'intro') {
    ctx.introTimer += dt
    const progress = Math.min(ctx.introTimer / INTRO_FRAMES, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    const startY = GAME_H + 60
    const endY = GAME_H * 0.67
    if (ctx.playerShip) {
      ctx.playerShip.y = startY + (endY - startY) * eased
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
      ctx.stageTitleText = new Text({ text: 'CHẾ ĐỘ VÔ TẬN', style })
      ctx.stageTitleText.anchor.set(0.5, 0.5)
      ctx.stageTitleText.x = GAME_W / 2
      ctx.stageTitleText.y = GAME_H * 0.38
      ctx.stageTitleText.alpha = 0
      ctx.uiLayer.addChild(ctx.stageTitleText)
    }
    return
  }

  // ── STAGE TITLE PHASE ────────────────────────────────────────────────────
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
      const spd = 5.5 * game.upgrades.shipSpeed * hpPenalty
      ctx.playerShip.x += dx * 0.055 * spd * dt * 0.5
      ctx.playerShip.y += dy * 0.055 * spd * dt * 0.5
      ctx.playerShip.x = Math.max(20, Math.min(GAME_W - 20, ctx.playerShip.x))
      ctx.playerShip.y = Math.max(60, Math.min(GAME_H - 60, ctx.playerShip.y))
    }
    return
  }

  // ── BOSS INTRO PHASE: boss đang trượt vào, không bắn, chỉ di chuyển ─────
  if (ctx.gamePhase === 'bossIntro') {
    // Tiếp tục di chuyển các viên đạn đã bắn ra trước đó
    for (let i = ctx.bullets.length - 1; i >= 0; i--) {
      const b = ctx.bullets[i]
      b.gfx.y -= b.vy * dt
      if (b.vx) b.gfx.x += b.vx * dt
      if (b.gfx.y < -20 || b.gfx.x < -10 || b.gfx.x > GAME_W + 10) {
        if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
        ctx.bullets.splice(i, 1)
      }
    }
    // Cho phép di chuyển máy bay người chơi
    if (ctx.playerShip && ctx.isDragging) {
      const _bz = ctx.bossZoom
      const _blx = GAME_W * (1 - _bz) / 2; const _bly = GAME_H * (1 - _bz) / 2
      const dx = (ctx.touchX - _blx) / _bz - ctx.playerShip.x
      const dy = ((ctx.touchY - _bly) / _bz - TOUCH_Y_OFFSET) - ctx.playerShip.y
      const hpPenalty = Math.max(0.7, Math.pow(100 / game.playerMaxHp, 0.15))
      const spd = 5.5 * game.upgrades.shipSpeed * hpPenalty
      ctx.playerShip.x += dx * 0.055 * spd * dt * 0.5
      ctx.playerShip.y += dy * 0.055 * spd * dt * 0.5
      ctx.playerShip.x = Math.max(20, Math.min(GAME_W - 20, ctx.playerShip.x))
      ctx.playerShip.y = Math.max(60, Math.min(GAME_H - 60, ctx.playerShip.y))
    }
    // Chạy entry animation + post-entry timer cho boss
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
            e.bossBattleTimer = 60  // thêm 1s delay sau khi vào vị trí
          }
        }
      } else {
        // Đã vào vị trí, chờ timer trước khi bắt đầu chiến đấu
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
    ctx.bossZoomTarget = _tinhVanAlive ? 0.75 : 1.0
    if (Math.abs(ctx.bossZoom - ctx.bossZoomTarget) > 0.001) {
      const zSpeed = 0.006 * dt
      ctx.bossZoom += Math.sign(ctx.bossZoomTarget - ctx.bossZoom) * Math.min(zSpeed, Math.abs(ctx.bossZoomTarget - ctx.bossZoom))
    }
    ctx.gameLayer.scale.set(ctx.bossZoom)
    ctx.gameLayer.position.set(GAME_W * (1 - ctx.bossZoom) / 2, GAME_H * (1 - ctx.bossZoom) / 2)
    // Chuyển sang 'playing' sau khi hết delay — reset shootTimer để không bắn ngay lập tức
    if (battleReady) {
      ctx.gamePhase = 'playing'
      ctx.shootTimer = 0
    }
    return
  }

  // ── PLAYING PHASE ────────────────────────────────────────────────────────
  if (game.isPaused) return

  game.tickSkillCooldown(dt / 60)
  game.tickShield(dt / 60)

  // Neutron Star vacuum timer
  if (game.artifactStats.neutronVacuumActive) {
    ctx.neutronVacuumTimer += dt / 60
    if (ctx.neutronVacuumTimer >= 30) {
      ctx.neutronVacuumTimer = 0
      activateNeutronVacuum(ctx, game)
    }
    game.neutronVacuumPct = ctx.neutronVacuumTimer / 30
  }

  // Mana core overload (set by killEnemy via flag to avoid circular dep)
  if (ctx.manaCoreOverloadPending) {
    ctx.manaCoreOverloadPending = false
    activateManaCoreOverload(ctx, game)
  }

  // Artifact gfx orbits ship
  if (ctx.artifactGfx && ctx.playerShip) {
    const equipped = game.equippedArtifacts[game.selectedShip] ?? []
    const artifactId = equipped[0] ?? ''
    ctx.artifactOrbitAngle += 0.022 * dt
    const orbitR = 36
    ctx.artifactGfx.x = ctx.playerShip.x + Math.cos(ctx.artifactOrbitAngle) * orbitR
    ctx.artifactGfx.y = ctx.playerShip.y + Math.sin(ctx.artifactOrbitAngle) * orbitR * 0.55
    let pulse = 0
    if (artifactId === 'neutron_star') pulse = game.neutronVacuumPct
    if (artifactId === 'mana_core') pulse = game.manaCorePct
    drawArtifactGfx(ctx.artifactGfx, artifactId, pulse)
  }

  // Skill activation
  if (game.consumeSkillActivation()) {
    if (game.selectedShip === 'star_holder') {
      activateSoulHarvest(ctx, game)
    } else if (game.selectedShip === 'star_shooter') {
      activateBlackHole(ctx, game)
    } else {
      activateHeatWave(ctx, game)
    }
  }

  // Card abilities
  updateMissileLaunchers(ctx, game, dt)
  updatePeriodicAbilities(ctx, game, dt)

  // Soul missile firing (Star Holder)
  if (ctx.soulMissileQueue > 0 && ctx.playerShip) {
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

  // Player movement
  if (ctx.isDragging && ctx.playerShip) {
    const _bz2 = ctx.bossZoom
    const _blx2 = GAME_W * (1 - _bz2) / 2; const _bly2 = GAME_H * (1 - _bz2) / 2
    const dx = (ctx.touchX - _blx2) / _bz2 - ctx.playerShip.x
    const dy = ((ctx.touchY - _bly2) / _bz2 - TOUCH_Y_OFFSET) - ctx.playerShip.y
    const hpPenalty = Math.max(0.7, Math.pow(100 / game.playerMaxHp, 0.15))
    const spd = 5.5 * game.upgrades.shipSpeed * (1 + game.cardStats.speedCardPct / 100) * hpPenalty
    ctx.playerShip.x += dx * 0.055 * spd * dt * 0.5
    ctx.playerShip.y += dy * 0.055 * spd * dt * 0.5
    ctx.playerShip.x = Math.max(20, Math.min(GAME_W - 20, ctx.playerShip.x))
    ctx.playerShip.y = Math.max(60, Math.min(GAME_H - 60, ctx.playerShip.y))
  }

  // Shooting
  const isHolder = game.selectedShip === 'star_holder'
  const isShooter = game.selectedShip === 'star_shooter'
  const effectiveBulletCount = isShooter ? 1 : (game.upgrades.bulletCount + game.cardStats.arsenalBulletBonus)
  const effectiveMissileCount = isShooter ? (game.upgrades.bulletCount + game.cardStats.shooterMissileBonus) : 1
  ctx.shootTimer += dt
  const baseShootInterval = isHolder ? 60 : (isShooter ? 80 : 18)
  const shootCount = isShooter ? effectiveMissileCount : effectiveBulletCount
  const shootInterval = (baseShootInterval / Math.sqrt(shootCount)) / (1 + game.permUpgrades.fireRate * 0.15 + game.cardStats.arsenalFireRatePct / 100 + game.cardStats.turboFireRatePct / 100)
  if (ctx.shootTimer >= shootInterval) {
    ctx.shootTimer = 0
    const cnt = isShooter ? effectiveMissileCount : effectiveBulletCount
    if (isHolder && ctx.playerShip) {
      const laserDmg = Math.round(
        game.upgrades.damage * Math.pow(0.8, cnt - 1)
        * (1 + game.cardStats.arsenalDamagePct / 100)
        * (1 + game.cardStats.damageBonusPct / 100)
      )
      screenFlash(ctx, 0xff4400, 0.15, 200)
      const step = Math.PI / 18
      for (let i = 0; i < cnt; i++) {
        const angle = (i - (cnt - 1) / 2) * step
        spawnHolderLaser(ctx, game, ctx.playerShip.x, ctx.playerShip.y - 18, angle, laserDmg)
      }
    } else if (isShooter && ctx.playerShip) {
      const cs = game.cardStats
      const mSpd = 6 * cs.shooterMissileSpdMult
      const missileDmg = Math.round(game.upgrades.damage * cs.shooterMissileDmgMult * (1 + cs.damageBonusPct / 100))
      if (findNearestEnemy(ctx.enemies, ctx.playerShip.x, ctx.playerShip.y)) {
        for (let i = 0; i < cnt; i++) {
          const offX = (i - (cnt - 1) / 2) * 14
          const mg = new Graphics()
          drawShooterMissile(mg)
          mg.x = ctx.playerShip.x + offX; mg.y = ctx.playerShip.y - 22
          ctx.gameLayer.addChild(mg)
          const target = findNearestEnemy(ctx.enemies, mg.x, mg.y)
          const dx = target ? target.container.x - mg.x : 0
          const dy = target ? target.container.y - mg.y : -1
          const d = Math.sqrt(dx * dx + dy * dy) || 1
          ctx.shooterMissiles.push({ gfx: mg, vx: (dx / d) * mSpd, vy: (dy / d) * mSpd, damage: missileDmg, aoe: cs.shooterMissileAoe })
        }
      }
    } else {
      const maxHalfAngle = Math.min(Math.PI * 12 / 180, (cnt - 1) * Math.PI * 3 / 180)
      const bulletVy = 8 * game.upgrades.bulletSpeed
      for (let i = 0; i < cnt; i++) {
        const norm = cnt > 1 ? (i - (cnt - 1) / 2) / ((cnt - 1) / 2) : 0
        const vxDrift = Math.tan(norm * maxHalfAngle) * bulletVy
        shoot((i - (cnt - 1) / 2) * 12, vxDrift)
      }
    }
  }

  // Star Shooter black hole projectile (in-flight phase)
  if (isShooter && ctx.shooterBlackHoleProjGfx) {
    const proj = ctx.shooterBlackHoleProjGfx
    const pdx = ctx.shooterBlackHoleProjTX - proj.x
    const pdy = ctx.shooterBlackHoleProjTY - proj.y
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy) || 1
    const projSpd = 11 * dt
    if (pdist <= projSpd + 2) {
      // Arrived — spawn black hole at target position
      if (!proj.destroyed) ctx.gameLayer.removeChild(proj)
      ctx.shooterBlackHoleProjGfx = null
      const g = new Graphics()
      g.x = ctx.shooterBlackHoleProjTX
      g.y = ctx.shooterBlackHoleProjTY
      ctx.gameLayer.addChild(g)
      ctx.shooterBlackHoleGfx = g
      ctx.shooterBlackHoleTimer = 300
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
      const dmgRate = isBoss ? 0.02 : 0.10
      const bhDmg = Math.round(e.maxHp * dmgRate * dt / 60)
      if (bhDmg > 0) {
        e.hp = Math.max(0, e.hp - bhDmg); hitFlash(e.body)
        redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
        if (e.hp <= 0) { killEnemy(ctx, game, e, i); continue }
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
    }
  }

  // Move player bullets
  for (let i = ctx.bullets.length - 1; i >= 0; i--) {
    const b = ctx.bullets[i]
    b.gfx.y -= b.vy * dt
    if (b.vx) b.gfx.x += b.vx * dt
    if (b.gfx.y < -20 || b.gfx.x < -10 || b.gfx.x > GAME_W + 10) {
      if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
      ctx.bullets.splice(i, 1)
    }
  }

  // Move enemy bullets
  for (let i = ctx.enemyBullets.length - 1; i >= 0; i--) {
    const b = ctx.enemyBullets[i]
    if (b.homing && (b.homingLife ?? 0) > 0 && ctx.playerShip) {
      b.homingLife! -= dt
      const spd = b.homingSpeed ?? 3.5
      const dx = ctx.playerShip.x - b.gfx.x
      const dy = ctx.playerShip.y - b.gfx.y
      const mag = Math.sqrt(dx * dx + dy * dy) || 1
      b.vx += (dx / mag * spd - b.vx) * 0.07
      b.vy += (dy / mag * spd - b.vy) * 0.07
      const vmag = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1
      b.vx = (b.vx / vmag) * spd
      b.vy = (b.vy / vmag) * spd
      b.gfx.rotation = Math.atan2(b.vy, b.vx) + Math.PI / 2
    }
    b.gfx.x += b.vx * dt
    b.gfx.y += b.vy * dt
    if (b.gfx.y > GAME_H + 40 || b.gfx.y < -40 || b.gfx.x < -40 || b.gfx.x > GAME_W + 40) {
      if (!b.gfx.destroyed) ctx.gameLayer.removeChild(b.gfx)
      ctx.enemyBullets.splice(i, 1)
      continue
    }
    const bHitR = b.homing ? 14 : 12
    // AOE missile: explode when reaching target position
    if (b.aoe && b.targetX !== undefined && b.targetY !== undefined) {
      if (dist2(b.gfx.x, b.gfx.y, b.targetX, b.targetY) < 28 * 28) {
        spawnExplosion(ctx, b.gfx.x, b.gfx.y, 22, 0xcc44ff, 0xffffff)
        screenFlash(ctx, 0x8800ff, 0.12, 200)
        if (ctx.playerShip && dist2(b.gfx.x, b.gfx.y, ctx.playerShip.x, ctx.playerShip.y) < 55 * 55) {
          if (game.absorbShieldHit()) {
            spawnExplosion(ctx, ctx.playerShip.x, ctx.playerShip.y, 10, 0x44aaff, 0x88ddff)
            screenFlash(ctx, 0x4488ff, 0.28, 200)
          } else {
            const dmg = 20 + game.currentStage * 3
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
      if (game.absorbShieldHit()) {
        spawnExplosion(ctx, b.gfx.x, b.gfx.y, 9, 0x44aaff, 0x88ddff)
        screenFlash(ctx, 0x4488ff, 0.28, 200)
      } else {
        const dmg = b.damage ?? (15 + game.currentStage * 3)
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
    const dispatchInterval = Math.max(60, 180 - game.currentStage * 8)
    if (ctx.waveDispatchTimer >= dispatchInterval) {
      ctx.waveDispatchTimer = 0
      const spawner = ctx.waveQueue.shift()!
      spawner()
      if (ctx.waveQueue.length === 0) ctx.waveIsClearing = true
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
    fs.timer -= dt
    const dx = fs.tx - fs.x
    const dy = fs.ty - fs.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < 18 || fs.timer <= 0) {
      fs.tx = GAME_W * 0.10 + Math.random() * GAME_W * 0.80
      fs.ty = GAME_H * 0.06 + Math.random() * GAME_H * 0.72
      fs.timer = 140 + Math.random() * 100
    }
    const nx = dx / (d || 1)
    const ny = dy / (d || 1)
    fs.x += nx * flockSpeed * dt
    fs.y += ny * flockSpeed * dt
    fs.x = Math.max(40, Math.min(GAME_W - 40, fs.x))
    fs.y = Math.max(40, Math.min(GAME_H - 120, fs.y))
  }

  // Update enemies (entity modules handle their own AI)
  // Pioneer, Kamikaze, Sniper, BossStarDestroyer, BossInvader are updated inline here
  // since they reach into ctx directly for PixiJS ops and shared state.

  // ── Boss zoom: smooth scale-out when Tinh Vân boss is alive ──────────────────
  const tinhVanAlive = ctx.enemies.some(e => e.kind === 'boss_tinhvan' && e.bossEntered)
  ctx.bossZoomTarget = tinhVanAlive ? 0.75 : 1.0
  if (Math.abs(ctx.bossZoom - ctx.bossZoomTarget) > 0.001) {
    const zSpeed = 0.006 * dt  // chậm hơn — zoom mượt hơn
    ctx.bossZoom += Math.sign(ctx.bossZoomTarget - ctx.bossZoom) * Math.min(zSpeed, Math.abs(ctx.bossZoomTarget - ctx.bossZoom))
  }
  const bz = ctx.bossZoom
  ctx.gameLayer.scale.set(bz)
  ctx.gameLayer.position.set(GAME_W * (1 - bz) / 2, GAME_H * (1 - bz) / 2)

  // Zoom change indicator
  if (zoomIndicatorText) {
    if (Math.abs(bz - zoomIndicatorLastZoom) > 0.002) {
      zoomIndicatorLastZoom = bz
      zoomIndicatorText.text = `TẦM NHÌN: ${Math.round(bz * 100)}%`
      zoomIndicatorText.alpha = 1
      zoomIndicatorTimer = 150
    } else if (zoomIndicatorTimer > 0) {
      zoomIndicatorTimer -= dt
      if (zoomIndicatorTimer <= 0) zoomIndicatorText.alpha = Math.max(0, zoomIndicatorText.alpha - 0.03 * dt)
    } else {
      zoomIndicatorText.alpha = Math.max(0, zoomIndicatorText.alpha - 0.03 * dt)
    }
  }

  // ── Thủ Hộ swarm reflect (global) ──────────────────────────────────────────
  const thuHoAlive = ctx.enemies.filter(e => e.kind === 'thu_ho').length
  if (thuHoAlive >= 4) {
    ctx.thuHoReflectTimer -= dt
    if (!ctx.thuHoReflecting && ctx.thuHoReflectTimer <= 0) {
      ctx.thuHoReflecting = true
      ctx.thuHoReflectGlow = 30             // 0.5 s at 60 fps
      ctx.thuHoReflectTimer = 300 + Math.random() * 120  // 5–7 s
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

  for (let i = ctx.enemies.length - 1; i >= 0; i--) {
    const e = ctx.enemies[i]

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
          const tx = fs.x + (e.formOffsetX ?? 0)
          const ty = fs.y + (e.formOffsetY ?? 0)
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
      if (e.container.y > GAME_H + 60 || e.container.x < -60 || e.container.x > GAME_W + 60) {
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
        if (e.container.y > GAME_H + 40) {
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
          e.vx = (tx / mag) * 9; e.vy = (ty / mag) * 9
        }
      }
      else if (e.kamiState === 'charge') {
        e.container.x += e.vx * dt
        e.container.y += e.vy * dt
        if (ctx.playerShip && dist2(e.container.x, e.container.y, ctx.playerShip.x, ctx.playerShip.y) < 22 * 22) {
          e.kamiState = 'dead'
        } else if (
          dist2(e.container.x, e.container.y, e.targetX ?? 0, e.targetY ?? 0) < 20 * 20 ||
          e.kamiTimer >= 90 || e.container.y > GAME_H + 60 || e.container.y < -60
        ) {
          e.kamiState = 'prexplode'; e.kamiTimer = 0; e.vx = 0; e.vy = 0
        }
      }
      else if (e.kamiState === 'prexplode') {
        e.body.alpha = Math.floor(e.kamiTimer / 4) % 2 === 0 ? 1 : 0.12
        if (e.kamiTimer >= 30) { e.body.alpha = 1; e.kamiState = 'dead' }
      }
      if (e.kamiState === 'dead') {
        spawnExplosion(ctx, e.container.x, e.container.y, 18, 0xff4400, 0xffcc00)
        if (ctx.playerShip) {
          const d = Math.sqrt(dist2(e.container.x, e.container.y, ctx.playerShip.x, ctx.playerShip.y))
          if (d < 70) {
            const aoe = Math.round(35 * (1 - d / 70))
            game.takeDamage(aoe)
            screenFlash(ctx, 0xff6600, 0.5, 220)
            spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, aoe)
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
          const mag = Math.sqrt(tx * tx + ty * ty) || 1
          const bg = new Graphics()
          drawEnemyBullet(bg)
          bg.x = e.container.x; bg.y = e.container.y + 10
          ctx.gameLayer.addChild(bg)
          ctx.enemyBullets.push({ gfx: bg, vx: (tx / mag) * 3.5, vy: (ty / mag) * 3.5 })
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
            if (Math.random() < 0.05) {
              const dir = Math.random() < 0.5 ? -1 : 1
              e.dodgeTarget = Math.max(30, Math.min(GAME_W - 30, e.container.x + dir * 50))
              e.dodgeCooldown = 100
            }
            break
          }
        }
      }
      if (e.container.y > GAME_H + 40) {
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
      e.shootTimer = (20 + Math.random() * 12 + Math.max(0, 10 - game.currentStage)) * 1.56
        const bg = new Graphics()
        drawDaiLienBullet(bg)
        bg.x = e.container.x
        bg.y = e.container.y + 8
        ctx.gameLayer.addChild(bg)
        const tx = ctx.playerShip.x - e.container.x
        const ty = ctx.playerShip.y - e.container.y
        const mag = Math.sqrt(tx * tx + ty * ty) || 1
        const spd = 4.5 + game.currentStage * 0.1
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
          if (game.absorbShieldHit()) {
            screenFlash(ctx, 0x88ff88, 0.25, 180)
          } else {
            game.takeDamage(20); screenFlash(ctx)
            spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, 20)
          }
          spawnExplosion(ctx, e.container.x, e.container.y, 14, 0x886644, 0xff6600)
          if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
          ctx.enemies.splice(i, 1); game.stageEnemiesKilled++; continue
        }
        if (e.container.y > GAME_H + 60 || e.container.x < -60 || e.container.x > GAME_W + 60) {
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
          // No shield available — gentle oscillation while looking for one
          const t = Date.now() / 1000 + (e.formTargetX ?? 0) * 0.008
          e.container.x += Math.sin(t * 0.9) * 0.4 * dt
          e.container.x = Math.max(20, Math.min(GAME_W - 20, e.container.x))
        }
      }
      // Healing beam: pick a nearby enemy and channel heal
      if (e.pioneerPhase === 'patrol' && ctx.enemies.length > 1) {
        // Re-pick target: must be within 230px, injured (hp < maxHp), prefer lowest HP ratio
        const currentTarget = e.healTarget ?? null
        const isValidTarget = currentTarget && currentTarget !== e
          && currentTarget.kind !== 'thuat_si' && !currentTarget.isDyingMeteor
          && currentTarget.hp < currentTarget.maxHp
          && ctx.enemies.includes(currentTarget)
          && dist2(e.container.x, e.container.y, currentTarget.container.x, currentTarget.container.y) < 230 * 230
        if (!isValidTarget) {
          // Find injured enemy within 230px with lowest HP ratio
          let bestTarget: Enemy | null = null
          let bestRatio = 1.0  // only consider hp < maxHp
          for (let k = 0; k < ctx.enemies.length; k++) {
            const t2 = ctx.enemies[k]!
            if (t2 === e || t2.kind === 'thuat_si' || t2.isDyingMeteor) continue
            if (t2.hp >= t2.maxHp) continue  // not injured
            if (dist2(e.container.x, e.container.y, t2.container.x, t2.container.y) > 230 * 230) continue
            const ratio = t2.hp / t2.maxHp
            if (ratio < bestRatio) { bestRatio = ratio; bestTarget = t2 }
          }
          e.healTarget = bestTarget
        }
        const healTarget = e.healTarget ?? null
        if (healTarget && e.healBeamGfx) {
          // Draw animated lightning beam
          const seed = Date.now() * 0.05
          const toX = healTarget.container.x - e.container.x
          const toY = healTarget.container.y - e.container.y
          drawHealBeam(e.healBeamGfx, toX, toY, seed)
          // Heal target: 10%/s for normal, 2%/s for boss (dt is frames at 60fps)
        const isBoss = healTarget.kind === 'boss_stardestroyer' || healTarget.kind === 'boss_invader' || healTarget.kind === 'boss_tinhvan' || healTarget.kind === 'boss_trumso'
          const healRate = isBoss ? 0.02 / 60 : 0.10 / 60
          healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healTarget.maxHp * healRate * dt)
          redrawHpBar(healTarget.hpBarBg, healTarget.hpBar, healTarget.hp / healTarget.maxHp, healTarget.barW)
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

    else if (e.kind === 'boss_stardestroyer') {
      if (!e.bossEntered) {
        e.container.y += 1.2 * dt
        if (e.container.y >= (e.bossTargetY ?? GAME_H * 0.18)) {
          e.container.y = e.bossTargetY ?? GAME_H * 0.18
          e.bossEntered = true
        }
        continue  // chưa vào vị trí, không tấn công
      }
      if (e.bossEntered) {
        if (e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
          e.bossPhase = 2
          screenFlash(ctx, 0x4466ff, 0.5, 600)
          spawnExplosion(ctx, e.container.x, e.container.y, 28, 0x4466ff, 0xaaccff)
          if (e.bossLabel) {
            e.bossLabel.text = 'ANOX - DIỆT SAO [PHASE 2]'
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
        if (e.bossPhase === 1) {
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
              ctx.enemyBullets.push({ gfx: smg, vx: (mdx / mmag) * 3.0, vy: (mdy / mmag) * 3.0, homing: true, homingLife: 240, homingSpeed: 3.0 })
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
        continue  // chưa vào vị trí, không tấn công
      }
      if (e.bossEntered) {
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
      // ── Entry ─────────────────────────────────────────────────────────────
      if (!e.bossEntered) {
        e.container.y += 1.0 * dt
        if (e.container.y >= (e.bossTargetY ?? GAME_H * 0.20)) {
          e.container.y = e.bossTargetY ?? GAME_H * 0.20
          e.bossEntered = true
          e.bossBattleReady = false
          e.bossBattleTimer = 180  // 3s: chờ zoom xong + delay trước khi tấn công
        }
        continue  // chưa vào vị trí, không làm gì cả
      }

      // Chờ timer đếm xuống 0 trước khi bắt đầu trận chiến
      if (!e.bossBattleReady) {
        e.body.rotation += 0.003 * dt
        e.bossBattleTimer = (e.bossBattleTimer ?? 180) - dt
        if ((e.bossBattleTimer ?? 0) <= 0) {
          e.bossBattleReady = true
          screenFlash(ctx, 0x6600aa, 0.3, 400)
        }
        continue  // chưa sẵn sàng, bỏ qua toàn bộ logic tấn công
      }

      if (e.bossEntered && e.bossBattleReady) {
        // Body slow rotation
        e.body.rotation += 0.003 * dt

        // Phase 1 → 2 transition at 50% HP
        if (e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
          e.bossPhase = 2
          screenFlash(ctx, 0x660099, 0.6, 700)
          spawnExplosion(ctx, e.container.x, e.container.y, 36, 0x6600aa, 0xcc44ff)
          if (e.bossLabel) {
            e.bossLabel.text = 'BNOX - TINH VÂN HẮC ÁM [PHASE 2]'
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

        // ── Gun burst fire (both phases) ────────────────────────────────────
        if (e.tinhVanGuns) {
          const phase2Boost = e.bossPhase === 2 ? 1 : 0
          for (const gun of e.tinhVanGuns) {
            // Mỗi 2s (120 frame) bắn 2 viên cùng lúc
            gun.shootTimer -= dt
            if (gun.shootTimer <= 0 && ctx.playerShip) {
              gun.shootTimer = 120
              const worldX = e.container.x + gun.offsetX
              const worldY = e.container.y + gun.offsetY
              const tx = ctx.playerShip.x - worldX
              const ty = ctx.playerShip.y - worldY
              const spd = 3.5 + phase2Boost * 0.8 + game.currentStage * 0.1
              const baseAngle = Math.atan2(ty, tx)
              const spread = 0.13  // ~7.5°
              for (const ao of [-spread, spread]) {
                const bg = new Graphics()
                drawEnemyBullet(bg)
                bg.x = worldX; bg.y = worldY + 10
                ctx.gameLayer.addChild(bg)
                ctx.enemyBullets.push({ gfx: bg, vx: Math.cos(baseAngle + ao) * spd, vy: Math.sin(baseAngle + ao) * spd })
              }
            }
          }
        }

        // ── Phase 1: Black hole spawn ────────────────────────────────────────
        if (e.bossPhase === 1) {
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

        // ── Black hole update (both phases) ─────────────────────────────────
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
                // Nếu người chơi đang di chuyển ra ngoài, kháng lại một phần
                if (bh.lastPlayerX !== undefined && bh.lastPlayerY !== undefined) {
                  const moveDx = ctx.playerShip.x - bh.lastPlayerX
                  const moveDy = ctx.playerShip.y - bh.lastPlayerY
                  // Thành phần hướng ra ngoài: dương = đang thoát khỏi hố đen
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
                ctx.playerShip.x = Math.max(10, Math.min(GAME_W - 10, ctx.playerShip.x))
                ctx.playerShip.y = Math.max(40, Math.min(GAME_H - 40, ctx.playerShip.y))
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
            // Enemy bullets are NOT pulled by black holes — only player projectiles are affected
          }
        }

        // ── Phase 2: Nebula portal summon (30s cooldown) ─────────────────────
        if (e.bossPhase === 2) {
          if ((e.pendingMissiles ?? 0) === 0) {
            e.attack2Timer = (e.attack2Timer ?? 1800) - dt
            if ((e.attack2Timer ?? 0) <= 0) {
              e.pendingMissiles = 4   // 4 spawn calls → ~7 Bnox enemies
              e.missileFireTimer = 50
              // Create 2 portal black holes at random screen positions
              e.blackHoles = e.blackHoles ?? []
              for (let pi = 0; pi < 2; pi++) {
                const pX = GAME_W * 0.15 + Math.random() * GAME_W * 0.70
                const pY = GAME_H * 0.02 + Math.random() * GAME_H * 0.10  // mở cổng ở trên cùng
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
              // Pick a random portal position and spawn enemies from it
              const portals = (e.blackHoles ?? []).filter(bh => bh.portal)
              const portal = portals[Math.floor(Math.random() * portals.length)]
              const spawnX = portal ? portal.x : e.container.x
              const spawnY = portal ? portal.y : (e.container.y + 60)
              const beforeCount = ctx.enemies.length
              const r = Math.random()
              let spawnType: string
              if (r < 0.45) { spawnDaiLienPair(ctx, game); spawnType = 'dai_lien' }
              else if (r < 0.75) { spawnThuatSi(ctx, game); spawnType = 'thuat_si' }
              else { spawnThuHoSwarm(ctx, game); spawnType = 'thu_ho' }
              // Teleport newly spawned enemies to portal, mỗi loại giữ vị trí chiến thuật của mình
              for (let ni = beforeCount; ni < ctx.enemies.length; ni++) {
                const ne = ctx.enemies[ni]!
                ne.container.x = spawnX + (Math.random() - 0.5) * 30
                ne.container.y = spawnY
                const atkX = GAME_W * 0.10 + Math.random() * GAME_W * 0.80
                // Liên xạ: giữ tầm cao; Thử hộ: tầm giữa chắn đạn; Thuật sĩ: tầm dưới để hồi máu
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
                ne.squadId = undefined  // no flock formation
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
      // ── Entry ──────────────────────────────────────────────────────────────
      if (!e.bossEntered) {
        e.container.y += 1.2 * dt
        if (e.container.y >= (e.bossTargetY ?? GAME_H * 0.20)) {
          e.container.y = e.bossTargetY ?? GAME_H * 0.20
          e.bossEntered = true
        }
        // Bất tử khi tái xuất: hấp thụ đạn (không xuyên qua) nhưng không nhận sát thương
        for (let j = ctx.bullets.length - 1; j >= 0; j--) {
          if (dist2(ctx.bullets[j].gfx.x, ctx.bullets[j].gfx.y, e.container.x, e.container.y) < 45 * 45) {
            spawnExplosion(ctx, ctx.bullets[j].gfx.x, ctx.bullets[j].gfx.y, 4, 0x8888bb, 0xaaaadd)
            if (!ctx.bullets[j].gfx.destroyed) ctx.gameLayer.removeChild(ctx.bullets[j].gfx)
            ctx.bullets.splice(j, 1)
          }
        }
        continue  // chưa vào vị trí, không tấn công
      }
      if (e.bossEntered) {
        // ── Phase 2 transition at 50% HP ──────────────────────────────────
        if (e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
          e.bossPhase = 2
          screenFlash(ctx, 0x6600cc, 0.55, 700)
          spawnExplosion(ctx, e.container.x, e.container.y, 34, 0x6600cc, 0xcc44ff)
          if (e.bossLabel) {
            e.bossLabel.text = 'BNOX - TRÙM SÒ [PHASE 2]'
            e.bossLabel.style = new TextStyle({ fill: 0xff88ff, fontSize: 10, fontFamily: "'Chakra Petch', sans-serif", fontWeight: 'bold', stroke: { color: 0x000011, width: 3 } })
          }
          if (e.trumSoLasers) {
            for (const laser of e.trumSoLasers) { laser.gfx.clear(); laser.state = 'idle' }
          }
          e.trumSoChargeTimer = 900
          e.trumSoContinuousDmgTimer = 30
        }

        // ── Horizontal drift (skipped during charge) ──────────────────────
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

        // ── Machine gun turrets ────────────────────────────────────────────
        if (e.trumSoGuns) {
          for (const gun of e.trumSoGuns.filter(g => g.type === 'machinegun')) {
            if (ctx.playerShip) {
              const adx = ctx.playerShip.x - (e.container.x + gun.offsetX)
              const ady = ctx.playerShip.y - (e.container.y + gun.offsetY)
              gun.gfx.rotation = Math.atan2(ady, adx) - Math.PI / 2
            }
            // Cả 2 phase: bắn hình nón 2 lần (cách 0.5s), nghỉ 3s
            const coneCount = e.bossPhase === 2 ? 5 : 3  // số viên mỗi lần bắn
            const coneSpread = e.bossPhase === 2 ? 0.30 : 0.22  // góc nón tổng (rad)
            const spd = (e.bossPhase === 2 ? 5 : 4.5) + game.currentStage * 0.05
            if (gun.burstLeft > 0) {
              gun.rapidTimer -= dt
              if (gun.rapidTimer <= 0) {
                gun.rapidTimer = 30  // 0.5s giữa mỗi lần bắn
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
              if (gun.timer <= 0) { gun.timer = 180; gun.burstLeft = 2; gun.rapidTimer = 30 }  // nghỉ 3s
            }
          }
        }

          // ── Missile salvos ───────────────────────────────────────────────
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

        // ── Phase 1: Simultaneous salvo lasers (all fire at once) ────────────
        if (e.bossPhase === 1 && e.trumSoLasers) {
          const len = GAME_W + GAME_H
          // Tick idle timers independently
          for (const laser of e.trumSoLasers) {
            if (laser.state === 'idle') laser.timer -= dt
          }
          // When any idle laser is ready and none are active → trigger ALL at once
          const anyActive = e.trumSoLasers.some(l => l.state !== 'idle')
          if (!anyActive && e.trumSoLasers.some(l => l.timer <= 0)) {
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
              if (laser.timer >= 17 && ctx.playerShip) {
                const px = ctx.playerShip.x - wx; const py = ctx.playerShip.y - wy
                const lx = Math.cos(laser.angle); const ly = Math.sin(laser.angle)
                const dot = px * lx + py * ly
                const perpX = px - dot * lx; const perpY = py - dot * ly
                if (Math.sqrt(perpX * perpX + perpY * perpY) < 20 && dot > 0) {
                  if (!game.absorbShieldHit()) {
                    const dmg = 16 + game.currentStage * 2
                    game.takeDamage(dmg); screenFlash(ctx)
                    spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, dmg)
                  } else {
                    spawnExplosion(ctx, ctx.playerShip.x, ctx.playerShip.y, 9, 0x8844ff, 0xcc88ff)
                    screenFlash(ctx, 0x8844ff, 0.28, 200)
                  }
                }
              }
              if (laser.timer <= 0) { laser.state = 'idle'; laser.timer = 70 + Math.random() * 50; laser.gfx.clear() }
            }
          }
        }

        // ── Phase 2: Core mega-laser (warning → fire, instant-kill) ──────────
        if (e.bossPhase === 2 && e.trumSoPhase2LaserGfx) {
          const bx = e.container.x; const by = e.container.y
          const len = GAME_W + GAME_H
          if (e.trumSoPhase2LaserState === 'idle' || e.trumSoPhase2LaserState === undefined) {
            e.trumSoContinuousDmgTimer = (e.trumSoContinuousDmgTimer ?? 400) - dt
            e.trumSoPhase2LaserGfx.clear()
            if ((e.trumSoContinuousDmgTimer ?? 0) <= 0) {
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
            // Check hit only on first frame of firing
            if ((e.trumSoContinuousDmgTimer ?? 0) >= 21 && ctx.playerShip) {
              const lx = Math.cos(angle); const ly = Math.sin(angle)
              const px = ctx.playerShip.x - bx; const py = ctx.playerShip.y - by
              const dot = px * lx + py * ly
              const perpX = px - dot * lx; const perpY = py - dot * ly
              if (Math.sqrt(perpX * perpX + perpY * perpY) < 22 && dot > 0) {
                if (!game.absorbShieldHit()) {
                  game.takeDamage(game.playerMaxHp)
                  screenFlash(ctx)
                  spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, game.playerMaxHp)
                } else {
                  spawnExplosion(ctx, ctx.playerShip.x, ctx.playerShip.y, 14, 0x8800ff, 0xee66ff)
                  screenFlash(ctx, 0x8800ff, 0.45, 300)
                }
              }
            }
            if ((e.trumSoContinuousDmgTimer ?? 0) <= 0) {
              e.trumSoPhase2LaserGfx.clear()
              e.trumSoPhase2LaserState = 'idle'
              e.trumSoContinuousDmgTimer = 350 + Math.random() * 150
            }
          }
        }

        // ── Phase 2: Charge dash ──────────────────────────────────────────
        if (e.bossPhase === 2) {
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
              if (!game.absorbShieldHit()) {
                const dmg = 25 + game.currentStage * 2
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

    // ── Hit by player bullets ──────────────────────────────────────────────
    let killed = false
    // Thủ Hộ reflect: during swarm reflect phase, bullets are bounced back
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
      // Reflect shooter missiles (Star Shooter) — loses homing
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
      // Reflect player card missiles — loses homing
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
            t.hp = Math.max(0, t.hp - bulletDmg)
            spawnDamageText(ctx, wx, wy - 16, bulletDmg)
            if (game.cardStats.vampireHitHeal > 0) game.healPlayer(game.cardStats.vampireHitHeal)
            redrawHpBar(t.hpBarBg, t.hpBar, t.hp / t.maxHp, 24)
            if (!game.cardStats.bulletPierceOnKill || t.hp <= 0) {
              if (!ctx.bullets[j].gfx.destroyed) ctx.gameLayer.removeChild(ctx.bullets[j].gfx)
              ctx.bullets.splice(j, 1)
            }
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
    }
    for (let j = ctx.bullets.length - 1; j >= 0; j--) {
      const bulletHitR = e.kind === 'boss_tinhvan' ? 60 : (e.kind === 'boss_stardestroyer' || e.kind === 'boss_invader' || e.kind === 'boss_trumso' ? 45 : 15)
      if (dist2(ctx.bullets[j].gfx.x, ctx.bullets[j].gfx.y, e.container.x, e.container.y) < bulletHitR * bulletHitR) {
        e.hp = Math.max(0, e.hp - bulletDmg)
        const dmgOffY = e.kind === 'boss_tinhvan' ? 75 : (e.kind === 'boss_stardestroyer' || e.kind === 'boss_invader' || e.kind === 'boss_trumso' ? 60 : 14)
        spawnDamageText(ctx, e.container.x, e.container.y - dmgOffY, bulletDmg)
        hitFlash(e.body)
        redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
        if (game.cardStats.vampireHitHeal > 0) game.healPlayer(game.cardStats.vampireHitHeal)
        if (!game.cardStats.bulletPierceOnKill || e.hp > 0) {
          if (!ctx.bullets[j].gfx.destroyed) ctx.gameLayer.removeChild(ctx.bullets[j].gfx)
          ctx.bullets.splice(j, 1)
        }
        if (e.hp <= 0) { killEnemy(ctx, game, e, i); killed = true; break }
      }
    }
    if (killed) continue

    // Pioneer collision with player
    if (e.kind === 'pioneer' && ctx.playerShip &&
      dist2(e.container.x, e.container.y, ctx.playerShip.x, ctx.playerShip.y) < 20 * 20) {
      spawnExplosion(ctx, e.container.x, e.container.y, 14)
      spawnEnemyOrbs(ctx, e.container.x, e.container.y, 'pioneer')
      if (game.absorbShieldHit()) {
        screenFlash(ctx, 0x4488ff, 0.28, 200)
      } else {
        game.takeDamage(25); screenFlash(ctx)
        spawnDamageText(ctx, ctx.playerShip.x, ctx.playerShip.y - 20, 25)
      }
      game.stageEnemiesKilled++
      if (!e.container.destroyed) ctx.gameLayer.removeChild(e.container)
      ctx.enemies.splice(i, 1)
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
    if (o.y > GAME_H + 20) { if (!o.gfx.destroyed) ctx.gameLayer.removeChild(o.gfx); ctx.expOrbs.splice(i, 1); continue }
    if (ctx.playerShip && dist2(o.gfx.x, o.y, ctx.playerShip.x, ctx.playerShip.y) < collectR2) {
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
        if (o.y > GAME_H + 20) { if (!o.gfx.destroyed) ctx.gameLayer.removeChild(o.gfx); ctx.fragmentOrbs.splice(i, 1) }
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
    const nearest = findNearestEnemy(ctx.enemies, m.gfx.x, m.gfx.y)
    if (nearest) {
      const dx = nearest.container.x - m.gfx.x; const dy = nearest.container.y - m.gfx.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      m.vx += (dx / dist) * 7 * 0.18; m.vy += (dy / dist) * 7 * 0.18
      const spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy)
      if (spd > 8) { m.vx = (m.vx / spd) * 8; m.vy = (m.vy / spd) * 8 }
    }
    m.gfx.x += m.vx * dt; m.gfx.y += m.vy * dt
    m.gfx.rotation = Math.atan2(m.vy, m.vx) + Math.PI / 2
    if (m.gfx.x < -20 || m.gfx.x > GAME_W + 20 || m.gfx.y < -40 || m.gfx.y > GAME_H + 20) {
      if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
      ctx.fragmentMissiles.splice(i, 1); continue
    }
    let hit = false
    for (let j = ctx.enemies.length - 1; j >= 0; j--) {
      const e = ctx.enemies[j]
      if (dist2(m.gfx.x, m.gfx.y, e.container.x, e.container.y) < 20 * 20) {
        const dmg = Math.round(60 + game.upgrades.damage * 0.5)
        e.hp = Math.max(0, e.hp - dmg); hitFlash(e.body)
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
  for (let i = ctx.shooterMissiles.length - 1; i >= 0; i--) {
    const m = ctx.shooterMissiles[i]
    const nearest = findNearestEnemy(ctx.enemies, m.gfx.x, m.gfx.y)
    if (nearest) {
      const dx = nearest.container.x - m.gfx.x; const dy = nearest.container.y - m.gfx.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const mSpd = Math.sqrt(m.vx * m.vx + m.vy * m.vy) || 6
      m.vx += (dx / dist) * mSpd * 0.12; m.vy += (dy / dist) * mSpd * 0.12
      const spd = Math.sqrt(m.vx * m.vx + m.vy * m.vy)
      if (spd > mSpd) { m.vx = (m.vx / spd) * mSpd; m.vy = (m.vy / spd) * mSpd }
    }
    m.gfx.x += m.vx * dt; m.gfx.y += m.vy * dt
    m.gfx.rotation = Math.atan2(m.vy, m.vx) + Math.PI / 2
    if (m.gfx.x < -40 || m.gfx.x > GAME_W + 40 || m.gfx.y < -60 || m.gfx.y > GAME_H + 40) {
      if (!m.gfx.destroyed) ctx.gameLayer.removeChild(m.gfx)
      ctx.shooterMissiles.splice(i, 1); continue
    }
    let hit = false
    for (let j = ctx.enemies.length - 1; j >= 0; j--) {
      const e = ctx.enemies[j]
      if (dist2(m.gfx.x, m.gfx.y, e.container.x, e.container.y) < 22 * 22) {
        if (m.aoe) {
          const aoeRadius = 65 * (1 + game.cardStats.shooterMissileAoeSizeBonus)
          spawnExplosion(ctx, m.gfx.x, m.gfx.y, 28, 0xff4400, 0xffaa00)
          screenFlash(ctx, 0xff3300, 0.18, 150)
          for (let k = ctx.enemies.length - 1; k >= 0; k--) {
            const ae = ctx.enemies[k]
            if (dist2(m.gfx.x, m.gfx.y, ae.container.x, ae.container.y) < aoeRadius * aoeRadius) {
              ae.hp = Math.max(0, ae.hp - m.damage); hitFlash(ae.body)
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
  for (let i = ctx.damageTexts.length - 1; i >= 0; i--) {
    const d = ctx.damageTexts[i]
    d.gfx.y -= d.vy * dt; d.life--
    d.gfx.alpha = d.life / 40
    if (d.life <= 0) { if (!d.gfx.destroyed) ctx.uiLayer.removeChild(d.gfx); ctx.damageTexts.splice(i, 1) }
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────
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

  for (let i = 0; i < 80; i++) {
    const s = createStar()
    ctx.bgLayer.addChild(s.gfx)
    ctx.stars.push(s)
  }

  ctx.playerShip = new Graphics()
  drawShip(ctx.playerShip, game.selectedShip)
  ctx.playerShip.x = GAME_W / 2; ctx.playerShip.y = GAME_H + 60
  ctx.gameLayer.addChild(ctx.playerShip)

  initArtifactGfx(ctx, game)

  ctx.shieldGfx = new Graphics()
  ctx.shieldGfx.visible = false
  ctx.gameLayer.addChild(ctx.shieldGfx)

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
  ctx.bullets = []; ctx.enemies = []; ctx.enemyBullets = []; ctx.stars = []
  ctx.damageTexts = []; ctx.expOrbs = []; ctx.fragmentOrbs = []; ctx.fragmentMissiles = []
  ctx.soulMissileQueue = 0; ctx.soulMissileFireTimer = 0
  ctx.neutronVacuumTimer = 0; ctx.manaCoreKillCount = 0; ctx.artifactOrbitAngle = 0
  ctx.artifactGfx = null
  game.neutronVacuumPct = 0; game.manaCorePct = 0
  ctx.shooterMissiles = []; ctx.shooterBlackHoleTimer = 0; ctx.shooterBlackHoleGfx = null
  if (ctx.shooterBlackHoleProjGfx && !ctx.shooterBlackHoleProjGfx.destroyed) ctx.gameLayer?.removeChild(ctx.shooterBlackHoleProjGfx)
  ctx.shooterBlackHoleProjGfx = null
}

onMounted(async () => { await initPixi(); game.startGame() })
onUnmounted(() => { destroyPixi() })

watch(() => game.isGameOverSequence, (val) => {
  if (!val || !app || !ctx.playerShip) return
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
    for (const b of ctx.bullets) if (!b.gfx.destroyed) ctx.gameLayer?.removeChild(b.gfx)
    for (const e of ctx.enemies) if (!e.container.destroyed) ctx.gameLayer?.removeChild(e.container)
    for (const b of ctx.enemyBullets) if (!b.gfx.destroyed) ctx.gameLayer?.removeChild(b.gfx)
    for (const d of ctx.damageTexts) if (!d.gfx.destroyed) ctx.uiLayer?.removeChild(d.gfx)
    for (const o of ctx.expOrbs) if (!o.gfx.destroyed) ctx.gameLayer?.removeChild(o.gfx)
    if (ctx.stageTitleText) { ctx.uiLayer?.removeChild(ctx.stageTitleText); ctx.stageTitleText = null }
    ctx.bullets = []; ctx.enemies = []; ctx.enemyBullets = []; ctx.damageTexts = []; ctx.expOrbs = []
    for (const ml of ctx.missileLaunchers) if (!ml.gfx.destroyed) ctx.gameLayer?.removeChild(ml.gfx)
    for (const pm of ctx.playerMissiles) if (!pm.gfx.destroyed) ctx.gameLayer?.removeChild(pm.gfx)
    ctx.missileLaunchers = []; ctx.playerMissiles = []
    for (const sm of ctx.shooterMissiles) if (!sm.gfx.destroyed) ctx.gameLayer?.removeChild(sm.gfx)
    ctx.shooterMissiles = []; ctx.shooterBlackHoleTimer = 0
    if (ctx.shooterBlackHoleGfx && !ctx.shooterBlackHoleGfx.destroyed) ctx.gameLayer?.removeChild(ctx.shooterBlackHoleGfx)
    ctx.shooterBlackHoleGfx = null
    if (ctx.shooterBlackHoleProjGfx && !ctx.shooterBlackHoleProjGfx.destroyed) ctx.gameLayer?.removeChild(ctx.shooterBlackHoleProjGfx)
    ctx.shooterBlackHoleProjGfx = null
    ctx.pbTimer = 0; ctx.cbTimer = 0; ctx.lsTimer = 0; ctx.sfDmgTimer = 0
    if (ctx.shieldGfx) ctx.shieldGfx.visible = false
    if (ctx.sfGfx) ctx.sfGfx.visible = false
    ctx.shootTimer = 0; ctx.waveQueue = []; ctx.waveDispatchTimer = 0
    ctx.waveIsClearing = false; ctx.stageClearTimer = 0; ctx.stageAnnouncePending = false
    ctx.gamePhase = 'intro'; ctx.introTimer = 0
    if (ctx.playerShip) {
      ctx.playerShip.x = GAME_W / 2; ctx.playerShip.y = GAME_H + 60; ctx.playerShip.visible = true
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
