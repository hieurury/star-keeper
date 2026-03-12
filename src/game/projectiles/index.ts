import { Graphics } from 'pixi.js'

/** Bullet drawn by enemy Sniper and regular enemies. */
export function drawEnemyBullet(g: Graphics): void {
  g.clear()
  g.circle(0, 0, 5).fill(0xff3300)
  g.circle(0, 0, 3).fill({ color: 0xff9966, alpha: 0.9 })
}

/** Large blue bullet fired by Boss Star Destroyer. */
export function drawBossBullet(g: Graphics): void {
  g.clear()
  g.circle(0, 0, 6.5).fill(0x4466bb)
  g.circle(0, 0, 4).fill({ color: 0x88aaff, alpha: 0.9 })
  g.circle(0, 0, 1.5).fill(0xffffff)
}

/** Boss missile (phase 1 large / phase 2 small). */
export function drawBossMissile(g: Graphics, small = false): void {
  g.clear()
  const s = small ? 0.55 : 1.0
  g.rect(-2.5*s, -8*s, 5*s, 14*s).fill(0x4488ff)
  g.poly([0, -12*s, 3*s, -8*s, -3*s, -8*s]).fill(0xaaccff)
  g.poly([-2.5*s, 4*s, -5.5*s, 8*s, -2.5*s, 2*s]).fill(0x2255aa)
  g.poly([2.5*s, 4*s, 5.5*s, 8*s, 2.5*s, 2*s]).fill(0x2255aa)
  g.circle(0, 7*s, 2*s).fill({ color: 0xff8800, alpha: 0.9 })
}

/** Fragment (soul) orb — teal diamond shape, clearly distinct from enemy bullets. */
export function drawFragmentOrb(g: Graphics): void {
  g.clear()
  // Outer diamond glow
  g.poly([0, -5.5, 3.8, 0, 0, 5.5, -3.8, 0]).fill({ color: 0x00e5ff, alpha: 0.9 })
  // Inner bright core
  g.poly([0, -3.0, 2.1, 0, 0, 3.0, -2.1, 0]).fill({ color: 0xaaffff, alpha: 0.9 })
  // White sparkle center
  g.circle(0, 0, 1.0).fill(0xffffff)
}

/** Fragment missile — homing soul shard fired by Star Holder skill. */
export function drawFragmentMissile(g: Graphics): void {
  g.clear()
  g.poly([0, -9, 3, -3, 0, 2, -3, -3]).fill(0xff9900)
  g.poly([0, -9, 2, -5, -2, -5]).fill(0xffee44)
  g.circle(0, 2, 2).fill({ color: 0xff4400, alpha: 0.85 })
}

/** Purple missile fired by Boss Trùm Sổ. */
export function drawTrumSoMissile(g: Graphics): void {
  g.clear()
  g.rect(-2.5, -8, 5, 14).fill(0x6600cc)
  g.poly([0, -12, 3, -8, -3, -8]).fill(0xcc66ff)
  g.poly([-2.5, 4, -5.5, 8, -2.5, 2]).fill(0x330066)
  g.poly([2.5, 4, 5.5, 8, 2.5, 2]).fill(0x330066)
  g.circle(0, 7, 2).fill({ color: 0xff44ff, alpha: 0.9 })
}
