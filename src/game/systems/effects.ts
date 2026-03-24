import { Graphics, Text, TextStyle } from 'pixi.js'
import type { GameContext } from '../context'
import { GAME_W, GAME_H } from '../constants'

export function spawnExplosion(
  ctx: GameContext,
  x: number,
  y: number,
  radius = 14,
  color1 = 0xff8800,
  color2 = 0xffee44,
): void {
  if (!ctx.gameLayer || !ctx.app) return
  const g = new Graphics()
  g.x = x
  g.y = y
  ctx.gameLayer.addChild(g)
  let frame = 0
  const maxFrames = radius
  const tick = () => {
    frame++
    g.clear()
    const r = frame * (radius / maxFrames) * 3
    g.circle(0, 0, r).fill({ color: color1, alpha: Math.max(0, 1 - frame / maxFrames) })
    g.circle(0, 0, r * 0.55).fill({ color: color2, alpha: Math.max(0, 1 - frame / (maxFrames * 0.7)) })
    if (frame >= maxFrames) {
      if (!g.destroyed) ctx.gameLayer.removeChild(g)
      ctx.app?.ticker.remove(tick)
    }
  }
  ctx.app.ticker.add(tick)
}

export function hitFlash(body: Graphics): void {
  body.alpha = 0.35
  setTimeout(() => { if (body && !body.destroyed) body.alpha = 1 }, 110)
}

export function screenFlash(
  ctx: GameContext,
  color = 0xff2222,
  intensity = 0.38,
  durationMs = 160,
): void {
  if (!ctx.app || !ctx.uiLayer) return
  const overlay = new Graphics()
  overlay.rect(0, 0, GAME_W, GAME_H).fill({ color, alpha: intensity })
  ctx.uiLayer.addChild(overlay)
  const start = performance.now()
  const tick = () => {
    const elapsed = performance.now() - start
    const progress = elapsed / durationMs
    if (progress >= 1) {
      if (!overlay.destroyed) ctx.uiLayer.removeChild(overlay)
      ctx.app?.ticker.remove(tick)
      return
    }
    overlay.alpha = intensity * (1 - progress)
  }
  ctx.app.ticker.add(tick)
}

export function spawnDamageText(ctx: GameContext, x: number, y: number, dmg: number | string): void {
  if (!ctx.gameLayer) return
  const isString = typeof dmg === 'string'
  const isCrit = !isString && Math.random() < 0.15
  const style = new TextStyle({
    fill: isCrit ? 0xffff44 : 0xff8844,
    fontSize: isCrit ? 16 : 12,
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 'bold',
  })
  const t = new Text({ text: String(dmg), style })
  t.anchor.set(0.5, 1)
  t.x = x + (Math.random() - 0.5) * 16
  t.y = y
  ctx.gameLayer.addChild(t)
  ctx.damageTexts.push({ gfx: t, vy: isCrit ? 1.8 : 1.4, life: isCrit ? 45 : 40 })
}

export function spawnHealText(ctx: GameContext, x: number, y: number, amount: number): void {
  if (!ctx.gameLayer || amount <= 0) return
  const style = new TextStyle({
    fill: 0x5dff7a,
    fontSize: 12,
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 'bold',
  })
  const t = new Text({ text: `+${amount}`, style })
  t.anchor.set(0.5, 1)
  t.x = x + (Math.random() - 0.5) * 14
  t.y = y
  // Heals float slightly slower so they are easy to distinguish from damage.
  ctx.gameLayer.addChild(t)
  ctx.damageTexts.push({ gfx: t, vy: 1.1, life: 44 })
}

export function getExpTierColor(tier: string): number {
  if (tier === 'gold') return 0xffdd55
  if (tier === 'purple') return 0xbb77ff
  if (tier === 'blue') return 0x66ccff
  return 0xffffff
}

