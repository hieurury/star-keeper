import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { GameContext } from '../context'
import type { useGameStore } from '../../stores/gameStore'
import type { Enemy, SunEnergyCrystal, SunWeaponStar } from '../types'
import { GAME_H, GAME_W } from '../constants'
import { redrawHpBar } from '../utils'
import { screenFlash } from '../systems/effects'

type GameStore = ReturnType<typeof useGameStore>

export function drawSunBossBody(g: Graphics, size: number): void {
  g.clear()
  g.circle(0, 0, size * 1.08).fill({ color: 0x1a1105, alpha: 0.72 })
  g.circle(0, 0, size).fill(0x2a1707)
  g.circle(0, 0, size).stroke({ color: 0xffb44c, width: 3, alpha: 0.75 })

  const wingR = size * 0.88
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(a) * wingR
    const y = Math.sin(a) * wingR
    g.poly([
      x,
      y - 13,
      x + 11,
      y,
      x,
      y + 13,
      x - 11,
      y,
    ]).fill(0xff9f3a)
    g.poly([
      x,
      y - 8,
      x + 6,
      y,
      x,
      y + 8,
      x - 6,
      y,
    ]).fill(0xffe1ab)
  }

  g.circle(0, 0, size * 0.42).fill(0x7f2f00)
  g.circle(0, 0, size * 0.30).fill(0xff7b00)
  g.circle(0, 0, size * 0.22).fill(0xffb933)
  g.circle(0, 0, size * 0.12).fill(0xfff3d1)
}

function drawStar(g: Graphics, kind: SunWeaponStar['kind']): void {
  g.clear()
  if (kind === 'triangle') {
    g.poly([0, -14, 13, 12, -13, 12]).fill(0xffd34a)
    g.poly([0, -8, 7, 6, -7, 6]).fill(0xfff0b0)
  } else if (kind === 'circle') {
    g.circle(0, 0, 12).fill(0xf6faff)
    g.circle(0, 0, 7).fill(0xbbe4ff)
  } else if (kind === 'diamond') {
    g.poly([0, -14, 11, 0, 0, 14, -11, 0]).fill(0x53b6ff)
    g.poly([0, -8, 6, 0, 0, 8, -6, 0]).fill(0xd4efff)
  } else {
    const pts: number[] = []
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? 14 : 6
      pts.push(Math.cos(a) * r, Math.sin(a) * r)
    }
    g.poly(pts).fill(0xc970ff)
    const inner: number[] = []
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 === 0 ? 8 : 3.5
      inner.push(Math.cos(a) * r, Math.sin(a) * r)
    }
    g.poly(inner).fill(0xefccff)
  }
  g.circle(0, 0, 2.8).fill(0xffffff)
}

export function cleanupBossCnoxSun(ctx: GameContext, e: Enemy): void {
  if (e.sunStars) {
    for (const s of e.sunStars) {
      s.warningGfx.clear()
      s.beamGfx.clear()
      if (!s.warningGfx.destroyed) ctx.gameLayer.removeChild(s.warningGfx)
      if (!s.beamGfx.destroyed) ctx.gameLayer.removeChild(s.beamGfx)
    }
  }
  if (e.sunCoreLaserGfx) {
    e.sunCoreLaserGfx.clear()
    if (!e.sunCoreLaserGfx.destroyed) ctx.gameLayer.removeChild(e.sunCoreLaserGfx)
  }
  if (e.sunLinkGfx) {
    e.sunLinkGfx.clear()
    if (!e.sunLinkGfx.destroyed) ctx.gameLayer.removeChild(e.sunLinkGfx)
  }
  for (const c of e.sunEnergyCrystals ?? []) {
    c.gfx.clear()
    if (!c.gfx.destroyed) ctx.gameLayer.removeChild(c.gfx)
  }
}

