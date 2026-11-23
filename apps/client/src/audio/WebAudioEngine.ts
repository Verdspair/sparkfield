import type { AudioAdapter, AudioEventPayloads } from '@pkg/contracts';

export type BgmTrackId = 'lobby' | 'early' | 'mid' | 'late' | 'overtime';

export type SfxId =
  | 'ui_click'
  | 'ui_hover'
  | 'ui_open'
  | 'ui_close'
  | 'ui_toggle'
  | 'ui_error'
  | 'shop_buy'
  | 'shop_reroll'
  | 'shop_sell'
  | 'shop_lock'
  | 'xp_buy'
  | 'level_up'
  | 'star_up_2'
  | 'star_up_3'
  | 'unit_pick'
  | 'unit_drop'
  | 'item_equip'
  | 'item_combine'
  | 'item_remover'
  | 'orb_drop'
  | 'orb_collect'
  | 'battle_horn'
  | 'skill_cast'
  | 'hit_phys'
  | 'hit_magic'
  | 'unit_death'
  | 'round_win'
  | 'round_loss'
  | 'augment_pick'
  | 'match_accept'
  | 'phase_chime'
  | 'answer_correct'
  | 'answer_wrong'
  | 'countdown_tick'
  | 'countdown_urgent';

export interface AudioSettings {
  readonly masterVolume: number;
  readonly bgmVolume: number;
  readonly sfxVolume: number;
  readonly muted: boolean;
}

export const AUDIO_PREFS_STORAGE_KEY = 'sparkfield_audio_prefs_v1';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.78,
  bgmVolume: 0.58,
  sfxVolume: 0.82,
  muted: false,
};

export const BGM_TRACK_PATHS: Readonly<Record<BgmTrackId, string>> = {
  lobby: '/audio/bgm/bgm_lobby.mp3',
  early: '/audio/bgm/bgm_early.mp3',
  mid: '/audio/bgm/bgm_mid.mp3',
  late: '/audio/bgm/bgm_late.mp3',
  overtime: '/audio/bgm/bgm_overtime.mp3',
};

export const SFX_PATHS: Readonly<Record<SfxId, string>> = {
  ui_click: '/audio/sfx/sfx_ui_click.mp3',
  ui_hover: '/audio/sfx/sfx_ui_hover.mp3',
  ui_open: '/audio/sfx/sfx_ui_open.mp3',
  ui_close: '/audio/sfx/sfx_ui_close.mp3',
  ui_toggle: '/audio/sfx/sfx_ui_toggle.mp3',
  ui_error: '/audio/sfx/sfx_ui_error.mp3',
  shop_buy: '/audio/sfx/sfx_shop_buy.mp3',
  shop_reroll: '/audio/sfx/sfx_shop_reroll.mp3',
  shop_sell: '/audio/sfx/sfx_shop_sell.mp3',
  shop_lock: '/audio/sfx/sfx_shop_lock.mp3',
  xp_buy: '/audio/sfx/sfx_xp_buy.mp3',
  level_up: '/audio/sfx/sfx_level_up.mp3',
  star_up_2: '/audio/sfx/sfx_star_up_2.mp3',
  star_up_3: '/audio/sfx/sfx_star_up_3.mp3',
  unit_pick: '/audio/sfx/sfx_unit_pick.mp3',
  unit_drop: '/audio/sfx/sfx_unit_drop.mp3',
  item_equip: '/audio/sfx/sfx_item_equip.mp3',
  item_combine: '/audio/sfx/sfx_item_combine.mp3',
  item_remover: '/audio/sfx/sfx_item_remover.mp3',
  orb_drop: '/audio/sfx/sfx_orb_drop.mp3',
  orb_collect: '/audio/sfx/sfx_orb_collect.mp3',
  battle_horn: '/audio/sfx/sfx_battle_horn.mp3',
  skill_cast: '/audio/sfx/sfx_skill_cast.mp3',
  hit_phys: '/audio/sfx/sfx_hit_phys.mp3',
  hit_magic: '/audio/sfx/sfx_hit_magic.mp3',
  unit_death: '/audio/sfx/sfx_unit_death.mp3',
  round_win: '/audio/sfx/sfx_round_win.mp3',
  round_loss: '/audio/sfx/sfx_round_loss.mp3',
  augment_pick: '/audio/sfx/sfx_augment_pick.mp3',
  match_accept: '/audio/sfx/sfx_match_accept.mp3',
  phase_chime: '/audio/sfx/sfx_phase_chime.mp3',
  answer_correct: '/audio/sfx/sfx_answer_correct.mp3',
  answer_wrong: '/audio/sfx/sfx_answer_wrong.mp3',
  countdown_tick: '/audio/sfx/sfx_countdown_tick.mp3',
  countdown_urgent: '/audio/sfx/sfx_countdown_urgent.mp3',
};

