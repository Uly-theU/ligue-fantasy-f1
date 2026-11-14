'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { buildRecord, crossedSector, deltaAt, formatDelta, parseRecord, sampleAtTime, type LapRecord, type LapSample } from '@/lib/clm-record';
import './arcade/arcade.css';
import { createLapInputLog, recordLapInput, replayLap, serializeLapInputs, type ClmInputSpan, type LapInputLog } from '@/lib/clm-replay';
import { apiFetch } from '@/lib/api';
import { biomeFor } from '@/lib/circuit-biome';
import { CLM_STEP_SECONDS, clmStepAlpha, createCar, crossingFraction, formatLap, interpolateClmPose, rampSteer, RUNOFF_RATIO, speedKmh, steerResponse, stepClm, STREET_RUNOFF_RATIO, takeClmSteps, topSpeed, type ClmCar } from '@/lib/clm';
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

type SectorSplits = [number | null, number | null, number | null];

const EMPTY_SPLITS: SectorSplits = [null, null, null];

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
  splits: SectorSplits;
};

type Sim = {
  car: ClmCar;
  /** Voiture au pas précédent, pour interpoler le rendu. */
  previous: ClmCar;
  /** Reliquat de temps, inférieur à un pas de 1/120 s. */
  leftover: number;
  phase: Phase;
  countStarted: number;
  raceStarted: number;
  blend: number;
  camHeading: number;
  record: LapRecord | null;
  /** Fantôme choisi dans le classement. Absent : le record personnel. */
  ghost: LapRecord | null;
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
  /** Temps cumulés aux lignes de secteur, pour l'affichage seulement. */
  marks: SectorSplits;
  splits: SectorSplits;
  /** Entrées réellement passées à stepClm, une plage par valeur tenue. */
  inputs: LapInputLog;
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
  splits: EMPTY_SPLITS,
};

/** Le prochain virage s'annonce à cette distance. */
const CORNER_CALL_M = 320;

