'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { buildRecord, crossedSector, deltaAt, formatDelta, parseRecord, sampleAtTime, type LapRecord, type LapSample } from '@/lib/clm-record';
import { biomeFor } from '@/lib/circuit-biome';
import { createCar, formatLap, rampSteer, RUNOFF_RATIO, speedKmh, steerResponse, stepClm, STREET_RUNOFF_RATIO, topSpeed, type ClmCar } from '@/lib/clm';
import { sampleElevation, type ElevationSample } from '@/lib/grade';
import type { TrackSign } from '@/lib/circuit-places';
import type { Track } from '@/lib/track-path';
import type { RaceCamera, RaceView } from './race-view';

const CAMERA_KEY = 'clm-camera';

type Phase = 'ready' | 'countdown' | 'racing' | 'finished';

type SectorNote = {
  sector: 1 | 2 | 3;
  delta: number;
  until: number;
};

type Hud = {
  phase: Phase;
  count: number | null;
  go: boolean;
  time: number;
  kmh: number;
  offTrack: boolean;
  atLimit: boolean;
  unbalanced: boolean;
  best: number | null;
  improved: boolean;
  delta: number | null;
  gap: number | null;
  sector: SectorNote | null;
  chasing: boolean;
  accel: number;
  brake: number;
  steer: number;
  grade: number | null;
  corner: { number: number; name: string | null; meters: number } | null;
  cut: number | null;
  penalty: number;
  rescued: boolean;
};

type Sim = {
  car: ClmCar;
  phase: Phase;
  countStarted: number;
  raceStarted: number;
  blend: number;
  camHeading: number;
  record: LapRecord | null;
  samples: LapSample[];
  best: number | null;
  improved: boolean;
  delta: number | null;
  gap: number | null;
  sector: SectorNote | null;
  enterLock: boolean;
  steer: number;
  cut: { seconds: number; until: number } | null;
  rescuedUntil: number;
};

type Held = {
  left: boolean;
  right: boolean;
  brake: boolean;
  throttle: boolean;
};

const COUNTDOWN_SECONDS = 1.35;

const EMPTY_HUD: Hud = {
  phase: 'ready',
  count: null,
  go: false,
  time: 0,
  kmh: 0,
  offTrack: false,
  atLimit: false,
  unbalanced: false,
  best: null,
  improved: false,
  delta: null,
  gap: null,
  sector: null,
  chasing: false,
  accel: 0,
  brake: 0,
  steer: 0,
  grade: null,
  corner: null,
  cut: null,
  penalty: 0,
  rescued: false,
};

/** Le prochain virage s'annonce à cette distance. */
const CORNER_CALL_M = 320;

