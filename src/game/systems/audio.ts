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
  private lobbyTrack: HTMLAudioElement | null = null
  private bossTrack: HTMLAudioElement | null = null
  private unlockRetryArmed = false
  private transitionSeq = 0
  private currentTrack: 'none' | 'lobby' | 'boss' = 'none'
  private bossOutroPending = false
  private lobbyGainFactor = 0
  private bossGainFactor = 0
  private lobbyLastIndex = -1
  private bossLastIndex = -1
  private lobbyHandlersBound = false
  private bossHandlersBound = false

  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS }

  private scene: AudioScene = 'none'
  private bossActive = false

  private readonly LOBBY_PLAYLIST = ['/audio/backgrounds/bg_1.mp3', '/audio/backgrounds/bg_2.mp3']
  private readonly BOSS_PLAYLIST = [
    '/audio/bosses/boss_1.mp3',
    '/audio/bosses/boss_2.mp3',
    '/audio/bosses/boss_3.mp3',
    '/audio/bosses/boss_4.mp3',
  ]

  private readonly FADE_OUT_MS = 520
  private readonly FADE_IN_MS = 620

  private canPlayMusic(): boolean {
    return this.settings.enabled && this.settings.musicEnabled
  }

  private armUnlockRetry() {
    if (typeof window === 'undefined' || this.unlockRetryArmed) return
    this.unlockRetryArmed = true

    const retry = () => {
      window.removeEventListener('pointerdown', retry)
      window.removeEventListener('keydown', retry)
      window.removeEventListener('touchstart', retry)
      this.unlockRetryArmed = false
      this.syncSceneMusic()
    }

    window.addEventListener('pointerdown', retry, { once: true })
    window.addEventListener('keydown', retry, { once: true })
    window.addEventListener('touchstart', retry, { once: true, passive: true })
  }

  private applyGains() {
    const master = this.settings.enabled ? this.settings.masterVolume : 0
    const music = this.canPlayMusic() ? this.settings.musicVolume : 0
    const base = clamp01(master * music)

    if (this.lobbyTrack) {
      this.lobbyTrack.volume = clamp01(base * this.lobbyGainFactor)
      this.lobbyTrack.muted = !this.canPlayMusic()
    }

    if (this.bossTrack) {
      this.bossTrack.volume = clamp01(base * this.bossGainFactor)
      this.bossTrack.muted = !this.canPlayMusic()
    }
  }

  private setTrackFactor(trackId: 'none' | 'lobby' | 'boss', value: number) {
    if (trackId === 'lobby') this.lobbyGainFactor = clamp01(value)
    if (trackId === 'boss') this.bossGainFactor = clamp01(value)
    this.applyGains()
  }

  private getTrackFactor(trackId: 'none' | 'lobby' | 'boss'): number {
    if (trackId === 'lobby') return this.lobbyGainFactor
    if (trackId === 'boss') return this.bossGainFactor
    return 0
  }

  private pickRandomIndex(length: number, lastIndex: number): number {
    if (length <= 1) return 0
    let next = Math.floor(Math.random() * length)
    if (next === lastIndex) {
      next = (next + 1 + Math.floor(Math.random() * (length - 1))) % length
    }
    return next
  }

  private chooseNextSrc(phase: 'lobby' | 'boss'): string {
    if (phase === 'lobby') {
      const idx = this.pickRandomIndex(this.LOBBY_PLAYLIST.length, this.lobbyLastIndex)
      this.lobbyLastIndex = idx
      return this.LOBBY_PLAYLIST[idx]!
    }
    const idx = this.pickRandomIndex(this.BOSS_PLAYLIST.length, this.bossLastIndex)
    this.bossLastIndex = idx
    return this.BOSS_PLAYLIST[idx]!
  }

  private handlePhaseEnded(phase: 'lobby' | 'boss') {
    if (!this.canPlayMusic()) return
    const desired = this.resolveDesiredTrack()
    if (phase === 'lobby' && !(desired === 'lobby' && this.currentTrack === 'lobby')) return
    if (phase === 'boss' && !(desired === 'boss' && this.currentTrack === 'boss')) return
    if (phase === 'lobby') this.startLobbyTrack(true)
    else this.startBossTrack(true)
  }

  private bindTrackEvents(track: HTMLAudioElement, phase: 'lobby' | 'boss') {
    if (phase === 'lobby') {
      if (this.lobbyHandlersBound) return
      track.addEventListener('ended', () => this.handlePhaseEnded('lobby'))
      this.lobbyHandlersBound = true
      return
    }
    if (this.bossHandlersBound) return
    track.addEventListener('ended', () => this.handlePhaseEnded('boss'))
    this.bossHandlersBound = true
  }

  private getLobbyTrack(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null
    if (this.lobbyTrack) return this.lobbyTrack

    const track = new Audio()
    track.preload = 'auto'
    track.loop = false
    this.bindTrackEvents(track, 'lobby')
    this.lobbyTrack = track
    this.applyGains()
    return this.lobbyTrack
  }

  private startLobbyTrack(forceNext = false): boolean {
    const track = this.getLobbyTrack()
    if (!track) return false

    if (forceNext || !track.src) {
      track.src = this.chooseNextSrc('lobby')
      track.currentTime = 0
    }

    const playPromise = track.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        if (this.scene !== 'lobby') return
        this.armUnlockRetry()
      })
    }
    return true
  }

  private pauseLobbyTrack(reset = false) {
    if (!this.lobbyTrack) return
    this.lobbyTrack.pause()
    if (reset) this.lobbyTrack.currentTime = 0
  }

  private getBossTrack(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null
    if (this.bossTrack) return this.bossTrack

    const track = new Audio()
    track.preload = 'auto'
    track.loop = false
    this.bindTrackEvents(track, 'boss')
    this.bossTrack = track
    this.applyGains()
    return this.bossTrack
  }

  private startBossTrack(forceNext = false): boolean {
    const track = this.getBossTrack()
    if (!track) return false

    if (forceNext || !track.src) {
      track.src = this.chooseNextSrc('boss')
      track.currentTime = 0
    }

    const playPromise = track.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        if (this.scene !== 'game' || !this.bossActive) return
        this.armUnlockRetry()
      })
    }
    return true
  }

  private pauseBossTrack(reset = false) {
    if (!this.bossTrack) return
    this.bossTrack.pause()
    if (reset) this.bossTrack.currentTime = 0
  }

  private startTrack(trackId: 'none' | 'lobby' | 'boss'): boolean {
    if (trackId === 'lobby') return this.startLobbyTrack()
    if (trackId === 'boss') return this.startBossTrack()
    return true
  }

  private stopTrack(trackId: 'none' | 'lobby' | 'boss', reset = true) {
    if (trackId === 'lobby') this.pauseLobbyTrack(reset)
    if (trackId === 'boss') this.pauseBossTrack(reset)
  }

  private async fadeTrack(trackId: 'none' | 'lobby' | 'boss', to: number, durationMs: number, seq: number) {
    if (trackId === 'none') return
    const from = this.getTrackFactor(trackId)
    if (durationMs <= 0 || Math.abs(to - from) < 0.001) {
      this.setTrackFactor(trackId, to)
      return
    }

    const start = (typeof performance !== 'undefined' ? performance.now() : Date.now())

    await new Promise<void>((resolve) => {
      const tick = (nowRaw: number) => {
        if (seq !== this.transitionSeq) {
          resolve()
          return
        }

        const now = typeof performance !== 'undefined' ? nowRaw : Date.now()
        const t = clamp01((now - start) / durationMs)
        const val = from + (to - from) * t
        this.setTrackFactor(trackId, val)

        if (t >= 1) {
          resolve()
          return
        }
        requestAnimationFrame(tick)
      }

      requestAnimationFrame(tick)
    })
  }

  private resolveDesiredTrack(): 'none' | 'lobby' | 'boss' {
    if (!this.canPlayMusic()) return 'none'
    if (this.scene === 'lobby') return 'lobby'
    if (this.scene === 'game') {
      if (this.bossActive || this.bossOutroPending) return 'boss'
      return 'none'
    }
    return 'none'
  }

  private async transitionTo(desired: 'none' | 'lobby' | 'boss') {
    const seq = ++this.transitionSeq
    const from = this.currentTrack

    if (from === desired) {
      this.startTrack(desired)
      if (desired !== 'none') this.setTrackFactor(desired, 1)
      if (desired !== 'lobby') this.setTrackFactor('lobby', 0)
      if (desired !== 'boss') this.setTrackFactor('boss', 0)
      return
    }

    if (from !== 'none') {
      await this.fadeTrack(from, 0, this.FADE_OUT_MS, seq)
      if (seq !== this.transitionSeq) return
      this.stopTrack(from, true)
    }

    if (desired === 'none') {
      this.currentTrack = 'none'
      this.setTrackFactor('lobby', 0)
      this.setTrackFactor('boss', 0)
      return
    }

    this.currentTrack = desired
    this.setTrackFactor(desired, 0)
    this.startTrack(desired)
    await this.fadeTrack(desired, 1, this.FADE_IN_MS, seq)
  }

  private syncSceneMusic() {
    const desired = this.resolveDesiredTrack()
    void this.transitionTo(desired)
  }

  ensureStarted() {
    this.applyGains()
    this.syncSceneMusic()
  }

  setSettings(next: Partial<AudioSettings>) {
    this.settings = {
      ...this.settings,
      ...next,
      masterVolume: clamp01(next.masterVolume ?? this.settings.masterVolume),
      musicVolume: clamp01(next.musicVolume ?? this.settings.musicVolume),
      sfxVolume: clamp01(next.sfxVolume ?? this.settings.sfxVolume),
    }
    this.applyGains()
    this.syncSceneMusic()
  }

  setScene(scene: AudioScene) {
    this.scene = scene
    if (scene !== 'game') this.bossOutroPending = false
    this.syncSceneMusic()
  }

  setBossActive(active: boolean) {
    if (this.bossActive === active) return
    this.bossActive = active
    if (active) {
      this.bossOutroPending = false
    } else if (this.scene === 'game') {
      // Keep boss track alive through the clear moment and stop it on stage start.
      this.bossOutroPending = true
    }
    this.syncSceneMusic()
  }

  notifyStageStart() {
    if (this.scene !== 'game') return
    if (!this.bossOutroPending) return
    this.bossOutroPending = false
    this.syncSceneMusic()
  }

  playUiClick() {}

  playSkill() {}

  playLevelUp() {}

  playPlayerHit() {}

  playEnemyKill() {}

  playBossAlert() {}

  playShipShoot(_shipId: ShipAudioId) {}
}

export const audioManager = new AudioManager()
export { DEFAULT_AUDIO_SETTINGS }
