import { describe, expect, it } from 'vitest';
import type { Track, TrackPoint } from '@/lib/track-path';
import { resampleLoop } from './historic-loop';
import { brakeBoards } from './road';
import { heightOf, nearestPoint } from './terrain';

function trackFrom(points: TrackPoint[], halfWidth: number, closed = false): Track {
  const length = closed
    ? points[points.length - 1].s
    : points[points.length - 1].s;
  return { points, length, halfWidth, closed };
}

function straight(count: number, spacing: number, halfWidth: number): Track {
  const points: TrackPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    points.push({ x: i * spacing, y: 0, s: i * spacing, angle: 0 });
  }
  return trackFrom(points, halfWidth);
}

/** Ligne droite puis un coude assez franc pour poser des panneaux de freinage. */
function kinked(): Track {
  const spacing = 20;
  const count = 80;
  const turnAt = 50;
  const points: TrackPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = i >= turnAt ? 0.8 : 0;
    const prev = points[i - 1];
    points.push({
      x: prev ? prev.x + Math.cos(points[i - 1].angle) * spacing : 0,
      y: prev ? prev.y + Math.sin(points[i - 1].angle) * spacing : 0,
      s: i * spacing,
      angle,
    });
  }
  return trackFrom(points, 6);
}

describe('heightOf', () => {
  const line = [
    { s: 0, z: 0 },
    { s: 10, z: 10 },
    { s: 20, z: 20 },
    { s: 30, z: 30 },
  ];

  it('interpole une pente régulière au milieu d’un segment', () => {
    expect(heightOf(line, 15, 40, false)).toBeCloseTo(15, 6);
  });

  it('renvoie 0 sans nœud, la seule cote s’il n’y en a qu’une, et cale un tracé ouvert hors de l’intervalle', () => {
    expect(heightOf([], 5, 10, false)).toBe(0);
    expect(heightOf([{ s: 0, z: 4 }], 99, 0, false)).toBe(0);
    expect(heightOf([{ s: 0, z: 4 }], 99, 10, true)).toBe(4);
    expect(heightOf([{ s: 5, z: 8 }, { s: 15, z: 20 }], 0, 20, false)).toBe(8);
    expect(heightOf([{ s: 5, z: 8 }, { s: 15, z: 20 }], 100, 20, false)).toBe(20);
  });

  it('referme la spline sur un anneau', () => {
    const ring = [
      { s: 0, z: 0 },
      { s: 10, z: 10 },
      { s: 20, z: 20 },
    ];
    expect(heightOf(ring, 5, 30, true)).toBeCloseTo(3.125, 6);
  });
});

describe('resampleLoop', () => {
  it('répartit un carré fermé sur le périmètre', () => {
    const samples = resampleLoop([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], 5);
    expect(samples.length).toBeGreaterThanOrEqual(8);
    expect(samples[0]).toEqual({ x: 0, y: 0 });
    for (const sample of samples) {
      expect(sample.x).toBeGreaterThanOrEqual(-1e-6);
      expect(sample.x).toBeLessThanOrEqual(10 + 1e-6);
      expect(sample.y).toBeGreaterThanOrEqual(-1e-6);
      expect(sample.y).toBeLessThanOrEqual(10 + 1e-6);
      const onEdge = sample.x < 1e-6 || Math.abs(sample.x - 10) < 1e-6 || sample.y < 1e-6 || Math.abs(sample.y - 10) < 1e-6;
      expect(onEdge).toBe(true);
    }
  });

  it('renvoie un tableau vide si la boucle n’a pas deux points distincts', () => {
    expect(resampleLoop([], 5)).toEqual([]);
    expect(resampleLoop([[0, 0]], 5)).toEqual([]);
    expect(resampleLoop([[0, 0], [0.01, 0]], 1)).toEqual([]);
  });
});

describe('nearestPoint', () => {
  const points: TrackPoint[] = [
    { x: 0, y: 0, s: 0, angle: 0 },
    { x: 10, y: 0, s: 10, angle: 0 },
    { x: 10, y: 10, s: 20, angle: Math.PI / 2 },
  ];

  function bucketsOf(cell: number) {
    const buckets = new Map<string, number[]>();
    points.forEach((point, index) => {
      const key = `${Math.floor(point.x / cell)}:${Math.floor(point.y / cell)}`;
      const list = buckets.get(key);
      if (list) list.push(index);
      else buckets.set(key, [index]);
    });
    return buckets;
  }

  it('retrouve le sommet le plus proche dans sa cellule', () => {
    const found = nearestPoint(bucketsOf(5), points, 5, 10, 10);
    expect(found.index).toBe(2);
    expect(found.distance).toBeCloseTo(0, 6);
  });

  it('parcourt tous les points quand aucun seau voisin ne répond, et reste défini sans point', () => {
    const far = nearestPoint(bucketsOf(5), points, 5, 100, 100);
    expect(far.index).toBe(2);
    expect(far.distance).toBeCloseTo(Math.hypot(90, 90), 6);
    const empty = nearestPoint(new Map(), [], 5, 0, 0);
    expect(empty.index).toBe(0);
    expect(empty.distance).toBe(Infinity);
  });
});

describe('brakeBoards', () => {
  it('pose les panneaux 50, 100 et 150 avant un coude', () => {
    const boards = brakeBoards(kinked(), 5);
    expect(boards.length).toBeGreaterThan(0);
    const labels = new Set(boards.map((board) => board.label));
    expect(labels.has('50') || labels.has('100') || labels.has('150')).toBe(true);
    for (const board of boards) {
      expect(['50', '100', '150']).toContain(board.label);
      expect(Number.isFinite(board.s)).toBe(true);
      expect(Number.isFinite(board.x)).toBe(true);
      expect(Number.isFinite(board.y)).toBe(true);
    }
  });

  it('n’en pose aucun sur une ligne droite, et traite une longueur nulle comme le kilométrage par défaut', () => {
    expect(brakeBoards(straight(30, 10, 4), 5)).toEqual([]);
    const kink = kinked();
    expect(brakeBoards(kink, 0)).toEqual(brakeBoards(kink, 4.304));
  });
});
