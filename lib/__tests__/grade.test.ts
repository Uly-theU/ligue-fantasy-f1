import { describe, expect, it } from 'vitest';
import { createCar, stepClm, topSpeed } from '@/lib/clm';
import { gradeAccel, sampleElevation, smoothElevation } from '@/lib/grade';
import { trackFromSvg } from '@/lib/track-path';

const STRAIGHT = '<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="20" d="M0 50 H400"/></svg>';

describe('dénivelé', () => {
  it('freine en montée et pousse en descente', () => {
    expect(gradeAccel(0)).toBe(0);
    expect(gradeAccel(0.08)).toBeCloseTo(-9.81 * Math.sin(Math.atan(0.08)), 6);
    expect(gradeAccel(-0.05)).toBeCloseTo(9.81 * Math.sin(Math.atan(0.05)), 6);
    expect(gradeAccel(Number.NaN)).toBe(0);
  });

  it('lit une pente de 8 % et une descente de 5 %', () => {
    const climb = sampleElevation([{ s: 0, z: 0 }, { s: 500, z: 40 }], 200, 500, 1, 0, false);
    const drop = sampleElevation([{ s: 250, z: 0 }, { s: 0, z: 12.5 }], 100, 250, 1, 0, false);
    expect(climb.grade).toBeCloseTo(0.08, 6);
    expect(drop.grade).toBeCloseTo(-0.05, 6);
    expect(climb.load).toBe(1);
    expect(drop.load).toBe(1);
  });

  it('déleste une crête et charge une cuvette, seulement en vitesse', () => {
    const crest = [{ s: 0, z: 0 }, { s: 100, z: 8 }, { s: 200, z: 0 }];
    const dip = [{ s: 0, z: 8 }, { s: 100, z: 0 }, { s: 200, z: 8 }];
    const stopped = sampleElevation(crest, 100, 200, 1, 0, false);
    const flying = sampleElevation(crest, 100, 200, 1, 50, false);
    const loaded = sampleElevation(dip, 100, 200, 1, 50, false);
    const onTheClimb = sampleElevation(crest, 50, 200, 1, 50, false);
    expect(stopped.load).toBe(1);
    expect(flying.grade).toBeCloseTo(-0.08, 5);
    expect(flying.load).toBeLessThan(0.7);
    expect(loaded.load).toBeGreaterThan(1.3);
    expect(onTheClimb.grade).toBeCloseTo(0.08, 5);
    expect(onTheClimb.load).toBe(1);
    expect(sampleElevation(crest, 100, 200, 1, 120, false).load).toBeCloseTo(0.35, 5);
  });

  it('ferme la pente sur un circuit bouclé, même si les points sont dans le désordre', () => {
    const samples = [{ s: 600, z: 40 }, { s: 100, z: 0 }];
    const uphill = sampleElevation(samples, 300, 1000, 1, 30, true);
    const downhill = sampleElevation(samples, 50, 1000, 1, 30, true);
    expect(uphill.grade).toBeCloseTo(0.08, 5);
    expect(downhill.grade).toBeCloseTo(-0.08, 5);
    expect(sampleElevation([], 10, 100, 1, 40, true)).toEqual({ grade: 0, load: 1 });
    expect(sampleElevation([{ s: 0, z: 12 }], 10, 100, 1, 40, false)).toEqual({ grade: 0, load: 1 });
  });

  it('lisse les marches du modèle de terrain sans effacer une vraie côte', () => {
    const steps: Array<{ s: number; z: number }> = [];
    for (let i = 0; i <= 40; i += 1) steps.push({ s: i * 25, z: i === 20 ? 9 : 0 });
    const smoothed = smoothElevation(steps, 1000, 1, false);
    const spike = smoothed.reduce((best, sample) => Math.max(best, sample.z), 0);
    expect(spike).toBeLessThan(4);

    const hill = [{ s: 0, z: 0 }, { s: 500, z: 20 }, { s: 1000, z: 40 }];
    const kept = smoothElevation(hill, 1000, 1, false);
    const crest = kept.reduce((best, sample) => Math.max(best, sample.z), 0);
    expect(crest).toBeGreaterThan(30);
  });

  it('ralentit la voiture en montée et la laisse filer en descente', () => {
    const track = trackFromSvg(STRAIGHT)!;
    const lengthKm = track.length / 1000;
    const speed = 40;
    const start = createCar(track);
    const seeded = {
      ...start,
      speed,
      vx: Math.cos(start.heading) * speed,
      vy: Math.sin(start.heading) * speed,
    };
    const input = { steer: 0, brake: 0, throttle: 0 };
    const flat = stepClm(track, seeded, input, 1, lengthKm);
    const level = stepClm(track, seeded, input, 1, lengthKm, [
      { s: 0, z: 5 },
      { s: track.length, z: 5 },
    ]);
    const uphill = stepClm(track, seeded, input, 1, lengthKm, [
      { s: 0, z: 0 },
      { s: track.length, z: track.length * 0.08 },
    ]);
    const downhill = stepClm(track, seeded, input, 1, lengthKm, [
      { s: 0, z: track.length * 0.08 },
      { s: track.length, z: 0 },
    ]);
    expect(level.speed).toBeCloseTo(flat.speed, 4);
    expect(uphill.speed).toBeLessThan(flat.speed - 0.4);
    expect(downhill.speed).toBeGreaterThan(flat.speed + 0.4);
    expect(uphill.offTrack).toBe(false);
    expect(topSpeed(track, lengthKm)).toBeGreaterThan(speed);
  });
});