const BGM_CROSSFADE_SEC = 1.4;
const BGM_OVERTIME_CROSSFADE_SEC = 0.6;
const FOCUS_LOWPASS_HZ = 1100;
const NORMAL_LOWPASS_HZ = 20000;
const FOCUS_BGM_DUCK_GAIN = 0.42;
const MAX_CONCURRENT_SFX = 12;

const SFX_COOLDOWN_MS: Partial<Readonly<Record<SfxId, number>>> = {
  hit_phys: 85,
  hit_magic: 85,
  skill_cast: 110,
  unit_death: 90,
  ui_hover: 70,
  orb_drop: 60,
  orb_collect: 60,
  phase_chime: 200,
};

const SFX_GAIN_SCALE: Partial<Readonly<Record<SfxId, number>>> = {
  ui_hover: 0.45,
  hit_phys: 0.72,
  hit_magic: 0.74,
  skill_cast: 0.85,
  unit_death: 0.82,
  star_up_3: 1.0,
  battle_horn: 0.95,
};

const SFX_PITCH_JITTER: Partial<Readonly<Record<SfxId, number>>> = {
  hit_phys: 0.04,
  hit_magic: 0.04,
  skill_cast: 0.04,
  unit_death: 0.04,
  orb_drop: 0.03,
  orb_collect: 0.03,
};

interface BgmSlot {
  trackId: BgmTrackId | null;
  source: AudioBufferSourceNode | null;
  gain: GainNode | null;
  stopTimer: ReturnType<typeof setTimeout> | null;
}

function clamp01(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function resolveAudioContextCtor(): (new () => AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  return win.AudioContext ?? win.webkitAudioContext ?? null;
}

function setParamSmooth(param: AudioParam, target: number, atTime: number, timeConstant: number): void {
  if (typeof param.setTargetAtTime === 'function') {
    param.setTargetAtTime(target, atTime, timeConstant);
  } else if (typeof param.setValueAtTime === 'function') {
    param.setValueAtTime(target, atTime);
  } else {
    param.value = target;
  }
}

function setParamImmediate(param: AudioParam, target: number, atTime: number): void {
  if (typeof param.setValueAtTime === 'function') {
    param.setValueAtTime(target, atTime);
  } else {
    param.value = target;
  }
}

function linearRampParam(param: AudioParam, target: number, endTime: number): void {
  if (typeof param.linearRampToValueAtTime === 'function') {
    param.linearRampToValueAtTime(target, endTime);
  } else if (typeof param.setValueAtTime === 'function') {
    param.setValueAtTime(target, endTime);
  } else {
    param.value = target;
  }
}

function cancelParamSchedule(param: AudioParam, atTime: number): void {
  if (typeof param.cancelScheduledValues === 'function') {
    param.cancelScheduledValues(atTime);
  }
}

function readStoredSettings(): AudioSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_AUDIO_SETTINGS;
    const raw = window.localStorage.getItem(AUDIO_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_AUDIO_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AudioSettings> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_AUDIO_SETTINGS;
    return {
      masterVolume: clamp01(parsed.masterVolume ?? DEFAULT_AUDIO_SETTINGS.masterVolume, DEFAULT_AUDIO_SETTINGS.masterVolume),
      bgmVolume: clamp01(parsed.bgmVolume ?? DEFAULT_AUDIO_SETTINGS.bgmVolume, DEFAULT_AUDIO_SETTINGS.bgmVolume),
      sfxVolume: clamp01(parsed.sfxVolume ?? DEFAULT_AUDIO_SETTINGS.sfxVolume, DEFAULT_AUDIO_SETTINGS.sfxVolume),
      muted: Boolean(parsed.muted),
    };
  } catch {
    return DEFAULT_AUDIO_SETTINGS;
  }
}

