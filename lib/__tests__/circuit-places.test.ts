import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CIRCUIT_PLACES, placesForCircuit } from '@/lib/circuit-places';

const manifest = JSON.parse(
  readFileSync(path.join(process.cwd(), 'lib/circuits/2026/manifest.json'), 'utf8'),
) as Array<{ circuit_id: string }>;

describe('lieux des circuits', () => {
  it('ne cite que des circuits du calendrier 2026', () => {
    const ids = new Set(manifest.map((race) => race.circuit_id));
    for (const circuitId of Object.keys(CIRCUIT_PLACES)) {
      expect(ids.has(circuitId)).toBe(true);
      expect(CIRCUIT_PLACES[circuitId].length).toBeGreaterThan(0);
      for (const place of CIRCUIT_PLACES[circuitId]) {
        expect(place.name.trim().length).toBeGreaterThan(1);
        expect(place.note.trim().length).toBeGreaterThan(8);
      }
    }
  });

  it('donne un lore à Mexico, Madrid et Las Vegas', () => {
    expect(placesForCircuit('mexico-city').map((place) => place.name)).toContain('Foro Sol');
    expect(placesForCircuit('mexico-city').map((place) => place.name)).toContain('Peraltada');
    expect(placesForCircuit('madring').some((place) => place.note.includes('24 %'))).toBe(true);
    expect(placesForCircuit('las-vegas').map((place) => place.name)).toEqual(['La Sphere', 'Le Strip']);
    expect(placesForCircuit('lusail')).toEqual([]);
    expect(placesForCircuit(null)).toEqual([]);
  });
});