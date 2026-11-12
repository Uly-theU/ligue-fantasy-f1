/** Le décor ne doit pas recouvrir l'asphalte, y compris par les coins d'une boîte droite dans un virage. */

import { paintedHalf, paintedHalfAt, type Track } from '@/lib/track-path';

/** Distance à une autre portion du tour. La portion en cours, sur 5 % du tour, ne compte pas. */
export function otherClearance(track: Track, x: number, y: number, s: number): number {
  let best = Infinity;
  for (const point of track.points) {
    let along = Math.abs(point.s - s);
    if (track.closed) along = Math.min(along, track.length - along);
    if (along < track.length * 0.05) continue;
    best = Math.min(best, Math.hypot(point.x - x, point.y - y));
  }
  return best;
}

/** Distance au centre du ruban, et abscisse du point le plus proche. */
export function nearestCenter(track: Track, x: number, y: number): { distance: number; s: number } {
  const points = track.points;
  const count = track.closed ? points.length : points.length - 1;
  let best = Infinity;
  let bestS = 0;
  for (let i = 0; i < count; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const raw = len2 > 1e-8 ? ((x - a.x) * dx + (y - a.y) * dy) / len2 : 0;
    const t = Math.max(0, Math.min(1, raw));
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const distance = Math.hypot(x - px, y - py);
    if (distance >= best) continue;
    best = distance;
    const s1 = track.closed && (i + 1) % points.length === 0 ? track.length : b.s;
    bestS = a.s + (s1 - a.s) * t;
  }
  return { distance: best, s: bestS };
}

/** Positif : on est hors de la peinture. Négatif : on est sur l'asphalte ou le vibreur. */
export function paintClearance(track: Track, x: number, y: number): number {
  const nearest = nearestCenter(track, x, y);
  return nearest.distance - paintedHalfAt(track, nearest.s);
}

/**
 * Vrai si le point, élargi de `pad`, tombe sur une autre portion du tour.
 * La portion en cours est ignorée : c'est le test des rubans voisins, pas celui de l'asphalte local.
 */
export function coversOther(track: Track, x: number, y: number, s: number, pad: number): boolean {
  const skip = Math.max(paintedHalf(track) * 2.4, track.length * 0.008);
  for (const point of track.points) {
    let along = Math.abs(point.s - s);
    if (track.closed) along = Math.min(along, track.length - along);
    if (along < skip) continue;
    if (Math.hypot(point.x - x, point.y - y) < paintedHalfAt(track, point.s) + pad) return true;
  }
  return false;
}

/**
 * Vrai si la boîte posée en (x, y), alignée sur `angle`, mord la peinture.
 * `length` suit le cap, `depth` est la largeur en travers.
 */
export function boxOnPaint(
  track: Track,
  x: number,
  y: number,
  angle: number,
  length: number,
  depth: number,
  margin = 0,
): boolean {
  const alongX = Math.cos(angle);
  const alongY = Math.sin(angle);
  const leftX = -Math.sin(angle);
  const leftY = Math.cos(angle);
  const halfL = length / 2;
  const halfD = depth / 2;
  for (let i = 0; i <= 6; i += 1) {
    const u = -1 + (2 * i) / 6;
    for (let k = 0; k < 3; k += 1) {
      const v = k - 1;
      const px = x + alongX * halfL * u + leftX * halfD * v;
      const py = y + alongY * halfL * u + leftY * halfD * v;
      if (paintClearance(track, px, py) <= margin) return true;
    }
  }
  return false;
}