export function spawnBossCnoxSun(ctx: GameContext, game: GameStore): void {
  const size = 76
  const maxHp = 3400 + game.currentStage * 650

  const body = new Graphics()
  drawSunBossBody(body, size)

  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  redrawHpBar(hpBarBg, hpBar, 1, 360)
  hpBarBg.y = -size - 32
  hpBar.y = -size - 32

  const bossLabel = new Text({
    text: 'Cnox - Mặt trời tối thượng',
    style: new TextStyle({
      fill: 0xffc56a,
      fontSize: 10,
      fontFamily: "'Chakra Petch', sans-serif",
      fontWeight: 'bold',
      stroke: { color: 0x1a0c00, width: 3 },
    }),
  })
  bossLabel.anchor.set(0.5, 1)
  bossLabel.y = -size - 34

  const container = new Container()
  container.x = GAME_W / 2
  container.y = -280
  container.addChild(body, hpBarBg, hpBar, bossLabel)

  const kinds: SunWeaponStar['kind'][] = ['circle', 'diamond', 'pentagon', 'triangle']
  const starOffsets = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]
  const stars: SunWeaponStar[] = kinds.map((kind, idx) => {
    const g = new Graphics()
    drawStar(g, kind)
    const warningGfx = new Graphics()
    const beamGfx = new Graphics()
    ctx.gameLayer.addChild(warningGfx, beamGfx)
    const star: SunWeaponStar = {
      kind,
      gfx: g,
      warningGfx,
      beamGfx,
      orbitAngle: starOffsets[idx]!,
      orbitRadius: 120,
      attackPush: 0,
      state: 'idle',
      timer: 60 + idx * 20,
    }
    g.x = Math.cos(star.orbitAngle) * star.orbitRadius
    g.y = Math.sin(star.orbitAngle) * star.orbitRadius
    container.addChild(g)
    return star
  })

  const coreLaserGfx = new Graphics()
  const linkGfx = new Graphics()
  ctx.gameLayer.addChild(linkGfx, coreLaserGfx)

  const alertText = new Text({
    text: 'CNOX\nMặt trời tối thượng',
    style: new TextStyle({
      fill: 0xffa545,
      fontSize: 23,
      fontFamily: "'Chakra Petch', sans-serif",
      fontWeight: 'bold',
      align: 'center',
      lineHeight: 28,
      stroke: { color: 0x150900, width: 4 },
    }),
  })
  alertText.anchor.set(0.5, 0.5)
  alertText.x = GAME_W / 2
  alertText.y = GAME_H * 0.45
  alertText.alpha = 0
  ctx.uiLayer.addChild(alertText)
  let af = 0
  const tick = () => {
    af++
    if (af < 25) alertText.alpha = af / 25
    else if (af < 120) alertText.alpha = 1
    else alertText.alpha = Math.max(0, 1 - (af - 120) / 30)
    if (af >= 150) {
      ctx.uiLayer.removeChild(alertText)
      ctx.app?.ticker.remove(tick)
    }
  }
  ctx.app?.ticker.add(tick)

  screenFlash(ctx, 0xff8d2a, 0.4, 620)
  ctx.gameLayer.addChild(container)

  ctx.enemies.push({
    container,
    body,
    hpBarBg,
    hpBar,
    kind: 'boss_cnox_sun',
    vx: 0,
    vy: 0,
    hp: maxHp,
    maxHp,
    barW: 360,
    bossLabel,
    bossEntered: false,
    bossTargetY: GAME_H * 0.12,
    bossPhase: 1,
    attack1Timer: 120,
    attack2Timer: 160,
    bossDriftTimer: 0,
    bossDriftTarget: GAME_W / 2,
    sunStars: stars,
    sunEnergyCrystals: [] as SunEnergyCrystal[],
    sunCrystalSpawnCd: 70,
    sunAttackQueue: [],
    sunActiveStars: [],
    sunLinkGfx: linkGfx,
    sunCoreLaserGfx: coreLaserGfx,
    sunCoreSpin: 0,
    sunCoreLaserState: 'idle',
    sunCoreLaserTimer: 220,
    sunCoreLaserAngle: -Math.PI / 2,
    sunCoreLaserStartAngle: -Math.PI / 2,
    sunCoreLaserSweepSpan: Math.PI / 1.5,
  })
}
