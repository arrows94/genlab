import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Minimal Web Audio stand-in: every node accepts any call, every param any automation. */
function fakeAudio() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  const node = (): unknown =>
    new Proxy({} as Record<string | symbol, unknown>, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === 'connect') return (to: unknown) => to;
        if (key === 'then') return undefined;
        if (['gain', 'frequency', 'detune', 'Q', 'playbackRate'].includes(String(key))) return (target[key] = param());
        return () => {};
      },
      set(target, key, value) {
        target[key] = value;
        return true;
      },
    });
  return {
    currentTime: 0,
    state: 'running',
    sampleRate: 8000,
    destination: node(),
    createGain: node,
    createOscillator: node,
    createBiquadFilter: node,
    createConvolver: node,
    createBufferSource: node,
    createBuffer: (_ch: number, frames: number) => ({ getChannelData: () => new Float32Array(frames) }),
    resume: async () => {},
  };
}

vi.mock('../src/ui/sound', () => {
  const ctx = fakeAudio();
  return { audioContext: () => ctx };
});

describe('background music', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });
  afterEach(() => vi.useRealTimers());

  it('switches the mood even when the app calls it on every frame (tester had to toggle the music)', async () => {
    const { setMusic, currentMood } = await import('../src/ui/music');
    setMusic(true, 0.5, 'lab');
    expect(currentMood()).toBe('lab');
    // App.svelte used to rerun its effect every 100 ms, which restarted the switch delay forever.
    for (let i = 0; i < 20; i++) {
      setMusic(true, 0.5, 'breeding');
      vi.advanceTimersByTime(100);
    }
    expect(currentMood()).toBe('breeding');
    setMusic(false, 0.5, 'breeding');
  });

  it('keeps the track when flicking through tabs and back', async () => {
    const { setMusic, currentMood } = await import('../src/ui/music');
    setMusic(true, 0.5, 'lab');
    setMusic(true, 0.5, 'tower');
    vi.advanceTimersByTime(100);
    setMusic(true, 0.5, 'lab');
    vi.advanceTimersByTime(1000);
    expect(currentMood()).toBe('lab');
    // Silent music switches at once.
    setMusic(false, 0.5, 'lab');
    setMusic(false, 0.5, 'aeon');
    expect(currentMood()).toBe('aeon');
  });

  /** Oscillators the first segment of a mood starts (randomness pinned). */
  async function oscillatorsFor(mood: 'cellar' | 'cellarBoss', depth: number, danger: number): Promise<number> {
    vi.resetModules();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const sound = (await import('../src/ui/sound')) as unknown as { audioContext: () => { createOscillator: () => unknown } };
    const ctx = sound.audioContext();
    const original = ctx.createOscillator;
    let count = 0;
    ctx.createOscillator = () => {
      count++;
      return original();
    };
    const { setMusic, setCellarAtmosphere, currentMood } = await import('../src/ui/music');
    setCellarAtmosphere(depth, danger);
    setMusic(true, 0.5, mood);
    expect(currentMood()).toBe(mood);
    setMusic(false, 0.5, mood);
    ctx.createOscillator = original;
    random.mockRestore();
    return count;
  }

  it('the Keller track grows darker with depth and gets a heartbeat when the team is in danger', async () => {
    const calm = await oscillatorsFor('cellar', 0, 0);
    expect(calm).toBeGreaterThan(0);
    expect(await oscillatorsFor('cellar', 1, 0)).toBeGreaterThan(calm);
    expect(await oscillatorsFor('cellar', 0, 1)).toBeGreaterThan(calm);
    // The shadow's track always has its heartbeat and the bent Brutstation tune.
    expect(await oscillatorsFor('cellarBoss', 0, 0)).toBeGreaterThan(calm);
  });
});