function writeStoredSettings(settings: AudioSettings): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(AUDIO_PREFS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
  }
}

export function resolveAdaptiveBgmTrack(context: AudioEventPayloads['onBgmContext']): BgmTrackId {
  if (context.scene !== 'match') {
    return 'lobby';
  }
  if (context.isOvertime) {
    return 'overtime';
  }
  const totalRounds = Math.max(1, context.totalRounds ?? 8);
  const roundIndex = Math.max(1, context.roundIndex ?? 1);
  const earlyCutoff = Math.max(2, Math.floor(totalRounds * 0.35));
  const lateStart = Math.max(totalRounds - 2, 4);
  if (roundIndex <= earlyCutoff) {
    return 'early';
  }
  if (roundIndex < lateStart) {
    return 'mid';
  }
  return 'late';
}

export class WebAudioEngine implements Required<AudioAdapter> {
  private settings: AudioSettings;
  private readonly subscribers = new Set<(settings: AudioSettings) => void>();

  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmFocusGain: GainNode | null = null;
  private bgmLowpass: BiquadFilterNode | null = null;
  private sfxGain: GainNode | null = null;

  private readonly slots: [BgmSlot, BgmSlot] = [
    { trackId: null, source: null, gain: null, stopTimer: null },
    { trackId: null, source: null, gain: null, stopTimer: null },
  ];
  private activeSlotIdx: 0 | 1 = 0;

  private desiredBgmTrack: BgmTrackId | null = 'lobby';
  private focusDuck = false;
  private disposed = false;

  private readonly bufferCache = new Map<string, AudioBuffer>();
  private readonly inFlightLoads = new Map<string, Promise<AudioBuffer | null>>();
  private readonly lastPlayedAt = new Map<string, number>();
  private readonly activeSfxSources = new Set<AudioBufferSourceNode>();
  private lastPreviewAt = 0;
  private bgmTransitionToken = 0;

  constructor() {
    this.settings = readStoredSettings();
  }

  public getSettings(): AudioSettings {
    return this.settings;
  }

  public updateSettings(patch: Partial<AudioSettings>): AudioSettings {
    const next: AudioSettings = {
      masterVolume: patch.masterVolume !== undefined
        ? clamp01(patch.masterVolume, this.settings.masterVolume)
        : this.settings.masterVolume,
      bgmVolume: patch.bgmVolume !== undefined
        ? clamp01(patch.bgmVolume, this.settings.bgmVolume)
        : this.settings.bgmVolume,
      sfxVolume: patch.sfxVolume !== undefined
        ? clamp01(patch.sfxVolume, this.settings.sfxVolume)
        : this.settings.sfxVolume,
      muted: patch.muted !== undefined ? Boolean(patch.muted) : this.settings.muted,
    };
    if (
      next.masterVolume === this.settings.masterVolume &&
      next.bgmVolume === this.settings.bgmVolume &&
      next.sfxVolume === this.settings.sfxVolume &&
      next.muted === this.settings.muted
    ) {
      return this.settings;
    }
    this.settings = next;
    writeStoredSettings(next);
    this.applySettingsToNodes();
    for (const cb of this.subscribers) {
      try {
        cb(next);
      } catch {
      }
    }
    return next;
  }

  public subscribe(cb: (settings: AudioSettings) => void): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  public isUnlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  public getActiveBgmTrack(): BgmTrackId | null {
    return this.desiredBgmTrack;
  }

  public isFocusDucking(): boolean {
    return this.focusDuck;
  }

