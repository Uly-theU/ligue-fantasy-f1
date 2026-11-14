/** Dénivelé le long de l'abscisse du tracé. z est en mètres, s dans les unités du circuit. */

export type ElevationSample = {
  s: number;
  z: number;
};

export type ElevationSampled = {
  grade: number;
  load: number;
};

const G = 9.81;
const LOAD_MIN = 0.35;
const LOAD_MAX = 1.65;

/** Profils déjà triés et bornés : le rejeu les relit à chaque pas, sans les recopier. */
const cleanProfiles = new WeakSet<ElevationSample[]>();

/** Altitude en mètres à une fraction du tour, sur le profil brut [fraction, altitude]. */
export function profileAt(points: Array<[number, number]>, fraction: number): number {
  if (points.length === 0) return 0;
  const f = ((fraction % 1) + 1) % 1;
  let lo = 0;
  for (let i = 0; i < points.length; i += 1) if (points[i][0] <= f) lo = i;
  const a = points[lo];
  const b = points[(lo + 1) % points.length];
  let span = b[0] - a[0];
  if (span <= 1e-9) span += 1;
  const traveled = f >= a[0] ? f - a[0] : f + 1 - a[0];
  return a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, traveled / span));
}

/** Accélération longitudinale due à la pente, en m/s². Une montée est négative. */
export function gradeAccel(grade: number): number {
  if (!Number.isFinite(grade) || grade === 0) return 0;
  return -G * Math.sin(Math.atan(grade));
}

/**
 * Pente (montée positive) et facteur de charge verticale.
 * La charge vaut 1 à l'arrêt ou sur une pente constante.
 * Elle tombe sur une crête et monte dans une cuvette, avec la vitesse.
 */
export function sampleElevation(
  samples: ElevationSample[],
  s: number,
  length: number,
  metersPerUnit: number,
  speedMps: number,
  closed: boolean,
): ElevationSampled {
  const flat = { grade: 0, load: 1 };
  if (!(metersPerUnit > 0) || !(length > 0)) return flat;
  const nodes = elevationNodes(samples, length, closed);
  if (nodes.length < 2) return flat;

  const at = closed ? mod(s, length) : s;
  const segment = findSegment(nodes, at, length, closed);
  const gradeOf = (index: number) => {
    const span = segmentSpan(nodes, index, length, closed);
    if (span <= 1e-6) return 0;
    const next = nodes[(index + 1) % nodes.length];
    return (next.z - nodes[index].z) / (span * metersPerUnit);
  };
  const curvatureAt = (index: number) => {
    if (!closed && (index === 0 || index === nodes.length - 1)) return 0;
    const previous = (index - 1 + nodes.length) % nodes.length;
    const dsIn = segmentSpan(nodes, previous, length, closed) * metersPerUnit;
    const dsOut = segmentSpan(nodes, index, length, closed) * metersPerUnit;
    const span = (dsIn + dsOut) / 2;
    if (span <= 1e-6) return 0;
    return (gradeOf(index) - gradeOf(previous)) / span;
  };

  const span = segmentSpan(nodes, segment, length, closed);
  const s0 = nodes[segment].s;
  const pos = at < s0 ? at + length : at;
  const t = span > 1e-6 ? Math.max(0, Math.min(1, (pos - s0) / span)) : 0;
  const w0 = influence(t);
  const w1 = influence(1 - t);
  const curvature = w0 + w1 > 1e-6
    ? (curvatureAt(segment) * w0 + curvatureAt((segment + 1) % nodes.length) * w1) / (w0 + w1)
    : 0;
  const speed = Math.max(0, speedMps);
  return {
    grade: gradeOf(segment),
    load: clamp(1 + (speed * speed * curvature) / G, LOAD_MIN, LOAD_MAX),
  };
}

function elevationNodes(samples: ElevationSample[], length: number, closed: boolean): ElevationSample[] {
  if (cleanProfiles.has(samples)) return samples;
  if (reusableProfile(samples, length, closed)) {
    cleanProfiles.add(samples);
    return samples;
  }
  return samples
    .filter((sample) => Number.isFinite(sample.s) && Number.isFinite(sample.z))
    .map((sample) => ({ s: closed ? mod(sample.s, length) : sample.s, z: sample.z }))
    .sort((a, b) => a.s - b.s);
}

/** Vrai quand filtrer, ramener dans le tour et trier laisserait le tableau identique. */
function reusableProfile(samples: ElevationSample[], length: number, closed: boolean): boolean {
  let previous = -Infinity;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    if (!Number.isFinite(sample.s) || !Number.isFinite(sample.z)) return false;
    const s = closed ? mod(sample.s, length) : sample.s;
    if (s !== sample.s || s < previous) return false;
    previous = s;
  }
  return true;
}

