/** Centre du tracé, échantillonné depuis le SVG F1DB (le chemin est la ligne de course). */

export type TrackPoint = {
  x: number;
  y: number;
  s: number;
  angle: number;
};

export type Track = {
  points: TrackPoint[];
  length: number;
  halfWidth: number;
  closed: boolean;
  /** Par point, fraction de la largeur gardée là où une autre portion du tour passe à côté. Absent : pleine largeur partout. */
  narrow?: number[];
  /** Dévers en radians, un par point. Positif : le côté gauche, dans le sens de la marche, est le plus haut. */
  bank?: number[];
};

export type TrackProjection = {
  x: number;
  y: number;
  s: number;
  distance: number;
  angle: number;
};

const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/g;

const ARITY: Record<string, number> = {
  M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0,
};

type Pt = { x: number; y: number };

export function trackFromSvg(svg: string): Track | null {
  const chosen = widestPath(svg);
  if (!chosen) return null;
  const subpaths = flattenPath(chosen.d);
  const raw = subpaths.sort((a, b) => polylineLength(b, false) - polylineLength(a, false))[0];
  if (!raw || raw.points.length < 2) return null;
  const halfWidth = Math.max(4, chosen.strokeWidth / 2);
  const gap = Math.hypot(raw.points[0].x - raw.points[raw.points.length - 1].x, raw.points[0].y - raw.points[raw.points.length - 1].y);
  const closed = raw.closed || gap < Math.max(1.5, halfWidth * 0.35);
  const sampled = resample(raw.points, closed, halfWidth);
  if (!sampled || sampled.length < 8 || sampled.points.length < 8) return null;
  return { points: sampled.points, length: sampled.length, halfWidth, closed };
}

/**
 * Remet une boucle dans le sens de la course et fait partir le tour de la vraie ligne de départ.
 * `start` est une fraction du tour mesurée sur le tracé d'origine.
 */
export function orientTrack(track: Track, { reverse, start }: { reverse: boolean; start: number }): Track {
  if (!track.closed || track.points.length < 3) return track;
  const origin = pointAt(track, mod(start, 1) * track.length);
  const ring = reverse ? track.points.slice().reverse() : track.points.slice();
  const ringS = (index: number) => (reverse ? track.length - ring[index].s : ring[index].s);
  const startS = reverse ? track.length - origin.s : origin.s;
  let first = 0;
  let closest = Infinity;
  for (let i = 0; i < ring.length; i += 1) {
    const ahead = mod(ringS(i) - startS, track.length);
    if (ahead > 1e-9 && ahead < closest) {
      closest = ahead;
      first = i;
    }
  }
  const ordered = [{ x: origin.x, y: origin.y }];
  for (let k = 0; k < ring.length; k += 1) {
    const p = ring[(first + k) % ring.length];
    if (Math.hypot(p.x - origin.x, p.y - origin.y) > 1e-6) ordered.push({ x: p.x, y: p.y });
  }
  const points: TrackPoint[] = [];
  let travelled = 0;
  for (let i = 0; i < ordered.length; i += 1) {
    const a = ordered[i];
    const b = ordered[(i + 1) % ordered.length];
    points.push({ x: a.x, y: a.y, s: travelled, angle: Math.atan2(b.y - a.y, b.x - a.x) });
    travelled += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return { ...track, points, length: travelled };
}

/** Demi-largeur peinte : asphalte plus vibreurs, jusqu'au bord blanc. */
export function paintedHalf(track: Track): number {
  return track.halfWidth * 1.28;
}

const NARROW_FLOOR = 0.42;
/** Au-delà de cet écart d'altitude, les deux portions sont un pont : chacune garde sa largeur. */
const BRIDGE_M = 4;

/**
 * Rétrécit la piste là où une autre portion du tour passe à côté, pour que la peinture de l'une
 * ne recouvre pas l'autre. Le dessin, le hors-piste et le décor lisent tous cette même largeur.
 * `heightAt` est l'altitude en mètres : un pont (l'autre portion bien plus haut ou plus bas) n'est pas rétréci.
 */
export function narrowTrack(track: Track, heightAt?: (s: number) => number): Track {
  const points = track.points;
  const limit = paintedHalf(track);
  if (points.length < 3 || !(limit > 0)) return track;
  // Quelques largeurs de piste, pas une fraction du tour : l'épingle de Monaco
  // ramène l'autre moitié du virage à moins de 6 % du tour, et les rubans se recouvraient.
  const along = limit * 3.2;
  const gap = Math.max(limit * 0.08, 0.15);
  const keep = new Array<number>(points.length).fill(1);
  const lap = track.closed ? track.length : Infinity;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const separation = absDelta(points[i].s, points[j].s, lap);
      if (separation < along) continue;
      // Un pont est loin dans le tour. L'épingle du Fairmont descend de dix mètres
      // entre ses deux bords : ce n'est pas un passage supérieur, les rubans doivent se céder la place.
      const bridge = heightAt != null
        && Math.abs(heightAt(points[i].s) - heightAt(points[j].s)) >= BRIDGE_M
        && separation >= track.length * 0.15;
      if (bridge) continue;
      const room = (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) - gap) / 2 / limit;
      if (room < keep[i]) keep[i] = Math.max(NARROW_FLOOR, room);
      if (room < keep[j]) keep[j] = Math.max(NARROW_FLOOR, room);
    }
  }
  const { narrow: _previous, ...rest } = track;
  return keep.some((value) => value < 1) ? { ...rest, narrow: keep } : rest;
}