export function TimeTrial({
  track,
  lengthKm,
  circuitId,
  elevation,
  signs,
  gameweekId = null,
  camera: cameraProp,
  circuitName,
  onLeave,
  leaveLabel = 'Menu',
  ghostInputs = null,
}: {
  track: Track;
  lengthKm: number;
  circuitId: string;
  elevation?: ElevationSample[];
  signs?: TrackSign[];
  gameweekId?: string | null;
  /** Vue choisie dans les options. Absente : on relit `clm-camera`. */
  camera?: RaceCamera;
  /** Entrées d'un tour de ligue. Absentes : fantôme du record personnel. */
  ghostInputs?: readonly ClmInputSpan[] | null;
  /** Nom affiché dans le bandeau. Absent : l'identifiant du circuit. */
  circuitName?: string;
  onLeave?: () => void;
  leaveLabel?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<Sim | null>(null);
  const keysRef = useRef(new Set<string>());
  const heldRef = useRef<Held>({ left: false, right: false, brake: false, throttle: false });
  const engineRef = useRef<Engine | null>(null);
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [camera, setCamera] = useState<RaceCamera>(cameraProp ?? 'chase');
  const cameraRef = useRef<RaceCamera>(cameraProp ?? 'chase');
  const submitSeq = useRef(0);
  const [officialTime, setOfficialTime] = useState<number | null>(null);
  const [homologation, setHomologation] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');

  useEffect(() => {
    if (cameraProp === 'chase' || cameraProp === 'cockpit') {
      cameraRef.current = cameraProp;
      setCamera(cameraProp);
      return;
    }
    try {
      if (localStorage.getItem(CAMERA_KEY) === 'cockpit') {
        cameraRef.current = 'cockpit';
        setCamera('cockpit');
      }
    } catch { /* stockage privé */ }
  }, [cameraProp]);

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
    submitSeq.current += 1;
    setOfficialTime(null);
    setHomologation('idle');

    const car = createCar(track);
    const record = readRecord(circuitId);
    const runoff = biomeFor(circuitId).walls ? STREET_RUNOFF_RATIO : RUNOFF_RATIO;
    const ghost = rivalGhost(track, lengthKm, elevation, runoff, ghostInputs);
    const sim: Sim = {
      car,
      previous: car,
      leftover: 0,
      phase: 'ready',
      countStarted: 0,
      raceStarted: 0,
      blend: 0,
      camHeading: car.heading,
      record,
      ghost,
      samples: [],
      best: ghost?.time ?? record?.time ?? null,
      improved: false,
      delta: null,
      gap: null,
      sector: null,
      enterLock: false,
      steer: 0,
      cut: null,
      rescuedUntil: 0,
      marks: [null, null, null],
      splits: [null, null, null],
      inputs: createLapInputLog(),
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
      const frameSeconds = Math.min(0.5, Math.max(0, (now - last) / 1000));
      last = now;
      const keys = keysRef.current;
      const held = heldRef.current;
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
      else sim.blend = Math.min(1, sim.blend + frameSeconds / 0.28);

      if (sim.phase === 'racing') {
        const tick = takeClmSteps(sim.leftover, frameSeconds);
        sim.leftover = tick.leftover;
        const runoff = biomeFor(circuitId).walls ? STREET_RUNOFF_RATIO : RUNOFF_RATIO;
        for (let step = 0; step < tick.steps; step += 1) {
          const wanted = (held.right || keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0)
            - (held.left || keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
          sim.steer = rampSteer(sim.steer, wanted, CLM_STEP_SECONDS, sim.car.speed / top);
          const steer = steerResponse(sim.steer);
          const brake = held.brake || keys.has('ArrowDown') || keys.has('KeyS') || keys.has('Space') ? 1 : 0;
          const throttle = held.throttle || keys.has('ArrowUp') || keys.has('KeyW') || keys.has('KeyZ') ? 1 : 0;
          recordLapInput(sim.inputs, { steer, brake, throttle });
          const prevS = sim.car.s;
          const prevTime = sim.car.time;
          const prevPenalty = sim.car.penalty;
          const prevRescues = sim.car.rescues;
          sim.previous = sim.car;
          sim.car = stepClm(track, sim.car, { steer, brake, throttle }, CLM_STEP_SECONDS, lengthKm, elevation, runoff);
          if (sim.car.penalty > prevPenalty) sim.cut = { seconds: sim.car.penalty - prevPenalty, until: now + 2200 };
          if (sim.car.rescues > prevRescues) {
            sim.rescuedUntil = now + 2200;
            sim.camHeading = sim.car.heading;
            sim.previous = sim.car;
          }
          rememberSample(sim, track.length);
          const sector = crossedSector(prevS, sim.car.s, track.length);
          if (sector) {
            const fraction = crossingFraction(prevS, sim.car.s, (sector * track.length) / 3, track.length);
            const penalty = sim.car.penalty - prevPenalty;
            const driven = sim.car.time - prevTime - penalty;
            const at = prevTime + (fraction == null ? driven : fraction * driven) + penalty;
            const avant = sector === 1 ? 0 : (sim.marks[sector - 2] ?? 0);
            sim.marks[sector - 1] = at;
            sim.splits[sector - 1] = at - avant;
            const cible = chasedLap(sim);
            if (cible?.sectors) {
              sim.sector = { sector, delta: at - cible.sectors[sector - 1], until: now + 1600 };
            }
          }
          const cible = chasedLap(sim);
          sim.delta = cible && cible.samples.length > 1 ? deltaAt(cible, sim.car.s, sim.car.time) : null;
            if (sim.car.finished) {
            if (sim.marks[1] != null) sim.splits[2] = sim.car.time - sim.marks[1];
            sim.samples.push({ t: sim.car.time, s: track.length, x: sim.car.x, y: sim.car.y, h: sim.car.heading });
            if (sim.ghost && sim.ghost.samples.length > 1) {
              sim.gap = sim.car.time - sim.ghost.time;
              sim.improved = sim.car.time < sim.ghost.time;
              sim.sector = { sector: 3, delta: sim.gap, until: now + 1600 };
              const ownReplayable = (sim.record?.samples.length ?? 0) > 1;
              const ownPrevious = ownReplayable ? sim.record!.time : null;
              if (ownPrevious == null || sim.car.time < ownPrevious) {
                const record = buildRecord(sim.car.time, sim.samples, track.length);
                sim.record = record;
                writeRecord(circuitId, record);
              }
            } else {
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
            }
            sim.phase = 'finished';
            sim.previous = sim.car;
            sim.leftover = 0;
            if (gameweekId) {
              const seq = submitSeq.current;
              const spans = sim.inputs.spans.map((span) => ({
                steer: span.steer,
                throttle: span.throttle,
                brake: span.brake,
                steps: span.steps,
              }));
              setHomologation('pending');
              void submitOfficialLap(gameweekId, spans).then((time) => {
                if (submitSeq.current !== seq) return;
                setOfficialTime(time);
                setHomologation('done');
              }).catch((error: unknown) => {
                console.error(error);
                if (submitSeq.current !== seq) return;
                setHomologation('error');
              });
            }
            break;
          }
        }
      }

      const shown = sim.phase === 'racing';
      const pose = interpolateClmPose(sim.previous, sim.car, shown ? sim.leftover : 0, track.length);
      const shownTime = sim.previous.time + (sim.car.time - sim.previous.time) * clmStepAlpha(shown ? sim.leftover : 0);
      const turn = Math.atan2(Math.sin(pose.heading - sim.camHeading), Math.cos(pose.heading - sim.camHeading));
      sim.camHeading += turn * (1 - Math.exp(-frameSeconds * 7));
      const cible = chasedLap(sim);
      const shownGhost = shown && cible && cible.samples.length > 1
        ? sampleAtTime(cible.samples, shownTime)
        : null;
      view?.render({
        car: {
          x: pose.x,
          y: pose.y,
          heading: pose.heading,
          s: pose.s,
          speed: sim.car.speed,
          steer: sim.steer,
          brake: sim.car.brake,
          offTrack: sim.car.offTrack,
        },
        ghost: shownGhost ? { x: shownGhost.x, y: shownGhost.y, heading: shownGhost.h, s: shownGhost.s } : null,
        ghostSamples: sim.ghost && sim.ghost.samples.length > 1 ? sim.ghost.samples : undefined,
        blend: sim.blend,
        camHeading: sim.camHeading,
        phase: sim.phase,
        go: sim.phase === 'racing' && now - sim.raceStarted < 500,
        view: cameraRef.current,
      }, frameSeconds);
      drawMinimap(map, track, bounds, sim, pose, shownTime);
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
  }, [track, lengthKm, circuitId, elevation, signs, gameweekId, ghostInputs]);

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
    sim.marks = [null, null, null];
    sim.splits = [null, null, null];
    sim.inputs = createLapInputLog();
    clearOfficial();
  }

  function reset(sim: Sim, course: Track, now: number) {
    sim.car = createCar(course);
    sim.previous = sim.car;
    sim.leftover = 0;
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
    sim.marks = [null, null, null];
    sim.splits = [null, null, null];
    sim.inputs = createLapInputLog();
    clearOfficial();
  }

  function clearOfficial() {
    submitSeq.current += 1;
    setOfficialTime(null);
    setHomologation('idle');
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

  const displayedTime = hud.phase === 'finished' && officialTime != null ? officialTime : hud.time;
  const live = liveMessage(hud, displayedTime);
  const timeLabel = formatLap(hud.phase === 'ready' || hud.phase === 'countdown' ? 0 : displayedTime);
  const ecart = hud.phase === 'racing' && hud.delta != null
    ? hud.delta
    : hud.phase === 'finished' && hud.gap != null
      ? hud.gap
      : null;
  const nomCircuit = circuitName ?? circuitId;

  return (
    <div className="clm-arcade" role="application" aria-label="Contre-la-montre. Haut pour accélérer, flèches pour tourner, espace pour freiner.">
      <p className="clm-arcade__sr" aria-live="polite">{live}</p>
      <div className="clm-arcade__course">
        <header className="clm-arcade__marquee">
          <div>
            <h1 className="clm-arcade__titre">Contre-la-montre</h1>
            <p className="clm-arcade__sous-titre">Ligue Fantasy F1</p>
          </div>
          <p className="clm-arcade__sous-titre">{nomCircuit}</p>
          {onLeave ? (
            <button type="button" onClick={onLeave}>{leaveLabel}</button>
          ) : null}
        </header>

        <section className="clm-arcade__chiffres" aria-label="Indicateurs de course">
          <div className="clm-arcade__bloc-chrono">
            <span className="clm-arcade__legend">Chrono</span>
            <strong className="clm-arcade__chrono" role="timer">{timeLabel}</strong>
          </div>
          <div>
            <span className="clm-arcade__legend">Vitesse</span>
            <strong className="clm-arcade__chiffre">
              {Math.round(hud.kmh)}
              <span className="clm-arcade__unite">km/h</span>
            </strong>
          </div>
          <div>
            <span className="clm-arcade__legend">Écart</span>
            <strong className={`clm-arcade__chiffre ${deltaTone(ecart)}`.trim()}>
              {ecart == null ? '—' : formatDelta(ecart)}
            </strong>
          </div>
          <ul className="clm-arcade__secteurs">
            {SECTOR_LABELS.map((label, index) => {
              const flash = hud.sector?.sector === index + 1 ? hud.sector.delta : null;
              return (
                <li key={label}>
                  <span className="clm-arcade__legend">{label}</span>
                  <span className="clm-arcade__chiffre">{formatSplit(hud.splits[index] ?? null)}</span>
                  {flash != null ? (
                    <span className={`clm-arcade__chiffre ${deltaTone(flash)}`.trim()}>{formatDelta(flash)}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="clm-arcade__scene">
          <div className="clm-arcade__tube">
            <div className="clm-arcade__piste-live">
              <div ref={hostRef} className="clm-arcade__ecran" />
              <canvas
                ref={mapRef}
                aria-hidden
                className={hud.phase === 'ready' ? 'clm-arcade__minimap clm-arcade__minimap--cache' : 'clm-arcade__minimap'}
              />
              {hud.corner && (
                <div aria-hidden className="clm-arcade__virage">
                  <span className="clm-arcade__virage-num">{hud.corner.number}</span>
                  {hud.corner.name ? <span>{hud.corner.name}</span> : null}
                  <span className="clm-arcade__chiffre">{Math.round(hud.corner.meters / 10) * 10} m</span>
                </div>
              )}
            </div>
          </div>

          <div className="clm-arcade__statuts">
            <article className="clm-arcade__statut clm-arcade__statut--depart">
              <h3>Départ</h3>
              {hud.phase === 'ready' && (
                <>
                  <p>{messageDepart(hud)}</p>
                  <button type="button" className="clm-arcade__bouton--principal" onClick={start}>Feu vert</button>
                </>
              )}
              {hud.phase === 'countdown' && hud.count != null && (
                <p className="clm-arcade__decompte">{hud.count}</p>
              )}
              {(hud.phase === 'countdown' && hud.count == null) || hud.go ? <p>Partez</p> : null}
              {hud.phase === 'racing' && !hud.go && <p>En course</p>}
              {hud.phase === 'finished' && <p>Arrivé</p>}
            </article>

            <article className="clm-arcade__statut clm-arcade__statut--penalite">
              <h3>Pénalité</h3>
              {hud.cut != null && <p className="clm-arcade__chiffre">+{hud.cut.toFixed(1)} s</p>}
              {hud.penalty > 0 && hud.cut == null && (
                <p className="clm-arcade__chiffre">+{hud.penalty.toFixed(1)} s</p>
              )}
              {hud.cut != null && <p>Virage coupé</p>}
              {hud.offTrack && <p>Hors piste</p>}
              {hud.unbalanced && <p>Déséquilibre</p>}
              {hud.atLimit && <p>Limite</p>}
              {hud.rescued && <p>Remis en piste</p>}
              {hud.cut == null && hud.penalty <= 0 && !hud.offTrack && !hud.unbalanced && !hud.atLimit && !hud.rescued && (
                <p>—</p>
              )}
            </article>

            <article className="clm-arcade__statut clm-arcade__statut--record">
              <h3>Record</h3>
              {hud.improved ? (
                <p className="clm-arcade__celebration">
                  {hud.gap == null ? 'Nouveau record' : `Nouveau record ${formatDelta(hud.gap)}`}
                </p>
              ) : hud.best == null ? (
                <p>Premier passage</p>
              ) : (
                <p>À battre {formatLap(hud.best)}</p>
              )}
              {hud.chasing && hud.phase === 'racing' ? <p>Fantôme en piste</p> : null}
            </article>

            {hud.phase === 'racing' && (
              <div className="clm-arcade__jauges" aria-hidden>
                {hud.grade != null && <SlopeReadout grade={hud.grade} />}
                <SteerGauge value={hud.steer} />
                <Pedal label="Accélération" value={hud.accel} tone="accel" />
                <Pedal label="Freinage" value={hud.brake} tone="brake" />
              </div>
            )}
          </div>
        </div>

        {hud.phase === 'finished' && (
          <div className="clm-arcade__fiche clm-arcade__fiche-course">
            <h2>Tour bouclé</h2>
            <p className="clm-arcade__temps clm-arcade__chiffre">{formatLap(displayedTime)}</p>
            {gameweekId && homologation === 'pending' && (
              <p className="clm-arcade__aide">Homologation du temps…</p>
            )}
            {gameweekId && homologation === 'done' && (
              <p className="clm-arcade__aide">Temps officiel</p>
            )}
            {gameweekId && homologation === 'error' && (
              <p className="clm-arcade__ligne-info clm-arcade__ligne-info--rouge">
                <span>Temps non homologué</span>
              </p>
            )}
            <p className={hud.improved ? 'clm-arcade__ligne-info clm-arcade__ligne-info--jaune' : 'clm-arcade__ligne-info'}>
              <span>{hud.improved ? 'Nouveau record' : 'Écart au record'}</span>
              <span className="clm-arcade__chiffre">
                {hud.gap == null ? '—' : formatDelta(hud.gap)}
              </span>
            </p>
            {hud.penalty > 0 && (
              <p className="clm-arcade__ligne-info clm-arcade__ligne-info--rouge">
                <span>Pénalité</span>
                <span className="clm-arcade__chiffre">+{hud.penalty.toFixed(1)} s</span>
              </p>
            )}
            <div className="clm-arcade__actions">
              <button type="button" className="clm-arcade__bouton--principal" onClick={replay}>Rejouer</button>
            </div>
          </div>
        )}

        <div className="clm-arcade__commandes" aria-label="Commandes tactiles" style={{ touchAction: 'none' }}>
          <button type="button" {...press('left')}>Gauche</button>
          <button type="button" {...press('right')}>Droite</button>
          <button type="button" {...press('brake')}>Frein</button>
          <button type="button" {...press('throttle')}>Gaz</button>
          <button type="button" onClick={toggleCamera} aria-pressed={camera === 'cockpit'}>
            {camera === 'cockpit' ? 'Vue poursuite' : 'Vue cockpit'}
          </button>
        </div>
        <p className="clm-arcade__aide">
          Haut, W ou Z pour accélérer. Garde la touche pour braquer plus, tape-la pour corriger. Trop de gaz en virage et ça décroche. Espace pour freiner. C pour passer en vue cockpit. Couper un virage coûte du temps.
        </p>
      </div>
    </div>
  );
}

const SECTOR_LABELS = ['S1', 'S2', 'S3'] as const;

function formatSplit(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
  if (seconds >= 60) return formatLap(seconds);
  return seconds.toFixed(3);
}

function deltaTone(value: number | null): string {
  if (value == null) return '';
  return value <= 0 ? 'clm-arcade__chiffre--avance' : 'clm-arcade__chiffre--retard';
}

function messageDepart(hud: Hud): string {
  if (hud.best == null) return 'Premier passage : ce tour devient le record à battre.';
  if (hud.chasing) return `Record ${formatLap(hud.best)}. Reste devant le fantôme.`;
  return `Record ${formatLap(hud.best)}. Ce tour devient le passage à battre.`;
}

function liveMessage(hud: Hud, time: number): string {
  if (hud.phase === 'finished') return `Tour bouclé en ${formatLap(time)}`;
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
    chasing: (chasedLap(sim)?.samples.length ?? 0) > 1,
    accel: sim.phase === 'racing' ? sim.car.accel : 0,
    brake: sim.phase === 'racing' ? sim.car.brake : 0,
    steer: sim.phase === 'racing' ? sim.steer : 0,
    grade,
    corner,
    cut: sim.cut && now < sim.cut.until ? sim.cut.seconds : null,
    penalty: sim.car.penalty,
    rescued: sim.phase === 'racing' && now < sim.rescuedUntil,
    splits: sim.splits,
  };
}

/** Le tour choisi dans le classement, sinon le record personnel. */
function chasedLap(sim: Sim): LapRecord | null {
  if (sim.ghost && sim.ghost.samples.length > 1) return sim.ghost;
  return sim.record;
}

function rivalGhost(
  track: Track,
  lengthKm: number,
  elevation: ElevationSample[] | undefined,
  runoff: number,
  inputs: readonly ClmInputSpan[] | null | undefined,
): LapRecord | null {
  if (!inputs || inputs.length === 0) return null;
  const replay = replayLap(track, inputs, { lengthKm, elevation, runoff });
  if (!replay.completed || replay.samples.length < 2) return null;
  return { time: replay.time, sectors: replay.sectors, samples: replay.samples };
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

async function submitOfficialLap(gameweekId: string, spans: readonly ClmInputSpan[]): Promise<number> {
  const inputs = await serializeLapInputs(spans);
  const data = await apiFetch<{ time: number }>('/api/clm/laps', {
    method: 'POST',
    body: JSON.stringify({ gameweek_id: gameweekId, inputs }),
  });
  if (typeof data.time !== 'number' || !Number.isFinite(data.time)) {
    throw new Error('Temps officiel illisible');
  }
  return data.time;
}

function Pedal({ label, value, tone }: { label: string; value: number; tone: 'accel' | 'brake' }) {
  const amount = Math.max(0, Math.min(1, value));
  return (
    <div>
      <div className="clm-arcade__jauge-ligne">
        <span>{label}</span>
        <span className="clm-arcade__chiffre">{Math.round(amount * 100)}</span>
      </div>
      <div className="clm-arcade__jauge-piste">
        <span
          className={tone === 'brake' ? 'clm-arcade__jauge-remplissage clm-arcade__jauge-remplissage--frein' : 'clm-arcade__jauge-remplissage'}
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
    <div className="clm-arcade__jauge-ligne">
      <span>{label}</span>
      <span className="clm-arcade__chiffre">
        {percent > 0 ? '↗' : percent < 0 ? '↘' : '→'} {Math.abs(percent)} %
      </span>
    </div>
  );
}

function SteerGauge({ value }: { value: number }) {
  const amount = Math.max(-1, Math.min(1, value));
  const width = Math.abs(amount) * 50;
  const limite = Math.abs(amount) > 0.95;
  return (
    <div>
      <div className="clm-arcade__jauge-ligne">
        <span>Direction</span>
        <span className="clm-arcade__chiffre">
          {Math.round(Math.abs(amount) * 100)}{amount < -0.005 ? ' G' : amount > 0.005 ? ' D' : ''}
        </span>
      </div>
      <div className="clm-arcade__jauge-piste">
        <span className="clm-arcade__jauge-axe" />
        <span
          className={limite ? 'clm-arcade__jauge-remplissage clm-arcade__jauge-remplissage--limite' : 'clm-arcade__jauge-remplissage'}
          style={amount < 0
            ? { position: 'absolute', top: 0, bottom: 0, right: '50%', width: `${width}%` }
            : { position: 'absolute', top: 0, bottom: 0, left: '50%', width: `${width}%` }}
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
  pose: { x: number; y: number },
  time: number,
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
  const ghost = sim.phase === "racing" ? sampleAtTime(chasedLap(sim)?.samples ?? [], time) : null;
  if (ghost) {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(ghost.x, ghost.y, track.halfWidth * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#e10600";
  ctx.beginPath();
  ctx.arc(pose.x, pose.y, track.halfWidth * 0.55, 0, Math.PI * 2);
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