  public async unlock(): Promise<void> {
    if (this.disposed) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }
    if (!this.disposed && ctx.state === 'running' && this.desiredBgmTrack) {
      const currentSlot = this.slots[this.activeSlotIdx];
      if (!currentSlot.source || currentSlot.trackId !== this.desiredBgmTrack) {
        void this.crossfadeToTrack(this.desiredBgmTrack);
      }
    }
  }

  public playPreviewSfx(): void {
    const now = nowMs();
    if (now - this.lastPreviewAt < 140) return;
    this.lastPreviewAt = now;
    void this.unlock();
    this.playSfx('ui_click');
  }

  public onPhaseChange(payload: AudioEventPayloads['onPhaseChange']): void {
    if (payload.phase === 'battle') return;
    if (
      payload.phase === 'learning' ||
      payload.phase === 'resource' ||
      payload.phase === 'choice' ||
      payload.phase === 'strategy' ||
      payload.phase === 'rest'
    ) {
      this.playSfx('phase_chime');
    }
  }

  public onUnitPurchase(_payload: AudioEventPayloads['onUnitPurchase']): void {
    this.playSfx('shop_buy');
  }

  public onUnitStarUp(payload: AudioEventPayloads['onUnitStarUp']): void {
    this.playSfx(payload.newStar === 3 ? 'star_up_3' : 'star_up_2');
  }

  public onBattleStart(_payload: AudioEventPayloads['onBattleStart']): void {
    this.playSfx('battle_horn');
  }

  public onSkillCast(_payload: AudioEventPayloads['onSkillCast']): void {
    this.playSfx('skill_cast');
  }

  public onUnitDeath(_payload: AudioEventPayloads['onUnitDeath']): void {
    this.playSfx('unit_death');
  }

  public onRoundResult(payload: AudioEventPayloads['onRoundResult']): void {
    if (payload.outcome === 'win') {
      this.playSfx('round_win');
    } else if (payload.outcome === 'loss') {
      this.playSfx('round_loss');
    } else {
      this.playSfx('phase_chime');
    }
  }

  public onLessonAudioPlay(payload: AudioEventPayloads['onLessonAudioPlay']): void {
    const ref = payload.audioRef.trim();
    if (!ref) return;
    if (ref.startsWith('/') || /^https?:\/\//i.test(ref)) {
      void this.playAudioUrl(ref, 0.95);
    }
  }

  public onShopAction(payload: AudioEventPayloads['onShopAction']): void {
    switch (payload.action) {
      case 'reroll':
        this.playSfx('shop_reroll');
        break;
      case 'sell':
        this.playSfx('shop_sell');
        break;
      case 'lock':
        this.playSfx('shop_lock');
        break;
      case 'buy_xp':
        this.playSfx('xp_buy');
        break;
      case 'level_up':
        this.playSfx('level_up');
        break;
    }
  }

  public onUnitMove(payload: AudioEventPayloads['onUnitMove']): void {
    this.playSfx(payload.kind === 'pick' ? 'unit_pick' : 'unit_drop');
  }

  public onItemAction(payload: AudioEventPayloads['onItemAction']): void {
    switch (payload.action) {
      case 'equip':
        this.playSfx('item_equip');
        break;
      case 'combine':
        this.playSfx('item_combine');
        break;
      case 'remover':
      case 'reforge':
        this.playSfx('item_remover');
        break;
    }
  }

  public onLootOrb(payload: AudioEventPayloads['onLootOrb']): void {
    this.playSfx(payload.action === 'drop' ? 'orb_drop' : 'orb_collect');
  }

  public onUiFeedback(payload: AudioEventPayloads['onUiFeedback']): void {
    switch (payload.kind) {
      case 'click':
        this.playSfx('ui_click');
        break;
      case 'hover':
        this.playSfx('ui_hover');
        break;
      case 'open':
        this.playSfx('ui_open');
        break;
      case 'close':
        this.playSfx('ui_close');
        break;
      case 'toggle':
        this.playSfx('ui_toggle');
        break;
      case 'error':
        this.playSfx('ui_error');
        break;
      case 'augment_pick':
        this.playSfx('augment_pick');
        break;
      case 'match_accept':
        this.playSfx('match_accept');
        break;
    }
  }

  public onLearningFeedback(payload: AudioEventPayloads['onLearningFeedback']): void {
    this.playSfx(payload.correct ? 'answer_correct' : 'answer_wrong');
  }

  public onCombatHit(payload: AudioEventPayloads['onCombatHit']): void {
    this.playSfx(payload.damageType === 'physical' ? 'hit_phys' : 'hit_magic');
  }

  public onCountdownTick(payload: AudioEventPayloads['onCountdownTick']): void {
    const sec = Math.max(1, Math.min(5, Math.round(payload.secondsLeft)));
    const id: SfxId = payload.urgent || sec <= 2 ? 'countdown_urgent' : 'countdown_tick';
    const rateBySec: Readonly<Record<number, number>> = {
      5: 0.96,
      4: 1.0,
      3: 1.04,
      2: 1.02,
      1: 1.1,
    };
    const gainBySec: Readonly<Record<number, number>> = {
      5: 0.76,
      4: 0.82,
      3: 0.88,
      2: 0.96,
      1: 1.04,
    };
    this.playSfxWithOverrides(id, gainBySec[sec] ?? 0.88, rateBySec[sec] ?? 1.0);
  }

  public onBgmContext(payload: AudioEventPayloads['onBgmContext']): void {
    const nextTrack = resolveAdaptiveBgmTrack(payload);
    const shouldDuck = payload.phase === 'learning' || Boolean(payload.focusDuck);
    this.setFocusDuck(shouldDuck);

    const currentSlot = this.slots[this.activeSlotIdx];
    const trackChanged = this.desiredBgmTrack !== nextTrack;
    this.desiredBgmTrack = nextTrack;

    if (this.disposed) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;
    if (trackChanged || !currentSlot.source || currentSlot.trackId !== nextTrack) {
      void this.crossfadeToTrack(nextTrack);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.clearSlot(0);
    this.clearSlot(1);
    for (const src of this.activeSfxSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
      }
    }
    this.activeSfxSources.clear();
    if (this.ctx) {
      const closing = this.ctx;
      this.ctx = null;
      try {
        void closing.close();
      } catch {
      }
    }
    this.compressor = null;
    this.masterGain = null;
    this.bgmGain = null;
    this.bgmFocusGain = null;
    this.bgmLowpass = null;
    this.sfxGain = null;
  }

  private ensureContext(): AudioContext | null {
    if (this.disposed) return null;
    if (this.ctx) return this.ctx;
    const Ctor = resolveAudioContextCtor();
    if (!Ctor) return null;

    try {
      const ctx = new Ctor();
      const now = ctx.currentTime ?? 0;

      const compressor = ctx.createDynamicsCompressor();
      setParamImmediate(compressor.threshold, -12, now);
      setParamImmediate(compressor.knee, 18, now);
      setParamImmediate(compressor.ratio, 4, now);
      setParamImmediate(compressor.attack, 0.005, now);
      setParamImmediate(compressor.release, 0.15, now);
      compressor.connect(ctx.destination);

      const masterGain = ctx.createGain();
      setParamImmediate(masterGain.gain, this.settings.muted ? 0 : this.settings.masterVolume, now);
      masterGain.connect(compressor);

      const bgmGain = ctx.createGain();
      setParamImmediate(bgmGain.gain, this.settings.bgmVolume, now);
      bgmGain.connect(masterGain);

      const bgmFocusGain = ctx.createGain();
      setParamImmediate(bgmFocusGain.gain, this.focusDuck ? FOCUS_BGM_DUCK_GAIN : 1.0, now);
      bgmFocusGain.connect(bgmGain);

      const bgmLowpass = ctx.createBiquadFilter();
      bgmLowpass.type = 'lowpass';
      setParamImmediate(bgmLowpass.Q, 0.7, now);
      setParamImmediate(bgmLowpass.frequency, this.focusDuck ? FOCUS_LOWPASS_HZ : NORMAL_LOWPASS_HZ, now);
      bgmLowpass.connect(bgmFocusGain);

      const sfxGain = ctx.createGain();
      setParamImmediate(sfxGain.gain, this.settings.sfxVolume, now);
      sfxGain.connect(masterGain);

      this.ctx = ctx;
      this.compressor = compressor;
      this.masterGain = masterGain;
      this.bgmGain = bgmGain;
      this.bgmFocusGain = bgmFocusGain;
      this.bgmLowpass = bgmLowpass;
      this.sfxGain = sfxGain;
      return ctx;
    } catch {
      return null;
    }
  }

  private applySettingsToNodes(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime ?? 0;
    if (this.masterGain) {
      setParamSmooth(this.masterGain.gain, this.settings.muted ? 0 : this.settings.masterVolume, now, 0.025);
    }
    if (this.bgmGain) {
      setParamSmooth(this.bgmGain.gain, this.settings.bgmVolume, now, 0.025);
    }
    if (this.sfxGain) {
      setParamSmooth(this.sfxGain.gain, this.settings.sfxVolume, now, 0.025);
    }
  }

  private setFocusDuck(duck: boolean): void {
    if (this.focusDuck === duck) return;
    this.focusDuck = duck;
    if (!this.ctx) return;
    const now = this.ctx.currentTime ?? 0;
    if (this.bgmLowpass) {
      setParamSmooth(this.bgmLowpass.frequency, duck ? FOCUS_LOWPASS_HZ : NORMAL_LOWPASS_HZ, now, 0.24);
    }
    if (this.bgmFocusGain) {
      setParamSmooth(this.bgmFocusGain.gain, duck ? FOCUS_BGM_DUCK_GAIN : 1.0, now, 0.24);
    }
  }

  private async loadBuffer(url: string): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(url);
    if (cached) return cached;
    const pending = this.inFlightLoads.get(url);
    if (pending) return pending;

    const task = (async (): Promise<AudioBuffer | null> => {
      if (this.disposed || typeof fetch !== 'function') return null;
      const ctx = this.ctx;
      if (!ctx) return null;
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        if (this.disposed || !this.ctx) return null;
        const decoded = await this.ctx.decodeAudioData(arrayBuffer);
        this.bufferCache.set(url, decoded);
        return decoded;
      } catch {
        return null;
      } finally {
        this.inFlightLoads.delete(url);
      }
    })();

    this.inFlightLoads.set(url, task);
    return task;
  }

  private clearSlot(slotIdx: 0 | 1): void {
    const slot = this.slots[slotIdx];
    if (slot.stopTimer !== null) {
      clearTimeout(slot.stopTimer);
      slot.stopTimer = null;
    }
    if (slot.source) {
      try {
        slot.source.stop();
        slot.source.disconnect();
      } catch {
      }
      slot.source = null;
    }
    if (slot.gain) {
      try {
        slot.gain.disconnect();
      } catch {
      }
      slot.gain = null;
    }
    slot.trackId = null;
  }

  private async crossfadeToTrack(trackId: BgmTrackId): Promise<void> {
    const token = ++this.bgmTransitionToken;
    const buffer = await this.loadBuffer(BGM_TRACK_PATHS[trackId]);
    if (!buffer || this.disposed || this.desiredBgmTrack !== trackId || token !== this.bgmTransitionToken) {
      return;
    }

    const ctx = this.ctx;
    const lowpass = this.bgmLowpass;
    if (!ctx || !lowpass || ctx.state !== 'running') return;

    const currentSlot = this.slots[this.activeSlotIdx];
    if (currentSlot.trackId === trackId && currentSlot.source) return;

    const nextIdx: 0 | 1 = this.activeSlotIdx === 0 ? 1 : 0;
    const prevIdx: 0 | 1 = this.activeSlotIdx;
    this.clearSlot(nextIdx);

    try {
      const now = ctx.currentTime ?? 0;
      const fadeSec = trackId === 'overtime' ? BGM_OVERTIME_CROSSFADE_SEC : BGM_CROSSFADE_SEC;
      const hasPrev = Boolean(this.slots[prevIdx].source && this.slots[prevIdx].gain);

      const nextGain = ctx.createGain();
      setParamImmediate(nextGain.gain, hasPrev ? 0.0001 : 1.0, now);
      if (hasPrev) {
        linearRampParam(nextGain.gain, 1.0, now + fadeSec);
      }
      nextGain.connect(lowpass);

      const nextSource = ctx.createBufferSource();
      nextSource.buffer = buffer;
      nextSource.loop = true;
      nextSource.connect(nextGain);
      nextSource.start(now);

      this.slots[nextIdx].trackId = trackId;
      this.slots[nextIdx].source = nextSource;
      this.slots[nextIdx].gain = nextGain;
      this.activeSlotIdx = nextIdx;

      if (hasPrev) {
        const prevSlot = this.slots[prevIdx];
        const prevGain = prevSlot.gain!;
        const prevSource = prevSlot.source!;
        cancelParamSchedule(prevGain.gain, now);
        setParamImmediate(prevGain.gain, prevGain.gain.value ?? 1.0, now);
        linearRampParam(prevGain.gain, 0.0001, now + fadeSec);
        try {
          prevSource.stop(now + fadeSec + 0.05);
        } catch {
        }
        prevSlot.stopTimer = setTimeout(() => {
          if (this.activeSlotIdx !== prevIdx) {
            this.clearSlot(prevIdx);
          }
        }, Math.round((fadeSec + 0.12) * 1000));
      }
    } catch {
    }
  }

  private playSfx(id: SfxId): void {
    const gainScale = SFX_GAIN_SCALE[id] ?? 1.0;
    const jitter = SFX_PITCH_JITTER[id] ?? 0;
    const playbackRate = jitter > 0 ? 1 + (Math.random() * 2 - 1) * jitter : 1;
    this.playSfxWithOverrides(id, gainScale, playbackRate);
  }

  private playSfxWithOverrides(id: SfxId, gainScale: number, playbackRate: number): void {
    if (this.disposed) return;
    if (this.settings.muted || this.settings.masterVolume <= 0 || this.settings.sfxVolume <= 0) return;

    const cooldown = SFX_COOLDOWN_MS[id] ?? 0;
    const ts = nowMs();
    if (cooldown > 0) {
      const last = this.lastPlayedAt.get(id) ?? -Infinity;
      if (ts - last < cooldown) return;
    }
    this.lastPlayedAt.set(id, ts);

    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;
    if (this.activeSfxSources.size >= MAX_CONCURRENT_SFX) return;

    void this.playAudioUrl(SFX_PATHS[id], gainScale, playbackRate);
  }

  private async playAudioUrl(url: string, gainScale: number, playbackRate = 1): Promise<void> {
    const buffer = await this.loadBuffer(url);
    if (!buffer || this.disposed) return;
    const ctx = this.ctx;
    const sfxGain = this.sfxGain;
    if (!ctx || !sfxGain || ctx.state !== 'running') return;
    if (this.activeSfxSources.size >= MAX_CONCURRENT_SFX) return;

    try {
      const now = ctx.currentTime ?? 0;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      if (playbackRate !== 1 && source.playbackRate) {
        setParamImmediate(source.playbackRate, playbackRate, now);
      }

      let outputNode: AudioNode = source;
      let perVoiceGain: GainNode | null = null;
      if (gainScale !== 1) {
        perVoiceGain = ctx.createGain();
        setParamImmediate(perVoiceGain.gain, gainScale, now);
        source.connect(perVoiceGain);
        outputNode = perVoiceGain;
      }
      outputNode.connect(sfxGain);

      this.activeSfxSources.add(source);
      source.onended = () => {
        this.activeSfxSources.delete(source);
        try {
          source.disconnect();
          perVoiceGain?.disconnect();
        } catch {
        }
      };
      source.start(now);
    } catch {
    }
  }
}

let sharedEngine: WebAudioEngine | null = null;

export function getSharedWebAudioEngine(): WebAudioEngine {
  if (!sharedEngine) {
    sharedEngine = new WebAudioEngine();
  }
  return sharedEngine;
}
