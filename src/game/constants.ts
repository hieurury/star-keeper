import type { OrbTier } from './types'

export const GAME_W = 390
export const GAME_H = 844
export const TOUCH_Y_OFFSET = 90
export const INTRO_FRAMES = 90
export const STAGE_TITLE_FRAMES = 130

export const ORB_CONFIG: Record<OrbTier, { outer: number; inner: number; exp: number; r: number }> = {
  white:  { outer: 0xffffff, inner: 0xdddddd, exp: 10, r: 4.5 },
  blue:   { outer: 0x44aaff, inner: 0xaaddff, exp: 20, r: 5.0 },
  purple: { outer: 0xcc44ff, inner: 0xee99ff, exp: 30, r: 5.5 },
  gold:   { outer: 0xffd700, inner: 0xffee88, exp: 50, r: 6.0 },
}
