import { readFileSync } from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'lib/circuits/2026');

export type BundledCircuit = {
  round: number;
  date: string;
  grand_prix_id: string;
  official_name: string;
  circuit_id: string;
  layout_id: string;
  full_name: string;
  length_km: number;
  turns: number;
  direction: string;
  file: string;
};

export type CircuitElevation = {
  range_m: number;
  elevation_source: string;
  /** Dessin F1DB à l'envers du sens officiel. */
  reverse: boolean;
  /** Fraction du dessin F1DB où se trouve la vraie ligne de départ. */
  start: number;
  /** [fraction du tour depuis la ligne, dans le sens de la course ; altitude en m] */
  points: Array<[number, number]>;
};

type ElevationFile = {
  circuits: Record<string, CircuitElevation>;
};

/** Virage numéroté : `at` = fraction du tour depuis la ligne, dans le sens de la course (repère de elevation.json). */
export type CircuitCorner = { number: number; at: number };

type CornersFile = {
  circuits: Record<string, { corners: CircuitCorner[] }>;
};

let manifest: BundledCircuit[] | null = null;
let elevation: ElevationFile | null = null;
let corners: CornersFile | null = null;

/** Les 23 tracés du calendrier officiel 2026 livrés avec l'app (F1DB). */
export function bundledCircuits(): BundledCircuit[] {
  manifest ??= JSON.parse(readFileSync(path.join(DIR, 'manifest.json'), 'utf8')) as BundledCircuit[];
  return manifest;
}

/** Le SVG sans le commentaire de crédit en tête (le crédit F1DB est affiché sous le jeu). */
export function bundledSvg(circuit: BundledCircuit): string {
  const raw = readFileSync(path.join(DIR, path.basename(circuit.file)), 'utf8');
  const start = raw.indexOf('<svg');
  return start >= 0 ? raw.slice(start) : raw;
}

/** Profil d'altitude : [fraction du tour depuis la ligne, altitude en m]. */
export function bundledElevation(circuitId: string | null): CircuitElevation | null {
  if (!circuitId) return null;
  try {
    elevation ??= JSON.parse(readFileSync(path.join(DIR, 'elevation.json'), 'utf8')) as ElevationFile;
  } catch {
    return null;
  }
  const found = elevation.circuits[circuitId];
  return found
    ? {
      range_m: found.range_m,
      elevation_source: found.elevation_source,
      reverse: found.reverse,
      start: found.start,
      points: found.points,
    }
    : null;
}

/** Virages numérotés, à n'utiliser qu'avec le profil de bundledElevation : ils partent de la même ligne. */
export function bundledCorners(circuitId: string | null): CircuitCorner[] | null {
  if (!circuitId) return null;
  try {
    corners ??= JSON.parse(readFileSync(path.join(DIR, 'corners.json'), 'utf8')) as CornersFile;
  } catch {
    return null;
  }
  return corners.circuits[circuitId]?.corners ?? null;
}
