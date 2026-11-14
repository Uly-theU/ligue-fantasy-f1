import { compileTiming, sanitizeSettings, type IntroSettings } from './intro-timing';

export type MediaClip = {id: string; name: string; kind: 'image' | 'video'; at: number; source: number; duration: number; available: number; url: string};
export type StoredClip = Omit<MediaClip, 'url'> & {file: Blob};
export type AudioTrack = 'music' | 'engine' | 'beep';
export type Selection = AudioTrack | 'lights' | 'sequence' | string;
export type AudioClip = {at: number; source: number; duration: number; available: number};
export function audioClip(settings: IntroSettings, track: 'music' | 'engine'): AudioClip {
  return track === 'music'
    ? {at: settings.musicOffset, source: settings.musicSource, duration: settings.musicDuration, available: 12000}
    : {at: settings.engineOffset, source: settings.engineSource, duration: settings.engineDuration, available: 10000};
}
export function editAudioClip(settings: IntroSettings, track: 'music' | 'engine', patch: Partial<AudioClip>) {
  const clip = {...audioClip(settings, track), ...patch};
  return sanitizeSettings({...settings, [`${track}Offset`]: clip.at, [`${track}Source`]: clip.source, [`${track}Duration`]: clip.duration});
}
/** Inserting anticipation keeps the engine anchored to the beginning. */
export function delayDeparture(settings: IntroSettings, delta: number, moveMusic = false) {
  const result = sanitizeSettings({...settings, hold: settings.hold + delta});
  const actualDelta = compileTiming(result).release - compileTiming(settings).release;
  return sanitizeSettings({...result, musicOffset: settings.musicOffset + (moveMusic ? actualDelta : 0)});
}
/** Both trims preserve source bounds; a left trim keeps the opposite edge fixed. */
export function dragClip(clip: AudioClip, mode: 'move' | 'left' | 'right', delta: number): AudioClip {
  if (mode === 'move') return {...clip, at: Math.max(0, clip.at + delta)};
  if (mode === 'right') return {...clip, duration: Math.max(100, Math.min(clip.available - clip.source, clip.duration + delta))};
  const change = Math.max(-clip.at, -clip.source, Math.min(clip.duration - 100, delta));
  return {...clip, at: clip.at + change, source: clip.source + change, duration: clip.duration - change};
}
export function timecode(ms: number) {
  const value = Math.max(0, Math.round(ms));
  return `${String(Math.floor(value / 60000)).padStart(2, '0')}:${String(Math.floor(value / 1000) % 60).padStart(2, '0')}.${String(value % 1000).padStart(3, '0')}`;
}

// Store original local files, not temporary blob URLs, so a reload can restore the cut.
const DB = 'fantasy-f1-intro-studio';
async function mediaDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('media', {keyPath: 'id'});
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readMedia(): Promise<StoredClip[]> {
  const db = await mediaDB();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('media').objectStore('media').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function saveMedia(clips: StoredClip[]) {
  const db = await mediaDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('media', 'readwrite');
      const store = tx.objectStore('media'); store.clear(); clips.forEach((clip) => store.put(clip));
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