/** Fraction de largeur gardée à l'abscisse s. */
export function narrowAt(track: Track, s: number): number {
  const narrow = track.narrow;
  if (!narrow || narrow.length !== track.points.length) return 1;
  const pts = track.points;
  const target = track.closed ? mod(s, track.length) : Math.max(0, Math.min(track.length, s));
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pts[mid].s <= target) lo = mid;
    else hi = mid - 1;
  }
  const next = track.closed ? (lo + 1) % pts.length : Math.min(pts.length - 1, lo + 1);
  const s1 = track.closed && next === 0 ? track.length : pts[next].s;
  const span = s1 - pts[lo].s;
  const t = span > 1e-6 ? Math.max(0, Math.min(1, (target - pts[lo].s) / span)) : 0;
  return narrow[lo] + (narrow[next] - narrow[lo]) * t;
}

/** Bord du hors-piste à l'abscisse s, rétrécissement compris. */
export function paintedHalfAt(track: Track, s: number): number {
  return paintedHalf(track) * narrowAt(track, s);
}

/** Dévers en radians à l'abscisse s. Zéro si le circuit n'en a pas. */
export function bankAt(track: Track, s: number): number {
  return sampleAlong(track, track.bank, s);
}

function sampleAlong(track: Track, values: number[] | undefined, s: number): number {
  if (!values || values.length !== track.points.length) return 0;
  const pts = track.points;
  const target = track.closed ? mod(s, track.length) : Math.max(0, Math.min(track.length, s));
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pts[mid].s <= target) lo = mid;
    else hi = mid - 1;
  }
  const next = track.closed ? (lo + 1) % pts.length : Math.min(pts.length - 1, lo + 1);
  const s1 = track.closed && next === 0 ? track.length : pts[next].s;
  const span = s1 - pts[lo].s;
  const t = span > 1e-6 ? Math.max(0, Math.min(1, (target - pts[lo].s) / span)) : 0;
  return values[lo] + (values[next] - values[lo]) * t;
}

export function projectTrack(track: Track, x: number, y: number, hintS: number): TrackProjection {
  const local = localTrack(track, x, y, hintS);
  if (Number.isFinite(local.distance) && local.distance <= paintedHalf(track)) return local;
  return search(track, x, y, hintS, track.length, 0.5);
}

/** Projection limitée au voisinage de l'abscisse en cours. Une autre portion du circuit, même toute proche, n'est pas retenue.
 *  Le coût le long du tour empêche l'autre bord d'une épingle, plus proche en plan, de prendre la place du tronçon en cours. */
export function localTrack(track: Track, x: number, y: number, hintS: number): TrackProjection {
  const window = Math.max(28, track.halfWidth * 3);
  return search(track, x, y, hintS, window, 0.9);
}

