import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEventBus, NullAudioAdapter } from '@pkg/contracts';
import {
  AUDIO_PREFS_STORAGE_KEY,
  BGM_TRACK_PATHS,
  DEFAULT_AUDIO_SETTINGS,
  SFX_PATHS,
  WebAudioEngine,
  resolveAdaptiveBgmTrack,
} from '../src/audio/WebAudioEngine.js';

function createFakeAudioParam(initialValue = 0) {
  const param = {
    value: initialValue,
    setValueAtTime: vi.fn((val: number) => {
      param.value = val;
    }),
    linearRampToValueAtTime: vi.fn((val: number) => {
      param.value = val;
    }),
    setTargetAtTime: vi.fn((val: number) => {
      param.value = val;
    }),
    cancelScheduledValues: vi.fn(),
  };
  return param;
}

describe('WebAudioEngine & adaptive audio contracts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('defines exact paths for all 5 BGM tracks and 37 SFX clips', () => {
    expect(Object.keys(BGM_TRACK_PATHS)).toHaveLength(5);
    expect(Object.keys(SFX_PATHS)).toHaveLength(37);
    expect(SFX_PATHS.countdown_tick).toBe('/audio/sfx/sfx_countdown_tick.mp3');
    expect(SFX_PATHS.countdown_urgent).toBe('/audio/sfx/sfx_countdown_urgent.mp3');
    expect(BGM_TRACK_PATHS.lobby).toBe('/audio/bgm/bgm_lobby.mp3');
    expect(BGM_TRACK_PATHS.overtime).toBe('/audio/bgm/bgm_overtime.mp3');
    expect(SFX_PATHS.star_up_3).toBe('/audio/sfx/sfx_star_up_3.mp3');
    expect(SFX_PATHS.answer_correct).toBe('/audio/sfx/sfx_answer_correct.mp3');
    expect(SFX_PATHS.trait_up).toBe('/audio/sfx/sfx_trait_up.mp3');
    expect(SFX_PATHS.victory_fanfare).toBe('/audio/sfx/sfx_victory_fanfare.mp3');
  });

  it('resolves 5-state adaptive BGM tracks accurately for lobby, quick, standard, deep, and overtime', () => {
    expect(resolveAdaptiveBgmTrack({ scene: 'lobby' })).toBe('lobby');
    expect(resolveAdaptiveBgmTrack({ scene: 'subpage', roundIndex: 7, totalRounds: 8 })).toBe('lobby');

    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 1, totalRounds: 6 })).toBe('early');
    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 2, totalRounds: 6 })).toBe('early');
    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 3, totalRounds: 6 })).toBe('mid');
    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 4, totalRounds: 6 })).toBe('late');
    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 6, totalRounds: 6 })).toBe('late');

    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 2, totalRounds: 8 })).toBe('early');
    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 3, totalRounds: 8 })).toBe('mid');
    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 5, totalRounds: 8 })).toBe('mid');
    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 6, totalRounds: 8 })).toBe('late');
    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 8, totalRounds: 8 })).toBe('late');

    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 4, totalRounds: 12 })).toBe('early');
    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 5, totalRounds: 12 })).toBe('mid');
    expect(resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 10, totalRounds: 12 })).toBe('late');

    expect(
      resolveAdaptiveBgmTrack({ scene: 'match', roundIndex: 1, totalRounds: 8, isOvertime: true }),
    ).toBe('overtime');
  });

  it('degrades safely without AudioContext and manages settings persistence', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storage.set(k, v);
        },
      },
    });

    const engine = new WebAudioEngine();
    const bus = new AudioEventBus();
    bus.setAdapter(engine);

    expect(engine.getSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
    const seen: boolean[] = [];
    const unsub = engine.subscribe((s) => seen.push(s.muted));

    engine.updateSettings({ masterVolume: 1.5, bgmVolume: -0.2, sfxVolume: 0.64, muted: true });
    expect(engine.getSettings()).toEqual({
      masterVolume: 1,
      bgmVolume: 0,
      sfxVolume: 0.64,
      muted: true,
    });
    expect(seen).toEqual([true]);
    expect(JSON.parse(storage.get(AUDIO_PREFS_STORAGE_KEY)!)).toEqual(engine.getSettings());

    await engine.unlock();
    bus.emit('onBgmContext', { scene: 'match', roundIndex: 7, totalRounds: 8, phase: 'learning' });
    expect(engine.getActiveBgmTrack()).toBe('late');
    expect(engine.isFocusDucking()).toBe(true);

    bus.emit('onBgmContext', { scene: 'match', roundIndex: 7, totalRounds: 8, phase: 'strategy' });
    expect(engine.isFocusDucking()).toBe(false);

    bus.emit('onShopAction', { action: 'reroll' });
    bus.emit('onCombatHit', { damageType: 'physical' });
    bus.emit('onLearningFeedback', { correct: true });
    bus.emit('onUiFeedback', { kind: 'trait_up' });
    bus.emit('onUiFeedback', { kind: 'victory_fanfare' });
    engine.playPreviewSfx();

    unsub();
    engine.dispose();

    const nullBus = new AudioEventBus();
    nullBus.setAdapter(NullAudioAdapter);
    nullBus.emit('onBgmContext', { scene: 'lobby' });
  });

  it('drives Web Audio bus, focus lowpass ducking, crossfade, and hit cooldown with mocked AudioContext', async () => {
    const createdGains: Array<{ gain: ReturnType<typeof createFakeAudioParam>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
    const createdFilters: Array<{ type: string; Q: ReturnType<typeof createFakeAudioParam>; frequency: ReturnType<typeof createFakeAudioParam>; connect: ReturnType<typeof vi.fn> }> = [];
    const createdSources: Array<{ buffer: unknown; loop: boolean; playbackRate: ReturnType<typeof createFakeAudioParam>; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: (() => void) | null }> = [];

    function MockAudioContext() {
      return {
        state: 'running',
        currentTime: 10,
        destination: {},
        resume: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        decodeAudioData: vi.fn().mockResolvedValue({ duration: 4 }),
        createDynamicsCompressor: () => ({
          threshold: createFakeAudioParam(-12),
          knee: createFakeAudioParam(18),
          ratio: createFakeAudioParam(4),
          attack: createFakeAudioParam(0.005),
          release: createFakeAudioParam(0.15),
          connect: vi.fn(),
        }),
        createGain: () => {
          const g = {
            gain: createFakeAudioParam(1),
            connect: vi.fn(),
            disconnect: vi.fn(),
          };
          createdGains.push(g);
          return g;
        },
        createBiquadFilter: () => {
          const f = {
            type: 'lowpass',
            Q: createFakeAudioParam(0.7),
            frequency: createFakeAudioParam(20000),
            connect: vi.fn(),
          };
          createdFilters.push(f);
          return f;
        },
        createBufferSource: () => {
          const s = {
            buffer: null,
            loop: false,
            playbackRate: createFakeAudioParam(1),
            connect: vi.fn(),
            disconnect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            onended: null as (() => void) | null,
          };
          createdSources.push(s);
          return s;
        },
      };
    }

    vi.stubGlobal('window', {
      AudioContext: MockAudioContext,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      }),
    );

    const engine = new WebAudioEngine();
    engine.onBgmContext({ scene: 'match', roundIndex: 1, totalRounds: 8, phase: 'strategy' });
    await vi.waitFor(() => expect(createdSources.length).toBe(1));
    expect(createdFilters[0]!.frequency.value).toBe(20000);

    engine.onBgmContext({ scene: 'match', roundIndex: 1, totalRounds: 8, phase: 'learning' });
    expect(createdFilters[0]!.frequency.value).toBe(1100);
    expect(createdGains[2]!.gain.value).toBeCloseTo(0.42, 4);

    engine.onBgmContext({ scene: 'match', roundIndex: 7, totalRounds: 8, phase: 'battle', isOvertime: true });
    expect(createdFilters[0]!.frequency.value).toBe(20000);
    expect(createdGains[2]!.gain.value).toBeCloseTo(1.0, 4);
    await vi.waitFor(() => expect(createdSources.length).toBe(2));

    const beforeSfx = createdSources.length;
    engine.onCombatHit({ damageType: 'physical' });
    engine.onCombatHit({ damageType: 'physical' });
    await vi.waitFor(() => expect(createdSources.length).toBe(beforeSfx + 1));

    engine.dispose();
  });
});
