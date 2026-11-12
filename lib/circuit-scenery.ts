/** Bâtiments, stands et tribunes posés hors de l'asphalte. Une boîte droite dans une épingle est refusée. */

import { bankOffset } from '@/lib/circuit-banking';
import { RUNOFF_RATIO, STREET_RUNOFF_RATIO } from '@/lib/clm';
import { boxOnPaint, coversOther, otherClearance } from '@/lib/track-clearance';
import { bankAt, narrowAt, paintedHalf, paintedHalfAt, pointAt, type Track } from '@/lib/track-path';

export type Footprint = {
  x: number;
  y: number;
  s: number;
  angle: number;
  length: number;
  depth: number;
  lift: number;
};

export type Placed = Footprint & { height: number; color: string };

const STAND_COLORS = ['#9b1d32', '#e6e1d6', '#1e3f78', '#c6a15a', '#245c3a'];
const BLOCK_COLORS = ['#c8c2b4', '#b7b0a4', '#d9d3c6', '#a39e96', '#e6dfd2', '#8e8a84'];
const NIGHT_COLORS = ['#f3efe6', '#e7e2d8', '#f7f4ee', '#ddd6cc'];

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function outerHalf(track: Track, half: number, s: number): number {
  const n = narrowAt(track, s);
  const gravel = half * 1.48;
  const limit = paintedHalf(track);
  const t = Math.max(0, Math.min(1, (n - 0.85) / 0.15));
  return n * (limit + (gravel - limit) * t);
}

function beside(
  track: Track,
  half: number,
  s: number,
  side: number,
  extra: number,
  walls: boolean,
): Footprint {
  const spot = pointAt(track, s);
  const nx = -Math.sin(spot.angle);
  const nz = Math.cos(spot.angle);
  const reach = paintedHalfAt(track, s) * (walls ? STREET_RUNOFF_RATIO : RUNOFF_RATIO) + extra;
  const raised = bankOffset(side * reach, bankAt(track, s), outerHalf(track, half, s));
  return {
    x: spot.x + nx * raised.lateral,
    y: spot.y + nz * raised.lateral,
    s: spot.s,
    angle: spot.angle,
    length: 0,
    depth: 0,
    lift: raised.y,
  };
}

/** Centre hors des autres rubans, et rectangle entier hors de la peinture. */
export function placeBox(
  track: Track,
  half: number,
  s: number,
  side: number,
  extra: number,
  length: number,
  depth: number,
  walls: boolean,
): Footprint | null {
  const pad = depth * 0.5;
  const margin = half * 0.04;
  const center = beside(track, half, s, side, extra, walls);
  if (coversOther(track, center.x, center.y, center.s, pad)) return null;
  for (const shift of [length * 0.45, -length * 0.45]) {
    const end = beside(track, half, s + shift, side, extra, walls);
    if (coversOther(track, end.x, end.y, end.s, pad)) return null;
  }
  if (boxOnPaint(track, center.x, center.y, center.angle, length, depth, margin)) return null;
  return { ...center, length, depth };
}

export function planPit(track: Track, half: number, walls: boolean): { box: Placed | null; side: number } {
  const depth = half * 0.85;
  const length = half * 7.2;
  const extra = depth * 0.5 + half * 0.22;
  let best: { box: Footprint; side: number; room: number } | null = null;
  for (let s = track.length * 0.012; s < track.length * 0.22; s += Math.max(half * 0.8, track.length * 0.008)) {
    for (const side of [1, -1]) {
      const box = placeBox(track, half, s, side, extra, length, depth, walls);
      if (!box) continue;
      const room = otherClearance(track, box.x, box.y, box.s);
      if (!best || room > best.room) best = { box, side, room };
    }
  }
  if (!best) return { box: null, side: 1 };
  return {
    side: best.side,
    box: { ...best.box, height: half * 0.62, color: '#2c323a' },
  };
}

export function planStands(track: Track, half: number, pitSide: number, walls: boolean): Placed[] {
  const places: Placed[] = [];
  const side = -pitSide;
  for (const [from, to] of [[0.008, 0.16], [0.46, 0.55]] as const) {
    for (let s = track.length * from; s < track.length * to; s += half * 1.7) {
      const depth = half * 0.48;
      const length = half * 1.45;
      const box = placeBox(track, half, s, side, depth * 0.5 + half * 0.18, length, depth, walls);
      if (!box) continue;
      const height = half * (0.42 + hash(places.length + 1, 3) * 0.55);
      places.push({ ...box, height, color: STAND_COLORS[places.length % STAND_COLORS.length] });
    }
  }
  return places;
}

export function planBlocks(track: Track, half: number, blocks: number, walls: boolean, night: boolean): Placed[] {
  if (blocks <= 0) return [];
  const places: Placed[] = [];
  const colors = night ? NIGHT_COLORS : BLOCK_COLORS;
  const points = track.points;
  const step = Math.max(1, Math.floor(points.length / 40));
  for (let i = 0; i < points.length; i += step) {
    if (hash(i, 11) > blocks) continue;
    const depth = half * (0.65 + hash(i, 13) * 0.85);
    const length = half * (0.9 + hash(i, 14) * 1.45);
    let height = half * (0.65 + hash(i, 15) * (walls ? 2.1 : 1.05));
    if (hash(i, 12) > 0.86) height *= 1.7;
    const extra = depth * 0.5 + half * (0.2 + hash(i, 16) * (walls ? 0.45 : 1.6));
    const prefer = hash(i, 17) > 0.5 ? 1 : -1;
    const box = placeBox(track, half, points[i].s, prefer, extra, length, depth, walls)
      ?? placeBox(track, half, points[i].s, -prefer, extra, length, depth, walls);
    if (!box) continue;
    places.push({ ...box, height, color: colors[places.length % colors.length] });
  }
  return places;
}
