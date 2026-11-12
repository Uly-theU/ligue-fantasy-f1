/** Eau, tribunes et ancien tracé, calés sur le circuit en coordonnées de piste. */

import raw from '@/lib/circuits/2026/surroundings.json';
import type { Footprint } from '@/lib/circuit-scenery';

export type CircuitSurroundings = {
  /** Erreur moyenne de l'alignement sur le tracé OSM, en mètres. Au-delà de 32 m, le calage est ignoré. */
  fit_m: number;
  waters: number[][][];
  /** Nappes entre une rive et le large : mer, fleuve, tour d'île. */
  sheets: number[][][];
  shores: number[][][];
  stands: Footprint[];
  blocks: Footprint[];
  /** Anciens anneaux (l'ovale de Monza), déjà hors de l'asphalte actuel. */
  loops: number[][][];
};

const data = raw as Record<string, Partial<CircuitSurroundings>>;

export function surroundingsFor(circuitId: string | null | undefined): CircuitSurroundings | null {
  if (!circuitId) return null;
  const entry = data[circuitId];
  if (!entry || typeof entry.fit_m !== 'number') return null;
  return {
    fit_m: entry.fit_m,
    waters: entry.waters ?? [],
    sheets: entry.sheets ?? [],
    shores: entry.shores ?? [],
    stands: entry.stands ?? [],
    blocks: entry.blocks ?? [],
    loops: entry.loops ?? [],
  };
}
