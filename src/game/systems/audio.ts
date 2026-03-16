export type AudioScene = 'none' | 'lobby' | 'game'

export interface AudioSettings {
  enabled: boolean
  musicEnabled: boolean
  sfxEnabled: boolean
  masterVolume: number
  musicVolume: number
  sfxVolume: number
}

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  enabled: true,
  musicEnabled: true,
  sfxEnabled: true,
  masterVolume: 0.75,
  musicVolume: 0.55,
  sfxVolume: 0.8,
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

type ShipAudioId = 'star_keeper' | 'star_holder' | 'star_shooter' | 'star_faster'

class AudioManager {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private musicGain: GainNode | null = null
  private sfxGain: GainNode | null = null

  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS }

  private scene: AudioScene = 'none'
  private bossActive = false

  private lobbyTimer: number | null = null
  private gameTimer: number | null = null
  private bossTimer: number | null = null

  private lastKillSfxMs = 0
  private lastHitSfxMs = 0
  private lastShipShotSfxMs = 0

  private isSupported(): boolean {
    return typeof window !== 'undefined' && !!(window.AudioContext || (window as any).webkitAudioContext)
  }

  private ensureContext(): boolean {
    if (!this.isSupported()) return false
    if (this.ctx) return true

    const ACtor = window.AudioContext || (window as any).webkitAudioContext
    this.ctx = new ACtor()

    this.masterGain = this.ctx.createGain()
    this.musicGain = this.ctx.createGain()
    this.sfxGain = this.ctx.createGain()

    this.musicGain.connect(this.masterGain)
    this.sfxGain.connect(this.masterGain)
    this.masterGain.connect(this.ctx.destination)

    this.applyGains()
    return true
  }

  private applyGains() {
    if (!this.masterGain || !this.musicGain || !this.sfxGain || !this.ctx) return
    const now = this.ctx.currentTime
    const master = this.settings.enabled ? this.settings.masterVolume : 0
    const music = this.settings.enabled && this.settings.musicEnabled ? this.settings.musicVolume : 0
    const sfx = this.settings.enabled && this.settings.sfxEnabled ? this.settings.sfxVolume : 0

    this.masterGain.gain.setTargetAtTime(clamp01(master), now, 0.02)
    this.musicGain.gain.setTargetAtTime(clamp01(music), now, 0.02)
    this.sfxGain.gain.setTargetAtTime(clamp01(sfx), now, 0.02)
  }

  private clearTimer(id: number | null) {
    if (id != null) window.clearInterval(id)
  }

  private stopAllLoops() {
    this.clearTimer(this.lobbyTimer)
    this.clearTimer(this.gameTimer)
    this.clearTimer(this.bossTimer)
    this.lobbyTimer = null
    this.gameTimer = null
    this.bossTimer = null
  }

  private note(freq: number, duration = 0.12, type: OscillatorType = 'triangle', gainMul = 1, target: 'music' | 'sfx' = 'music') {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return
    if (freq <= 0) return

    const node = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    const out = target === 'music' ? this.musicGain : this.sfxGain

    node.type = type
    node.frequency.value = freq
    node.connect(gain)
    gain.connect(out)

    const now = this.ctx.currentTime
    const peak = 0.25 * gainMul
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    node.start(now)
    node.stop(now + duration + 0.015)
  }

  private startLobbyLoop() {
    if (this.lobbyTimer != null) return
    const seq = [220, 277.18, 329.63, 392, 329.63, 277.18, 246.94, 329.63]
    let step = 0
    this.lobbyTimer = window.setInterval(() => {
      if (!this.settings.enabled || !this.settings.musicEnabled) return
      this.note(seq[step % seq.length]!, 0.32, 'sine', 0.38, 'music')
      if (step % 2 === 0) this.note((seq[(step + 3) % seq.length] ?? 220) * 0.5, 0.22, 'triangle', 0.2, 'music')
      step++
    }, 420)
  }

  private startGameLoop() {
    if (this.gameTimer != null) return
    const bass = [110, 110, 123.47, 98, 110, 130.81, 146.83, 123.47]
    const lead = [440, 523.25, 659.25, 587.33, 698.46, 659.25, 523.25, 493.88]
    let step = 0
    this.gameTimer = window.setInterval(() => {
      if (!this.settings.enabled || !this.settings.musicEnabled) return
      const i = step % bass.length
      this.note(bass[i]!, 0.22, 'square', 0.22, 'music')
      this.note(lead[i]!, 0.14, 'sawtooth', 0.13, 'music')
      if (step % 4 === 0) this.note(lead[(i + 2) % lead.length]!, 0.1, 'triangle', 0.09, 'music')
      step++
    }, 240)
  }

  private startBossOverlay() {
    if (this.bossTimer != null) return
    let step = 0
    this.bossTimer = window.setInterval(() => {
      if (!this.settings.enabled || !this.settings.musicEnabled || !this.bossActive) return
      const freq = step % 2 === 0 ? 73.42 : 82.41
      this.note(freq, 0.26, 'sawtooth', 0.16, 'music')
      this.note(freq * 2, 0.12, 'triangle', 0.07, 'music')
      step++
    }, 360)
  }

  ensureStarted() {
    if (!this.ensureContext() || !this.ctx) return
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
  }

  setSettings(next: Partial<AudioSettings>) {
    this.settings = {
      ...this.settings,
      ...next,
      masterVolume: clamp01(next.masterVolume ?? this.settings.masterVolume),
      musicVolume: clamp01(next.musicVolume ?? this.settings.musicVolume),
      sfxVolume: clamp01(next.sfxVolume ?? this.settings.sfxVolume),
    }
    this.ensureContext()
    this.applyGains()
  }

  setScene(scene: AudioScene) {
    this.scene = scene
    this.ensureStarted()
    this.stopAllLoops()
    if (scene === 'lobby') this.startLobbyLoop()
    if (scene === 'game') this.startGameLoop()
    if (scene === 'game' && this.bossActive) this.startBossOverlay()
  }

  setBossActive(active: boolean) {
    if (this.bossActive === active) return
    this.bossActive = active
    if (this.scene !== 'game') return
    if (active) {
      this.playBossAlert()
      this.startBossOverlay()
    } else {
      this.clearTimer(this.bossTimer)
      this.bossTimer = null
    }
  }

  playUiClick() {
    if (!this.settings.enabled || !this.settings.sfxEnabled) return
    this.ensureStarted()
    this.note(900, 0.05, 'square', 0.18, 'sfx')
    this.note(1200, 0.04, 'triangle', 0.1, 'sfx')
  }

  playSkill() {
    if (!this.settings.enabled || !this.settings.sfxEnabled) return
    this.ensureStarted()
    this.note(420, 0.12, 'sawtooth', 0.2, 'sfx')
    this.note(620, 0.16, 'triangle', 0.18, 'sfx')
    this.note(880, 0.2, 'sine', 0.14, 'sfx')
  }

  playLevelUp() {
    if (!this.settings.enabled || !this.settings.sfxEnabled) return
    this.ensureStarted()
    this.note(523.25, 0.08, 'triangle', 0.16, 'sfx')
    setTimeout(() => this.note(659.25, 0.09, 'triangle', 0.16, 'sfx'), 60)
    setTimeout(() => this.note(783.99, 0.11, 'triangle', 0.16, 'sfx'), 130)
  }

  playPlayerHit() {
    if (!this.settings.enabled || !this.settings.sfxEnabled) return
    const now = Date.now()
    if (now - this.lastHitSfxMs < 90) return
    this.lastHitSfxMs = now
    this.ensureStarted()
    this.note(160, 0.09, 'sawtooth', 0.22, 'sfx')
    this.note(120, 0.11, 'square', 0.16, 'sfx')
  }

  playEnemyKill() {
    if (!this.settings.enabled || !this.settings.sfxEnabled) return
    const now = Date.now()
    if (now - this.lastKillSfxMs < 40) return
    this.lastKillSfxMs = now
    this.ensureStarted()
    this.note(260, 0.04, 'square', 0.12, 'sfx')
    this.note(180, 0.06, 'triangle', 0.09, 'sfx')
  }

  playBossAlert() {
    if (!this.settings.enabled || !this.settings.sfxEnabled) return
    this.ensureStarted()
    this.note(140, 0.22, 'sawtooth', 0.22, 'sfx')
    setTimeout(() => this.note(110, 0.25, 'sawtooth', 0.2, 'sfx'), 140)
  }

  playShipShoot(shipId: ShipAudioId) {
    if (!this.settings.enabled || !this.settings.sfxEnabled) return

    const now = Date.now()
    const minGap = shipId === 'star_faster' ? 38 : shipId === 'star_shooter' ? 90 : shipId === 'star_holder' ? 70 : 52
    if (now - this.lastShipShotSfxMs < minGap) return
    this.lastShipShotSfxMs = now

    this.ensureStarted()
    if (shipId === 'star_keeper') {
      this.note(630, 0.04, 'square', 0.14, 'sfx')
      this.note(420, 0.06, 'triangle', 0.11, 'sfx')
      return
    }
    if (shipId === 'star_holder') {
      this.note(170, 0.07, 'sawtooth', 0.2, 'sfx')
      this.note(120, 0.09, 'square', 0.16, 'sfx')
      return
    }
    if (shipId === 'star_shooter') {
      this.note(300, 0.06, 'triangle', 0.17, 'sfx')
      this.note(220, 0.08, 'sawtooth', 0.15, 'sfx')
      this.note(140, 0.11, 'square', 0.1, 'sfx')
      return
    }
    this.note(820, 0.03, 'square', 0.12, 'sfx')
    this.note(620, 0.04, 'triangle', 0.09, 'sfx')
  }
}

export const audioManager = new AudioManager()
export { DEFAULT_AUDIO_SETTINGS }
