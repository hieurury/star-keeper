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

type ShipAudioId = 'star_keeper' | 'star_holder' | 'star_shooter' | 'star_faster' | 'thien_ha_truy'
type ManagedSfxAudio = HTMLAudioElement & { __baseGain?: number }

interface ShipSfxConfig {
  src: string
  gain: number
  cooldownMs: number
  playbackRateJitter?: number
}

class AudioManager {
  private lobbyTrack: HTMLAudioElement | null = null
  private gameTrack: HTMLAudioElement | null = null
  private bossTrack: HTMLAudioElement | null = null
  private unlockRetryArmed = false
  private transitionSeq = 0
  private currentTrack: 'none' | 'lobby' | 'game' | 'boss' = 'none'
  private bossActive = false
  private lobbyGainFactor = 0
  private gameGainFactor = 0
  private bossGainFactor = 0
  private lobbyLastIndex = -1
  private lobbyOutroArmed = false
  private lobbyGapSeq = 0
  private lobbyHandlersBound = false
  private gameHandlersBound = false
  private bossHandlersBound = false
  private readonly activeSfx = new Set<ManagedSfxAudio>()
  private readonly sfxLastPlayedAt = new Map<string, number>()

  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS }

  private scene: AudioScene = 'none'

  private readonly LOBBY_PLAYLIST = ['/audio/backgrounds/bg_1.mp3', '/audio/backgrounds/bg_2.mp3']
  private readonly GAME_STAGE_TRACK = '/audio/gameStage/sound_1.mp3'
  private readonly BOSS_STAGE_TRACK = '/audio/bosses/boss_battle_mix.mp3'

  private readonly FADE_OUT_MS = 520
  private readonly FADE_IN_MS = 620
  private readonly CROSSFADE_MS = 760
  private readonly LOBBY_OUTRO_MS = 680
  private readonly LOBBY_GAP_MS = 340
  private readonly LOBBY_INTRO_MS = 620
  private readonly MAX_SFX_VOICES = 14

  private readonly SHIP_SHOT_SFX: Partial<Record<ShipAudioId, ShipSfxConfig>> = {
    star_keeper: {
      src: '/audio/soundEffects/starKeeper/shot-cue.flac',
      gain: 0.48,
      cooldownMs: 48,
      playbackRateJitter: 0.03,
    },
    star_faster: {
      src: '/audio/soundEffects/starKeeper/shot-cue.flac',
      gain: 0.38,
      cooldownMs: 36,
      playbackRateJitter: 0.05,
    },
    star_shooter: {
      src: '/audio/soundEffects/starShooter/shot-cue.flac',
      gain: 0.5,
      cooldownMs: 72,
      playbackRateJitter: 0.04,
    },
    thien_ha_truy: {
      src: '/audio/soundEffects/ThienHaTruy/shot-cue.flac',
      gain: 0.34,
      cooldownMs: 72,
      playbackRateJitter: 0.04,
    },
  }

  private readonly SHIP_HIT_SFX: Partial<Record<ShipAudioId, ShipSfxConfig>> = {
    star_keeper: {
      src: '/audio/soundEffects/starKeeper/hit-cue.flac',
      gain: 0.68,
      cooldownMs: 22,
      playbackRateJitter: 0.03,
    },
    star_faster: {
      src: '/audio/soundEffects/starKeeper/hit-cue.flac',
      gain: 0.58,
      cooldownMs: 20,
      playbackRateJitter: 0.04,
    },
    thien_ha_truy: {
      src: '/audio/soundEffects/ThienHaTruy/hit-cue.flac',
      gain: 0.74,
      cooldownMs: 26,
      playbackRateJitter: 0.05,
    },
  }

  private canPlayMusic(): boolean {
    return this.settings.enabled && this.settings.musicEnabled
  }

  private canPlaySfx(): boolean {
    return this.settings.enabled && this.settings.sfxEnabled
  }

  private getSfxBaseGain(): number {
    if (!this.canPlaySfx()) return 0
    return clamp01(this.settings.masterVolume * this.settings.sfxVolume)
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
    const sfxBase = this.getSfxBaseGain()

    if (this.lobbyTrack) {
      this.lobbyTrack.volume = clamp01(base * this.lobbyGainFactor)
      this.lobbyTrack.muted = !this.canPlayMusic()
    }

    if (this.gameTrack) {
      this.gameTrack.volume = clamp01(base * this.gameGainFactor)
      this.gameTrack.muted = !this.canPlayMusic()
    }

    if (this.bossTrack) {
      this.bossTrack.volume = clamp01(base * this.bossGainFactor)
      this.bossTrack.muted = !this.canPlayMusic()
    }

    for (const sfx of this.activeSfx) {
      sfx.volume = clamp01((sfx.__baseGain ?? 1) * sfxBase)
      sfx.muted = !this.canPlaySfx()
    }
  }

  private shouldThrottleSfx(key: string, cooldownMs: number): boolean {
    const now = Date.now()
    const last = this.sfxLastPlayedAt.get(key) ?? 0
    if (cooldownMs > 0 && now - last < cooldownMs) return true
    this.sfxLastPlayedAt.set(key, now)
    return false
  }

  private trimSfxVoices() {
    while (this.activeSfx.size >= this.MAX_SFX_VOICES) {
      const oldest = this.activeSfx.values().next().value
      if (!oldest) break
      oldest.pause()
      this.activeSfx.delete(oldest)
    }
  }

  private playSfx(config: ShipSfxConfig) {
    if (typeof Audio === 'undefined' || !this.canPlaySfx()) return
    const sfxBase = this.getSfxBaseGain()
    if (sfxBase <= 0) return

    this.trimSfxVoices()

    const audio = new Audio(config.src) as ManagedSfxAudio
    audio.preload = 'auto'
    audio.__baseGain = clamp01(config.gain)
    audio.volume = clamp01(audio.__baseGain * sfxBase)

    if ((config.playbackRateJitter ?? 0) > 0) {
      const jitter = config.playbackRateJitter!
      audio.playbackRate = Math.max(0.86, Math.min(1.2, 1 + (Math.random() * 2 - 1) * jitter))
    }

    this.activeSfx.add(audio)

    const cleanup = () => {
      this.activeSfx.delete(audio)
      audio.removeEventListener('ended', cleanup)
      audio.removeEventListener('error', cleanup)
    }
    audio.addEventListener('ended', cleanup)
    audio.addEventListener('error', cleanup)

    const playPromise = audio.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        cleanup()
      })
    }
  }

  private setTrackFactor(trackId: 'none' | 'lobby' | 'game' | 'boss', value: number) {
    if (trackId === 'lobby') this.lobbyGainFactor = clamp01(value)
    if (trackId === 'game') this.gameGainFactor = clamp01(value)
    if (trackId === 'boss') this.bossGainFactor = clamp01(value)
    this.applyGains()
  }

  private getTrackFactor(trackId: 'none' | 'lobby' | 'game' | 'boss'): number {
    if (trackId === 'lobby') return this.lobbyGainFactor
    if (trackId === 'game') return this.gameGainFactor
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

  private chooseNextSrc(phase: 'lobby' | 'game' | 'boss'): string {
    if (phase === 'lobby') {
      const idx = this.pickRandomIndex(this.LOBBY_PLAYLIST.length, this.lobbyLastIndex)
      this.lobbyLastIndex = idx
      return this.LOBBY_PLAYLIST[idx]!
    }
    if (phase === 'boss') return this.BOSS_STAGE_TRACK
    return this.GAME_STAGE_TRACK
  }

  private async wait(ms: number) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, Math.max(0, ms))
    })
  }

  private async handleLobbyEnded() {
    if (!this.canPlayMusic()) return
    if (this.resolveDesiredTrack() !== 'lobby' || this.currentTrack !== 'lobby') return

    const gapSeq = ++this.lobbyGapSeq
    this.setTrackFactor('lobby', 0)
    await this.wait(this.LOBBY_GAP_MS)
    if (gapSeq !== this.lobbyGapSeq) return
    if (!this.canPlayMusic()) return
    if (this.resolveDesiredTrack() !== 'lobby' || this.currentTrack !== 'lobby') return

    const seq = this.transitionSeq
    if (!this.startLobbyTrack(true)) return
    this.setTrackFactor('lobby', 0)
    await this.fadeTrack('lobby', 1, this.LOBBY_INTRO_MS, seq)
  }

  private armLobbyOutro() {
    if (this.lobbyOutroArmed) return
    const track = this.lobbyTrack
    if (!track) return
    if (!track.duration || !Number.isFinite(track.duration)) return

    const remainingMs = Math.max(0, (track.duration - track.currentTime) * 1000)
    if (remainingMs > this.LOBBY_OUTRO_MS) return
    if (this.resolveDesiredTrack() !== 'lobby' || this.currentTrack !== 'lobby') return

    this.lobbyOutroArmed = true
    const seq = this.transitionSeq
    void this.fadeTrack('lobby', 0, Math.min(this.LOBBY_OUTRO_MS, Math.max(120, remainingMs)), seq)
  }

  private bindTrackEvents(track: HTMLAudioElement, phase: 'lobby' | 'game' | 'boss') {
    if (phase === 'lobby') {
      if (this.lobbyHandlersBound) return
      track.addEventListener('ended', () => {
        this.lobbyOutroArmed = false
        void this.handleLobbyEnded()
      })
      track.addEventListener('timeupdate', () => this.armLobbyOutro())
      this.lobbyHandlersBound = true
      return
    }
    if (phase === 'game') {
      if (this.gameHandlersBound) return
      this.gameHandlersBound = true
      return
    }
    if (this.bossHandlersBound) return
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
    this.lobbyGapSeq += 1
    this.lobbyOutroArmed = false

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

  private getGameTrack(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null
    if (this.gameTrack) return this.gameTrack

    const track = new Audio()
    track.preload = 'auto'
    track.loop = true
    this.bindTrackEvents(track, 'game')
    this.gameTrack = track
    this.applyGains()
    return this.gameTrack
  }

  private startGameTrack(_forceNext = false): boolean {
    const track = this.getGameTrack()
    if (!track) return false

    if (!track.src) {
      track.src = this.chooseNextSrc('game')
      track.currentTime = 0
    }

    const playPromise = track.play()
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        if (this.scene !== 'game') return
        this.armUnlockRetry()
      })
    }
    return true
  }

  private pauseGameTrack(reset = false) {
    if (!this.gameTrack) return
    this.gameTrack.pause()
    if (reset) this.gameTrack.currentTime = 0
  }

  private getBossTrack(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null
    if (this.bossTrack) return this.bossTrack

    const track = new Audio()
    track.preload = 'auto'
    track.loop = true
    this.bindTrackEvents(track, 'boss')
    this.bossTrack = track
    this.applyGains()
    return this.bossTrack
  }

  private startBossTrack(): boolean {
    const track = this.getBossTrack()
    if (!track) return false

    if (!track.src) {
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

  private startTrack(trackId: 'none' | 'lobby' | 'game' | 'boss'): boolean {
    if (trackId === 'lobby') return this.startLobbyTrack()
    if (trackId === 'game') return this.startGameTrack()
    if (trackId === 'boss') return this.startBossTrack()
    return true
  }

  private stopTrack(trackId: 'none' | 'lobby' | 'game' | 'boss', reset = true) {
    if (trackId === 'lobby') this.pauseLobbyTrack(reset)
    if (trackId === 'game') this.pauseGameTrack(reset)
    if (trackId === 'boss') this.pauseBossTrack(reset)
  }

  private async fadeTrack(trackId: 'none' | 'lobby' | 'game' | 'boss', to: number, durationMs: number, seq: number) {
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

  private resolveDesiredTrack(): 'none' | 'lobby' | 'game' | 'boss' {
    if (!this.canPlayMusic()) return 'none'
    if (this.scene === 'lobby') return 'lobby'
    if (this.scene === 'game') return this.bossActive ? 'boss' : 'game'
    return 'none'
  }

  private async transitionTo(desired: 'none' | 'lobby' | 'game' | 'boss') {
    const seq = ++this.transitionSeq
    const from = this.currentTrack

    if (from === desired) {
      this.startTrack(desired)
      if (desired !== 'none') this.setTrackFactor(desired, 1)
      if (desired !== 'lobby') this.setTrackFactor('lobby', 0)
      if (desired !== 'game') this.setTrackFactor('game', 0)
      if (desired !== 'boss') this.setTrackFactor('boss', 0)
      return
    }

    if (from !== 'none') {
      if (desired !== 'none') {
        this.currentTrack = desired
        this.setTrackFactor(desired, 0)
        this.startTrack(desired)

        await Promise.all([
          this.fadeTrack(from, 0, this.CROSSFADE_MS, seq),
          this.fadeTrack(desired, 1, this.CROSSFADE_MS, seq),
        ])
        if (seq !== this.transitionSeq) return

        this.stopTrack(from, true)
        if (desired !== 'lobby') this.setTrackFactor('lobby', 0)
        if (desired !== 'game') this.setTrackFactor('game', 0)
        if (desired !== 'boss') this.setTrackFactor('boss', 0)
        return
      }

      await this.fadeTrack(from, 0, this.FADE_OUT_MS, seq)
      if (seq !== this.transitionSeq) return
      this.stopTrack(from, true)
    }

    if (desired === 'none') {
      this.currentTrack = 'none'
      this.setTrackFactor('lobby', 0)
      this.setTrackFactor('game', 0)
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
    this.syncSceneMusic()
  }

  setBossActive(_active: boolean) {
    if (this.bossActive === _active) return
    this.bossActive = _active
    this.syncSceneMusic()
  }

  notifyStageStart() {
    this.syncSceneMusic()
  }

  playUiClick() {}

  playSkill() {}

  playLevelUp() {}

  playPlayerHit() {}

  playEnemyKill() {}

  playBossAlert() {}

  playShipShoot(shipId: ShipAudioId) {
    const config = this.SHIP_SHOT_SFX[shipId] ?? this.SHIP_SHOT_SFX.star_keeper
    if (!config) return
    if (this.shouldThrottleSfx(`ship_shot:${shipId}`, config.cooldownMs)) return
    this.playSfx(config)
  }

  playShipHit(shipId: ShipAudioId) {
    const config = this.SHIP_HIT_SFX[shipId]
    if (!config) return
    if (this.shouldThrottleSfx(`ship_hit:${shipId}`, config.cooldownMs)) return
    this.playSfx(config)
  }
}

export const audioManager = new AudioManager()
export { DEFAULT_AUDIO_SETTINGS }
