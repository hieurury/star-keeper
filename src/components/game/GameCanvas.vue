<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Application, Graphics, Container, Text, TextStyle, Ticker } from 'pixi.js'
import { useGameStore } from '../../stores/gameStore'

const canvasWrapper = ref<HTMLDivElement>()
const game = useGameStore()

let app: Application | null = null

// ─── Types ────────────────────────────────────────────────────────────────────
interface Bullet {
  gfx: Graphics
  vy: number
  vx?: number
}
type EnemyKind = 'pioneer' | 'kamikaze' | 'sniper' | 'boss_stardestroyer'
type KamiState = 'descend' | 'aim' | 'charge' | 'prexplode' | 'dead'
type BossAttack2State = 'ready' | 'locking'
// Pioneer movement phases: patrol → approach → ram
type PioneerPhase = 'enter' | 'patrol' | 'approach'
interface Enemy {
  container: Container
  body: Graphics
  hpBarBg: Graphics
  hpBar: Graphics
  kind: EnemyKind
  vy: number
  vx: number
  hp: number
  maxHp: number
  barW: number
  // kamikaze
  kamiState?: KamiState
  kamiTimer?: number
  warnSign?: Text
  aimLine?: Graphics
  targetX?: number
  targetY?: number
  // sniper
  shootTimer?: number
  dodgeCooldown?: number
  dodgeTarget?: number
  // boss_stardestroyer
  bossEntered?: boolean
  bossTargetY?: number
  bossPhase?: 1 | 2
  attack1Timer?: number
  attack2Timer?: number
  bossAttack2State?: BossAttack2State
  laserLockTimer?: number
  laserLine?: Graphics
  laserTargetX?: number
  laserTargetY?: number
  pendingMissiles?: number
  missileFireTimer?: number
  bossDriftTarget?: number
  bossDriftTimer?: number
  bossLabel?: Text
  // formation / pioneer squad
  pioneerPhase?: PioneerPhase
  formTargetX?: number   // patrol/hover destination X
  formTargetY?: number   // patrol/hover destination Y
  enterTargetX?: number  // entry landing X
  enterTargetY?: number  // entry landing Y
  approachTimer?: number // countdown before charging
  squadId?: number       // which flock this pioneer belongs to
  formOffsetX?: number   // offset from squad anchor X
  formOffsetY?: number   // offset from squad anchor Y
}
interface EnemyBullet {
  gfx: Graphics
  vx: number
  vy: number
  homing?: boolean
  homingLife?: number    // frames remaining to track
  homingSpeed?: number
  onHitPlayer?: () => void
}
interface StarBg {
  gfx: Graphics
  vy: number
}
interface DamageText {
  gfx: Text
  vy: number
  life: number
}
interface ExpOrb {
  gfx: Graphics
  x: number
  y: number
  vy: number
  amount: number
  tier: OrbTier
}

type OrbTier = 'white' | 'blue' | 'purple' | 'gold'
// Game phase for intro
type GamePhase = 'intro' | 'stageTitle' | 'playing'

let playerShip: Graphics | null = null
let bullets: Bullet[] = []
let enemies: Enemy[] = []
let enemyBullets: EnemyBullet[] = []
let stars: StarBg[] = []
let damageTexts: DamageText[] = []
let expOrbs: ExpOrb[] = []
let gameLayer: Container
let bgLayer: Container
let uiLayer: Container

let shootTimer = 0
const TOUCH_Y_OFFSET = 90  // ship floats this many px above the finger
let isDragging = false
let touchX = 0
let touchY = 0

// ── Wave / Stage state ─────────────────────────────────────────────────────
// waveQueue: list of spawn functions to call for the current stage
type WaveSpawner = () => void
let waveQueue: WaveSpawner[] = []
let waveDispatchTimer = 0          // frames between group dispatches
let waveIsClearing = false         // waiting for enemies to die
let stageClearTimer = 0            // short pause between stages
let stageAnnouncePending = false   // show stage title next frame

// ── Flock / squad state ──────────────────────────────────────────────────────
interface FlockState {
  x: number; y: number    // current anchor position
  tx: number; ty: number  // roam target
  timer: number           // countdown to pick next target
}
const flockStates = new Map<number, FlockState>()
let nextSquadId = 0

// Intro / phase state
let gamePhase: GamePhase = 'intro'
let introTimer = 0
let stageTitleText: Text | null = null
let stageTitleTimer = 0
const INTRO_FRAMES = 90
const STAGE_TITLE_FRAMES = 130

const GAME_W = 390
const GAME_H = 844

// ─── Drawing helpers (Pixi.js v8 API) ────────────────────────────────────────
function drawShip(g: Graphics) {
  g.clear()
  g.rect(-10, -22, 20, 34).fill(0x00cfff)
  g.poly([-10, 0, -28, 18, -10, 10]).fill(0x0077bb)
  g.poly([10, 0, 28, 18, 10, 10]).fill(0x0077bb)
  g.rect(-5, -22, 10, 13).fill(0xffd700)
  g.rect(-6, 12, 12, 9).fill({ color: 0xff6600, alpha: 0.85 })
}

function drawBullet(g: Graphics, spdScale = 1.0) {
  g.clear()
  // Faster bullets are smaller (min 60% original size)
  const sz = Math.max(0.6, 1.0 / Math.pow(spdScale, 0.35))
  const w = Math.max(2, Math.round(4 * sz))
  const h = Math.max(11, Math.round(18 * sz))
  g.rect(-w / 2, -(h * 0.55), w, h).fill(0xffee22)
  g.rect(-w / 4, -(h * 0.55) - Math.round(h * 0.22), Math.max(1, w / 2), Math.round(h * 0.4)).fill({ color: 0xffffff, alpha: 0.8 })
}

function drawEnemyBullet(g: Graphics) {
  g.clear()
  g.circle(0, 0, 5).fill(0xff3300)
  g.circle(0, 0, 3).fill({ color: 0xff9966, alpha: 0.9 })
}

// Anox Tiên Phong — compact diamond shape, bluish-red
function drawPioneer(g: Graphics, size: number) {
  g.clear()
  g.poly([0, -size, size * 0.7, 0, 0, size * 0.55, -size * 0.7, 0]).fill(0xcc2266)
  g.poly([0, -size * 0.5, size * 0.35, 0, 0, size * 0.3, -size * 0.35, 0]).fill(0x881144)
  g.circle(0, -size * 0.15, size * 0.2).fill(0xff44aa)
  g.rect(-size * 0.08, size * 0.35, size * 0.16, size * 0.22).fill({ color: 0xff2200, alpha: 0.8 })
}

// Anox Cảm Tử — spike-heavy, orange core
function drawKamikaze(g: Graphics, size: number) {
  g.clear()
  g.poly([0, -size, size * 0.55, size * 0.3, size * 0.2, size * 0.5, -size * 0.2, size * 0.5, -size * 0.55, size * 0.3]).fill(0xdd4400)
  // spikes
  g.poly([size * 0.55, size * 0.3, size * 1.1, size * 0.05, size * 0.65, size * 0.5]).fill(0xff6600)
  g.poly([-size * 0.55, size * 0.3, -size * 1.1, size * 0.05, -size * 0.65, size * 0.5]).fill(0xff6600)
  g.circle(0, size * 0.1, size * 0.25).fill(0xffaa00)
}

