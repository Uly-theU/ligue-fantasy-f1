import { describe, expect, it } from 'vitest';
import { buildRecord, crossedSector, deltaAt, formatDelta, parseRecord, sampleAtTime, timeAtS, type LapSample } from '@/lib/clm-record';

const samples: LapSample[] = [
  { t: 0, s: 0, x: 0, y: 0, h: 0 },
  { t: 10, s: 100, x: 100, y: 0, h: 0 },
  { t: 30, s: 200, x: 200, y: 20, h: 1 },
];

describe('record de tour', () => {
  it('situe le temps du record à une distance', () => {
    expect(timeAtS(samples, 50)).toBeCloseTo(5);
    expect(timeAtS(samples, 150)).toBeCloseTo(20);
    expect(timeAtS(samples, 999)).toBe(30);
  });

  it('donne un écart négatif quand on est plus rapide', () => {
    const record = buildRecord(30, samples, 300);
    expect(deltaAt(record, 100, 8)).toBeCloseTo(-2);
    expect(record.sectors?.[0]).toBeCloseTo(10);
    expect(record.sectors?.[1]).toBeCloseTo(30);
    expect(record.sectors?.[2]).toBe(30);
  });

  it('place le fantôme au même instant', () => {
    const ghost = sampleAtTime(samples, 20);
    expect(ghost).not.toBeNull();
    expect(ghost!.x).toBeCloseTo(150);
    expect(ghost!.y).toBeCloseTo(10);
  });

  it('repère le passage des secteurs', () => {
    expect(crossedSector(10, 40, 90)).toBe(1);
    expect(crossedSector(40, 70, 90)).toBe(2);
    expect(crossedSector(70, 80, 90)).toBeNull();
    expect(crossedSector(80, 5, 90)).toBeNull();
  });

  it('formate l’écart et relit un record', () => {
    expect(formatDelta(-0.214)).toBe('−0.214');
    expect(formatDelta(1.2)).toBe('+1.200');
    expect(formatDelta(0)).toBe('0.000');
    const raw = JSON.stringify(buildRecord(30, samples, 300));
    expect(parseRecord(raw)?.time).toBe(30);
    expect(parseRecord('non')).toBeNull();
    expect(parseRecord(null)).toBeNull();
  });
});