/** Point du tracé le plus proche, sans préférence pour l'abscisse en cours. */
export function nearestTrack(track: Track, x: number, y: number): TrackProjection {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return search(track, x, y, 0, track.length, 0);
  return nearestIndexed(track, x, y);
}

export function pointAt(track: Track, s: number): TrackPoint {
  const length = track.length;
  const target = track.closed ? mod(s, length) : Math.max(0, Math.min(length, s));
  const pts = track.points;
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pts[mid].s <= target) lo = mid;
    else hi = mid - 1;
  }
  const a = pts[lo];
  const bIndex = track.closed ? (lo + 1) % pts.length : Math.min(pts.length - 1, lo + 1);
  const b = pts[bIndex];
  const s0 = a.s;
  const s1 = track.closed && bIndex === 0 ? length : b.s;
  const span = s1 - s0;
  const t = span > 1e-6 ? Math.max(0, Math.min(1, (target - s0) / span)) : 0;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    s: target,
    angle: span > 1e-6 ? Math.atan2(b.y - a.y, b.x - a.x) : a.angle,
  };
}

function widestPath(svg: string): { d: string; strokeWidth: number } | null {
  const tags = svg.match(/<path\b[^>]*>/gi) ?? [];
  let best: { d: string; strokeWidth: number } | null = null;
  for (const tag of tags) {
    const d = attr(tag, 'd');
    if (!d) continue;
    const strokeWidth = readStrokeWidth(tag);
    if (!best || strokeWidth > best.strokeWidth) best = { d, strokeWidth };
  }
  return best;
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
  return match?.[1] ?? null;
}

function readStrokeWidth(tag: string): number {
  const style = attr(tag, 'style') ?? '';
  const fromStyle = style.match(/stroke-width:\s*([0-9.]+)/i);
  if (fromStyle) return Number(fromStyle[1]);
  const direct = attr(tag, 'stroke-width');
  return direct ? Number(direct) : 8;
}