// Anox Liên Xạ — wide wing shape, green tones
function drawSniper(g: Graphics, size: number) {
  g.clear()
  g.rect(-size * 0.25, -size * 0.7, size * 0.5, size * 1.2).fill(0x228833)
  g.poly([-size * 0.25, -size * 0.1, -size * 1.1, size * 0.4, -size * 0.25, size * 0.25]).fill(0x115522)
  g.poly([size * 0.25, -size * 0.1, size * 1.1, size * 0.4, size * 0.25, size * 0.25]).fill(0x115522)
  g.rect(-size * 0.12, -size * 0.7, size * 0.24, size * 0.55).fill(0x44ff88)
  g.circle(-size * 0.7, size * 0.3, size * 0.12).fill({ color: 0x44ff88, alpha: 0.7 })
  g.circle(size * 0.7, size * 0.3, size * 0.12).fill({ color: 0x44ff88, alpha: 0.7 })
}

// Anox Kẻ Diệt Sao — large boss, dark blue steel
function drawStarDestroyer(g: Graphics, size: number) {
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

function drawBossBullet(g: Graphics) {
  g.clear()
  g.circle(0, 0, 6.5).fill(0x4466bb)
  g.circle(0, 0, 4).fill({ color: 0x88aaff, alpha: 0.9 })
  g.circle(0, 0, 1.5).fill(0xffffff)
}

function drawBossMissile(g: Graphics, small = false) {
  g.clear()
  const s = small ? 0.55 : 1.0
  g.rect(-2.5*s, -8*s, 5*s, 14*s).fill(0x4488ff)
  g.poly([0, -12*s, 3*s, -8*s, -3*s, -8*s]).fill(0xaaccff)
  g.poly([-2.5*s, 4*s, -5.5*s, 8*s, -2.5*s, 2*s]).fill(0x2255aa)
  g.poly([2.5*s, 4*s, 5.5*s, 8*s, 2.5*s, 2*s]).fill(0x2255aa)
  g.circle(0, 7*s, 2*s).fill({ color: 0xff8800, alpha: 0.9 })
}

function redrawHpBar(hpBarBg: Graphics, hpBar: Graphics, pct: number, w: number) {
  hpBarBg.clear()
  hpBarBg.rect(-w / 2, 0, w, 4).fill(0x222222)
  hpBar.clear()
  if (pct > 0) {
    const color = pct > 0.5 ? 0x22dd44 : pct > 0.25 ? 0xffaa00 : 0xff2222
    hpBar.rect(-w / 2, 0, w * pct, 4).fill(color)
  }
}

function createStar(): StarBg {
  const g = new Graphics()
  const size = Math.random() * 1.5 + 0.5
  g.rect(0, 0, size, size).fill({ color: 0xffffff, alpha: Math.random() * 0.5 + 0.3 })
  g.x = Math.random() * GAME_W
  g.y = Math.random() * GAME_H
  return { gfx: g, vy: Math.random() * 1.5 + 0.5 }
}

// ─── Effects ─────────────────────────────────────────────────────────────────
function spawnDamageText(x: number, y: number, dmg: number) {
  const style = new TextStyle({
    fill: 0xff8844,
    fontSize: 12,
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 'bold',
  })
  const t = new Text({ text: String(dmg), style })
  t.anchor.set(0.5, 1)
  t.x = x + (Math.random() - 0.5) * 16
  t.y = y
  uiLayer.addChild(t)
  damageTexts.push({ gfx: t, vy: 1.4, life: 40 })
}

function spawnExplosion(x: number, y: number, radius = 14, color1 = 0xff8800, color2 = 0xffee44) {
  if (!gameLayer || !app) return
  const g = new Graphics()
  g.x = x
  g.y = y
  gameLayer.addChild(g)
  let frame = 0
  const maxFrames = radius
  const tick = () => {
    frame++
    g.clear()
    const r = frame * (radius / maxFrames) * 3
    g.circle(0, 0, r).fill({ color: color1, alpha: Math.max(0, 1 - frame / maxFrames) })
    g.circle(0, 0, r * 0.55).fill({ color: color2, alpha: Math.max(0, 1 - frame / (maxFrames * 0.7)) })
    if (frame >= maxFrames) {
      gameLayer.removeChild(g)
      app?.ticker.remove(tick)
    }
  }
  app.ticker.add(tick)
}

function hitFlash(body: Graphics) {
  body.alpha = 0.35
  setTimeout(() => { if (body && !body.destroyed) body.alpha = 1 }, 110)
}

function screenFlash(color = 0xff2222, intensity = 0.38, durationMs = 160) {
  if (!app || !uiLayer) return
  const overlay = new Graphics()
  overlay.rect(0, 0, GAME_W, GAME_H).fill({ color, alpha: intensity })
  uiLayer.addChild(overlay)
  const start = performance.now()
  const tick = () => {
    const elapsed = performance.now() - start
    const progress = elapsed / durationMs
    if (progress >= 1) {
      uiLayer.removeChild(overlay)
      app?.ticker.remove(tick)
      return
    }
    overlay.alpha = intensity * (1 - progress)
  }
  app.ticker.add(tick)
}

function showStageClearBanner() {
  if (!app || !uiLayer) return
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
  uiLayer.addChild(txt)
  let f = 0
  const tick = () => {
    f++
    if (f < 20) txt.alpha = f / 20
    else if (f < 120) txt.alpha = 1
    else txt.alpha = Math.max(0, 1 - (f - 120) / 20)
    if (f >= 140) { uiLayer.removeChild(txt); app?.ticker.remove(tick) }
  }
  app.ticker.add(tick)
}

// Sóng tầm nhiệt huỷ diệt: hiệu ứng vòng sóng toả rộng
function spawnHeatWave(px: number, py: number) {
  if (!app || !gameLayer) return
  for (let w = 0; w < 3; w++) {
    const ring = new Graphics()
    ring.x = px
    ring.y = py
    gameLayer.addChild(ring)
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
        if (!ring.destroyed) gameLayer.removeChild(ring)
        app?.ticker.remove(wTick)
      }
    }
    app.ticker.add(wTick)
  }
}

function activateHeatWave() {
  if (!playerShip || !app) return
  const px = playerShip.x
  const py = playerShip.y
  screenFlash(0xff6600, 0.55, 450)
  spawnHeatWave(px, py)

  // Huỷ tất cả đường đạn kẻ địch
  for (const b of enemyBullets) {
    if (!b.gfx.destroyed) gameLayer.removeChild(b.gfx)
  }
  enemyBullets = []

  // Gây sát thương lên tất cả kẻ địch
  const waveDamage = 150
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]
    e.hp = Math.max(0, e.hp - waveDamage)
    hitFlash(e.body)
    spawnDamageText(e.container.x, e.container.y - (e.kind === 'boss_stardestroyer' ? 60 : 16), waveDamage)
    redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
    if (e.hp <= 0) {
      if (e.kind === 'boss_stardestroyer') {
        spawnExplosion(e.container.x, e.container.y, 50, 0x4466ff, 0xaaccff)
        spawnExplosion(e.container.x - 30, e.container.y + 20, 28, 0xff4400, 0xffee44)
        spawnExplosion(e.container.x + 30, e.container.y - 10, 24, 0xff8800, 0xffee44)
        screenFlash(0x4466ff, 0.65, 800)
        spawnEnemyOrbs(e.container.x, e.container.y, 'boss_stardestroyer')
        if (e.laserLine) e.laserLine.clear()
        game.addScore(300 + game.currentStage * 50)
      } else {
        spawnExplosion(e.container.x, e.container.y, e.kind === 'kamikaze' ? 18 : 14)
        spawnEnemyOrbs(e.container.x, e.container.y, e.kind)
        const pts = e.kind === 'sniper' ? 20 + game.currentStage * 7
          : e.kind === 'kamikaze' ? 15 + game.currentStage * 6
          : 10 + game.currentStage * 5
        game.addScore(pts)
      }
      gameLayer.removeChild(e.container)
      enemies.splice(i, 1)
      game.stageEnemiesKilled++
    }
  }
}

