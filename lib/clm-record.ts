export type LapSample = {
  t: number;
  s: number;
  x: number;
  y: number;
  h: number;
};

export type LapRecord = {
  time: number;
  sectors: [number, number, number] | null;
  samples: LapSample[];
};

export function formatDelta(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const abs = Math.abs(seconds);
  if (abs < 0.0005) return '0.000';
  return `${seconds < 0 ? '−' : '+'}${abs.toFixed(3)}`;
}

export function timeAtS(samples: LapSample[], s: number): number | null {
  if (samples.length === 0) return null;
  if (s <= samples[0].s) return samples[0].t;
  const last = samples[samples.length - 1];
  if (s >= last.s) return last.t;
  let lo = 0;
  let hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].s <= s) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const span = b.s - a.s;
  const t = span <= 1e-6 ? 0 : (s - a.s) / span;
  return a.t + (b.t - a.t) * t;
}

export function deltaAt(record: LapRecord, s: number, time: number): number | null {
  const ref = timeAtS(record.samples, s);
  if (ref == null) return null;
  return time - ref;
}

export function sampleAtTime(samples: LapSample[], time: number): LapSample | null {
  if (samples.length === 0) return null;
  if (time <= samples[0].t) return samples[0];
  const last = samples[samples.length - 1];
  if (time >= last.t) return last;
  let lo = 0;
  let hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= time) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const span = b.t - a.t;
  const t = span <= 1e-6 ? 0 : (time - a.t) / span;
  const turn = Math.atan2(Math.sin(b.h - a.h), Math.cos(b.h - a.h));
  return {
    t: time,
    s: a.s + (b.s - a.s) * t,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    h: a.h + turn * t,
  };
}

/** Secteur 1 ou 2 franchi dans le sens de la marche. L'arrivée est le secteur 3. */
export function crossedSector(prevS: number, nextS: number, length: number): 1 | 2 | null {
  if (length <= 0 || nextS < prevS) return null;
  const a = prevS / length;
  const b = nextS / length;
  if (a < 2 / 3 && b >= 2 / 3) return 2;
  if (a < 1 / 3 && b >= 1 / 3) return 1;
  return null;
}

export function buildRecord(time: number, samples: LapSample[], length: number): LapRecord {
  const at = (mark: number) => timeAtS(samples, mark) ?? time;
  return {
    time,
    sectors: length > 0 ? [at(length / 3), at((2 * length) / 3), time] : null,
    samples,
  };
}

export function parseRecord(raw: string | null): LapRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LapRecord>;
    if (typeof value.time !== 'number' || !(value.time > 0)) return null;
    const samples = Array.isArray(value.samples) ? value.samples.filter(isSample) : [];
    const sectors = isSectors(value.sectors) ? value.sectors : null;
    return { time: value.time, sectors, samples };
  } catch {
    return null;
  }
}

function isSample(value: unknown): value is LapSample {
  if (!value || typeof value !== 'object') return false;
  const sample = value as LapSample;
  return [sample.t, sample.s, sample.x, sample.y, sample.h].every((n) => typeof n === 'number' && Number.isFinite(n));
}

function isSectors(value: unknown): value is [number, number, number] {
  return Array.isArray(value)
    && value.length === 3
    && value.every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0);
}