function flattenPath(d: string): Array<{ points: Pt[]; closed: boolean }> {
  const tokens = d.match(TOKEN) ?? [];
  const subpaths: Array<{ points: Pt[]; closed: boolean }> = [];
  let current: Pt[] = [];
  let closed = false;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let ctrlX = 0;
  let ctrlY = 0;
  let qcx = 0;
  let qcy = 0;
  let prev = '';
  let cmd = '';
  let i = 0;

  const push = (x: number, y: number) => {
    const last = current[current.length - 1];
    if (last && Math.hypot(last.x - x, last.y - y) < 1e-4) return;
    current.push({ x, y });
  };

  const endSubpath = () => {
    if (current.length > 1) subpaths.push({ points: current, closed });
    current = [];
    closed = false;
  };

  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) {
      cmd = tokens[i];
      i += 1;
      if (cmd === 'Z' || cmd === 'z') {
        push(sx, sy);
        cx = sx;
        cy = sy;
        closed = true;
        prev = cmd;
        continue;
      }
    }
    const kind = cmd.toUpperCase();
    const arity = ARITY[kind] ?? 0;
    if (!cmd || i + arity > tokens.length) break;
    const n = tokens.slice(i, i + arity).map(Number);
    i += arity;
    const rel = cmd === cmd.toLowerCase();

    if (kind === 'M') {
      endSubpath();
      cx = rel ? cx + n[0] : n[0];
      cy = rel ? cy + n[1] : n[1];
      sx = cx;
      sy = cy;
      push(cx, cy);
      cmd = rel ? 'l' : 'L';
    } else if (kind === 'L') {
      cx = rel ? cx + n[0] : n[0];
      cy = rel ? cy + n[1] : n[1];
      push(cx, cy);
    } else if (kind === 'H') {
      cx = rel ? cx + n[0] : n[0];
      push(cx, cy);
    } else if (kind === 'V') {
      cy = rel ? cy + n[0] : n[0];
      push(cx, cy);
    } else if (kind === 'C') {
      const p1 = { x: rel ? cx + n[0] : n[0], y: rel ? cy + n[1] : n[1] };
      const p2 = { x: rel ? cx + n[2] : n[2], y: rel ? cy + n[3] : n[3] };
      const p3 = { x: rel ? cx + n[4] : n[4], y: rel ? cy + n[5] : n[5] };
      curve(push, { x: cx, y: cy }, p1, p2, p3);
      ctrlX = p2.x;
      ctrlY = p2.y;
      cx = p3.x;
      cy = p3.y;
    } else if (kind === 'S') {
      const smooth = prev.toUpperCase() === 'C' || prev.toUpperCase() === 'S';
      const p1 = smooth ? { x: 2 * cx - ctrlX, y: 2 * cy - ctrlY } : { x: cx, y: cy };
      const p2 = { x: rel ? cx + n[0] : n[0], y: rel ? cy + n[1] : n[1] };
      const p3 = { x: rel ? cx + n[2] : n[2], y: rel ? cy + n[3] : n[3] };
      curve(push, { x: cx, y: cy }, p1, p2, p3);
      ctrlX = p2.x;
      ctrlY = p2.y;
      cx = p3.x;
      cy = p3.y;
    } else if (kind === 'Q') {
      const c = { x: rel ? cx + n[0] : n[0], y: rel ? cy + n[1] : n[1] };
      const p = { x: rel ? cx + n[2] : n[2], y: rel ? cy + n[3] : n[3] };
      quad(push, { x: cx, y: cy }, c, p);
      qcx = c.x;
      qcy = c.y;
      cx = p.x;
      cy = p.y;
    } else if (kind === 'T') {
      const smooth = prev.toUpperCase() === 'Q' || prev.toUpperCase() === 'T';
      const c = smooth ? { x: 2 * cx - qcx, y: 2 * cy - qcy } : { x: cx, y: cy };
      const p = { x: rel ? cx + n[0] : n[0], y: rel ? cy + n[1] : n[1] };
      quad(push, { x: cx, y: cy }, c, p);
      qcx = c.x;
      qcy = c.y;
      cx = p.x;
      cy = p.y;
    } else if (kind === 'A') {
      const end = { x: rel ? cx + n[5] : n[5], y: rel ? cy + n[6] : n[6] };
      arc(push, cx, cy, n[0], n[1], n[2], n[3], n[4], end.x, end.y);
      cx = end.x;
      cy = end.y;
    }
    prev = cmd;
  }
  endSubpath();
  return subpaths;
}

function curve(push: (x: number, y: number) => void, p0: Pt, p1: Pt, p2: Pt, p3: Pt) {
  const approx = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y) + Math.hypot(p3.x - p2.x, p3.y - p2.y);
  const steps = Math.max(2, Math.ceil(approx / 4));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    push(
      mt ** 3 * p0.x + 3 * mt ** 2 * t * p1.x + 3 * mt * t ** 2 * p2.x + t ** 3 * p3.x,
      mt ** 3 * p0.y + 3 * mt ** 2 * t * p1.y + 3 * mt * t ** 2 * p2.y + t ** 3 * p3.y,
    );
  }
}

function quad(push: (x: number, y: number) => void, p0: Pt, p1: Pt, p2: Pt) {
  const approx = Math.hypot(p1.x - p0.x, p1.y - p0.y) + Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const steps = Math.max(2, Math.ceil(approx / 4));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const mt = 1 - t;
    push(mt ** 2 * p0.x + 2 * mt * t * p1.x + t ** 2 * p2.x, mt ** 2 * p0.y + 2 * mt * t * p1.y + t ** 2 * p2.y);
  }
}