const ORB_CONFIG: Record<OrbTier, { outer: number; inner: number; exp: number; r: number }> = {
  white:  { outer: 0xffffff, inner: 0xdddddd, exp: 10, r: 4.5 },
  blue:   { outer: 0x44aaff, inner: 0xaaddff, exp: 20, r: 5.0 },
  purple: { outer: 0xcc44ff, inner: 0xee99ff, exp: 30, r: 5.5 },
  gold:   { outer: 0xffd700, inner: 0xffee88, exp: 50, r: 6.0 },
}

function spawnExpOrb(x: number, y: number, tier: OrbTier) {
  const cfg = ORB_CONFIG[tier]
  const g = new Graphics()
  g.circle(0, 0, cfg.r).fill(cfg.outer)
  g.circle(0, 0, cfg.r * 0.55).fill({ color: cfg.inner, alpha: 0.9 })
  const ox = x + (Math.random() - 0.5) * 28
  g.x = ox
  g.y = y
  gameLayer.addChild(g)
  expOrbs.push({ gfx: g, x: ox, y, vy: 0.55 + Math.random() * 0.45, amount: cfg.exp, tier })
}

function spawnEnemyOrbs(x: number, y: number, kind: EnemyKind) {
  if (kind === 'pioneer') {
    const count = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) spawnExpOrb(x, y, 'white')
  } else if (kind === 'kamikaze') {
    const count = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < count; i++) spawnExpOrb(x, y, Math.random() < 0.3 ? 'blue' : 'white')
  } else if (kind === 'sniper') {
    const count = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) spawnExpOrb(x, y, Math.random() < 0.25 ? 'purple' : 'white')
  } else if (kind === 'boss_stardestroyer') {
    for (let i = 0; i < 10; i++) spawnExpOrb(x + (Math.random()-0.5)*40, y + (Math.random()-0.5)*20, 'gold')
    for (let i = 0; i < 6; i++) spawnExpOrb(x + (Math.random()-0.5)*30, y + (Math.random()-0.5)*20, 'purple')
    for (let i = 0; i < 4; i++) spawnExpOrb(x + (Math.random()-0.5)*20, y, 'blue')
  }
}

// ─── Spawn enemies ────────────────────────────────────────────────────────────
function makePioneer(startX: number, startY: number, formX: number, formY: number): Enemy {
  const size = Math.random() * 6 + 13
  const barW = size * 2.4
  const maxHp = 28 + game.currentStage * 18
  const body = new Graphics()
  drawPioneer(body, size)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 8
  hpBar.y = -size - 8
  const container = new Container()
  container.addChild(body, hpBarBg, hpBar)
  container.x = startX
  container.y = startY
  gameLayer.addChild(container)
  return {
    container, body, hpBarBg, hpBar,
    kind: 'pioneer',
    vy: 2.0 + game.currentStage * 0.1,
    vx: 0,
    hp: maxHp, maxHp, barW,
    pioneerPhase: 'enter',
    enterTargetX: formX,
    enterTargetY: formY,
    formTargetX: formX,
    formTargetY: formY,
    approachTimer: 0,
  }
}

// Spawn 1 squad of pioneers (4-6) in a formation pattern
// formation: 'line' | 'diamond' | 'box'
// entry: 'top' | 'left' | 'right'
function spawnPioneerSquad(formation: 'line' | 'diamond' | 'box' = 'line', entry: 'top' | 'left' | 'right' = 'top') {
  const count = 6 + Math.floor(Math.random() * 4)   // 6-9
  const stage = game.currentStage
  // Formation positions relative to center anchor
  const positions: [number, number][] = []
  const spacing = 44
  if (formation === 'line') {
    for (let i = 0; i < count; i++) positions.push([(i - (count - 1) / 2) * spacing, 0])
  } else if (formation === 'diamond') {
    const rows = Math.ceil(count / 2)
    let idx = 0
    for (let r = 0; r < rows && idx < count; r++) {
      const inRow = r === 0 || r === rows - 1 ? 1 : 2
      for (let c = 0; c < inRow && idx < count; c++) {
        positions.push([(c - (inRow - 1) / 2) * spacing, (r - (rows - 1) / 2) * spacing])
        idx++
      }
    }
  } else {
    // box
    const cols = Math.ceil(Math.sqrt(count))
    for (let i = 0; i < count; i++) {
      const r = Math.floor(i / cols), c = i % cols
      positions.push([(c - (cols - 1) / 2) * spacing, r * spacing])
    }
  }

  // Anchor = formation centre in the play field
  const anchorX = GAME_W * 0.2 + Math.random() * GAME_W * 0.6
  const anchorY = GAME_H * 0.12 + Math.random() * GAME_H * 0.18

  // Assign a shared squad ID so all members share one flock anchor
  const squadId = nextSquadId++
  flockStates.set(squadId, {
    x: anchorX, y: anchorY,
    tx: GAME_W * 0.1 + Math.random() * GAME_W * 0.8,
    ty: GAME_H * 0.08 + Math.random() * GAME_H * 0.70,
    timer: 150 + Math.random() * 100,
  })

  for (const [rx, ry] of positions) {
    const formX = anchorX + rx
    const formY = anchorY + Math.abs(ry)
    let startX: number, startY: number
    if (entry === 'top') {
      startX = formX + (Math.random() - 0.5) * 30
      startY = -40
    } else if (entry === 'left') {
      startX = -40
      startY = formY
    } else {
      startX = GAME_W + 40
      startY = formY
    }
    const e = makePioneer(startX, startY, formX, formY)
    e.squadId = squadId
    e.formOffsetX = rx
    e.formOffsetY = Math.abs(ry)
    // Stagger approach timer — back rows wait longer
    e.approachTimer = 80 + Math.abs(ry / spacing) * 40 + stage * 2
    enemies.push(e)
    game.stageEnemiesTotal++
  }
}

function spawnKamikaze() {
  const size = Math.random() * 5 + 16
  const barW = size * 2.8
  const body = new Graphics()
  drawKamikaze(body, size)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  const maxHp = 30 + game.currentStage * 22
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 10
  hpBar.y = -size - 10
  const warnStyle = new TextStyle({
    fill: 0xffdd00, fontSize: 16,
    fontFamily: "'Chakra Petch', sans-serif", fontWeight: 'bold',
  })
  const warnSign = new Text({ text: '!!', style: warnStyle })
  warnSign.anchor.set(0.5, 1)
  warnSign.y = -size - 14
  warnSign.visible = false
  const aimLine = new Graphics()
  aimLine.visible = false
  const container = new Container()
  container.addChild(body, hpBarBg, hpBar, warnSign, aimLine)
  container.x = Math.random() * (GAME_W - 80) + 40
  container.y = -40
  gameLayer.addChild(container)
  const e: Enemy = {
    container, body, hpBarBg, hpBar,
    kind: 'kamikaze',
    vy: 1.2 + Math.random() * 0.6 + game.currentStage * 0.08,
    vx: 0,
    hp: maxHp, maxHp, barW,
    kamiState: 'descend',
    kamiTimer: 0,
    warnSign, aimLine,
    targetX: 0, targetY: 0,
  }
  enemies.push(e)
  game.stageEnemiesTotal++
}

