import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bankOffset, bankTrack } from '@/lib/circuit-banking';
import { createCar, stepClm, topSpeed } from '@/lib/clm';
import { bankAt, orientTrack, pointAt, trackFromSvg } from '@/lib/track-path';

const STRAIGHT = '<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="20" d="M0 50 H400"/></svg>';

describe('dévers', () => {
  it('pivote autour du bord intérieur : il reste au sol, l’extérieur monte', () => {
    const outer = 10;
    const bank = (18 * Math.PI) / 180;
    expect(bankOffset(4, 0, outer)).toEqual({ lateral: 4, y: 0 });
    expect(bankOffset(-outer, bank, outer).y).toBeCloseTo(0, 5);
    expect(bankOffset(outer, bank, outer).y).toBeCloseTo(2 * outer * Math.sin(bank), 4);
    expect(bankOffset(0, bank, outer).y).toBeCloseTo(outer * Math.sin(bank), 4);
    expect(bankOffset(outer, -bank, outer).y).toBeCloseTo(0, 5);
    expect(bankOffset(-outer, -bank, outer).y).toBeCloseTo(2 * outer * Math.sin(bank), 4);
  });

  it('relève Hugenholtz et Arie Luyendyk, et laisse la ligne droite plate', () => {
    const dir = path.join(process.cwd(), 'lib/circuits/2026');
    const svg = readFileSync(path.join(dir, '12-zandvoort.svg'), 'utf8');
    const drawn = trackFromSvg(svg);
    expect(drawn).not.toBeNull();
    const profile = (JSON.parse(readFileSync(path.join(dir, 'elevation.json'), 'utf8')) as {
      circuits: Record<string, { reverse: boolean; start: number }>;
    }).circuits.zandvoort;
    const corners = (JSON.parse(readFileSync(path.join(dir, 'corners.json'), 'utf8')) as {
      circuits: Record<string, { corners: Array<{ number: number; at: number }> }>;
    }).circuits.zandvoort.corners;
    const track = bankTrack(orientTrack(drawn!, profile), 'zandvoort', corners);

    for (const number of [3, 14]) {
      const at = corners.find((corner) => corner.number === number)!.at;
      const peak = bankAt(track, at * track.length);
      const span = track.length * 0.012;
      const before = pointAt(track, at * track.length - span);
      const after = pointAt(track, at * track.length + span);
      const delta = Math.atan2(Math.sin(after.angle - before.angle), Math.cos(after.angle - before.angle));
      expect(Math.abs(peak) * 180 / Math.PI).toBeCloseTo(18, 0);
      // Même côté que les panneaux : l'extérieur du virage, pas l'intérieur.
      const outside = delta > 0 ? -1 : 1;
      expect(Math.sign(peak)).toBe(outside);
    }
    expect(Math.abs(bankAt(track, track.length * 0.02))).toBeLessThan(0.01);
    expect(bankAt(bankTrack(drawn!, 'melbourne', corners), track.length * 0.2)).toBe(0);
  });

  it('relève La Monumental, extérieur en haut, et laisse les autres circuits plats', () => {
    const dir = path.join(process.cwd(), 'lib/circuits/2026');
    const svg = readFileSync(path.join(dir, '14-madring.svg'), 'utf8');
    const drawn = trackFromSvg(svg);
    expect(drawn).not.toBeNull();
    const profile = (JSON.parse(readFileSync(path.join(dir, 'elevation.json'), 'utf8')) as {
      circuits: Record<string, { reverse: boolean; start: number }>;
    }).circuits.madring;
    const corners = (JSON.parse(readFileSync(path.join(dir, 'corners.json'), 'utf8')) as {
      circuits: Record<string, { corners: Array<{ number: number; at: number }> }>;
    }).circuits.madring.corners;
    const track = bankTrack(orientTrack(drawn!, profile), 'madring', corners);
    const at = corners.find((corner) => corner.number === 12)!.at;
    const peak = bankAt(track, at * track.length);
    const span = track.length * 0.012;
    const before = pointAt(track, at * track.length - span);
    const after = pointAt(track, at * track.length + span);
    const delta = Math.atan2(Math.sin(after.angle - before.angle), Math.cos(after.angle - before.angle));
    const outside = delta > 0 ? -1 : 1;
    expect(Math.abs(peak) * 180 / Math.PI).toBeCloseTo(13.5, 0);
    expect(Math.sign(peak)).toBe(outside);
    expect(Math.abs(bankAt(track, track.length * 0.05))).toBeLessThan(0.01);
    expect(bankAt(bankTrack(drawn!, 'monaco', corners), track.length * 0.2)).toBe(0);
  });

  it('pousse la voiture vers le bord bas', () => {
    const track = trackFromSvg(STRAIGHT)!;
    track.bank = track.points.map(() => 0.5);
    const start = createCar(track);
    const speed = topSpeed(track) * 0.4;
    const drifted = stepClm(track, {
      ...start,
      speed,
      vx: Math.cos(start.heading) * speed,
      vy: Math.sin(start.heading) * speed,
    }, { steer: 0, brake: 0, throttle: 0.3 }, 1.2);
    expect(drifted.y).toBeLessThan(start.y - 0.02);
    expect(drifted.offTrack).toBe(false);
  });
});
