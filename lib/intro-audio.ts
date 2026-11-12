import { AUDIO_ASSETS, audioEvents, remainingEvent, type IntroTiming } from './intro-timing';

type Envelope = [number, number][];
const sampleEnvelope = (points: Envelope, time: number) => {
  if (time <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (time <= points[i][0]) {
      const [a, av] = points[i - 1]; const [b, bv] = points[i];
      return av + (bv - av) * (time - a) / Math.max(.001, b - a);
    }
  }
  return points[points.length - 1][1];
};

/** All sources are scheduled once on one audio clock. No audio setTimeouts. */
export class IntroAudio {
  private context?: AudioContext;
  private buffers?: {music: AudioBuffer; engine: AudioBuffer; beep: AudioBuffer};
  private loading?: Promise<void>;
  private nodes: AudioNode[] = [];
  private sources: AudioBufferSourceNode[] = [];
  private master?: GainNode;
  private origin = 0;
  private offset = 0;
  private end = 0;
  private active = false;
  private generation = 0;

  private async prepare() {
    this.context ??= new AudioContext({latencyHint: 'interactive'});
    // Resume within the click gesture, before waiting for network/decode.
    await this.context.resume();
    const context = this.context;
    this.loading ??= (async () => {
      const read = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Chargement audio impossible (${response.status}).`);
        return context.decodeAudioData(await response.arrayBuffer());
      };
      const [music, engine] = await Promise.all([read(AUDIO_ASSETS.music), read(AUDIO_ASSETS.engine)]);
      const beep = context.createBuffer(2, Math.round(.26 * context.sampleRate), context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = beep.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
          const t = i / context.sampleRate;
          for (const [delay, gain] of [[0, .14], [.045, .018], [.09, .008]]) {
            const u = t - delay;
            if (u >= 0 && u < .15) {
              const env = Math.min(u / .003, 1) * Math.min((.15 - u) / .025, 1);
              data[i] += (.83 * Math.sin(2 * Math.PI * 880 * u) + .17 * Math.sin(2 * Math.PI * 1760 * u)) * env * gain;
            }
          }
        }
      }
      this.buffers = {music, engine, beep};
    })().catch((error) => { this.loading = undefined; throw error; });
    await this.loading;
  }

  async play(timing: IntroTiming, from = 0, muted = false) {
    this.pause();
    const generation = this.generation;
    await this.prepare();
    if (generation !== this.generation) return false;
    const context = this.context!; const buffers = this.buffers!;
    this.offset = Math.max(0, Math.min(from, timing.end));
    this.end = timing.end + Math.max(0, timing.visualOffset);
    this.origin = context.currentTime + .08;
    this.active = true;
    const master = context.createGain();
    // Soft clipping without the compressor's look-ahead latency.
    const limiter = context.createWaveShaper();
    limiter.curve = Float32Array.from({length: 4096}, (_, i) => Math.tanh((i / 4095 * 2 - 1) * 1.15));
    master.gain.value = muted ? 0 : .8;
    limiter.connect(master); master.connect(context.destination);
    this.master = master; this.nodes.push(master, limiter);
    const fromSec = this.offset / 1000; const end = timing.end / 1000;
    const release = timing.release / 1000; const engineAt = timing.engineAt / 1000;
    const envelope = (points: Envelope, gain = 1) => {
      const node = context.createGain();
      node.gain.setValueAtTime(sampleEnvelope(points, fromSec) * gain, this.origin);
      for (const [time, value] of points) {
        if (time > fromSec) node.gain.linearRampToValueAtTime(value * gain, this.origin + time - fromSec);
      }
      node.connect(limiter); this.nodes.push(node); return node;
    };
    const start = (buffer: AudioBuffer, at: number, sourceOffset: number, duration: number, output: AudioNode) => {
      const skip = Math.max(0, fromSec - at);
      const offset = sourceOffset + skip;
      const count = Math.min(duration - skip, buffer.duration - offset, end - Math.max(fromSec, at));
      if (count <= 0) return;
      const source = context.createBufferSource(); source.buffer = buffer;
      source.connect(output); this.sources.push(source);
      source.start(this.origin + Math.max(0, at - fromSec), offset, count);
    };
    // Preserve the supplied composition through the launch and its resolution.
    // Optional gap mutes a small window, then resumes at the same musical position.
    const musicAt = timing.musicOffset / 1000;
    const musicEnd = Math.min(end, musicAt + timing.musicDuration / 1000);
    const musicPoints: Envelope = [[musicAt, 0], [musicAt + .005, 1],
      [Math.max(musicAt + .005, musicEnd - .08), 1], [musicEnd, 0]];
    if (timing.musicGap > 0) {
      // Multiply the optional suspension by the clip envelope, without changing the source clock.
      const gap = timing.musicGap / 1000;
      const points = [...musicPoints.map(([time]) => time), release - gap - .12, release - gap, release, release + .12]
        .filter((time) => time >= musicAt && time <= musicEnd).sort((a, b) => a - b);
      const suspension: Envelope = [[release - gap - .12, 1], [release - gap, 0], [release, 0], [release + .12, 1]];
      const combined: Envelope = points.map((time) => [time, sampleEnvelope(musicPoints, time) * sampleEnvelope(suspension, time)]);
      musicPoints.splice(0, musicPoints.length, ...combined);
    }
    const music = envelope(musicPoints, timing.musicVolume);
    start(buffers.music, musicAt, timing.musicSource / 1000, timing.musicDuration / 1000, music);

    // The engine begins with the animation; its cue is independent of lights-out.
    const motorEnd = Math.min(end, engineAt + timing.engineDuration / 1000);
    const motor = envelope([[engineAt, 0], [engineAt + .005, 1], [Math.max(engineAt + .005, motorEnd - .08), 1], [motorEnd, 0]], timing.engineVolume * 1.2);
    const beeps = envelope([[0, timing.beepVolume], [end, timing.beepVolume]]);
    for (const event of audioEvents(timing)) {
      // Exact same event map is used by the editor and seek tests.
      if (!remainingEvent(event, this.offset)) continue;
      start(event.kind === 'beep' ? buffers.beep : buffers.engine,
        event.at / 1000, event.source / 1000, event.duration / 1000,
        event.kind === 'beep' ? beeps : motor);
    }
    return true;
  }

  get position() {
    if (!this.active || !this.context) return this.offset;
    const context = this.context;
    const stamp = context.getOutputTimestamp?.();
    // Align the picture with samples reaching the output, not the render-ahead clock.
    // https://www.w3.org/TR/webaudio/#dom-audiocontext-getoutputtimestamp
    const audible = stamp && typeof stamp.performanceTime === 'number' && stamp.performanceTime > 0 && typeof stamp.contextTime === 'number'
      ? stamp.contextTime + Math.max(0, performance.now() - stamp.performanceTime) / 1000
      : context.currentTime - (context.outputLatency || context.baseLatency || 0);
    return Math.max(this.offset, Math.min(this.end, this.offset + (audible - this.origin) * 1000));
  }
  mute(muted: boolean) {
    if (this.master && this.context) this.master.gain.setTargetAtTime(muted ? 0 : .8, this.context.currentTime, .01);
  }
  pause() {
    const position = this.position;
    this.generation++;
    this.active = false;
    this.offset = position;
    for (const source of this.sources) { try { source.stop(); } catch { /* Already ended. */ } source.disconnect(); }
    for (const node of this.nodes) node.disconnect();
    this.sources = []; this.nodes = []; this.master = undefined;
    return position;
  }
  async dispose() {
    this.pause();
    await this.context?.close();
    this.context = undefined; this.loading = undefined; this.buffers = undefined;
  }
}