// Spawn a sniper optionally with pioneer escort
function spawnSniperGroup(withEscort = false) {
  const size = Math.random() * 5 + 14
  const barW = size * 2.8
  const body = new Graphics()
  drawSniper(body, size)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  const maxHp = 12 + game.currentStage * 10
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 10
  hpBar.y = -size - 10
  const container = new Container()
  container.addChild(body, hpBarBg, hpBar)
  const sniperX = GAME_W * 0.2 + Math.random() * GAME_W * 0.6
  const sniperY = GAME_H * 0.10 + Math.random() * GAME_H * 0.12
  container.x = sniperX
  container.y = -40
  gameLayer.addChild(container)
  const sniper: Enemy = {
    container, body, hpBarBg, hpBar,
    kind: 'sniper',
    vy: 0.4 + Math.random() * 0.3,
    vx: 0,
    hp: maxHp, maxHp, barW,
    shootTimer: 200 + Math.random() * 100,
    dodgeCooldown: 0,
    formTargetX: sniperX,
    formTargetY: sniperY,
    pioneerPhase: 'enter',
    enterTargetX: sniperX,
    enterTargetY: sniperY,
    approachTimer: 999999, // sniper never approaches on its own
  }
  enemies.push(sniper)
  game.stageEnemiesTotal++

  if (withEscort) {
    // 2-4 pioneers flanking the sniper
    const escortCount = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < escortCount; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const rank = Math.floor(i / 2)
      const formX = sniperX + side * (55 + rank * 44)
      const formY = sniperY + rank * 30
      const e = makePioneer(-40 + (side < 0 ? 0 : GAME_W + 80), formY - 80, formX, formY)
      e.approachTimer = 999999  // escorts stay until sniper is killed or they are shot
      enemies.push(e)
      game.stageEnemiesTotal++
    }
  }
}

function spawnStarDestroyer() {
  const size = 50
  const maxHp = 1600 + game.currentStage * 400
  const barW = 260
  const body = new Graphics()
  drawStarDestroyer(body, size)
  const hpBarBg = new Graphics()
  const hpBar = new Graphics()
  redrawHpBar(hpBarBg, hpBar, 1, barW)
  hpBarBg.y = -size - 16
  hpBar.y = -size - 16
  const laserLine = new Graphics()
  laserLine.visible = false
  const labelStyle = new TextStyle({
    fill: 0xaaccff, fontSize: 10,
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 'bold',
    stroke: { color: 0x000022, width: 3 },
  })
  const bossLabel = new Text({ text: 'ANOX - KẾ DIỆT SAO', style: labelStyle })
  bossLabel.anchor.set(0.5, 1)
  bossLabel.y = -size - 18
  const container = new Container()
  container.addChild(body, hpBarBg, hpBar, laserLine, bossLabel)
  container.x = GAME_W / 2
  container.y = -size * 2.5
  gameLayer.addChild(container)
  // Boss alert text
  const alertStyle = new TextStyle({
    fill: 0xff4444, fontSize: 22,
    fontFamily: "'Chakra Petch', sans-serif",
    fontWeight: 'bold',
    stroke: { color: 0x220000, width: 4 },
  })
  const alertText = new Text({ text: '⚠ BOSS XUẤT HIỆN ⚠', style: alertStyle })
  alertText.anchor.set(0.5, 0.5)
  alertText.x = GAME_W / 2
  alertText.y = GAME_H * 0.45
  alertText.alpha = 0
  uiLayer.addChild(alertText)
  let alertFrame = 0
  const alertTick = () => {
    alertFrame++
    if (alertFrame < 30) alertText.alpha = alertFrame / 30
    else if (alertFrame < 120) alertText.alpha = 1
    else alertText.alpha = Math.max(0, 1 - (alertFrame - 120) / 30)
    if (alertFrame >= 150) { uiLayer.removeChild(alertText); app?.ticker.remove(alertTick) }
  }
  app?.ticker.add(alertTick)
  screenFlash(0xff2222, 0.3, 500)
  const e: Enemy = {
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
  }
  enemies.push(e)
  game.stageEnemiesTotal++
}

// ─── Wave builder ─────────────────────────────────────────────────────────────
// Returns an array of spawner functions for stage N
function buildWave(stage: number): WaveSpawner[] {
  const wave: WaveSpawner[] = []
  const isBossStage = stage % 5 === 0

  if (isBossStage) {
    // Boss stage: bigger escort waves before boss appears
    const escortGroups = 2 + Math.floor(stage / 5)
    for (let g = 0; g < escortGroups; g++) {
      const entries: Array<'top' | 'left' | 'right'> = ['top', 'left', 'right']
      wave.push(() => spawnPioneerSquad('diamond', entries[g % 3]!))
    }
    wave.push(() => spawnStarDestroyer())
    return wave
  }

  // Scale with stage: every 5 stages is a harder tier
  const tier  = Math.floor((stage - 1) / 5)  // 0,1,2...
  const difficulty = 1 + tier * 0.4

  // Pioneer squads (always present, count scales strongly)
  const squadCount = Math.min(10, 2 + Math.floor(stage / 2))
  for (let i = 0; i < squadCount; i++) {
    const formations: Array<'line' | 'diamond' | 'box'> = ['line', 'diamond', 'box']
    const entries: Array<'top' | 'left' | 'right'> = ['top', 'left', 'right']
    const form = formations[Math.floor(Math.random() * (stage < 4 ? 1 : stage < 7 ? 2 : 3))]
    const entry = entries[Math.floor(Math.random() * (stage < 3 ? 1 : 3))]
    wave.push(() => spawnPioneerSquad(form, entry))
  }

  // Sniper groups — balanced with Pioneer squads
  if (stage >= 2) {
    const sniperCount = Math.min(10, 2 + Math.floor(stage / 2))
    for (let i = 0; i < sniperCount; i++) {
      const withEscort = stage >= 3 && Math.random() < 0.65
      wave.push(() => spawnSniperGroup(withEscort))
    }
  }

  // Kamikaze — elite unit, only stage 4+
  if (stage >= 4 && difficulty >= 1) {
    const kamiCount = Math.min(6, stage - 3)
    for (let i = 0; i < kamiCount; i++) {
      wave.push(() => spawnKamikaze())
    }
  }

  // Shuffle groups so it's not always pioneer → sniper → kamikaze
  for (let i = wave.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wave[i], wave[j]] = [wave[j]!, wave[i]!]
  }

  return wave
}

function launchWave() {
  game.stageEnemiesTotal = 0
  game.stageEnemiesKilled = 0
  game.stageComplete = false
  waveQueue = buildWave(game.currentStage)
  waveIsClearing = false
  waveDispatchTimer = 0
  flockStates.clear()
  nextSquadId = 0
}

// ─── Shoot ────────────────────────────────────────────────────────────────────
function shoot(offsetX = 0, vxDrift = 0) {
  if (!playerShip) return
  const g = new Graphics()
  drawBullet(g, game.upgrades.bulletSpeed)
  g.x = playerShip.x + offsetX
  g.y = playerShip.y - 22
  gameLayer.addChild(g)
  bullets.push({ gfx: g, vy: 8 * game.upgrades.bulletSpeed, vx: vxDrift })
}

function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

