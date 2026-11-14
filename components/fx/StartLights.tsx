'use client';

import { useEffect, useRef, useState, useMemo, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { IntroAudio } from '@/lib/intro-audio';
import { compileTiming, DEFAULT_SETTINGS, PREVIEW_KEY, sanitizeSettings, visualState, type IntroSettings } from '@/lib/intro-timing';

const STORAGE_KEY = 'f1-start';
const REPLAY_EVENT = 'f1-replay-intro';
const IMAGES = ['visor', 'tire', 'grid'] as const;
const IMAGE_URLS = { visor: '/intro/visor-v4.webp', tire: '/intro/tire-v4.webp', grid: '/intro/grid-v4.webp' };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
// Un seul chrono pilote le montage, les feux et le fondu sonore.
type Phase = 'wait' | 'ready' | 'run' | 'gone';

function remember() {
  try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* Stockage privé indisponible. */ }
}

export function ReplayStartLights() {
  return (
    <button type="button" className="inline-flex items-center gap-2 text-xs text-white/60 transition hover:text-white" onClick={() => window.dispatchEvent(new Event(REPLAY_EVENT))}>
      <Play size={12} aria-hidden /> Revoir l’intro
    </button>
  );
}

export function StartLights() {
  const pathname = usePathname();
  const [settings, setSettings] = useState<IntroSettings>(DEFAULT_SETTINGS);
  const TIMING = useMemo(() => compileTiming(settings), [settings]);
  const [phase, setPhase] = useState<Phase>('wait');
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const [launching, setLaunching] = useState(false);
  const audio = useRef<IntroAudio | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const started = useRef(0);
  const launchId = useRef(0);
  const audioClock = useRef(false);
  const heroBounds = useRef({ top: 0, right: 0, bottom: 0, left: 0 });
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    let seen = false;
    let preview = false;
    try {
      const saved = sessionStorage.getItem(PREVIEW_KEY);
      if (saved) { setSettings(sanitizeSettings(JSON.parse(saved))); preview = true; }
    } catch { /* Aucun réglage valide. */ }
    try { seen = sessionStorage.getItem(STORAGE_KEY) === '1'; } catch { /* Continuer sans stockage. */ }
    setPhase(pathname === '/' && (preview || (!seen && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)) ? 'ready' : 'gone');
    const replay = () => {
      try { const saved = sessionStorage.getItem(PREVIEW_KEY); setSettings(saved ? sanitizeSettings(JSON.parse(saved)) : DEFAULT_SETTINGS); } catch { setSettings(DEFAULT_SETTINGS); }
      setElapsed(0); setAudioFailed(false); setLaunching(false); setPhase('ready'); };
    if (pathname === '/') window.addEventListener(REPLAY_EVENT, replay);
    return () => {
      launchId.current += 1;
      window.removeEventListener(REPLAY_EVENT, replay);
    };
  }, [pathname]);

  useEffect(() => () => {
    const player = audio.current; audio.current = null;
    void player?.dispose();
  }, []);

  const visible = phase === 'ready' || phase === 'run';
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    // Précharger les trois plans avant la première coupe, y compris sur mobile.
    void Promise.all(IMAGES.map((name) => new Promise<void>((resolve) => {
      const image = new Image();
      image.onload = image.onerror = () => resolve();
      image.src = IMAGE_URLS[name];
    }))).then(() => { if (!cancelled) setAssetsReady(true); });
    return () => { cancelled = true; };
  }, [visible]);
  useEffect(() => {
    if (assetsReady && phase === 'ready') dialog.current?.querySelector<HTMLButtonElement>('.start-launch')?.focus();
  }, [assetsReady, phase]);

  useEffect(() => {
    if (!visible) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [visible]);

  useEffect(() => {
    if (phase !== 'run') return;
    let frame: number;
    const sound = audio.current;
    const tick = () => {
      // Le lecteur est l'horloge maître : un buffering arrête aussi l'image.
      const time = audioClock.current && sound ? sound.position : performance.now() - started.current;
      if (time >= TIMING.end + Math.max(0, TIMING.visualOffset)) {
        sound?.pause();
        remember();
        setPhase('gone');
        return;
      }
      setElapsed(time);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const hide = () => {
      if (document.hidden) { sound?.pause(); remember(); setPhase('gone'); }
    };
    document.addEventListener('visibilitychange', hide);
    return () => { cancelAnimationFrame(frame); sound?.pause(); document.removeEventListener('visibilitychange', hide); };
  }, [phase, TIMING]);

  function finish() {
    launchId.current += 1;
    audio.current?.pause();
    setLaunching(false);
    remember();
    setPhase('gone');
  }

  async function launch(withSound: boolean) {
    const id = ++launchId.current;
    window.scrollTo({ top: 0, behavior: 'instant' });
    const hero = document.querySelector('.home-hero')?.getBoundingClientRect();
    if (hero && hero.width > 0 && hero.height > 0) {
      heroBounds.current = {
        top: Math.max(0, hero.top), right: Math.max(0, window.innerWidth - hero.right),
        bottom: Math.max(0, window.innerHeight - Math.min(hero.bottom, window.innerHeight)), left: Math.max(0, hero.left),
      };
    }
    setLaunching(true);
    setMuted(!withSound);
    setAudioFailed(false);
    audioClock.current = false;
    const sound = audio.current ??= new IntroAudio();
    if (sound) {

      try {
        // Même silencieux, le lecteur pilote tous les repères visuels.
        const began = await sound.play(TIMING, 0, !withSound);
        if (!began) return;
        if (id !== launchId.current) return;
        audioClock.current = true;
      } catch {
        if (id !== launchId.current) return;
        setAudioFailed(true);
        setMuted(true);
      }
    }
    if (id !== launchId.current) return;
    started.current = performance.now();
    setElapsed(0);
    setLaunching(false);
    setPhase('run');
  }

  function toggleSound() {
    if (audioFailed) return;
    const next = !muted;
    audio.current?.mute(next);
    setMuted(next);
  }

  if (!visible) return null;
  const running = phase === 'run';
  const visual = visualState(elapsed, TIMING);
  const pictureTime = visual.time;
  const released = running && visual.released;
  const releaseProgress = clamp((pictureTime - TIMING.release) / (TIMING.end - TIMING.release));
  const scene = !running ? 'ready' : released ? 'release' : pictureTime >= TIMING.holdAt ? 'hold' : 'film';
  const shotIndex = visual.shotIndex;
  const shot = TIMING.shots[shotIndex];
  const nextCut = TIMING.shots[shotIndex + 1]?.at ?? TIMING.end;
  const shotProgress = clamp((pictureTime - shot.at) / (nextCut - shot.at));
  const lit = running ? visual.lit : 0;
  const sinceLight = pictureTime - (TIMING.lights[lit - 1] ?? -1000);
  const pulse = lit ? Math.exp(-sinceLight / 180) : 0;
  const morph = clamp((releaseProgress - .68) / .32);
  const easedMorph = morph * morph * (3 - 2 * morph);
  const bounds = heroBounds.current;
  const overlayStyle = {
    '--intro-red': lit / 5,
    '--intro-pulse': pulse,
    '--intro-release': releaseProgress,
    '--intro-title': released ? clamp((releaseProgress - .14) / .13) * (1 - clamp((releaseProgress - .58) / .12)) : 0,
    '--intro-rig-opacity': released ? 1 - clamp(releaseProgress / .18) : running ? 1 : 0,
    '--intro-rig-scale': released ? 1 + releaseProgress * 2 : .78 + lit * .044,
    '--intro-opacity': 1 - clamp((releaseProgress - .9) / .1),
    clipPath: released ? `inset(${bounds.top * easedMorph}px ${bounds.right * easedMorph}px ${bounds.bottom * easedMorph}px ${bounds.left * easedMorph}px round ${24 * easedMorph}px)` : undefined,
  } as CSSProperties;

  return (
    <dialog ref={dialog} className="start-overlay" data-scene={scene} style={overlayStyle} aria-label="Bienvenue sur Fantasy F1" onCancel={(event) => { event.preventDefault(); finish(); }}>
      <div className="start-film" aria-hidden style={{ top: bounds.top * easedMorph, right: bounds.right * easedMorph, bottom: bounds.bottom * easedMorph, left: bounds.left * easedMorph }}>
        {IMAGES.map((name) => {
          const active = !running ? name === 'grid' : name === shot.image;
          const scale = running && active ? shot.from + (shot.to - shot.from) * shotProgress : 1.04;
          return <div key={name} className={`start-shot start-shot-${name}`} style={{
            opacity: active ? 1 : 0,
            backgroundPosition: running && active ? `${shot.x}% ${shot.y}%` : '65% 52%',
            transform: `scale(${scale * (1 - easedMorph) + easedMorph})`,
            filter: released ? `blur(${Math.sin(releaseProgress * Math.PI) * 3}px)` : undefined,
          }} />;
        })}
      </div>
      <div className="start-vignette" aria-hidden />
      <div className="start-red-spill" aria-hidden />
      <div className="start-film-grain" aria-hidden />
      <div className="start-letterbox start-letterbox-top" aria-hidden />
      <div className="start-letterbox start-letterbox-bottom" aria-hidden />
      <header className="start-topline"><span><i /> Fantasy F1 <span className="start-topline-divider">/</span> Saison 2026</span><span>Le silence avant la course.</span></header>
      <div className="start-stage">
        {!running ? (
          <div className="start-ready">
            <p className="start-eyebrow">Entre sur la grille.</p>
            <h2>Tout se joue<br />avant <em>le départ.</em></h2>
            <p className="start-description">La prochaine décision est la tienne.</p>
            <div className="start-launch-actions">
              <button autoFocus type="button" className="start-launch" disabled={launching || !assetsReady} onClick={() => void launch(true)}><Play size={14} fill="currentColor" aria-hidden /> {launching || !assetsReady ? 'Préparation…' : 'Vivre le départ'} <Volume2 size={15} aria-hidden /></button>
              <button type="button" className="start-quiet" disabled={launching || !assetsReady} onClick={() => void launch(false)}>Lancer sans son</button>
            </div>
            <p className="start-duration">{Math.ceil(TIMING.end / 1000)} secondes pour entrer dans la course</p>
          </div>
        ) : (
          <>
            <p className="sr-only" role="status">{released ? 'Départ ! La prochaine décision est la tienne.' : `${lit} feux rouges sur 5`}</p>
            <div className="start-gantry" aria-hidden>
              <div className="start-gantry-rail" />
              <div className="start-lights">
                {TIMING.lights.map((time, index) => (
                  <div className="start-light-column" key={time} data-lit={index < lit}>
                    <span className="start-lamp" /><span className="start-lamp" />
                  </div>
                ))}
              </div>
            </div>
            <div className="start-release-title" aria-hidden={!released}>
              <p className="start-eyebrow">La prochaine décision est la tienne.</p>
              <h2>FANTASY <em>F1</em></h2>
              <span className="start-title-rule" />
            </div>
            <div className="start-count" aria-hidden><span>{released ? 'GO' : String(lit).padStart(2, '0')}</span><span>{released ? 'La piste est à toi' : '/ 05'}</span></div>
          </>
        )}
      </div>
      <footer className="start-footer">
        <div className="start-audio-control">
          {running && <button type="button" onClick={toggleSound} disabled={audioFailed} aria-label={muted ? 'Activer le son' : 'Couper le son'} aria-pressed={!muted}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}<span>{audioFailed ? 'Son indisponible' : muted ? 'Son désactivé' : 'Immersion sonore'}</span></button>}
          <a href="/audio/CREDITS.txt" target="_blank" rel="noreferrer">Crédits images et son</a>
        </div>
        <button type="button" className="start-skip" onClick={finish}>Passer <span aria-hidden>↗</span></button>
      </footer>
      {running && <div className="start-progress" style={{ transform: `scaleX(${clamp(elapsed / TIMING.end)})` }} aria-hidden />}
    </dialog>
  );
}
