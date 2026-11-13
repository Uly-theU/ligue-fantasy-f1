import { describe, expect, it } from 'vitest';
import { CLM_STEP_SECONDS, createCar, rampSteer, steerResponse, stepClm, topSpeed, type ClmCar } from '@/lib/clm';
import {
  clampClmInput,
  createLapInputLog,
  parseLapInputs,
  recordLapInput,
  replayLap,
  serializeLapInputs,
  type ClmInputSpan,
  type LapInputLog,
} from '@/lib/clm-replay';
import { pointAt, trackFromSvg, type Track } from '@/lib/track-path';

const ANNEAU = '<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="48" d="M280 40 A 240 240 0 1 1 279.5 40 Z"/></svg>';
const LENGTH_KM = 5.2;

describe('entrées du tour', () => {
  it('regroupe une entrée identique sur plusieurs pas', () => {
    const log = createLapInputLog();
    recordLapInput(log, { steer: 0, brake: 0, throttle: 1 });
    recordLapInput(log, { steer: 0, brake: 0, throttle: 1 });
    recordLapInput(log, { steer: 0.2, brake: 0, throttle: 1 });
    expect(log.spans).toEqual([
      { steer: 0, throttle: 1, brake: 0, steps: 2 },
      { steer: 0.2, throttle: 1, brake: 0, steps: 1 },
    ]);
  });

  it('rejoue un tour simulé avec exactement le même temps', async () => {
    const track = trackFromSvg(ANNEAU)!;
    const driven = driveLap(track, LENGTH_KM);
    expect(driven.car.finished).toBe(true);

    const replay = replayLap(track, driven.log.spans, { lengthKm: LENGTH_KM });
    expect(replay.completed).toBe(true);
    if (!replay.completed) return;
    expect(replay.time).toBe(driven.car.time);
    expect(replay.penalty).toBe(driven.car.penalty);
    expect(replay.sectors).toHaveLength(3);
    expect(replay.sectors[2]).toBe(replay.time);
    expect(replay.sectors[0]).toBeLessThan(replay.sectors[1]);
    expect(replay.sectors[1]).toBeLessThanOrEqual(replay.sectors[2]);

    const serialized = await serializeLapInputs(driven.log.spans);
    const parsed = await parseLapInputs(serialized);
    expect(parsed).toEqual(driven.log.spans);
    const again = replayLap(track, parsed ?? [], { lengthKm: LENGTH_KM });
    expect(again.completed).toBe(true);
    if (again.completed) expect(again.time).toBe(driven.car.time);
  });

  it('répond « tour non bouclé » quand les entrées s’arrêtent avant la ligne', () => {
    const track = trackFromSvg(ANNEAU)!;
    const driven = driveLap(track, LENGTH_KM);
    expect(driven.car.finished).toBe(true);
    const total = driven.log.spans.reduce((sum, span) => sum + span.steps, 0);
    const cut = truncate(driven.log.spans, Math.max(1, Math.floor(total * 0.4)));

    const replay = replayLap(track, cut, { lengthKm: LENGTH_KM });
    expect(replay).toEqual({ completed: false, outcome: 'tour non bouclé' });
    expect(Object.hasOwn(replay, 'time')).toBe(false);
    expect(replayLap(track, [])).toEqual({ completed: false, outcome: 'tour non bouclé' });
  });

  it('borne un volant à 3 et un gaz négatif au lieu de les rejouer tels quels', () => {
    expect(clampClmInput({ steer: 3, throttle: -0.4, brake: 5 })).toEqual({
      steer: 1,
      throttle: 0,
      brake: 1,
    });
    expect(clampClmInput({ steer: -3, throttle: 4, brake: 0.25 })).toEqual({
      steer: -1,
      throttle: 1,
      brake: 0.25,
    });

    const log = createLapInputLog();
    recordLapInput(log, { steer: 3, throttle: -1, brake: 0 });
    expect(log.spans[0]).toEqual({ steer: 1, throttle: 0, brake: 0, steps: 1 });
    expect(log.spans[0].steer).not.toBe(3);
    expect(log.spans[0].throttle).toBeGreaterThanOrEqual(0);

    const track = trackFromSvg(ANNEAU)!;
    const hostile: ClmInputSpan[] = [{ steer: 3, throttle: -0.4, brake: 5, steps: 360 }];
    const bounded: ClmInputSpan[] = [{ steer: 1, throttle: 0, brake: 1, steps: 360 }];
    expect(replayLap(track, hostile, { lengthKm: LENGTH_KM })).toEqual(
      replayLap(track, bounded, { lengthKm: LENGTH_KM }),
    );
  });

  it('sérialise un tour de 90 s tenu au clavier en moins de 20 Ko', async () => {
    const track = trackFromSvg(ANNEAU)!;
    const log = keyboardLap(track, LENGTH_KM, 90);
    const steps = log.spans.reduce((sum, span) => sum + span.steps, 0);
    expect(steps).toBe(90 * 120);
    const serialized = await serializeLapInputs(log.spans);
    expect(serialized.length).toBeLessThan(20 * 1024);
    const parsed = await parseLapInputs(serialized);
    expect(parsed).toEqual(log.spans);
  });
});