// ─── Game loop ────────────────────────────────────────────────────────────────
function gameLoop(ticker: Ticker) {
  if (!app || !game.isPlaying || game.isGameOverSequence) return
  const dt = ticker.deltaTime

  // Stars always scroll
  for (const s of stars) {
    s.gfx.y += s.vy * dt
    if (s.gfx.y > GAME_H) s.gfx.y = -4
  }

  // ── INTRO PHASE ──────────────────────────────────────────────────────────
  if (gamePhase === 'intro') {
    introTimer += dt
    const progress = Math.min(introTimer / INTRO_FRAMES, 1)
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3)
    const startY = GAME_H + 60
    const endY = GAME_H * 0.67
    if (playerShip) {
      playerShip.y = startY + (endY - startY) * eased
    }
    if (progress >= 1) {
      gamePhase = 'stageTitle'
      stageTitleTimer = 0
      // Show stage title text
      const style = new TextStyle({
        fill: 0xffd700,
        fontSize: 26,
        fontFamily: "'Chakra Petch', sans-serif",
        fontWeight: 'bold',
        stroke: { color: 0x000000, width: 4 },
        dropShadow: { color: 0xff8800, blur: 12, distance: 0, angle: 0, alpha: 0.9 },
      })
      stageTitleText = new Text({ text: 'CHẾ ĐỘ VÔ TẬN', style })
      stageTitleText.anchor.set(0.5, 0.5)
      stageTitleText.x = GAME_W / 2
      stageTitleText.y = GAME_H * 0.38
      stageTitleText.alpha = 0
      uiLayer.addChild(stageTitleText)
    }
    return // block all player action during intro
  }

  // ── STAGE TITLE PHASE ────────────────────────────────────────────────────
  if (gamePhase === 'stageTitle') {
    stageTitleTimer += dt
    if (stageTitleText) {
      const fadeIn = STAGE_TITLE_FRAMES * 0.2
      const fadeOut = STAGE_TITLE_FRAMES * 0.8
      if (stageTitleTimer < fadeIn) {
        stageTitleText.alpha = stageTitleTimer / fadeIn
      } else if (stageTitleTimer < fadeOut) {
        stageTitleText.alpha = 1
      } else {
        stageTitleText.alpha = 1 - (stageTitleTimer - fadeOut) / (STAGE_TITLE_FRAMES - fadeOut)
      }
    }
    if (stageTitleTimer >= STAGE_TITLE_FRAMES) {
      if (stageTitleText) {
        uiLayer.removeChild(stageTitleText)
        stageTitleText = null
      }
      gamePhase = 'playing'
      launchWave()  // kick off stage 1 wave
    }
    // Allow player movement during stage title but no enemy spawn
    if (playerShip && isDragging) {
      const dx = touchX - playerShip.x
      const dy = (touchY - TOUCH_Y_OFFSET) - playerShip.y
      const hpPenalty = Math.max(0.7, Math.pow(100 / game.playerMaxHp, 0.15))
      const spd = 5.5 * game.upgrades.shipSpeed * hpPenalty
      playerShip.x += dx * 0.055 * spd * dt * 0.5
      playerShip.y += dy * 0.055 * spd * dt * 0.5
      playerShip.x = Math.max(20, Math.min(GAME_W - 20, playerShip.x))
      playerShip.y = Math.max(60, Math.min(GAME_H - 60, playerShip.y))
    }
    return
  }

  // ── PLAYING PHASE ────────────────────────────────────────────────────────
  if (game.isPaused) return

  // Tick skill cooldown
  game.tickSkillCooldown(dt / 60)
  // Kiểm tra skill activation
  if (game.consumeSkillActivation()) {
    activateHeatWave()
  }

  // Player move
  if (isDragging && playerShip) {
    const dx = touchX - playerShip.x
    const dy = (touchY - TOUCH_Y_OFFSET) - playerShip.y
    const hpPenalty = Math.max(0.7, Math.pow(100 / game.playerMaxHp, 0.15))
    const spd = 5.5 * game.upgrades.shipSpeed * hpPenalty
    playerShip.x += dx * 0.055 * spd * dt * 0.5
    playerShip.y += dy * 0.055 * spd * dt * 0.5
    playerShip.x = Math.max(20, Math.min(GAME_W - 20, playerShip.x))
    playerShip.y = Math.max(60, Math.min(GAME_H - 60, playerShip.y))
  }

  // Shoot
  shootTimer += dt
  const shootInterval = 18 / Math.sqrt(game.upgrades.bulletCount)
  if (shootTimer >= shootInterval) {
    shootTimer = 0
    const cnt = game.upgrades.bulletCount
    // Spread angle: max ±12° for outermost bullet (giảm từ 22.5°)
    const maxHalfAngle = Math.min(Math.PI * 12 / 180, (cnt - 1) * Math.PI * 3 / 180)
    const bulletVy = 8 * game.upgrades.bulletSpeed
    for (let i = 0; i < cnt; i++) {
      const norm = cnt > 1 ? (i - (cnt - 1) / 2) / ((cnt - 1) / 2) : 0
      const vxDrift = Math.tan(norm * maxHalfAngle) * bulletVy
      shoot((i - (cnt - 1) / 2) * 12, vxDrift)
    }
  }

  // Move player bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    b.gfx.y -= b.vy * dt
    if (b.vx) b.gfx.x += b.vx * dt
    if (b.gfx.y < -20 || b.gfx.x < -10 || b.gfx.x > GAME_W + 10) {
      gameLayer.removeChild(b.gfx)
      bullets.splice(i, 1)
    }
  }

  // Move enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i]
    // Homing steering
    if (b.homing && (b.homingLife ?? 0) > 0 && playerShip) {
      b.homingLife! -= dt
      const spd = b.homingSpeed ?? 3.5
      const dx = playerShip.x - b.gfx.x
      const dy = playerShip.y - b.gfx.y
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
      gameLayer.removeChild(b.gfx)
      enemyBullets.splice(i, 1)
      continue
    }
    // Check hit player — larger hitbox for homing missiles
    const bHitR = b.homing ? 14 : 12
    if (playerShip && dist2(b.gfx.x, b.gfx.y, playerShip.x, playerShip.y) < bHitR * bHitR) {
      const dmg = 15 + game.currentStage * 3
      game.takeDamage(dmg)
      screenFlash()
      spawnDamageText(playerShip.x, playerShip.y - 20, dmg)
      b.onHitPlayer?.()
      gameLayer.removeChild(b.gfx)
      enemyBullets.splice(i, 1)
    }
  }

  // Wave dispatch — pop one group from waveQueue every N frames
  if (!waveIsClearing && waveQueue.length > 0) {
    waveDispatchTimer += dt
    const dispatchInterval = Math.max(60, 180 - game.currentStage * 8)
    if (waveDispatchTimer >= dispatchInterval) {
      waveDispatchTimer = 0
      const spawner = waveQueue.shift()!
      spawner()
      if (waveQueue.length === 0) waveIsClearing = true
    }
  }

  // Stage clear check — all dispatched enemies dead?
  if (waveIsClearing && enemies.length === 0) {
    if (stageClearTimer === 0) {
      game.stageComplete = true
      stageClearTimer = 180  // 3 s pause before next stage
      if (!stageAnnouncePending) {
        stageAnnouncePending = true
        showStageClearBanner()
      }
    }
  }
  if (stageClearTimer > 0) {
    stageClearTimer -= dt
    if (stageClearTimer <= 0) {
      stageClearTimer = 0
      stageAnnouncePending = false
      game.currentStage++
      launchWave()
    }
  }
  // Pre-compute bullet damage scaled by bullet count (more bullets = less per-bullet damage, higher total)
  const bulletDmg = Math.round(
    game.upgrades.damage * Math.pow(1.2, game.upgrades.bulletCount - 1) / game.upgrades.bulletCount
  )
  // ── Advance flock anchors (shared per squad) ─────────────────────────────
  const flockSpeed = 1.4 + game.currentStage * 0.05
  for (const fs of flockStates.values()) {
    fs.timer -= dt
    const dx = fs.tx - fs.x
    const dy = fs.ty - fs.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 18 || fs.timer <= 0) {
      // Pick new roam target — stay within playfield
      fs.tx = GAME_W * 0.10 + Math.random() * GAME_W * 0.80
      fs.ty = GAME_H * 0.06 + Math.random() * GAME_H * 0.72
      fs.timer = 140 + Math.random() * 100
    }
    const nx = dx / (dist || 1)
    const ny = dy / (dist || 1)
    fs.x += nx * flockSpeed * dt
    fs.y += ny * flockSpeed * dt
    // Keep anchor inside screen bounds
    fs.x = Math.max(40, Math.min(GAME_W - 40, fs.x))
    fs.y = Math.max(40, Math.min(GAME_H - 120, fs.y))
  }
  // ── Update enemies ───────────────────────────────────────────────────────
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]

    // ── Pioneer: enter → patrol → approach phases ──
    if (e.kind === 'pioneer') {
      if (e.pioneerPhase === 'enter') {
        // Fly toward formation slot at moderate speed
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
        // Small drift around formation position
        const t = Date.now() / 1000 + (e.formTargetX ?? 0) * 0.01
        e.container.x += Math.sin(t * 1.3) * 0.4 * dt
        e.container.y += Math.cos(t * 0.9) * 0.25 * dt
        // Count down before approaching
        if ((e.approachTimer ?? 0) > 0) {
          e.approachTimer = (e.approachTimer ?? 0) - dt
          if ((e.approachTimer ?? 0) <= 0) e.pioneerPhase = 'approach'
        }
      } else {
        // approach: flock roam — all squad members share one anchor, each keeps its formation offset
        const fs = e.squadId != null ? flockStates.get(e.squadId) : null
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
        gameLayer.removeChild(e.container)
        enemies.splice(i, 1)
        game.stageEnemiesKilled++  // count as cleared (flew off screen)
        continue
      }
    }

    // ── Kamikaze: descend → aim → charge → explode ──
    else if (e.kind === 'kamikaze') {
      e.kamiTimer = (e.kamiTimer ?? 0) + dt

      if (e.kamiState === 'descend') {
        e.container.y += e.vy * dt
        // Detect player in range (y within 260px and x within 140px)
        if (playerShip &&
          e.container.y > 0 &&
          Math.abs(e.container.x - playerShip.x) < 140 &&
          e.container.y < playerShip.y - 40) {
          e.kamiState = 'aim'
          e.kamiTimer = 0
          e.targetX = playerShip.x
          e.targetY = playerShip.y
          if (e.warnSign) e.warnSign.visible = true
          if (e.aimLine) e.aimLine.visible = true
        }
        if (e.container.y > GAME_H + 40) {
          gameLayer.removeChild(e.container)
          enemies.splice(i, 1)
          continue
        }
      }
      else if (e.kamiState === 'aim') {
        // Slow descent while aiming
        e.container.y += e.vy * 0.2 * dt
        // Update aim line toward player
        if (e.aimLine && playerShip) {
          const tx = playerShip.x - e.container.x
          const ty = playerShip.y - e.container.y
          e.aimLine.clear()
          e.aimLine.moveTo(0, 0).lineTo(tx, ty).stroke({ color: 0xff4400, width: 1, alpha: 0.6 })
          e.targetX = playerShip.x
          e.targetY = playerShip.y
        }
        // Flash warn sign
        if (e.warnSign) {
          e.warnSign.alpha = Math.sin(e.kamiTimer * 0.25) > 0 ? 1 : 0.2
        }
        if (e.kamiTimer >= 60) { // 1s at 60fps
          e.kamiState = 'charge'
          e.kamiTimer = 0
          if (e.warnSign) e.warnSign.visible = false
          if (e.aimLine) e.aimLine.visible = false
          // Compute charge velocity
          const tx = (e.targetX ?? GAME_W / 2) - e.container.x
          const ty = (e.targetY ?? GAME_H / 2) - e.container.y
          const mag = Math.sqrt(tx * tx + ty * ty) || 1
          const speed = 9
          e.vx = (tx / mag) * speed
          e.vy = (ty / mag) * speed
        }
      }
      else if (e.kamiState === 'charge') {
        e.container.x += e.vx * dt
        e.container.y += e.vy * dt
        // Hit player directly → instant explosion
        if (playerShip && dist2(e.container.x, e.container.y, playerShip.x, playerShip.y) < 22 * 22) {
          e.kamiState = 'dead'
        }
        // Arrived at locked target OR max flight time → enter prexplode warning
        else if (
          dist2(e.container.x, e.container.y, e.targetX ?? 0, e.targetY ?? 0) < 20 * 20 ||
          e.kamiTimer >= 90 ||
          e.container.y > GAME_H + 60 || e.container.y < -60
        ) {
          e.kamiState = 'prexplode'
          e.kamiTimer = 0
          e.vx = 0
          e.vy = 0
        }
      }
      else if (e.kamiState === 'prexplode') {
        // Flash body 0.5s (30 frames) then explode
        e.body.alpha = Math.floor(e.kamiTimer / 4) % 2 === 0 ? 1 : 0.12
        if (e.kamiTimer >= 30) {
          e.body.alpha = 1
          e.kamiState = 'dead'
        }
      }
      if (e.kamiState === 'dead') {
        // Explode — big blast, AOE damage
        spawnExplosion(e.container.x, e.container.y, 18, 0xff4400, 0xffcc00)
        if (playerShip) {
          const d = Math.sqrt(dist2(e.container.x, e.container.y, playerShip.x, playerShip.y))
          if (d < 70) {
            const aoe = Math.round(35 * (1 - d / 70))
            game.takeDamage(aoe)
            screenFlash(0xff6600, 0.5, 220)
            spawnDamageText(playerShip.x, playerShip.y - 20, aoe)
          }
        }
        game.addScore(15 + game.currentStage * 6)
        game.stageEnemiesKilled++
        gameLayer.removeChild(e.container)
        enemies.splice(i, 1)
        continue
      }
    }

    // ── Sniper: slow descent, shoots every ~5s, dodge by instant sidestep ──
    else if (e.kind === 'sniper') {
      // Enter phase — fly to formation position
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
        // patrol/approach: gentle slow drift downward
        e.container.y += e.vy * dt
      }

      // Shoot at player every 300 frames (~5s)
      e.shootTimer = (e.shootTimer ?? 300) - dt
      if (e.shootTimer <= 0) {
        e.shootTimer = 290 + Math.random() * 60
        if (playerShip) {
          const tx = playerShip.x - e.container.x
          const ty = playerShip.y - e.container.y
          const mag = Math.sqrt(tx * tx + ty * ty) || 1
          const spd = 3.5
          const bg = new Graphics()
          drawEnemyBullet(bg)
          bg.x = e.container.x
          bg.y = e.container.y + 10
          gameLayer.addChild(bg)
          enemyBullets.push({ gfx: bg, vx: (tx / mag) * spd, vy: (ty / mag) * spd })
        }
      }

      // Smooth dodge animation toward dodgeTarget
      if (e.dodgeTarget !== undefined) {
        const ddx = e.dodgeTarget - e.container.x
        const step = Math.min(Math.abs(ddx), 9 * dt) * Math.sign(ddx)
        e.container.x += step
        if (Math.abs(ddx) < 1.5) {
          e.container.x = e.dodgeTarget
          e.dodgeTarget = undefined
        }
      }
      // Dodge: 5% chance per close bullet, slide to side then stay still
      e.dodgeCooldown = Math.max(0, (e.dodgeCooldown ?? 0) - dt)
      if (e.dodgeCooldown <= 0 && e.dodgeTarget === undefined) {
        for (const b of bullets) {
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
        gameLayer.removeChild(e.container)
        enemies.splice(i, 1)
        game.stageEnemiesKilled++
        continue
      }
    }

    // ── Boss Star Destroyer ──
    else if (e.kind === 'boss_stardestroyer') {
      // Entry animation — descend to target position
      if (!e.bossEntered) {
        e.container.y += 1.2 * dt
        if (e.container.y >= (e.bossTargetY ?? GAME_H * 0.18)) {
          e.container.y = e.bossTargetY ?? GAME_H * 0.18
          e.bossEntered = true
        }
      }
      if (e.bossEntered) {
        // Phase 2 transition at 50% HP
        if (e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
          e.bossPhase = 2
          screenFlash(0x4466ff, 0.5, 600)
          spawnExplosion(e.container.x, e.container.y, 28, 0x4466ff, 0xaaccff)
          if (e.bossLabel) {
            e.bossLabel.text = 'ANOX - DI\u1ec6T SAO [PHASE 2]'
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
        // Attack 1 — 6-bullet scatter burst, each hit heals boss 5% maxHp
        e.attack1Timer = (e.attack1Timer ?? 100) - dt
        if ((e.attack1Timer ?? 0) <= 0) {
          e.attack1Timer = 85
          if (playerShip) {
            const baseAngle = Math.atan2(playerShip.y - e.container.y, playerShip.x - e.container.x)
            const capturedEnemy = e
            for (let k = 0; k < 6; k++) {
              const angle = baseAngle + (k - 2.5) * 0.20
              const bg = new Graphics()
              drawBossBullet(bg)
              bg.x = e.container.x
              bg.y = e.container.y + 20
              gameLayer.addChild(bg)
              enemyBullets.push({
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
        // Attack 2 — missile attack (10s cooldown)
        if (e.bossPhase === 1) {
          // Phase 1: 2s laser lock-on → 2 homing missiles
          if (e.bossAttack2State === 'ready') {
            e.attack2Timer = (e.attack2Timer ?? 600) - dt
            if ((e.attack2Timer ?? 0) <= 0) {
              e.bossAttack2State = 'locking'
              e.laserLockTimer = 80
              if (e.laserLine) e.laserLine.visible = true
            }
          } else {
            e.laserLockTimer = (e.laserLockTimer ?? 0) - dt
            if (e.laserLine && playerShip) {
              const ltx = playerShip.x - e.container.x
              const lty = playerShip.y - e.container.y
              e.laserTargetX = playerShip.x
              e.laserTargetY = playerShip.y
              const alpha = 0.35 + Math.sin((120 - (e.laserLockTimer ?? 0)) * 0.25) * 0.3
              e.laserLine.clear()
              e.laserLine.moveTo(0, 20).lineTo(ltx, lty).stroke({ color: 0x4488ff, width: 2, alpha })
              e.laserLine.circle(ltx, lty, 8 + Math.sin((e.laserLockTimer ?? 0) * 0.3) * 3).stroke({ color: 0x4488ff, width: 1.5, alpha })
            }
            if ((e.laserLockTimer ?? 0) <= 0) {
              if (e.laserLine) { e.laserLine.clear(); e.laserLine.visible = false }
              for (let k = 0; k < 2; k++) {
                const offX = (k - 0.5) * 30
                const mlx = (e.laserTargetX ?? playerShip?.x ?? GAME_W / 2) - (e.container.x + offX)
                const mly = (e.laserTargetY ?? playerShip?.y ?? GAME_H / 2) - (e.container.y + 20)
                const mmag = Math.sqrt(mlx * mlx + mly * mly) || 1
                const mg = new Graphics()
                drawBossMissile(mg)
                mg.x = e.container.x + offX
                mg.y = e.container.y + 20
                gameLayer.addChild(mg)
                enemyBullets.push({ gfx: mg, vx: (mlx / mmag) * 4.5, vy: (mly / mmag) * 4.5, homing: true, homingLife: 180, homingSpeed: 4.5 })
              }
              e.bossAttack2State = 'ready'
              e.attack2Timer = 380
            }
          }
        } else {
          // Phase 2: 10 slow homing missiles that track for 5s
          if ((e.pendingMissiles ?? 0) > 0) {
            e.missileFireTimer = (e.missileFireTimer ?? 0) - dt
            if ((e.missileFireTimer ?? 0) <= 0) {
              const mox = (Math.random() - 0.5) * 60
              const mdx = (playerShip?.x ?? GAME_W / 2) - (e.container.x + mox)
              const mdy = (playerShip?.y ?? GAME_H) - (e.container.y + 20)
              const mmag = Math.sqrt(mdx * mdx + mdy * mdy) || 1
              const smg = new Graphics()
              drawBossMissile(smg, true)
              smg.x = e.container.x + mox
              smg.y = e.container.y + 20
              gameLayer.addChild(smg)
              enemyBullets.push({ gfx: smg, vx: (mdx / mmag) * 3.0, vy: (mdy / mmag) * 3.0, homing: true, homingLife: 240, homingSpeed: 3.0 })
              e.pendingMissiles!--
              e.missileFireTimer = 4
            }
          }
          e.attack2Timer = (e.attack2Timer ?? 600) - dt
          if ((e.attack2Timer ?? 0) <= 0 && (e.pendingMissiles ?? 0) === 0) {
            e.pendingMissiles = 14
            e.missileFireTimer = 0
            e.attack2Timer = 320
          }
        }
      }
    }

    // ── Hit by player bullets ──
    let killed = false
    for (let j = bullets.length - 1; j >= 0; j--) {
      const bulletHitR = e.kind === 'boss_stardestroyer' ? 50 : 15
      if (dist2(bullets[j].gfx.x, bullets[j].gfx.y, e.container.x, e.container.y) < bulletHitR * bulletHitR) {
        const dmg = bulletDmg
        e.hp = Math.max(0, e.hp - dmg)
        spawnDamageText(e.container.x, e.container.y - (e.kind === 'boss_stardestroyer' ? 60 : 14), dmg)
        hitFlash(e.body)
        redrawHpBar(e.hpBarBg, e.hpBar, e.hp / e.maxHp, e.barW)
        gameLayer.removeChild(bullets[j].gfx)
        bullets.splice(j, 1)
        if (e.hp <= 0) {
          if (e.kind === 'boss_stardestroyer') {
            spawnExplosion(e.container.x, e.container.y, 50, 0x4466ff, 0xaaccff)
            spawnExplosion(e.container.x - 30, e.container.y + 20, 28, 0xff4400, 0xffee44)
            spawnExplosion(e.container.x + 30, e.container.y - 10, 24, 0xff8800, 0xffee44)
            screenFlash(0x4466ff, 0.65, 800)
            spawnEnemyOrbs(e.container.x, e.container.y, 'boss_stardestroyer')
            if (e.laserLine) e.laserLine.clear()
            game.addScore(300 + game.currentStage * 50)
            game.unlockAchievement('kill_boss')
            game.stageEnemiesKilled++
          } else {
            const explR = e.kind === 'kamikaze' ? 18 : 14
            spawnExplosion(e.container.x, e.container.y, explR)
            spawnEnemyOrbs(e.container.x, e.container.y, e.kind)
            const pts = e.kind === 'sniper' ? 20 + game.currentStage * 7
              : e.kind === 'kamikaze' ? 15 + game.currentStage * 6
                : 10 + game.currentStage * 5
            game.addScore(pts)
            game.stageEnemiesKilled++
          }
          gameLayer.removeChild(e.container)
          enemies.splice(i, 1)
          killed = true
          break
        }
      }
    }
    if (killed) continue

    // ── Collide player (pioneer only; others handled in their own block) ──
    if (e.kind === 'pioneer' && playerShip &&
      dist2(e.container.x, e.container.y, playerShip.x, playerShip.y) < 20 * 20) {
      spawnExplosion(e.container.x, e.container.y, 14)
      spawnEnemyOrbs(e.container.x, e.container.y, 'pioneer')
      game.takeDamage(25)
      screenFlash()
      spawnDamageText(playerShip.x, playerShip.y - 20, 25)
      game.stageEnemiesKilled++
      gameLayer.removeChild(e.container)
      enemies.splice(i, 1)
    }
  }

  // Exp orbs — move & collect
  const collectR2 = game.upgrades.collectRange * game.upgrades.collectRange
  for (let i = expOrbs.length - 1; i >= 0; i--) {
    const o = expOrbs[i]
    o.y += o.vy * dt
    o.gfx.y = o.y
    if (o.y > GAME_H + 20) {
      gameLayer.removeChild(o.gfx)
      expOrbs.splice(i, 1)
      continue
    }
    if (playerShip && dist2(o.gfx.x, o.y, playerShip.x, playerShip.y) < collectR2) {
      game.gainSessionExp(o.amount)
      gameLayer.removeChild(o.gfx)
      expOrbs.splice(i, 1)
    }
  }

  // Damage texts
  for (let i = damageTexts.length - 1; i >= 0; i--) {
    const d = damageTexts[i]
    d.gfx.y -= d.vy * dt
    d.life--
    d.gfx.alpha = d.life / 40
    if (d.life <= 0) {
      uiLayer.removeChild(d.gfx)
      damageTexts.splice(i, 1)
    }
  }

  // (Stage progression now handled by wave-based clear logic above)
}

// ─── Setup ───────────────────────────────────────────────────────────────────
async function initPixi() {
  app = new Application()
  await app.init({
    width: GAME_W,
    height: GAME_H,
    backgroundColor: 0x050a18,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  })

  if (canvasWrapper.value) {
    canvasWrapper.value.appendChild(app.canvas as HTMLCanvasElement)
  }

  // Layers
  bgLayer   = new Container(); app.stage.addChild(bgLayer)
  gameLayer = new Container(); app.stage.addChild(gameLayer)
  uiLayer   = new Container(); app.stage.addChild(uiLayer)

  // Stars
  for (let i = 0; i < 80; i++) {
    const s = createStar()
    bgLayer.addChild(s.gfx)
    stars.push(s)
  }

  // Player ship — start off screen bottom for intro
  playerShip = new Graphics()
  drawShip(playerShip)
  playerShip.x = GAME_W / 2
  playerShip.y = GAME_H + 60
  gameLayer.addChild(playerShip)

  // Reset intro phase
  gamePhase = 'intro'
  introTimer = 0

  // Input: touch/mouse drag
  app.canvas.addEventListener('touchstart', onTouchStart, { passive: false })
  app.canvas.addEventListener('touchmove', onTouchMove, { passive: false })
  app.canvas.addEventListener('touchend', onTouchEnd)
  app.canvas.addEventListener('mousedown', onMouseDown)
  app.canvas.addEventListener('mousemove', onMouseMove)
  app.canvas.addEventListener('mouseup', onMouseUp)

  app.ticker.add(gameLoop)
}

function onTouchStart(e: TouchEvent) {
  e.preventDefault()
  isDragging = true
  const rect = (app!.canvas as HTMLCanvasElement).getBoundingClientRect()
  const scaleX = GAME_W / rect.width
  const scaleY = GAME_H / rect.height
  touchX = (e.touches[0].clientX - rect.left) * scaleX
  touchY = (e.touches[0].clientY - rect.top) * scaleY
}
function onTouchMove(e: TouchEvent) {
  e.preventDefault()
  if (!isDragging) return
  const rect = (app!.canvas as HTMLCanvasElement).getBoundingClientRect()
  const scaleX = GAME_W / rect.width
  const scaleY = GAME_H / rect.height
  touchX = (e.touches[0].clientX - rect.left) * scaleX
  touchY = (e.touches[0].clientY - rect.top) * scaleY
}
function onTouchEnd() { isDragging = false }
function onMouseDown(e: MouseEvent) {
  isDragging = true
  const rect = (app!.canvas as HTMLCanvasElement).getBoundingClientRect()
  const scaleX = GAME_W / rect.width
  const scaleY = GAME_H / rect.height
  touchX = (e.clientX - rect.left) * scaleX
  touchY = (e.clientY - rect.top) * scaleY
}
function onMouseMove(e: MouseEvent) {
  if (!isDragging) return
  const rect = (app!.canvas as HTMLCanvasElement).getBoundingClientRect()
  const scaleX = GAME_W / rect.width
  const scaleY = GAME_H / rect.height
  touchX = (e.clientX - rect.left) * scaleX
  touchY = (e.clientY - rect.top) * scaleY
}
function onMouseUp() { isDragging = false }

function destroyPixi() {
  if (app) {
    app.ticker.remove(gameLoop)
    app.canvas.removeEventListener('touchstart', onTouchStart)
    app.canvas.removeEventListener('touchmove', onTouchMove)
    app.canvas.removeEventListener('touchend', onTouchEnd)
    app.canvas.removeEventListener('mousedown', onMouseDown)
    app.canvas.removeEventListener('mousemove', onMouseMove)
    app.canvas.removeEventListener('mouseup', onMouseUp)
    app.destroy(true, { children: true })
    app = null
  }
  bullets = []
  enemies = []
  enemyBullets = []
  stars = []
  damageTexts = []
  expOrbs = []
}

onMounted(async () => {
  await initPixi()
  game.startGame()
})

onUnmounted(() => {
  destroyPixi()
})

// Chuỗi hiệu ứng chết — nổ 3 lần → 2s → finalizeGameOver()
watch(() => game.isGameOverSequence, (val) => {
  if (!val || !app || !playerShip) return
  const px = playerShip.x
  const py = playerShip.y
  playerShip.visible = false

  // Nổ lần 1
  spawnExplosion(px, py, 26, 0xff4400, 0xffaa00)
  screenFlash(0xff2222, 0.65, 350)

  // Nổ lần 2
  setTimeout(() => {
    if (!app) return
    spawnExplosion(px + 12, py - 6, 20, 0xff6600, 0xffdd00)
    screenFlash(0xff4400, 0.45, 250)
  }, 450)

  // Nổ lần 3 — lớn nhất
  setTimeout(() => {
    if (!app) return
    spawnExplosion(px - 8, py + 8, 30, 0xff2200, 0xff8800)
    spawnExplosion(px + 4, py - 12, 18, 0xffcc00, 0xffee66)
    screenFlash(0xff1100, 0.55, 400)
  }, 900)

  // Kết thúc sau 2s
  setTimeout(() => {
    game.finalizeGameOver()
  }, 2000)
})

// Restart khi isPlaying bật lại
watch(() => game.isPlaying, (val, old) => {
  if (val && !old && app) {
    // Clear entities khi chơi lại
    for (const b of bullets) gameLayer?.removeChild(b.gfx)
    for (const e of enemies) gameLayer?.removeChild(e.container)
    for (const b of enemyBullets) gameLayer?.removeChild(b.gfx)
    for (const d of damageTexts) uiLayer?.removeChild(d.gfx)
    for (const o of expOrbs) gameLayer?.removeChild(o.gfx)
    if (stageTitleText) { uiLayer?.removeChild(stageTitleText); stageTitleText = null }
    bullets = []; enemies = []; enemyBullets = []; damageTexts = []; expOrbs = []
    shootTimer = 0
    waveQueue = []; waveDispatchTimer = 0; waveIsClearing = false; stageClearTimer = 0; stageAnnouncePending = false
    // Restart intro animation
    gamePhase = 'intro'
    introTimer = 0
    if (playerShip) { playerShip.x = GAME_W / 2; playerShip.y = GAME_H + 60; playerShip.visible = true }
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