function arc(push: (x: number, y: number) => void, x1: number, y1: number, rx: number, ry: number, phiDeg: number, fa: number, fs: number, x2: number, y2: number) {
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx < 1e-6 || ry < 1e-6 || (Math.hypot(x2 - x1, y2 - y1) < 1e-6)) {
    push(x2, y2);
    return;
  }
  const phi = (phiDeg * Math.PI) / 180;
  const sin = Math.sin(phi);
  const cos = Math.cos(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  let rxsq = rx * rx;
  let rysq = ry * ry;
  const lam = (x1p * x1p) / rxsq + (y1p * y1p) / rysq;
  if (lam > 1) {
    const scale = Math.sqrt(lam);
    rx *= scale;
    ry *= scale;
    rxsq = rx * rx;
    rysq = ry * ry;
  }
  const num = Math.max(0, rxsq * rysq - rxsq * y1p * y1p - rysq * x1p * x1p);
  const den = rxsq * y1p * y1p + rysq * x1p * x1p;
  const coef = (fa === fs ? -1 : 1) * Math.sqrt(den === 0 ? 0 : num / den);
  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * ((-ry * x1p) / rx);
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const theta1 = vectorAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta = vectorAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (fs === 0 && dtheta > 0) dtheta -= Math.PI * 2;
  if (fs === 1 && dtheta < 0) dtheta += Math.PI * 2;
  const steps = Math.max(4, Math.ceil((Math.abs(dtheta) * Math.max(rx, ry)) / 4));
  for (let i = 1; i <= steps; i += 1) {
    const t = theta1 + (dtheta * i) / steps;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    push(cos * ex - sin * ey + cx, sin * ex + cos * ey + cy);
  }
}

function vectorAngle(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  let ang = Math.acos(Math.max(-1, Math.min(1, len === 0 ? 0 : dot / len)));
  if (ux * vy - uy * vx < 0) ang = -ang;
  return ang;
}

function polylineLength(sub: { points: Pt[] }, closed: boolean): number {
  let total = 0;
  for (let i = 1; i < sub.points.length; i += 1) {
    total += Math.hypot(sub.points[i].x - sub.points[i - 1].x, sub.points[i].y - sub.points[i - 1].y);
  }
  if (closed && sub.points.length > 1) {
    const a = sub.points[0];
    const b = sub.points[sub.points.length - 1];
    total += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return total;
}

function resample(raw: Pt[], closed: boolean, halfWidth: number): { points: TrackPoint[]; length: number } | null {
  const pts = raw.slice();
  if (closed && pts.length > 2 && Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 0.5) {
    pts.pop();
  }
  if (pts.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  if (closed) cum.push(cum[cum.length - 1] + Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y));
  const length = cum[cum.length - 1];
  if (length < 8) return null;
  const count = Math.max(closed ? 24 : 8, Math.round(length / Math.max(2, length / 520)));
  const step = length / (closed ? count : Math.max(1, count - 1));
  const out: TrackPoint[] = [];
  const samples = closed ? count : count;
  let seg = 0;
  for (let i = 0; i < samples; i += 1) {
    const target = closed ? i * step : Math.min(length, i * step);
    while (seg < cum.length - 2 && cum[seg + 1] < target - 1e-6) seg += 1;
    const span = cum[seg + 1] - cum[seg];
    const t = span > 1e-6 ? (target - cum[seg]) / span : 0;
    const a = pts[seg % pts.length];
    const b = pts[(seg + 1) % pts.length];
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      s: target,
      angle: 0,
    });
  }
  relaxHiddenKinks(out, halfWidth, closed);
  let travelled = 0;
  for (let i = 0; i < out.length; i += 1) {
    out[i].s = travelled;
    const nxt = out[closed ? (i + 1) % out.length : Math.min(out.length - 1, i + 1)];
    if (!closed && i === out.length - 1) break;
    travelled += Math.hypot(nxt.x - out[i].x, nxt.y - out[i].y);
  }
  for (let i = 0; i < out.length; i += 1) {
    const a = out[i];
    const b = out[closed ? (i + 1) % out.length : Math.min(out.length - 1, i + 1)];
    const from = i === out.length - 1 && !closed ? out[i - 1] : a;
    const to = i === out.length - 1 && !closed ? a : b;
    a.angle = Math.atan2(to.y - from.y, to.x - from.x);
  }
  return { points: out, length: travelled };
}

