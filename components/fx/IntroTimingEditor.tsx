'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Plus, Upload, Undo2, Redo2, Film, Music2, Gauge, Flag, Trash2, Download, Magnet } from 'lucide-react';
import { IntroAudio } from '@/lib/intro-audio';
import { AUDIO_ASSETS, compileTiming, DEFAULT_SETTINGS, DRAFT_KEY, PREVIEW_KEY, sanitizeSettings, visualState, type IntroSettings } from '@/lib/intro-timing';
import { audioClip, editAudioClip, delayDeparture, dragClip, timecode, readMedia, saveMedia, type AudioTrack, type MediaClip, type StoredClip } from '@/lib/intro-studio';

type Project = {settings: IntroSettings; clips: MediaClip[]};
type Status = 'idle' | 'loading' | 'playing' | 'paused';
type Drag = {x: number; original: Project; target: string; mode: 'move' | 'left' | 'right'; scale: number; moved: boolean};
const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const names = {music: 'Musique', engine: 'Moteur', beep: 'Bips'};
const volumeKey = (track: AudioTrack) => `${track}Volume` as 'musicVolume' | 'engineVolume' | 'beepVolume';
function Field({label, value, onChange, min = 0, max = 180000}: {label: string; value: number; onChange: (n: number) => void; min?: number; max?: number}) {
  return <label className="studio-field"><span>{label}</span><div><input type="number" aria-label={label} value={Number((value / 1000).toFixed(3))} step={.01} min={min / 1000} max={max / 1000} onChange={(e) => { if (e.target.value !== '' && Number.isFinite(e.target.valueAsNumber)) onChange(Math.round(e.target.valueAsNumber * 1000)); }} /><small>s</small></div></label>;
}
function Waveform({peaks, source, duration, available}: {peaks?: number[]; source: number; duration: number; available: number}) {
  return <svg className="studio-waveform" viewBox={`0 0 ${Math.max(1, peaks?.length ?? 100) * duration / available} 40`} preserveAspectRatio="none" aria-hidden>
    <g transform={`translate(-${source / available * (peaks?.length ?? 100)},0)`}>{peaks?.map((v, i) => <path key={i} d={`M${i},${20 - v * 18}V${20 + v * 18}`} />)}</g>
  </svg>;
}

