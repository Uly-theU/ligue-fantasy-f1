/** Eau, tribunes et ancien tracé, calés sur le circuit en coordonnées de piste. */

import raw from '@/lib/circuits/2026/surroundings.json';
import type { Footprint } from '@/lib/circuit-scenery';

export type CircuitSurroundings = {
  /** Erreur moyenne de l'alignement sur le tracé OSM, en mètres. Au-delà de `MAX_FIT_M`, le calage est ignoré. */
  fit_m: number;
  waters: number[][][];
  /** Nappes entre une rive et le large : mer, fleuve, tour d'île. */
  sheets: number[][][];
  stands: Footprint[];
  blocks: Footprint[];
  /** Anciens anneaux (l'ovale de Monza), déjà hors de l'asphalte actuel. */
  loops: number[][][];
};

/** Erreur d'alignement au-delà de laquelle le décor OSM tomberait à côté du tracé. */
export const MAX_FIT_M = 42;

const data = raw as Record<string, Partial<CircuitSurroundings>>;

/** Le décor relevé d'un circuit, ou rien s'il n'est pas calé assez juste. */
export function surroundingsFor(circuitId: string | null | undefined): CircuitSurroundings | null {
  if (!circuitId) return null;
  const entry = data[circuitId];
  if (!entry || typeof entry.fit_m !== 'number' || entry.fit_m > MAX_FIT_M) return null;
  return {
    fit_m: entry.fit_m,
    waters: entry.waters ?? [],
    sheets: entry.sheets ?? [],
    stands: entry.stands ?? [],
    blocks: entry.blocks ?? [],
    loops: entry.loops ?? [],
  };
}