export function TimeTrial({
  track,
  lengthKm,
  circuitId,
  elevation,
  signs,
}: {
  track: Track;
  lengthKm: number;
  circuitId: string;
  elevation?: ElevationSample[];
  signs?: TrackSign[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const keysRef = useRef(new Set<string>());
  const heldRef = useRef<Held>({ left: false, right: false, brake: false, throttle: false });
  const engineRef = useRef<Engine | null>(null);
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [camera, setCamera] = useState<RaceCamera>('chase');
  const cameraRef = useRef<RaceCamera>('chase');

  useEffect(() => {
    try {
      if (localStorage.getItem(CAMERA_KEY) === 'cockpit') {
        cameraRef.current = 'cockpit';
        setCamera('cockpit');
      }
    } catch { /* stockage privé */ }
  }, []);

  const toggleCamera = () => {
    const next: RaceCamera = cameraRef.current === 'cockpit' ? 'chase' : 'cockpit';
    cameraRef.current = next;
    setCamera(next);
    try {
      localStorage.setItem(CAMERA_KEY, next);
    } catch { /* stockage privé */ }
  };
  const toggleRef = useRef(toggleCamera);
  toggleRef.current = toggleCamera;

  useEffect(() => {
    const keys = keysRef.current;
    const releaseButtons = () => {
      const held = heldRef.current;
      held.left = false;
      held.right = false;
      held.brake = false;
      held.throttle = false;
    };
    const release = () => {
      keys.clear();
      releaseButtons();
      const sim = simRef.current;
      if (sim) sim.steer = 0;
    };
    const down = (event: KeyboardEvent) => {
      if (event.code === 'KeyC' && !event.repeat) toggleRef.current();
      if (event.code === 'Space' || event.code.startsWith('Arrow') || event.code === 'KeyA' || event.code === 'KeyD' || event.code === 'KeyS' || event.code === 'KeyW' || event.code === 'KeyZ') {
        event.preventDefault();
      }
      if (!event.repeat) keys.add(event.code);
    };
    const up = (event: KeyboardEvent) => {
      keys.delete(event.code);
    };
    const blur = () => {
      if (document.hidden || !document.hasFocus()) release();
    };
    window.addEventListener('keydown', down, { capture: true });
    window.addEventListener('keyup', up, { capture: true });
    window.addEventListener('blur', blur);
    window.addEventListener('pointerup', releaseButtons);
    window.addEventListener('pointercancel', releaseButtons);
    document.addEventListener('visibilitychange', blur);
    return () => {
      window.removeEventListener('keydown', down, { capture: true });
      window.removeEventListener('keyup', up, { capture: true });
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointerup', releaseButtons);
      window.removeEventListener('pointercancel', releaseButtons);
      document.removeEventListener('visibilitychange', blur);
      release();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const map = mapRef.current;
    if (!host || !map) return;

    const car = createCar(track);
    const record = readRecord(circuitId);
    const sim: Sim = {
      car,
      phase: 'ready',
      countStarted: 0,
      raceStarted: 0,
      blend: 0,
      camHeading: car.heading,
      record,
      samples: [],
      best: record?.time ?? null,
      improved: false,
      delta: null,
      gap: null,
      sector: null,
      enterLock: false,
      steer: 0,
      cut: null,
      rescuedUntil: 0,
    };
    simRef.current = sim;
    setHud(snapshot(sim, lengthKm, track));
    const turns = (signs ?? []).filter((sign) => sign.number != null);

    const bounds = boundsOf(track);
    let view: RaceView | null = null;
    let cancelled = false;
    void import('./race-view').then((mod) => {
      if (cancelled) return;
      try {
        view = new mod.RaceView(host, track, lengthKm, elevation, signs, circuitId);
      } catch (error) {
        console.error(error);
      }
    }).catch((error: unknown) => {
      console.error(error);
    });

    let timer = 0;
    let last = performance.now();
    let hudAt = 0;
    const top = Math.max(1e-3, topSpeed(track, lengthKm));

    // Un onglet masqué suspend requestAnimationFrame : au retour, on repart de maintenant au lieu de rejouer l'absence.
    const resume = () => {
      last = performance.now();
    };
    document.addEventListener('visibilitychange', resume);

    const loop = () => {
      timer = window.requestAnimationFrame(loop);
      const now = performance.now();
      if (document.hidden) {
        last = now;
        return;
      }
      let pending = Math.min(0.5, (now - last) / 1000);
      const visualDt = pending;
      last = now;
      const keys = keysRef.current;
      const held = heldRef.current;
      while (pending > 0) {
        const dt = Math.min(0.05, pending);
        pending -= dt;
        const enter = keys.has('Enter');
        if (enter && !sim.enterLock) {
          if (sim.phase === 'ready') begin(sim, now);
          else if (sim.phase === 'finished') reset(sim, track, now);
          sim.enterLock = true;
        }
        if (!enter) sim.enterLock = false;

        if (sim.phase === 'countdown' && (now - sim.countStarted) / 1000 >= COUNTDOWN_SECONDS) {
          sim.phase = 'racing';
          sim.raceStarted = now;
        }
        if (sim.phase === 'ready') sim.blend = 0;
        else sim.blend = Math.min(1, sim.blend + dt / 0.28);

        if (sim.phase === 'racing') {
          const wanted = (held.right || keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0)
            - (held.left || keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
          sim.steer = rampSteer(sim.steer, wanted, dt, sim.car.speed / top);
          const steer = steerResponse(sim.steer);
          const brake = held.brake || keys.has('ArrowDown') || keys.has('KeyS') || keys.has('Space') ? 1 : 0;
          const throttle = held.throttle || keys.has('ArrowUp') || keys.has('KeyW') || keys.has('KeyZ') ? 1 : 0;
          const prevS = sim.car.s;
          const prevPenalty = sim.car.penalty;
          const prevRescues = sim.car.rescues;
          const runoff = biomeFor(circuitId).walls ? STREET_RUNOFF_RATIO : RUNOFF_RATIO;
          sim.car = stepClm(track, sim.car, { steer, brake, throttle }, dt, lengthKm, elevation, runoff);
          if (sim.car.penalty > prevPenalty) sim.cut = { seconds: sim.car.penalty - prevPenalty, until: now + 2200 };
          if (sim.car.rescues > prevRescues) {
            sim.rescuedUntil = now + 2200;
            sim.camHeading = sim.car.heading;
          }
          rememberSample(sim, track.length);
          const sector = crossedSector(prevS, sim.car.s, track.length);
          if (sector && sim.record?.sectors) {
            sim.sector = { sector, delta: sim.car.time - sim.record.sectors[sector - 1], until: now + 1600 };
          }
          sim.delta = sim.record && sim.record.samples.length > 1 ? deltaAt(sim.record, sim.car.s, sim.car.time) : null;
          if (sim.car.finished) {
            sim.samples.push({ t: sim.car.time, s: track.length, x: sim.car.x, y: sim.car.y, h: sim.car.heading });
            const replayable = (sim.record?.samples.length ?? 0) > 1;
            const previous = replayable ? sim.best : null;
            sim.gap = previous == null ? null : sim.car.time - previous;
            sim.improved = previous == null || sim.car.time < previous;
            if (sim.improved) {
              const record = buildRecord(sim.car.time, sim.samples, track.length);
              sim.record = record;
              sim.best = record.time;
              if (sim.gap != null) sim.sector = { sector: 3, delta: sim.gap, until: now + 1600 };
              writeRecord(circuitId, record);
            } else if (sim.gap != null) {
              sim.sector = { sector: 3, delta: sim.gap, until: now + 1600 };
            }
            sim.phase = 'finished';
          }
        }

        const turn = Math.atan2(Math.sin(sim.car.heading - sim.camHeading), Math.cos(sim.car.heading - sim.camHeading));
        sim.camHeading += turn * (1 - Math.exp(-dt * 7));
      }
      const ghost = sim.phase === 'racing' && sim.record && sim.record.samples.length > 1
        ? sampleAtTime(sim.record.samples, sim.car.time)
        : null;
      view?.render({
        car: {
          x: sim.car.x,
          y: sim.car.y,
          heading: sim.car.heading,
          s: sim.car.s,
          speed: sim.car.speed,
          steer: sim.steer,
          brake: sim.car.brake,
          offTrack: sim.car.offTrack,
        },
        ghost: ghost ? { x: ghost.x, y: ghost.y, heading: ghost.h, s: ghost.s } : null,
        blend: sim.blend,
        camHeading: sim.camHeading,
        phase: sim.phase,
        go: sim.phase === 'racing' && now - sim.raceStarted < 500,
        view: cameraRef.current,
      }, visualDt);
      drawMinimap(map, track, bounds, sim);
      tuneEngine(engineRef.current, sim, track, lengthKm);
      if (now - hudAt >= 33) {
        hudAt = now;
        setHud(snapshot(sim, lengthKm, track, now, elevation, turns));
      }
    };

    timer = window.requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(timer);
      document.removeEventListener('visibilitychange', resume);
      stopEngine(engineRef.current);
      engineRef.current = null;
      view?.dispose();
    };
  }, [track, lengthKm, circuitId, elevation, signs]);

  function begin(sim: Sim, now: number) {
    sim.phase = 'countdown';
    sim.countStarted = now;
    sim.improved = false;
    sim.samples = [];
    sim.delta = null;
    sim.gap = null;
    sim.sector = null;
    sim.cut = null;
    sim.rescuedUntil = 0;
  }

  function reset(sim: Sim, course: Track, now: number) {
    sim.car = createCar(course);
    sim.steer = 0;
    sim.camHeading = sim.car.heading;
    sim.phase = 'countdown';
    sim.countStarted = now;
    sim.blend = 1;
    sim.improved = false;
    sim.samples = [];
    sim.delta = null;
    sim.gap = null;
    sim.sector = null;
    sim.cut = null;
    sim.rescuedUntil = 0;
  }

  const start = () => {
    const sim = simRef.current;
    if (!sim || sim.phase !== 'ready') return;
    engineRef.current = engineRef.current ?? startEngine();
    begin(sim, performance.now());
  };

  const replay = () => {
    const sim = simRef.current;
    if (!sim) return;
    engineRef.current = engineRef.current ?? startEngine();
    reset(sim, track, performance.now());
  };

  const press = (key: keyof Held) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      heldRef.current[key] = true;
    },
    onPointerUp: () => {
      heldRef.current[key] = false;
    },
    onPointerCancel: () => {
      heldRef.current[key] = false;
    },
    onLostPointerCapture: () => {
      heldRef.current[key] = false;
    },
  });

  const live = liveMessage(hud);

  return (
    <div role="application" aria-label="Contre-la-montre. Haut pour accélérer, flèches pour tourner, espace pour freiner.">
      <p className="sr-only" aria-live="polite">{live}</p>
      <div className={`relative overflow-hidden rounded-3xl border bg-[#100c28] ${hud.offTrack ? 'border-ember/80' : hud.unbalanced ? 'border-amber-400/80' : hud.atLimit ? 'border-amber-200/50' : 'border-white/15'}`}>
        <div ref={hostRef} className="h-[min(68vh,720px)] min-h-[420px] w-full bg-[#8eb6d6]" />
        <canvas
          ref={mapRef}
          aria-hidden
          className={`pointer-events-none absolute right-3 top-3 h-24 w-24 rounded-2xl border border-white/20 shadow-lg transition-opacity duration-300 sm:right-4 sm:top-4 sm:h-32 sm:w-32 ${hud.phase === 'ready' ? 'opacity-0' : 'opacity-100'}`}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(12,10,28,0.28)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Chrono</p>
            <p className="font-mono text-4xl tabular-nums leading-none">{formatLap(hud.phase === 'ready' || hud.phase === 'countdown' ? 0 : hud.time)}</p>
            {hud.phase === 'racing' && hud.delta != null && (
              <p className={`mt-2 font-mono text-2xl tabular-nums leading-none ${hud.delta <= 0 ? 'text-emerald-400' : 'text-ember'}`}>{formatDelta(hud.delta)}</p>
            )}
            <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/55">À battre {hud.best == null ? '—' : formatLap(hud.best)}</p>
          </div>
        </div>
        {hud.corner && (
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#100c28]/80 px-3 py-1.5 backdrop-blur-sm">
            <span className="rounded bg-[#ffd21f] px-1.5 font-mono text-lg font-bold leading-tight text-[#15123a]">{hud.corner.number}</span>
            {hud.corner.name && <span className="text-sm font-semibold">{hud.corner.name}</span>}
            <span className="font-mono text-xs tabular-nums text-white/60">{Math.round(hud.corner.meters / 10) * 10} m</span>
          </div>
        )}
        {hud.rescued && (
          <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2">
            <p className="text-2xl font-semibold text-amber-300">Remis en piste</p>
          </div>
        )}
        {hud.cut != null && (
          <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2">
            <p className="font-mono text-2xl font-semibold tabular-nums text-ember">Virage coupé +{hud.cut.toFixed(1)} s</p>
          </div>
        )}
        {hud.sector && (
          <div className="pointer-events-none absolute left-1/2 top-28 -translate-x-1/2">
            <p className={`font-mono text-3xl tabular-nums ${hud.sector.delta <= 0 ? 'text-emerald-400' : 'text-ember'}`}>
              S{hud.sector.sector} {formatDelta(hud.sector.delta)}
            </p>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-4 left-4">
          <p className="font-mono text-2xl tabular-nums">
            {Math.round(hud.kmh)}
            <span className="ml-1 text-sm text-white/60">km/h</span>
          </p>
          {hud.offTrack && <p className="text-sm font-medium text-ember">Hors piste</p>}
          {hud.unbalanced && <p className="text-sm font-medium text-amber-300">Déséquilibre</p>}
          {hud.atLimit && <p className="text-sm font-medium text-amber-100">Limite</p>}
        </div>
        <div aria-hidden className="pointer-events-none absolute bottom-4 right-4 w-40 space-y-2 rounded-2xl bg-[#100c28]/85 px-3 py-2 backdrop-blur-sm">
          {hud.grade != null && <SlopeReadout grade={hud.grade} />}
          <SteerGauge value={hud.steer} />
          <Pedal label="Accélération" value={hud.accel} tone="accel" />
          <Pedal label="Freinage" value={hud.brake} tone="brake" />
        </div>

        {hud.phase === 'ready' && (
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-[#100c28]/80 to-transparent p-6">
            <div className="mb-2 max-w-md text-center">
              <p className="mb-4 text-sm text-white/75">
                {hud.best == null
                  ? 'Premier passage : ce tour devient le record à battre.'
                  : hud.chasing
                    ? `Record ${formatLap(hud.best)}. Reste devant le fantôme.`
                    : `Record ${formatLap(hud.best)}. Ce tour devient le passage à battre.`}
              </p>
              <Button type="button" onClick={start} className="pointer-events-auto">Feu vert</Button>
            </div>
          </div>
        )}

        {hud.phase === 'countdown' && hud.count != null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-8xl font-semibold text-ember">{hud.count}</p>
          </div>
        )}

        {hud.go && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-5xl font-semibold tracking-wide text-white">Partez</p>
          </div>
        )}

        {hud.phase === 'finished' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#100c28]/55 p-6">
            <div className="rounded-3xl border border-white/15 bg-[#120e30]/90 px-8 py-6 text-center backdrop-blur-md">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">Tour bouclé</p>
              <p className="mt-1 font-mono text-5xl tabular-nums">{formatLap(hud.time)}</p>
              <p className="mt-2 text-sm text-white/70">
                {hud.improved
                  ? hud.gap == null ? 'Nouveau record' : `Nouveau record · ${formatDelta(hud.gap)} s`
                  : hud.gap != null ? `${formatDelta(hud.gap)} s du record` : ''}
              </p>
              {hud.penalty > 0 && (
                <p className="mt-1 text-xs text-ember">Dont {hud.penalty.toFixed(1)} s de pénalité pour virages coupés</p>
              )}
              <Button type="button" onClick={replay} className="mt-4">Rejouer</Button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={toggleCamera} aria-pressed={camera === 'cockpit'}>
          {camera === 'cockpit' ? 'Vue poursuite' : 'Vue cockpit'} (C)
        </Button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2" style={{ touchAction: 'none' }}>
        <Button type="button" variant="outline" {...press('left')}>Gauche</Button>
        <Button type="button" {...press('throttle')}>Gaz</Button>
        <Button type="button" variant="secondary" {...press('brake')}>Frein</Button>
        <Button type="button" variant="outline" {...press('right')}>Droite</Button>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">Haut, W ou Z pour accélérer. Garde la touche pour braquer plus, tape-la pour corriger. Trop de gaz en virage et ça décroche. Espace pour freiner. C pour passer en vue cockpit. Couper un virage coûte du temps.</p>
    </div>
  );
}

function liveMessage(hud: Hud): string {
  if (hud.phase === 'finished') return `Tour bouclé en ${formatLap(hud.time)}`;
  if (hud.phase === 'countdown' && hud.count) return String(hud.count);
  if (hud.go) return 'Partez';
  if (hud.rescued) return 'Remis en piste';
  if (hud.cut != null) return `Virage coupé, ${hud.cut.toFixed(1)} secondes de pénalité`;
  if (hud.offTrack) return 'Hors piste';
  if (hud.unbalanced) return 'Déséquilibre';
  if (hud.atLimit) return 'Limite';
  return '';
}

function slipOf(car: ClmCar): number {
  const forward = car.vx * Math.cos(car.heading) + car.vy * Math.sin(car.heading);
  const lateral = car.vx * Math.sin(car.heading) - car.vy * Math.cos(car.heading);
  if (forward <= 0.05) return 0;
  return Math.abs(Math.atan2(lateral, forward));
}

function snapshot(sim: Sim, lengthKm: number, track: Track, now = 0, elevation?: ElevationSample[], turns: TrackSign[] = []): Hud {
  const meters = ((lengthKm > 0 ? lengthKm : 4.304) * 1000) / Math.max(track.length, 1e-6);
  let corner: Hud['corner'] = null;
  if (sim.phase === 'racing') {
    for (const turn of turns) {
      let ahead = turn.at * track.length - sim.car.s;
      if (ahead < 0) ahead += track.length;
      const away = ahead * meters;
      if (turn.number != null && away <= CORNER_CALL_M && (!corner || away < corner.meters)) {
        corner = { number: turn.number, name: turn.name, meters: away };
      }
    }
  }
  const grade = elevation?.length
    ? sampleElevation(elevation, sim.car.s, track.length, meters, 0, track.closed).grade
    : null;
  const beat = COUNTDOWN_SECONDS / 3;
  const countLeft = sim.phase === 'countdown' ? 3 - Math.floor((now - sim.countStarted) / 1000 / beat) : null;
  const slip = sim.phase === 'racing' && !sim.car.offTrack ? slipOf(sim.car) : 0;
  return {
    phase: sim.phase,
    count: countLeft != null && countLeft > 0 ? countLeft : null,
    go: sim.phase === 'racing' && now - sim.raceStarted < 500,
    time: sim.car.time,
    kmh: speedKmh(sim.car.speed, track.length, lengthKm),
    offTrack: sim.car.offTrack && sim.phase === 'racing',
    atLimit: slip > 0.045 && slip <= 0.1,
    unbalanced: slip > 0.1,
    best: sim.best,
    improved: sim.improved,
    delta: sim.phase === 'racing' ? sim.delta : null,
    gap: sim.gap,
    sector: sim.sector && now < sim.sector.until ? sim.sector : null,
    chasing: (sim.record?.samples.length ?? 0) > 1,
    accel: sim.phase === 'racing' ? sim.car.accel : 0,
    brake: sim.phase === 'racing' ? sim.car.brake : 0,
    steer: sim.phase === 'racing' ? sim.steer : 0,
    grade,
    corner,
    cut: sim.cut && now < sim.cut.until ? sim.cut.seconds : null,
    penalty: sim.car.penalty,
    rescued: sim.phase === 'racing' && now < sim.rescuedUntil,
  };
}

function readRecord(circuitId: string): LapRecord | null {
  try {
    return parseRecord(localStorage.getItem(recordKey(circuitId)));
  } catch {
    return null;
  }
}

function writeRecord(circuitId: string, record: LapRecord) {
  try {
    localStorage.setItem(recordKey(circuitId), JSON.stringify(record));
  } catch { /* stockage privé */ }
}

function recordKey(circuitId: string) {
  return `clm-record:v5:${circuitId}`;
}

function Pedal({ label, value, tone }: { label: string; value: number; tone: 'accel' | 'brake' }) {
  const amount = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-white/55">
        <span>{label}</span>
        <span className="font-mono tabular-nums">{Math.round(amount * 100)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
        <div
          className={`h-full rounded-full ${tone === 'brake' ? 'bg-ember' : 'bg-white'}`}
          style={{ width: `${Math.round(amount * 100)}%` }}
        />
      </div>
    </div>
  );
}

function SlopeReadout({ grade }: { grade: number }) {
  const percent = Math.round(grade * 100);
  const label = percent > 0 ? 'Montée' : percent < 0 ? 'Descente' : 'Plat';
  return (
    <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-white/55">
      <span>{label}</span>
      <span className={`font-mono tabular-nums ${percent > 0 ? 'text-amber-200' : percent < 0 ? 'text-sky-300' : ''}`}>
        {percent > 0 ? '↗' : percent < 0 ? '↘' : '→'} {Math.abs(percent)} %
      </span>
    </div>
  );
}

function SteerGauge({ value }: { value: number }) {
  const amount = Math.max(-1, Math.min(1, value));
  const width = Math.abs(amount) * 50;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.14em] text-white/55">
        <span>Direction</span>
        <span className="font-mono tabular-nums">
          {Math.round(Math.abs(amount) * 100)}{amount < -0.005 ? ' G' : amount > 0.005 ? ' D' : ''}
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/50" />
        <div
          className={`absolute inset-y-0 rounded-full ${Math.abs(amount) > 0.95 ? 'bg-amber-300' : 'bg-white'}`}
          style={amount < 0 ? { right: '50%', width: `${width}%` } : { left: '50%', width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function rememberSample(sim: Sim, length: number) {
  const car = sim.car;
  if (car.finished || car.s >= length) return;
  const last = sim.samples[sim.samples.length - 1];
  if (last && (car.s < last.s || car.time - last.t < 0.1)) return;
  sim.samples.push({ t: car.time, s: car.s, x: car.x, y: car.y, h: car.heading });
}

function boundsOf(track: Track) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of track.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const pad = track.halfWidth * 2.2;
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

function drawMinimap(
  canvas: HTMLCanvasElement,
  track: Track,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  sim: Sim,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const css = 128;
  const buffer = Math.floor(css * dpr);
  if (canvas.width !== buffer || canvas.height !== buffer) {
    canvas.width = buffer;
    canvas.height = buffer;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, css, css);
  ctx.fillStyle = "rgba(14, 64, 28, 0.88)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(0, 0, css, css, 16);
  else ctx.rect(0, 0, css, css);
  ctx.fill();
  const bw = bounds.maxX - bounds.minX;
  const bh = bounds.maxY - bounds.minY;
  const zoom = Math.min((css - 18) / bw, (css - 18) / bh);
  ctx.save();
  ctx.translate(css / 2, css / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-(bounds.minX + bounds.maxX) / 2, -(bounds.minY + bounds.maxY) / 2);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(track.points[0].x, track.points[0].y);
  for (let i = 1; i < track.points.length; i += 1) ctx.lineTo(track.points[i].x, track.points[i].y);
  if (track.closed) ctx.closePath();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = track.halfWidth * 1.15;
  ctx.stroke();
  const ghost = sim.phase === "racing" && sim.record ? sampleAtTime(sim.record.samples, sim.car.time) : null;
  if (ghost) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(ghost.x, ghost.y, track.halfWidth * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#e10600";
  ctx.beginPath();
  ctx.arc(sim.car.x, sim.car.y, track.halfWidth * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}


type Engine = {
  ctx: AudioContext;
  osc: OscillatorNode;
  gain: GainNode;
};

function startEngine(): Engine | null {
  const Ctx = window.AudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 58;
  filter.type = 'lowpass';
  filter.frequency.value = 380;
  gain.gain.value = 0;
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  void ctx.resume();
  return { ctx, osc, gain };
}

function stopEngine(engine: Engine | null) {
  if (!engine) return;
  try {
    engine.osc.stop();
    void engine.ctx.close();
  } catch { /* déjà coupé */ }
}

function tuneEngine(engine: Engine | null, sim: Sim, track: Track, lengthKm: number) {
  if (!engine) return;
  const ratio = Math.min(1, sim.car.speed / Math.max(1e-3, topSpeed(track, lengthKm)));
  const racing = sim.phase === 'racing';
  engine.gain.gain.value = racing ? 0.03 + ratio * 0.035 : 0;
  engine.osc.frequency.value = (sim.car.offTrack ? 42 : 56) + ratio * 150;
}