export function IntroTimingEditor() {
  const [settings, setSettings] = useState<IntroSettings>(DEFAULT_SETTINGS);
  const [clips, setClips] = useState<MediaClip[]>([]);
  const timing = useMemo(() => compileTiming(settings), [settings]);
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [muted, setMuted] = useState(false);
  const [loop, setLoop] = useState(false);
  const [solo, setSolo] = useState<AudioTrack | null>(null);
  const [selection, setSelection] = useState('sequence');
  const [zoom, setZoom] = useState(1);
  const [snap, setSnap] = useState(true);
  const [moveMusic, setMoveMusic] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [importing, setImporting] = useState(false);
  const [peaks, setPeaks] = useState<Partial<Record<'music' | 'engine', number[]>>>({});
  const [historySize, setHistorySize] = useState([0, 0]);
  const history = useRef<{past: Project[]; future: Project[]}>({past: [], future: []});
  const project = useRef<Project>({settings, clips}); project.current = {settings, clips};
  const transport = useRef<IntroAudio | null>(null);
  const frame = useRef(0); const request = useRef(0);
  const loopRef = useRef(loop); loopRef.current = loop;
  const drag = useRef<Drag | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const fileStore = useRef(new Map<string, Blob>());
  const urls = useRef(new Set<string>());
  const saving = useRef<Promise<void>>(Promise.resolve());
  const volumes = useRef({music: .65, engine: .55, beep: .65});
  const state = visualState(cursor, timing);
  const playing = status === 'playing';
  const activeClip = [...clips].reverse().find((clip) => cursor >= clip.at && cursor < clip.at + clip.duration);
  const selectedMedia = clips.find((clip) => clip.id === selection);
  const selectedAudio = selection === 'music' || selection === 'engine' ? audioClip(settings, selection) : undefined;
  const extent = Math.max(timing.end, ...clips.map((c) => c.at + c.duration), settings.musicOffset + settings.musicDuration, settings.engineOffset + settings.engineDuration);
  const rulerEnd = Math.ceil((extent + 1000) / 1000) * 1000;
  const tickStep = rulerEnd > 60000 ? 10000 : rulerEnd > 25000 ? 5000 : 1000;

  useEffect(() => {
    try { const draft = sessionStorage.getItem(DRAFT_KEY); if (draft) setSettings(sanitizeSettings(JSON.parse(draft))); } catch { /* Optional draft. */ }
    setReady(true);
    let cancelled = false;
    void readMedia().then((stored) => {
      if (cancelled) return;
      setClips(stored.map(({file, ...clip}) => {
        fileStore.current.set(clip.id, file);
        const url = URL.createObjectURL(file); urls.current.add(url);
        return {...clip, url};
      }));
    }).catch(() => { if (!cancelled) setNotice('Stockage des médias indisponible : les imports resteront disponibles jusqu’à la fermeture de la page.'); })
      .finally(() => { if (!cancelled) setMediaReady(true); });
    return () => {
      cancelled = true; request.current++; cancelAnimationFrame(frame.current);
      const player = transport.current; transport.current = null; void player?.dispose();
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    if (ready) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(settings)); } catch { setNotice('Sauvegarde des réglages indisponible. Exporte-les pour conserver cette prise.'); } }
  }, [settings, ready]);
  useEffect(() => {
    if (!mediaReady) return;
    const stored: StoredClip[] = clips.flatMap(({url: _url, ...clip}) => {
      const file = fileStore.current.get(clip.id); return file ? [{...clip, file}] : [];
    });
    const timer = window.setTimeout(() => {
      saving.current = saving.current.catch(() => {}).then(() => saveMedia(stored)).catch(() => setNotice('Les médias n’ont pas pu être sauvegardés. Garde cette page ouverte pour conserver le montage.'));
    }, 250);
    return () => clearTimeout(timer);
  }, [clips, mediaReady]);
  useEffect(() => {
    let cancelled = false;
    const context = new AudioContext();
    void Promise.all((['music', 'engine'] as const).map(async (track) => {
      const response = await fetch(AUDIO_ASSETS[track]);
      if (!response.ok) throw new Error('Waveform');
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      const data = buffer.getChannelData(0); const count = 240;
      const values = Array.from({length: count}, (_, i) => {
        let peak = 0; const stop = Math.floor((i + 1) * data.length / count);
        for (let j = Math.floor(i * data.length / count); j < stop; j += 8) peak = Math.max(peak, Math.abs(data[j]));
        return peak;
      });
      const max = Math.max(.01, ...values);
      if (!cancelled) setPeaks((p) => ({...p, [track]: values.map((v) => v / max)}));
    })).catch(() => { /* Waveform is optional; playback reports audio failures. */ }).finally(() => { void context.close(); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const hide = () => { if (document.hidden) pause(); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useEffect(() => {
    const element = video.current;
    if (!element || activeClip?.kind !== 'video') return;
    const target = (activeClip.source + cursor - activeClip.at) / 1000;
    if (Number.isFinite(element.duration) && Math.abs(element.currentTime - target) > (playing ? .12 : .001)) element.currentTime = Math.min(element.duration, Math.max(0, target));
    if (playing) { void element.play().catch(() => {}); } else element.pause();
  }, [cursor, playing, activeClip]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest('input,textarea,select,button,a')) return;
      if (e.code === 'Space') { e.preventDefault(); if (playing) pause(); else void play(cursor >= timing.end ? 0 : cursor); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); seek(cursor + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1000 : 10)); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(e.shiftKey); }
    }
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
  });

  function pause() {
    request.current++; cancelAnimationFrame(frame.current);
    const time = transport.current?.pause();
    if (time !== undefined && status === 'playing') setCursor(time);
    video.current?.pause(); setStatus('paused');
  }
  function seek(time: number) { pause(); setCursor(Math.max(0, Math.min(timing.end, time))); }
  function remember() {
    history.current.past.push(project.current);
    if (history.current.past.length > 80) history.current.past.shift();
    history.current.future = []; setHistorySize([history.current.past.length, 0]);
  }
  function apply(next: Project, record = true) {
    pause(); if (record) remember();
    setSettings(next.settings); setClips(next.clips); setError(''); setNotice('');
    setCursor((time) => Math.min(time, compileTiming(next.settings).end));
  }
  function update(patch: Partial<IntroSettings>) { apply({...project.current, settings: sanitizeSettings({...project.current.settings, ...patch})}); }
  function updateMedia(id: string, patch: Partial<MediaClip>) {
    apply({...project.current, clips: project.current.clips.map((c) => c.id === id ? {...c, ...patch} : c)});
  }
  function undo(redo = false) {
    const h = history.current; const source = redo ? h.future : h.past; const target = redo ? h.past : h.future;
    const previous = source.pop(); if (!previous) return;
    target.push(project.current); apply(previous, false); setHistorySize([h.past.length, h.future.length]);
  }
  async function play(from: number, until = timing.end) {
    pause(); const id = ++request.current;
    const player = transport.current ??= new IntroAudio();
    setStatus('loading'); setError('');
    const mixed = solo ? {...timing, musicVolume: solo === 'music' ? timing.musicVolume : 0, engineVolume: solo === 'engine' ? timing.engineVolume : 0, beepVolume: solo === 'beep' ? timing.beepVolume : 0} : timing;
    try {
      if (!await player.play(mixed, from, muted) || id !== request.current) return;
      setStatus('playing');
      const tick = () => {
        if (id !== request.current) return;
        const time = player.position; setCursor(time);
        if (time >= until) { player.pause(); setCursor(until); setStatus('paused'); if (loopRef.current) void play(from, until); return; }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    } catch {
      if (id !== request.current) return;
      player.pause(); setStatus('paused'); setError('Le son n’a pas pu démarrer. Vérifie le chargement des fichiers puis relance la lecture.');
    }
  }
  function delay(delta: number) { apply({...project.current, settings: delayDeparture(settings, delta, moveMusic)}); }
  function toggleTrack(track: AudioTrack) {
    const key = volumeKey(track);
    if (settings[key] > 0) { volumes.current[track] = settings[key]; update({[key]: 0}); }
    else update({[key]: volumes.current[track] || .65});
  }
  function beginDrag(e: ReactPointerEvent<HTMLElement>, target: string, mode: Drag['mode'] = 'move') {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation(); pause(); setSelection(target);
    const row = e.currentTarget.closest('.studio-lane') as HTMLElement;
    drag.current = {x: e.clientX, original: project.current, target, mode, scale: rulerEnd / row.getBoundingClientRect().width, moved: false};
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function dragging(e: ReactPointerEvent<HTMLElement>) {
    const d = drag.current; if (!d) return;
    const raw = (e.clientX - d.x) * d.scale;
    const delta = snap && !e.altKey ? Math.round(raw / 50) * 50 : Math.round(raw);
    if (!d.moved && delta === 0) return;
    if (!d.moved) { remember(); d.moved = true; }
    const original = d.original.settings;
    if (d.target === 'lights') setSettings(sanitizeSettings({...original, firstLight: original.firstLight + delta}));
    else if (d.target === 'release') setSettings(delayDeparture(original, delta, moveMusic));
    else if (d.target === 'music' || d.target === 'engine') {
      const clip = dragClip(audioClip(original, d.target), d.mode, delta);
      setSettings(editAudioClip(original, d.target, clip));
    } else {
      const clip = d.original.clips.find((c) => c.id === d.target); if (!clip) return;
      const imageLeft = Math.max(-clip.at, Math.min(clip.duration - 100, delta));
      const edited = clip.kind === 'image' && d.mode === 'left'
        ? {...clip, at: clip.at + imageLeft, duration: clip.duration - imageLeft}
        : dragClip(clip, d.mode, delta);
      setClips(d.original.clips.map((c) => c.id === clip.id ? {...c, ...edited} : c));
    }
  }
  function finishDrag() { drag.current = null; setCursor((time) => Math.min(time, compileTiming(project.current.settings).end)); }
  const dragEvents = {onPointerMove: dragging, onPointerUp: finishDrag, onPointerCancel: finishDrag};
  function clipKeyboard(e: React.KeyboardEvent, target: string) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); const amount = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1000 : 50);
    if (target === 'lights') update({firstLight: settings.firstLight + amount});
    else if (target === 'release') delay(amount);
    else if (target === 'music' || target === 'engine') apply({...project.current, settings: editAudioClip(settings, target, {at: Math.max(0, audioClip(settings, target).at + amount)})});
    else { const clip = clips.find((c) => c.id === target); if (clip) updateMedia(target, {at: Math.max(0, clip.at + amount)}); }
  }
  async function importMedia(files: FileList | null) {
    if (!files?.length) return;
    pause(); setImporting(true); setError(''); const added: MediaClip[] = []; const failures: string[] = [];
    let at = cursor;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { failures.push(file.name); continue; }
      const url = URL.createObjectURL(file); const kind = file.type.startsWith('video/') ? 'video' : 'image';
      try {
        const available = await new Promise<number>((resolve, reject) => {
          const timer = window.setTimeout(() => reject(new Error('Délai dépassé')), 15000);
          if (kind === 'video') {
            const media = document.createElement('video'); media.preload = 'metadata'; media.muted = true;
            const clean = () => { clearTimeout(timer); media.removeAttribute('src'); media.load(); };
            media.onloadedmetadata = () => { const duration = media.duration; clean(); Number.isFinite(duration) && duration > 0 ? resolve(Math.round(duration * 1000)) : reject(new Error('Durée invalide')); };
            media.onerror = () => { clean(); reject(new Error('Format vidéo')); }; media.src = url;
          } else {
            const image = new Image(); image.onload = () => { clearTimeout(timer); resolve(180000); };
            image.onerror = () => { clearTimeout(timer); reject(new Error('Format image')); }; image.src = url;
          }
        });
        const clip: MediaClip = {id: crypto.randomUUID(), name: file.name, kind, at, source: 0, duration: kind === 'image' ? 3000 : available, available, url};
        fileStore.current.set(clip.id, file); urls.current.add(url); added.push(clip); at += clip.duration;
      } catch { URL.revokeObjectURL(url); failures.push(file.name); }
    }
    if (added.length) {
      const current = project.current; const currentTiming = compileTiming(current.settings);
      apply({settings: sanitizeSettings({...current.settings, tail: Math.max(current.settings.tail, at - currentTiming.release)}), clips: [...current.clips, ...added]});
      setSelection(added[0].id); setNotice(`${added.length} média(s) ajouté(s). Les vidéos sont lues sans son. En cas de superposition, le dernier média ajouté est visible.`);
    }
    if (failures.length) setError(`Format non lisible : ${failures.join(', ')}. Essaie une image JPG/PNG ou une vidéo MP4 compatible avec le navigateur.`);
    setImporting(false); if (upload.current) upload.current.value = '';
  }
  function exportSettings() {
    const data = {version: 3, settings, visuals: clips.map(({url: _url, ...c}) => c)};
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'fantasy-f1-studio.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Réglages et liste des plans exportés en JSON. Les fichiers médias restent dans ce navigateur ; ce fichier n’est pas un rendu vidéo.');
  }
  function preview() {
    pause(); try { sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(settings)); location.assign('/'); }
    catch { setError('Impossible de transmettre les réglages à l’accueil.'); }
  }
  const positionStyle = (at: number, duration: number) => ({left: `${at / rulerEnd * 100}%`, width: `${duration / rulerEnd * 100}%`});
  function trimHandles(id: string) {
    return <><span className="studio-trim studio-trim-left" aria-hidden="true" onPointerDown={(e) => beginDrag(e, id, 'left')} {...dragEvents} /><span className="studio-trim studio-trim-right" aria-hidden="true" onPointerDown={(e) => beginDrag(e, id, 'right')} {...dragEvents} /></>;
  }

  return <div className="studio">
    <header className="studio-header"><div><p className="studio-eyebrow"><span /> FANTASY F1 / MOTION STUDIO</p><h1>Chaque milliseconde compte.</h1><p>Monte la tension. Cale le son. Déclenche le départ.</p></div><div className="studio-header-actions"><span className="studio-draft">Brouillon local</span><button onClick={exportSettings}><Download size={14} />Exporter les réglages</button><Link href="/">Quitter ↗</Link></div></header>
    <div className="studio-top">
      <section className="studio-monitor" aria-label="Moniteur de montage">
        <div className="studio-monitor-bar"><span><span className="studio-live-dot" />MONITEUR / {activeClip ? activeClip.kind === 'video' ? 'VIDÉO SANS SON' : 'IMAGE' : 'ANIMATIQUE'}</span><span>16:9 · AUDIO MAÎTRE</span></div>
        <div className="studio-screen" data-stage={state.released ? 'release' : 'hold'}>
          {activeClip && (activeClip.kind === 'image' ? <img className="studio-picture" src={activeClip.url} alt={activeClip.name} /> : <video className="studio-picture" key={activeClip.id} ref={video} src={activeClip.url} muted playsInline preload="auto" onLoadedMetadata={(e) => { e.currentTarget.currentTime = Math.max(0, (activeClip.source + cursor - activeClip.at) / 1000); if (playing) void e.currentTarget.play().catch(() => {}); }} />)}
          <div className="studio-screen-shade" />
          <div className="studio-screen-corner">F1 <span>/ INTRO SEQUENCE</span></div><div className="studio-countdown">{cursor < timing.release ? `DÉPART DANS ${seconds(timing.release - cursor)}` : 'DÉPART'}</div>
          {!activeClip && <div className="studio-empty-frame"><span>PLAN {String(state.shotIndex + 1).padStart(2, '0')}</span><p>{state.released ? 'LIGHTS OUT.' : state.lit === 5 ? 'HOLD YOUR BREATH.' : 'BEFORE THE RUSH.'}</p><small>Importe tes plans pour construire le montage.</small></div>}
          <div className="studio-lights" role="img" aria-label={state.released ? 'Feux éteints, départ' : `${state.lit} feux rouges sur 5`}>{timing.lights.map((_, i) => <span key={i} data-lit={i < state.lit}><i /><i /></span>)}</div>
          <div className="studio-screen-footer"><span>{activeClip?.name ?? 'ANIMATIQUE · REPÈRES DE RYTHME'}</span><output>{timecode(cursor)}</output></div>
        </div>
        <div className="studio-transport"><button className="studio-play" disabled={status === 'loading'} onClick={() => playing ? pause() : void play(cursor >= timing.end ? 0 : cursor)}>{playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}{status === 'loading' ? 'Préparation…' : playing ? 'Pause' : 'Lire'}</button><button onClick={() => seek(0)} aria-label="Revenir au début"><RotateCcw size={16} /></button><button onClick={() => void play(Math.max(0, timing.release - 1500), Math.min(timing.end, timing.release + 1500))}>Autour du départ</button><button onClick={() => { transport.current?.mute(!muted); setMuted(!muted); }} aria-label={muted ? 'Activer le son' : 'Couper le son'}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button><label><input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />Boucle</label><output className="studio-timecode" aria-label="Position de lecture">{timecode(cursor)}<small> / {timecode(timing.end)}</small></output></div>
        <label className="studio-seek"><span className="sr-only">Position dans la séquence</span><input type="range" aria-label="Position dans la séquence" min={0} max={timing.end} step={10} value={Math.min(cursor, timing.end)} onChange={(e) => seek(Number(e.target.value))} /></label>
      </section>
      <aside className="studio-inspector" aria-label="Inspecteur du montage">
        <div className="studio-panel-heading"><span>INSPECTEUR</span><button onClick={() => setSelection('sequence')} aria-pressed={selection === 'sequence'}><Flag size={13} />Séquence</button></div>
        <div className="studio-launch-clock"><span>DÉPART / EXTINCTION DES FEUX</span><strong>{timecode(timing.release)}</strong><div><button onClick={() => delay(1000)}><Plus size={13} />1 seconde</button><button onClick={() => delay(3000)}><Plus size={13} />3 secondes</button></div><label className="studio-check"><input type="checkbox" checked={moveMusic} onChange={(e) => setMoveMusic(e.target.checked)} />Décaler aussi la musique</label></div>
        <div className="studio-properties">
          {(selection === 'sequence' || selection === 'lights' || selection === 'release') && <><h2>{selection === 'sequence' ? 'Rythme de la séquence' : 'Feux de départ'}</h2><div className="studio-field-grid"><Field label="Avant le premier feu" value={settings.firstLight} min={300} max={60000} onChange={(v) => update({firstLight: v})} /><Field label="Intervalle des feux" value={settings.interval} min={100} max={5000} onChange={(v) => update({interval: v})} /><Field label="Attente après le 5e feu" value={settings.hold} min={100} max={60000} onChange={(v) => update({hold: v})} /><Field label="Départ à" value={timing.release} min={timing.lights[4] + 100} max={timing.lights[4] + 60000} onChange={(v) => delay(v - timing.release)} /><Field label="Après le départ" value={settings.tail} min={500} max={60000} onChange={(v) => update({tail: v})} /><Field label="Correction image / son" value={settings.visualOffset} min={-250} max={250} onChange={(v) => update({visualOffset: v})} /></div><p className="studio-help">Le moteur garde son début à {seconds(settings.engineOffset)}. Les cinq bips suivent les feux. Les coupes de l’animatique suivent le rythme.</p></>}
          {selectedAudio && <><h2>{names[selection as 'music' | 'engine']}</h2><p className="studio-filename">{selection === 'music' ? AUDIO_ASSETS.musicLabel : AUDIO_ASSETS.engineLabel}</p><div className="studio-field-grid"><Field label="Début dans le montage" value={selectedAudio.at} onChange={(at) => apply({...project.current, settings: editAudioClip(settings, selection as 'music' | 'engine', {at})})} /><Field label="Entrée dans le fichier" value={selectedAudio.source} max={selectedAudio.available - 100} onChange={(source) => apply({...project.current, settings: editAudioClip(settings, selection as 'music' | 'engine', {source})})} /><Field label="Durée du clip" value={selectedAudio.duration} min={100} max={selectedAudio.available - selectedAudio.source} onChange={(duration) => apply({...project.current, settings: editAudioClip(settings, selection as 'music' | 'engine', {duration})})} /></div><label className="studio-volume">Volume <output>{Math.round(settings[volumeKey(selection as AudioTrack)] * 100)} %</output><input type="range" aria-label={`Volume ${names[selection as 'music' | 'engine']}`} min={0} max={1.2} step={.01} value={settings[volumeKey(selection as AudioTrack)]} onChange={(e) => update({[volumeKey(selection as AudioTrack)]: Number(e.target.value)})} /></label>{selection === 'music' && <Field label="Silence musical avant départ" value={settings.musicGap} max={700} onChange={(v) => update({musicGap: v})} />}<p className="studio-help">Déplace le clip pour son départ. Tire ses bords pour choisir l’extrait. La lecture reprend au bon endroit après un déplacement du curseur.</p></>}
          {selection === 'beep' && <><h2>Bips des feux</h2><label className="studio-volume">Volume <output>{Math.round(settings.beepVolume * 100)} %</output><input type="range" aria-label="Volume Bips" min={0} max={1.2} step={.01} value={settings.beepVolume} onChange={(e) => update({beepVolume: Number(e.target.value)})} /></label><p className="studio-help">Les bips sont liés aux cinq allumages. Pour changer leur rythme, sélectionne la piste Feux.</p><button onClick={() => setSelection('lights')}>Régler les feux</button></>}
          {selectedMedia && <><h2>{selectedMedia.kind === 'video' ? 'Vidéo · sans son' : 'Image'}</h2><p className="studio-filename">{selectedMedia.name}</p><div className="studio-field-grid"><Field label="Début du plan" value={selectedMedia.at} onChange={(at) => updateMedia(selection, {at: Math.max(0, at)})} /><Field label="Durée du plan" value={selectedMedia.duration} min={100} max={selectedMedia.available - selectedMedia.source} onChange={(duration) => updateMedia(selection, {duration: Math.max(100, Math.min(selectedMedia.available - selectedMedia.source, duration))})} />{selectedMedia.kind === 'video' && <Field label="Entrée dans la vidéo" value={selectedMedia.source} max={selectedMedia.available - 100} onChange={(source) => updateMedia(selection, {source: Math.max(0, Math.min(source, selectedMedia.available - 100)), duration: Math.min(selectedMedia.duration, selectedMedia.available - source)})} />}</div><button className="studio-delete" onClick={() => { apply({...project.current, clips: clips.filter((c) => c.id !== selection)}); setSelection('sequence'); }}><Trash2 size={13} />Supprimer le plan</button><p className="studio-help">En cas de superposition, le dernier média ajouté passe devant. Le son des vidéos reste désactivé.</p></>}
        </div>
      </aside>
    </div>
    <section className="studio-edit" aria-label="Timeline de montage">
      <div className="studio-edit-toolbar"><div><span className="studio-eyebrow">TIMELINE</span><span className="studio-track-count">4 pistes · {clips.length} média{clips.length > 1 ? 's' : ''}</span><button disabled={!historySize[0]} onClick={() => undo()} aria-label="Annuler"><Undo2 size={15} /></button><button disabled={!historySize[1]} onClick={() => undo(true)} aria-label="Rétablir"><Redo2 size={15} /></button></div><div><button aria-pressed={snap} onClick={() => setSnap(!snap)} title="Magnétisme 50 ms · Alt pour désactiver pendant le déplacement"><Magnet size={14} />50 ms</button><label className="studio-zoom">Zoom<input type="range" aria-label="Zoom de la timeline" min={1} max={5} step={.25} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /></label><button disabled={importing || !mediaReady} onClick={() => upload.current?.click()}><Upload size={14} />{importing ? 'Import…' : 'Images / vidéos'}</button><input ref={upload} className="sr-only" type="file" aria-label="Importer des images ou vidéos" accept="image/*,video/*" multiple onChange={(e) => void importMedia(e.target.files)} /></div></div>
      <div className="studio-timeline-scroll"><div className="studio-timeline-inner" style={{width: `${zoom * 100}%`}}>
        <div className="studio-ruler-row"><div className="studio-track-header"><span>PISTES</span><small>secondes</small></div><div className="studio-ruler studio-lane" onPointerDown={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('studio-tick')) { e.currentTarget.setPointerCapture(e.pointerId); seek((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.clientWidth * rulerEnd); } }} onPointerMove={(e) => { if (e.buttons === 1 && e.currentTarget.hasPointerCapture(e.pointerId)) seek((e.clientX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.clientWidth * rulerEnd); }}>
          {Array.from({length: Math.floor(rulerEnd / tickStep) + 1}, (_, i) => <span className="studio-tick" key={i} style={{left: `${i * tickStep / rulerEnd * 100}%`}}>{i * tickStep / 1000}s</span>)}
          <button className="studio-release-marker" style={{left: `${timing.release / rulerEnd * 100}%`}} onPointerDown={(e) => beginDrag(e, 'release')} {...dragEvents} onKeyDown={(e) => clipKeyboard(e, 'release')} aria-label="Déplacer le départ">DÉPART {seconds(timing.release)}<i /></button>
        </div></div>
        <div className="studio-track-row"><div className="studio-track-header"><Film size={15} /><div><b>Visuels</b><small>Images & vidéos muettes</small></div><button aria-label="Ajouter un média" disabled={!mediaReady || importing} onClick={() => upload.current?.click()}><Plus size={14} /></button></div><div className="studio-lane studio-visual-lane" onDoubleClick={() => upload.current?.click()}>
          {!clips.length && timing.shots.map((shot, i) => <button className="studio-placeholder" key={i} style={positionStyle(shot.at, (timing.shots[i + 1]?.at ?? timing.end) - shot.at)} onClick={() => seek(shot.at)} title={`Plan de repère ${i + 1}`}><Film size={12} />{String(i + 1).padStart(2, '0')}</button>)}
          {clips.map((clip) => <button key={clip.id} className="studio-clip studio-visual-clip" data-selected={selection === clip.id} style={positionStyle(clip.at, clip.duration)} onPointerDown={(e) => beginDrag(e, clip.id)} {...dragEvents} onClick={() => setSelection(clip.id)} onKeyDown={(e) => clipKeyboard(e, clip.id)} aria-label={`Plan ${clip.name}`} title={`${clip.name} · ${seconds(clip.at)} → ${seconds(clip.at + clip.duration)}`}>{clip.kind === 'image' ? <img src={clip.url} alt="" /> : <Film size={18} />}<span>{clip.name}</span>{trimHandles(clip.id)}</button>)}
        </div></div>
        <div className="studio-track-row"><div className="studio-track-header"><Flag size={15} /><div><b>Feux & bips</b><small>5 allumages liés</small></div><div className="studio-track-buttons"><button aria-label="Couper Bips" aria-pressed={settings.beepVolume === 0} onClick={() => toggleTrack('beep')}>M</button><button aria-label="Solo Bips" aria-pressed={solo === 'beep'} onClick={() => { pause(); setSolo(solo === 'beep' ? null : 'beep'); setSelection('beep'); }}>S</button></div></div><div className="studio-lane"><button className="studio-light-clip" data-selected={selection === 'lights'} style={positionStyle(settings.firstLight, timing.release - settings.firstLight)} onPointerDown={(e) => beginDrag(e, 'lights')} {...dragEvents} onClick={() => setSelection('lights')} onKeyDown={(e) => clipKeyboard(e, 'lights')} aria-label="Déplacer la séquence des feux">{timing.lights.map((at, i) => <span key={i} style={{left: `${(at - settings.firstLight) / (timing.release - settings.firstLight) * 100}%`}}><i>{i + 1}</i><small>{seconds(at)}</small></span>)}<b className="studio-hold-label">ATTENTE</b></button></div></div>
        {(['music', 'engine'] as const).map((track) => { const clip = audioClip(settings, track); return <div className="studio-track-row" key={track}><div className="studio-track-header">{track === 'music' ? <Music2 size={15} /> : <Gauge size={15} />}<div><b>{names[track]}</b><small>{track === 'music' ? 'Lights Out Grid' : 'ElevenLabs · moteur'}</small></div><div className="studio-track-buttons"><button aria-label={`Couper ${names[track]}`} aria-pressed={settings[volumeKey(track)] === 0} onClick={() => toggleTrack(track)}>M</button><button aria-label={`Solo ${names[track]}`} aria-pressed={solo === track} onClick={() => { pause(); setSolo(solo === track ? null : track); setSelection(track); }}>S</button></div></div><div className="studio-lane"><button className={`studio-clip studio-audio-clip studio-${track}`} data-selected={selection === track} data-muted={settings[volumeKey(track)] === 0 || (solo !== null && solo !== track)} style={positionStyle(clip.at, clip.duration)} onPointerDown={(e) => beginDrag(e, track)} {...dragEvents} onClick={() => setSelection(track)} onKeyDown={(e) => clipKeyboard(e, track)} aria-label={`Clip ${names[track]}`}><span className="studio-clip-title">{names[track]}<small>{seconds(clip.duration)}</small></span><Waveform peaks={peaks[track]} {...clip} />{trimHandles(track)}</button></div></div>; })}
        <div className="studio-timeline-overlay"><div className="studio-end-zone" style={{left: `${timing.end / rulerEnd * 100}%`}}><span>FIN</span></div><div className="studio-release-line" style={{left: `${timing.release / rulerEnd * 100}%`}} /><div className="studio-playhead" style={{left: `${Math.min(cursor, timing.end) / rulerEnd * 100}%`}}><i /></div></div>
      </div></div>
      <footer className="studio-timeline-footer"><span>Espace : lecture · ← → : 10 ms · Glisser : déplacer · Bords : rogner</span><span>{extent > timing.end && <button onClick={() => update({tail: extent - timing.release})}>Étendre la fin aux pistes</button>} Fin du clip <b>{timecode(timing.end)}</b></span></footer>
    </section>
    <div className="studio-bottom"><p>Les médias sont conservés dans ce navigateur. L’aperçu de l’accueil reprend les réglages de timing et de son ; les médias importés se prévisualisent dans le studio.</p><button onClick={preview}>Tester le timing sur l’accueil ↗</button></div>
    {solo && <p className="studio-notice" role="status">Écoute solo : {names[solo]}. <button onClick={() => { pause(); setSolo(null); }}>Réécouter toutes les pistes</button></p>}
    {error && <p className="studio-error" role="alert">{error}</p>}{notice && <p className="studio-notice" role="status">{notice}</p>}
    <div className="studio-footnote"><span>Le timing des feux est un choix de montage, ajustable.</span><a href="/audio/CREDITS.txt" target="_blank" rel="noreferrer">Crédits audio ↗</a></div>
  </div>;
}