function driveLap(track: Track, lengthKm: number): { car: ClmCar; log: LapInputLog } {
  const max = topSpeed(track, lengthKm);
  let car = createCar(track);
  let wheel = 0;
  const log = createLapInputLog();
  for (let n = 0; n < 120 * 150 && !car.finished; n += 1) {
    const look = pointAt(track, car.s + track.halfWidth * 4);
    const aim = Math.atan2(look.y - car.y, look.x - car.x);
    const diff = Math.atan2(Math.sin(aim - car.heading), Math.cos(aim - car.heading));
    const wanted = Math.max(-1, Math.min(1, diff / 0.45));
    wheel = rampSteer(wheel, wanted, CLM_STEP_SECONDS, max > 0 ? car.speed / max : 0);
    const steer = steerResponse(wheel);
    const input = { steer, brake: 0, throttle: 1 };
    recordLapInput(log, input);
    car = stepClm(track, car, input, CLM_STEP_SECONDS, lengthKm);
  }
  return { car, log };
}

/** Tenue clavier : la cible ne change qu’une fois par seconde, au plus. */
function keyboardLap(track: Track, lengthKm: number, seconds: number): LapInputLog {
  const max = topSpeed(track, lengthKm);
  let car = createCar(track);
  let wheel = 0;
  const log = createLapInputLog();
  const total = seconds * 120;
  for (let step = 0; step < total; step += 1) {
    const keys = keysAt(step);
    wheel = rampSteer(wheel, keys.steer, CLM_STEP_SECONDS, max > 0 ? car.speed / max : 0);
    const steer = steerResponse(wheel);
    const input = { steer, brake: keys.brake, throttle: keys.throttle };
    recordLapInput(log, input);
    if (!car.finished) car = stepClm(track, car, input, CLM_STEP_SECONDS, lengthKm);
  }
  return log;
}

function keysAt(step: number): { steer: -1 | 0 | 1; throttle: 0 | 1; brake: 0 | 1 } {
  const phase = Math.floor(step / 120) % 8;
  if (phase < 4) return { steer: 0, throttle: 1, brake: 0 };
  if (phase === 4) return { steer: 0, throttle: 0, brake: 1 };
  if (phase < 7) return { steer: 1, throttle: 1, brake: 0 };
  return { steer: -1, throttle: 1, brake: 0 };
}

function truncate(spans: readonly ClmInputSpan[], keep: number): ClmInputSpan[] {
  const out: ClmInputSpan[] = [];
  let left = keep;
  for (const span of spans) {
    if (left <= 0) break;
    const steps = Math.min(span.steps, left);
    out.push({ ...span, steps });
    left -= steps;
  }
  return out;
}
