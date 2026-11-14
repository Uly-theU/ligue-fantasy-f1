import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { biomeFor, CIRCUIT_BIOMES } from '@/lib/circuit-biome';

const manifest = JSON.parse(readFileSync(path.join(process.cwd(), 'lib/circuits/2026/manifest.json'), 'utf8')) as Array<{
  circuit_id: string;
}>;

describe('ambiance des circuits', () => {
  it('habille chaque circuit du calendrier 2026', () => {
    expect(Object.keys(CIRCUIT_BIOMES).sort()).toEqual(manifest.map((race) => race.circuit_id).sort());
  });

  it('garde des densités entre 0 et 1', () => {
    for (const biome of Object.values(CIRCUIT_BIOMES)) {
      expect(biome.trees).toBeGreaterThanOrEqual(0);
      expect(biome.trees).toBeLessThanOrEqual(1);
      expect(biome.treeScale).toBeGreaterThan(0.5);
      expect(biome.treeScale).toBeLessThan(3);
      expect(biome.blocks).toBeGreaterThanOrEqual(0);
      expect(biome.blocks).toBeLessThanOrEqual(1);
      expect(biome.sunIntensity).toBeGreaterThan(0);
      expect(biome.exposure).toBeGreaterThan(0);
    }
  });

  it('met des murs en ville, une forêt à Spa, du sable à Zandvoort', () => {
    expect(biomeFor('monaco').walls).toBe(true);
    expect(biomeFor('monaco').blocks).toBeGreaterThan(0.8);
    expect(biomeFor('baku').walls).toBe(true);
    expect(biomeFor('spa-francorchamps').trees).toBeGreaterThan(0.9);
    expect(biomeFor('spa-francorchamps').walls).toBe(false);
    expect(biomeFor('zandvoort').ground).toBe('sand');
    expect(biomeFor('suzuka').trees).toBeGreaterThan(0.8);
    expect(biomeFor('spielberg').treeScale).toBeGreaterThan(biomeFor('spa-francorchamps').treeScale);
    expect(biomeFor('spa-francorchamps').treeScale).toBeGreaterThan(1.6);
    expect(biomeFor('monaco').treeScale).toBeLessThan(1.2);
  });

  it('éteint le soleil des courses de nuit', () => {
    for (const id of ['marina-bay', 'las-vegas', 'lusail']) {
      const biome = biomeFor(id);
      expect(biome.night).toBe(true);
      expect(biome.sunIntensity).toBeLessThan(0.5);
    }
    expect(biomeFor('silverstone').night).toBe(false);
    expect(biomeFor('silverstone').sunIntensity).toBeGreaterThan(1);
    expect(biomeFor('yas-marina').night).toBe(false);
    expect(biomeFor('yas-marina').palms).toBe(true);
  });

  it('retombe sur une prairie pour un circuit inconnu', () => {
    expect(biomeFor(null).ground).toBe('grass');
    expect(biomeFor('inexistant').walls).toBe(false);
    expect(biomeFor(undefined).stands).toBe(true);
  });
});