/** Un virage plus serré que la largeur peinte est invisible et se conduit comme un mur. */
function relaxHiddenKinks(points: TrackPoint[], halfWidth: number, closed: boolean) {
  const count = points.length;
  for (let pass = 0; pass < 6; pass += 1) {
    const next = points.map((point) => ({ x: point.x, y: point.y }));
    let moved = false;
    for (let i = 0; i < count; i += 1) {
      if (!closed && (i === 0 || i === count - 1)) continue;
      const prev = points[(i - 1 + count) % count];
      const point = points[i];
      const nxt = points[(i + 1) % count];
      const ax = point.x - prev.x;
      const ay = point.y - prev.y;
      const bx = nxt.x - point.x;
      const by = nxt.y - point.y;
      const la = Math.hypot(ax, ay);
      const lb = Math.hypot(bx, by);
      if (la < 1e-4 || lb < 1e-4) continue;
      const dot = (ax * bx + ay * by) / (la * lb);
      const turn = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (turn < 0.55) continue;
      const radius = Math.min(la, lb) / turn;
      if (radius > halfWidth * 0.85) continue;
      const prevWide = points[(i - 3 + count) % count];
      const nextWide = points[(i + 3) % count];
      const wax = point.x - prevWide.x;
      const way = point.y - prevWide.y;
      const wbx = nextWide.x - point.x;
      const wby = nextWide.y - point.y;
      const wla = Math.hypot(wax, way);
      const wlb = Math.hypot(wbx, wby);
      if (wla < 1e-4 || wlb < 1e-4) continue;
      const wide = Math.acos(Math.max(-1, Math.min(1, (wax * wbx + way * wby) / (wla * wlb))));
      if (turn < wide + 0.28) continue;
      const blend = Math.min(0.55, (turn - wide) * 0.45);
      next[i] = {
        x: point.x * (1 - blend) + ((prev.x + nxt.x) / 2) * blend,
        y: point.y * (1 - blend) + ((prev.y + nxt.y) / 2) * blend,
      };
      moved = true;
    }
    if (!moved) break;
    for (let i = 0; i < count; i += 1) {
      points[i].x = next[i].x;
      points[i].y = next[i].y;
    }
  }
}

const tangentCache = new WeakMap<TrackPoint[], Float64Array>();

type SegmentGrid = {
  cell: number;
  originX: number;
  originY: number;
  cols: number;
  rows: number;
  buckets: number[][];
  seen: Int32Array;
  stamp: number;
};

const segmentGrids = new WeakMap<TrackPoint[], SegmentGrid>();

/**
 * Même plus proche segment que le parcours complet, sans relire tout le circuit à chaque pas.
 * On s'arrête quand le carré déjà lu est strictement plus large que la distance retenue :
 * dehors, tout point est plus loin, donc aucun autre segment ne peut gagner, même à égalité.
 */
function nearestIndexed(track: Track, x: number, y: number): TrackProjection {
  const grid = segmentGrid(track);
  const { cell, originX, originY, cols, rows, buckets } = grid;
  const cx = Math.floor((x - originX) / cell);
  const cy = Math.floor((y - originY) / cell);
  const found: { proj: TrackProjection | null; index: number; distance: number } = {
    proj: null,
    index: -1,
    distance: Infinity,
  };
  grid.stamp += 1;
  if (grid.stamp >= 0x7fffffff) {
    grid.seen.fill(0);
    grid.stamp = 1;
  }
  const stamp = grid.stamp;
  const maxRing = cols + rows + 2;
  for (let ring = 0; ring <= maxRing; ring += 1) {
    const r0 = cy - ring;
    const r1 = cy + ring;
    const c0 = cx - ring;
    const c1 = cx + ring;
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        if (ring > 0 && r !== r0 && r !== r1 && c !== c0 && c !== c1) continue;
        if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
        const bucket = buckets[r * cols + c];
        for (let k = 0; k < bucket.length; k += 1) {
          const index = bucket[k];
          if (grid.seen[index] === stamp) continue;
          grid.seen[index] = stamp;
          const proj = projectSegment(track, x, y, index);
          if (proj.distance < found.distance || (proj.distance === found.distance && index < found.index)) {
            found.distance = proj.distance;
            found.index = index;
            found.proj = proj;
          }
        }
      }
    }
    const minX = originX + (cx - ring) * cell;
    const maxX = originX + (cx + ring + 1) * cell;
    const minY = originY + (cy - ring) * cell;
    const maxY = originY + (cy + ring + 1) * cell;
    const distToBoundary = Math.min(x - minX, maxX - x, y - minY, maxY - y);
    if (found.proj && found.distance < distToBoundary) {
      const along = fanS(track, x, y, found.index);
      return along == null ? found.proj : { ...found.proj, s: along };
    }
  }
  return search(track, x, y, 0, track.length, 0);
}