export function spawnExpCollectEffect(
  ctx: GameContext,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  amount: number,
  color = 0x66ccff,
): void {
  if (!ctx.gameLayer) return
  const particleCount = Math.max(2, Math.min(6, Math.round(Math.sqrt(Math.max(1, amount)) / 2.6)))
  for (let i = 0; i < particleCount; i++) {
    const g = new Graphics()
    const size = 1.6 + Math.random() * 1.6
    g.circle(0, 0, size).fill({ color, alpha: 0.95 })
    g.circle(0, 0, size * 0.45).fill({ color: 0xffffff, alpha: 0.6 })
    const sx = fromX + (Math.random() - 0.5) * 10
    const sy = fromY + (Math.random() - 0.5) * 10
    g.x = sx
    g.y = sy
    ctx.gameLayer.addChild(g)
    ctx.expCollectParticles.push({
      gfx: g,
      x: sx,
      y: sy,
      vx: (Math.random() - 0.5) * 1.4,
      vy: (Math.random() - 0.5) * 1.4,
      targetX: toX + (Math.random() - 0.5) * 6,
      targetY: toY + (Math.random() - 0.5) * 6,
      life: 0,
      maxLife: 18 + Math.random() * 10,
    })
  }
}

export function showStageClearBanner(ctx: GameContext): void {
  if (!ctx.app || !ctx.uiLayer) return
  const style = new TextStyle({
    fill: 0x44ff88, fontSize: 20,
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 'bold',
    stroke: { color: 0x002200, width: 4 },
  })
  const txt = new Text({ text: '✓ STAGE CLEAR!', style })
  txt.anchor.set(0.5, 0.5)
  txt.x = GAME_W / 2
  txt.y = GAME_H * 0.45
  txt.alpha = 0
  ctx.uiLayer.addChild(txt)
  let f = 0
  const tick = () => {
    f++
    if (f < 20) txt.alpha = f / 20
    else if (f < 120) txt.alpha = 1
    else txt.alpha = Math.max(0, 1 - (f - 120) / 20)
    if (f >= 140) {
      if (!txt.destroyed) ctx.uiLayer.removeChild(txt)
      ctx.app?.ticker.remove(tick)
    }
  }
  ctx.app.ticker.add(tick)
}

/** Visual heat-wave ring — call activateHeatWave (abilities.ts) for the full damage effect. */
export function spawnHeatWave(ctx: GameContext, px: number, py: number): void {
  if (!ctx.app || !ctx.gameLayer) return
  for (let w = 0; w < 3; w++) {
    const ring = new Graphics()
    ring.x = px
    ring.y = py
    ctx.gameLayer.addChild(ring)
    let frame = 0
    const delay = w * 7
    const maxR = Math.max(GAME_W, GAME_H) * 0.9
    const maxFrames = 40
    const waveColor = w === 0 ? 0xff6600 : w === 1 ? 0xffaa00 : 0xffdd44
    const wTick = () => {
      if (frame < delay) { frame++; return }
      const f = frame - delay
      ring.clear()
      const r = (f / maxFrames) * maxR
      const alpha = Math.max(0, 0.75 - f / maxFrames)
      ring.circle(0, 0, r).stroke({ color: waveColor, width: Math.max(1, 4 - w), alpha })
      ring.circle(0, 0, r * 0.9).stroke({ color: 0xffffff, width: 1, alpha: alpha * 0.4 })
      frame++
      if (f >= maxFrames) {
        if (!ring.destroyed) ctx.gameLayer.removeChild(ring)
        ctx.app?.ticker.remove(wTick)
      }
    }
    ctx.app.ticker.add(wTick)
  }
}

/** Flashing AOE warning ring at a position (used for boss missile target indicator). */
export function spawnMissileWarning(ctx: GameContext, x: number, y: number): void {
  if (!ctx.app || !ctx.gameLayer) return
  const g = new Graphics()
  g.x = x; g.y = y
  ctx.gameLayer.addChild(g)
  let frame = 0
  const maxFrames = 90
  const tick = () => {
    frame++
    const progress = frame / maxFrames
    const r = 18 + progress * 18
    const alpha = (1 - progress) * 0.85
    g.clear()
    if (Math.floor(frame / 7) % 2 === 0) {
      g.circle(0, 0, r).stroke({ color: 0xff44ff, width: 2, alpha })
      g.circle(0, 0, 5).fill({ color: 0xff44ff, alpha: alpha * 0.9 })
    }
    if (frame >= maxFrames) {
      if (!g.destroyed) ctx.gameLayer.removeChild(g)
      ctx.app?.ticker.remove(tick)
    }
  }
  ctx.app.ticker.add(tick)
}
