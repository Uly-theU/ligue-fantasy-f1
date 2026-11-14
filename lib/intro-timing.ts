import BASE from '@/components/fx/start-timing.json';

export const PREVIEW_KEY = 'f1-intro-timing-preview-elevenlabs-v2';
export const DRAFT_KEY = 'f1-intro-timing-draft-elevenlabs-v2';
export type IntroSettings = {
  firstLight: number; interval: number; hold: number; tail: number;
  engineOffset: number; engineSource: number; visualOffset: number; musicGap: number;
  musicVolume: number; engineVolume: number; beepVolume: number;
  musicOffset: number; musicSource: number; musicDuration: number; engineDuration: number;
};
export const DEFAULT_SETTINGS: IntroSettings = {
  // First pass anchored to the uploaded music's impact at ~5s.
  firstLight: 500, interval: 750, hold: 1500, tail: 7000,
  engineOffset: 0, engineSource: 0, visualOffset: 0, musicGap: 0,
  musicVolume: .65, engineVolume: .55, beepVolume: .65,
  musicOffset: 0, musicSource: 0, musicDuration: 12000, engineDuration: 10000,
};
export const AUDIO_ASSETS = {
  music: '/audio/intro/elevenlabs-music-v1.wav',
  engine: '/audio/intro/elevenlabs-engine-v1.wav',
  musicDuration: 12000, engineDuration: 10000,
  musicLabel: 'Lights Out Grid · 12 s', engineLabel: 'Moteur ElevenLabs · 10 s',
};
const LIMITS: Record<keyof IntroSettings, [number, number]> = {
  firstLight: [300, 60000], interval: [100, 5000], hold: [100, 60000], tail: [500, 60000],
  engineOffset: [0, 180000], engineSource: [0, 8000], visualOffset: [-250, 250], musicGap: [0, 700],
  musicVolume: [0, 1.2], engineVolume: [0, 1.2], beepVolume: [0, 1.2],
  musicOffset: [0, 180000], musicSource: [0, 11900], musicDuration: [100, 12000], engineDuration: [100, 10000],
};
export function sanitizeSettings(input: unknown): IntroSettings {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const result = Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([name, fallback]) => {
    const key = name as keyof IntroSettings;
    const value = source[key]; const [min, max] = LIMITS[key];
    return [key, typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback];
  })) as IntroSettings;
  result.musicDuration = Math.min(result.musicDuration, AUDIO_ASSETS.musicDuration - result.musicSource);
  result.engineDuration = Math.min(result.engineDuration, AUDIO_ASSETS.engineDuration - result.engineSource);
  return result;
}
export function compileTiming(input: IntroSettings) {
  const settings = sanitizeSettings(input);
  const lights = Array.from({length: 5}, (_, i) => settings.firstLight + i * settings.interval);
  const release = lights[4] + settings.hold;
  const end = release + settings.tail;
  const before = [0, ...BASE.lights, BASE.release, BASE.end];
  const after = [0, ...lights, release, end];
  function remap(ms: number) {
    const i = Math.min(before.length - 2, before.findIndex((stop) => stop > ms) - 1);
    const index = i < 0 ? before.length - 2 : i;
    return after[index] + (ms - before[index]) / (before[index + 1] - before[index]) * (after[index + 1] - after[index]);
  }
  return {
    ...settings, lights, release, end, engineAt: settings.engineOffset,
    shots: BASE.shots.map((shot) => ({...shot, at: remap(shot.at)})), holdAt: remap(7450),
  };
}
export type IntroTiming = ReturnType<typeof compileTiming>;
export function visualState(audioMs: number, timing: IntroTiming) {
  // Positive correction delays the picture relative to the sound.
  const time = Math.max(0, audioMs - timing.visualOffset);
  const released = time >= timing.release;
  const shotIndex = timing.shots.reduce((latest, shot, i) => time >= shot.at ? i : latest, 0);
  return {time, released, lit: released ? 0 : timing.lights.filter((cue) => time >= cue).length, shotIndex};
}
export type AudioEvent = {kind: 'beep' | 'engine'; at: number; duration: number; source: number};
export function audioEvents(timing: IntroTiming): AudioEvent[] {
  return [
    ...timing.lights.map((at) => ({kind: 'beep' as const, at, duration: 260, source: 0})),
    {kind: 'engine', at: timing.engineAt, duration: Math.max(0, Math.min(timing.end - timing.engineAt, timing.engineDuration)), source: timing.engineSource},
  ];
}
/** Resume mid-event without replaying cues that have already ended. */
export function remainingEvent(event: AudioEvent, from: number) {
  const skip = Math.max(0, from - event.at);
  if (skip >= event.duration) return null;
  return {delay: Math.max(0, event.at - from), offset: event.source + skip, duration: event.duration - skip};
}