function segmentGrid(track: Track): SegmentGrid {
  const cached = segmentGrids.get(track.points);
  if (cached) return cached;
  const pts = track.points;
  const n = pts.length;
  const segCount = track.closed ? n : Math.max(0, n - 1);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i += 1) {
    minX = Math.min(minX, pts[i].x);
    minY = Math.min(minY, pts[i].y);
    maxX = Math.max(maxX, pts[i].x);
    maxY = Math.max(maxY, pts[i].y);
  }
  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 1;
    maxY = 1;
  }
  const span = Math.max(maxX - minX, maxY - minY, 1e-6);
  const cells = Math.max(4, Math.round(Math.sqrt(Math.max(segCount, 1))));
  const cell = span / cells;
  const cols = Math.max(1, Math.ceil((maxX - minX) / cell));
  const rows = Math.max(1, Math.ceil((maxY - minY) / cell));
  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  for (let i = 0; i < segCount; i += 1) {
    const a = pts[i];
    const b = pts[track.closed ? (i + 1) % n : i + 1];
    let c0 = Math.floor((Math.min(a.x, b.x) - minX) / cell);
    let c1 = Math.floor((Math.max(a.x, b.x) - minX) / cell);
    let r0 = Math.floor((Math.min(a.y, b.y) - minY) / cell);
    let r1 = Math.floor((Math.max(a.y, b.y) - minY) / cell);
    c0 = clamp(c0, 0, cols - 1);
    c1 = clamp(c1, 0, cols - 1);
    r0 = clamp(r0, 0, rows - 1);
    r1 = clamp(r1, 0, rows - 1);
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) buckets[r * cols + c].push(i);
    }
  }
  const grid: SegmentGrid = {
    cell,
    originX: minX,
    originY: minY,
    cols,
    rows,
    buckets,
    seen: new Int32Array(Math.max(segCount, 1)),
    stamp: 1,
  };
  segmentGrids.set(track.points, grid);
  return grid;
}

function projectSegment(track: Track, x: number, y: number, index: number): TrackProjection {
  const pts = track.points;
  const n = pts.length;
  const a = pts[index];
  const b = pts[track.closed ? (index + 1) % n : index + 1];
  const s0 = a.s;
  const s1 = track.closed && index === n - 1 ? track.length : b.s;
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t = len2 > 0 ? clamp(((x - a.x) * abx + (y - a.y) * aby) / len2, 0, 1) : 0;
  const px = a.x + abx * t;
  const py = a.y + aby * t;
  return {
    x: px,
    y: py,
    s: s0 + (s1 - s0) * t,
    distance: Math.hypot(x - px, y - py),
    angle: Math.atan2(aby, abx),
  };
}

/** Tangente unitaire à chaque sommet, moyenne des deux segments voisins. */
function vertexTangents(track: Track): Float64Array {
  const pts = track.points;
  const cached = tangentCache.get(pts);
  if (cached && cached.length === pts.length * 2) return cached;
  const n = pts.length;
  const out = new Float64Array(n * 2);
  for (let i = 0; i < n; i += 1) {
    const prev = track.closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const next = track.closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    let inX = pts[i].x - prev.x;
    let inY = pts[i].y - prev.y;
    let outX = next.x - pts[i].x;
    let outY = next.y - pts[i].y;
    const inLen = Math.hypot(inX, inY);
    const outLen = Math.hypot(outX, outY);
    inX = inLen > 0 ? inX / inLen : 0;
    inY = inLen > 0 ? inY / inLen : 0;
    outX = outLen > 0 ? outX / outLen : 0;
    outY = outLen > 0 ? outY / outLen : 0;
    let tx = inX + outX;
    let ty = inY + outY;
    let len = Math.hypot(tx, ty);
    if (len < 1e-6) {
      tx = outLen > 0 ? outX : inX;
      ty = outLen > 0 ? outY : inY;
      len = Math.hypot(tx, ty) || 1;
    }
    out[i * 2] = tx / len;
    out[i * 2 + 1] = ty / len;
  }
  tangentCache.set(pts, out);
  return out;
}

