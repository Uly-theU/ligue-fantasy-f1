import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntroAudio } from '@/lib/intro-audio';
import { compileTiming, DEFAULT_SETTINGS } from '@/lib/intro-timing';

const musicBuffer = {duration: 12};
const engineBuffer = {duration: 10};
function parameter() { return {value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn()}; }
function node() { return {connect: vi.fn(), disconnect: vi.fn()}; }
function sourceNode() { return {...node(), buffer: null as unknown, start: vi.fn(), stop: vi.fn()}; }
class Context {
  static latest: Context;
  currentTime = 20;
  sampleRate = 44100;
  baseLatency = .01;
  outputLatency = .02;
  destination = node();
  sources: ReturnType<typeof sourceNode>[] = [];
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
  decodeAudioData = vi.fn(async (bytes: ArrayBuffer) => new Uint8Array(bytes)[0] === 1 ? musicBuffer : engineBuffer);
  getOutputTimestamp = vi.fn(() => ({contextTime: 20, performanceTime: performance.now()}));
  constructor() { Context.latest = this; }
  createGain() { return {...node(), gain: parameter()}; }
  createWaveShaper() { return {...node(), curve: new Float32Array()}; }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({length: channels}, () => new Float32Array(length));
    return {duration: length / sampleRate, getChannelData: (channel: number) => data[channel]};
  }
  createBufferSource() {
    const source = sourceNode();
    this.sources.push(source);
    return source;
  }
}

beforeEach(() => {
  vi.stubGlobal('AudioContext', Context);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ok: true, arrayBuffer: async () => Uint8Array.of(url.includes('music') ? 1 : 2).buffer})));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('transport sonore de l’intro', () => {
  it('programme cinq bips et le moteur sur le même départ audio futur', async () => {
    const player = new IntroAudio(); const timing = compileTiming(DEFAULT_SETTINGS);
    expect(await player.play(timing)).toBe(true);
    const context = Context.latest;
    const beeps = context.sources.filter((source) => source.buffer !== musicBuffer && source.buffer !== engineBuffer);
    expect(beeps).toHaveLength(5);
    beeps.forEach((source, index) => expect(source.start.mock.calls[0][0]).toBeCloseTo(20.08 + timing.lights[index] / 1000, 6));
    const musical = context.sources.find((source) => source.buffer === musicBuffer)!;
    expect(musical.start.mock.calls[0][2]).toBe(12);
    const launch = context.sources.at(-1)!;
    expect(launch.buffer).toBe(engineBuffer);
    expect(launch.start.mock.calls[0][0]).toBeCloseTo(20.08, 6);
    expect(launch.start.mock.calls[0][1]).toBe(0);
    expect(launch.start.mock.calls[0][0]).toBe(musical.start.mock.calls[0][0]);
    expect(launch.start.mock.calls[0][2]).toBe(10);
    player.pause();
    context.sources.forEach((source) => expect(source.stop).toHaveBeenCalledOnce());
  });
  it('reprend dans le moteur sans réémettre les cinq bips', async () => {
    const player = new IntroAudio(); const timing = compileTiming(DEFAULT_SETTINGS);
    await player.play(timing, timing.release + 600);
    const context = Context.latest;
    expect(context.sources.filter((source) => source.buffer !== musicBuffer && source.buffer !== engineBuffer)).toHaveLength(0);
    expect(context.sources.at(-1)!.start.mock.calls[0][1]).toBeCloseTo(5.6, 6);
    const musical = context.sources.find((source) => source.buffer === musicBuffer)!;
    expect(musical.start.mock.calls[0][1]).toBeCloseTo(5.6, 6);
  });
  it('cale la position visuelle sur la sortie audio et non sur le calcul en avance', async () => {
    const player = new IntroAudio(); await player.play(compileTiming(DEFAULT_SETTINGS));
    const context = Context.latest;
    context.currentTime = 24.1;
    context.getOutputTimestamp.mockImplementation(() => ({contextTime: 24, performanceTime: performance.now()}));
    expect(player.position).toBeCloseTo(3920, 0);
    expect(player.pause()).toBeCloseTo(3920, 0);
    expect(player.position).toBeCloseTo(3920, 0);
  });
  it('respecte le déplacement et les coupes des pistes, y compris lors d’une reprise', async () => {
    const player = new IntroAudio();
    const timing = compileTiming({...DEFAULT_SETTINGS, musicOffset: 2000, musicSource: 1000, musicDuration: 5000,
      engineOffset: 1000, engineSource: 2000, engineDuration: 3000});
    await player.play(timing, 3000);
    const context = Context.latest;
    const music = context.sources.find((source) => source.buffer === musicBuffer)!;
    const engine = context.sources.find((source) => source.buffer === engineBuffer)!;
    expect(music.start.mock.calls[0]).toEqual([20.08, 2, 4]);
    expect(engine.start.mock.calls[0]).toEqual([20.08, 4, 1]);
    const count = context.sources.length;
    await player.play(timing, 8000);
    expect(context.sources.slice(count)).toHaveLength(0);
  });
});
