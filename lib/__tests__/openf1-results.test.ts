import { describe, expect, it } from 'vitest';
import { calculateDriverScore, DEFAULT_SCORING_RULES } from '@/lib/scoring';
import { mapOfficialResult } from '@/lib/openf1-results';
import { qualifyingSessionForPosition } from '@/lib/qualifying';

describe('mapOfficialResult', () => {
  it('ignore le dernier échantillon de position et marque un abandon', () => {
    const performance = mapOfficialResult({
      race: { driver_number: 1, position: 18, dnf: true, dns: false, dsq: false },
      qualifyingPosition: 5,
      gridPosition: 5,
      fastestLap: false,
      positionSamples: [
        { driver_number: 1, position: 5, date: '2026-03-15T16:00:00Z' },
      ],
    });

    expect(performance.race_position).toBe(18);
    expect(performance.dnf).toBe('unspecified');
    expect(performance.dotd).toBe(false);

    const score = calculateDriverScore(performance, DEFAULT_SCORING_RULES);
    expect(score.race).toBe(0);
  });

  it('prend la position officielle, pas le flux', () => {
    const performance = mapOfficialResult({
      race: { driver_number: 44, position: 7, dnf: false, dns: false, dsq: false },
      qualifyingPosition: 4,
      gridPosition: 4,
      fastestLap: false,
      positionSamples: [
        { driver_number: 44, position: 3, date: '2026-03-15T16:10:00Z' },
      ],
    });
    expect(performance.race_position).toBe(7);
  });
});

describe('qualifyingSessionForPosition', () => {
  it('suit la grille 2026 de 22 voitures', () => {
    expect(qualifyingSessionForPosition(10)).toBe('Q3');
    expect(qualifyingSessionForPosition(11)).toBe('Q2');
    expect(qualifyingSessionForPosition(16)).toBe('Q2');
    expect(qualifyingSessionForPosition(17)).toBe('Q1');
    expect(qualifyingSessionForPosition(22)).toBe('Q1');
  });

  it('rejette une place hors grille', () => {
    expect(qualifyingSessionForPosition(0)).toBeNull();
    expect(qualifyingSessionForPosition(23)).toBeNull();
  });
});