function findSegment(nodes: ElevationSample[], at: number, length: number, closed: boolean): number {
  const count = nodes.length;
  if (!closed) return greatestAtMost(nodes, at);
  if (at < nodes[0].s) return segmentContains(nodes, count - 1, at, length) ? count - 1 : 0;
  const index = greatestAtMost(nodes, at);
  return segmentContains(nodes, index, at, length) ? index : 0;
}

/** Dernier point dont l'abscisse est ≤ `at`. Les nœuds sont triés. */
function greatestAtMost(nodes: ElevationSample[], at: number): number {
  let lo = 0;
  let hi = nodes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (nodes[mid].s <= at) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function segmentContains(nodes: ElevationSample[], index: number, at: number, length: number): boolean {
  const s0 = nodes[index].s;
  const s1 = s0 + segmentSpan(nodes, index, length, true);
  const pos = at < s0 ? at + length : at;
  return pos >= s0 && pos < s1;
}

function segmentSpan(nodes: ElevationSample[], index: number, length: number, closed: boolean): number {
  const from = nodes[index].s;
  const next = (index + 1) % nodes.length;
  if (!closed && next === 0) return 0;
  const to = next === 0 ? nodes[0].s + length : nodes[next].s;
  return Math.max(0, to - from);
}

function influence(t: number): number {
  const u = Math.min(1, Math.max(0, t) * 2);
  return (1 - u) * (1 - u);
}

function mod(value: number, length: number): number {
  return ((value % length) + length) % length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

const SMOOTH_SIGMA_M = 80;

/**
 * Le MNT est échantillonné tous les ~50 m et saute de plusieurs mètres d'un point à l'autre.
 * On le rééchantillonne puis on le lisse sur environ 80 m, pour que la piste et la voiture
 * suivent la colline au lieu d'enchainer des cassures.
 */
export function smoothElevation(
  samples: ElevationSample[],
  length: number,
  metersPerUnit: number,
  closed: boolean,
): ElevationSample[] {
  const nodes = samples
    .filter((sample) => Number.isFinite(sample.s) && Number.isFinite(sample.z))
    .map((sample) => ({ s: closed ? mod(sample.s, length) : sample.s, z: sample.z }))
    .sort((a, b) => a.s - b.s);
  if (nodes.length < 3 || !(length > 0) || !(metersPerUnit > 0)) return samples;
  const stepM = 15;
  const count = Math.max(nodes.length, Math.round((length * metersPerUnit) / stepM));
  const step = length / count;
  const raw = new Float64Array(count);
  for (let i = 0; i < count; i += 1) raw[i] = heightAt(nodes, i * step, length, closed);
  const sigma = Math.max(1, SMOOTH_SIGMA_M / (step * metersPerUnit));
  const radius = Math.min(count - 1, Math.ceil(sigma * 3));
  const weights: number[] = [];
  for (let k = -radius; k <= radius; k += 1) weights.push(Math.exp(-0.5 * (k / sigma) * (k / sigma)));
  const smoothed: ElevationSample[] = [];
  for (let i = 0; i < count; i += 1) {
    let acc = 0;
    let weight = 0;
    for (let k = -radius; k <= radius; k += 1) {
      const index = closed ? mod(i + k, count) : clamp(i + k, 0, count - 1);
      const w = weights[k + radius];
      acc += raw[index] * w;
      weight += w;
    }
    smoothed.push({ s: i * step, z: acc / weight });
  }
  return smoothed;
}

function heightAt(nodes: ElevationSample[], s: number, length: number, closed: boolean): number {
  if (nodes.length === 0) return 0;
  if (nodes.length === 1) return nodes[0].z;
  const at = closed ? mod(s, length) : Math.max(0, Math.min(length, s));
  let prev = nodes[nodes.length - 1];
  for (let i = 0; i < nodes.length; i += 1) {
    const next = nodes[i];
    if (!closed && i === 0) {
      prev = next;
      continue;
    }
    const start = prev.s;
    let end = next.s;
    let pos = at;
    if (closed && end <= start) {
      end += length;
      if (pos < start) pos += length;
    }
    if (!closed && pos < start) {
      prev = next;
      continue;
    }
    if (pos >= start && pos <= end) {
      const span = end - start;
      const t = span > 1e-6 ? (pos - start) / span : 0;
      return prev.z + (next.z - prev.z) * t;
    }
    prev = next;
  }
  return nodes[nodes.length - 1].z;
}