/**
 * Position sur le segment [a, b] le long d'une normale qui tourne d'un sommet à l'autre.
 * Avec la normale du seul segment, l'abscisse se fige à l'extérieur de chaque angle puis saute d'un coup.
 */
function fanParameter(x: number, y: number, ax: number, ay: number, abx: number, aby: number, tax: number, tay: number, tbx: number, tby: number): number | null {
  const wx = x - ax;
  const wy = y - ay;
  const f0 = wx * tax + wy * tay;
  const f1 = (wx - abx) * tbx + (wy - aby) * tby;
  if (f0 < 0 || f1 > 0) return null;
  const dx = tbx - tax;
  const dy = tby - tay;
  const qa = -(abx * dx + aby * dy);
  const qb = wx * dx + wy * dy - (abx * tax + aby * tay);
  if (Math.abs(qa) < 1e-12) return Math.abs(qb) < 1e-12 ? 0 : clamp(-f0 / qb, 0, 1);
  const disc = Math.sqrt(Math.max(0, qb * qb - 4 * qa * f0));
  const r1 = (-qb + disc) / (2 * qa);
  const r2 = (-qb - disc) / (2 * qa);
  if (r1 >= -1e-9 && r1 <= 1 + 1e-9) return clamp(r1, 0, 1);
  if (r2 >= -1e-9 && r2 <= 1 + 1e-9) return clamp(r2, 0, 1);
  return null;
}

function search(track: Track, x: number, y: number, hintS: number, span: number, continuity: number): TrackProjection {
  const pts = track.points;
  const n = pts.length;
  const segCount = track.closed ? n : n - 1;
  let best: TrackProjection | null = null;
  let bestScore = Infinity;
  let bestIndex = -1;
  for (let i = 0; i < segCount; i += 1) {
    const a = pts[i];
    const b = pts[track.closed ? (i + 1) % n : i + 1];
    const s0 = a.s;
    const s1 = track.closed && i === n - 1 ? track.length : b.s;
    if (span < track.length && absDelta(s0, hintS, track.length) > span && absDelta(s1, hintS, track.length) > span) continue;
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    const t = len2 > 0 ? clamp(((x - a.x) * abx + (y - a.y) * aby) / len2, 0, 1) : 0;
    const px = a.x + abx * t;
    const py = a.y + aby * t;
    const distance = Math.hypot(x - px, y - py);
    const s = s0 + (s1 - s0) * t;
    const score = distance + absDelta(s, hintS, track.length) * continuity;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
      best = { x: px, y: py, s, distance, angle: Math.atan2(aby, abx) };
    }
  }
  if (!best) return { x, y, s: hintS, distance: Infinity, angle: 0 };
  const s = fanS(track, x, y, bestIndex);
  return s == null ? best : { ...best, s };
}

/** Abscisse continue autour du segment retenu : on cherche, parmi lui et ses voisins, celui dont l'éventail de normales contient le point. */
function fanS(track: Track, x: number, y: number, index: number): number | null {
  const pts = track.points;
  const n = pts.length;
  const segCount = track.closed ? n : n - 1;
  const tangents = vertexTangents(track);
  for (const offset of [0, -1, 1]) {
    let i = index + offset;
    if (track.closed) i = (i + segCount) % segCount;
    else if (i < 0 || i >= segCount) continue;
    const j = track.closed ? (i + 1) % n : i + 1;
    const a = pts[i];
    const b = pts[j];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    if (abx * abx + aby * aby <= 0) continue;
    const t = fanParameter(x, y, a.x, a.y, abx, aby, tangents[i * 2], tangents[i * 2 + 1], tangents[j * 2], tangents[j * 2 + 1]);
    if (t == null) continue;
    const s1 = track.closed && i === n - 1 ? track.length : b.s;
    return a.s + (s1 - a.s) * t;
  }
  return null;
}

function absDelta(a: number, b: number, length: number): number {
  const d = Math.abs(a - b);
  return Math.min(d, length - d);
}

function mod(value: number, length: number): number {
  if (length <= 0) return 0;
  return ((value % length) + length) % length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
