import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { biomeFor } from '@/lib/circuit-biome';
import { planBlocks, planPit, planStands, type Placed } from '@/lib/circuit-scenery';
import { fitRoad } from '@/lib/clm';
import { profileAt } from '@/lib/grade';
import { boxOnPaint } from '@/lib/track-clearance';
import { orientTrack, trackFromSvg, type Track } from '@/lib/track-path';

const directory = path.join(process.cwd(), 'lib/circuits/2026');

function placed(track: Track, id: string): Placed[] {
  const biome = biomeFor(id);
  const half = track.halfWidth;
  const pit = planPit(track, half, biome.walls);
  return [
    ...(pit.box ? [pit.box] : []),
    ...planStands(track, half, pit.side, biome.walls),
    ...planBlocks(track, half, biome.blocks, biome.walls, biome.night),
  ];
}

function offPaint(track: Track, box: Placed): boolean {
  return !boxOnPaint(track, box.x, box.y, box.angle, box.length, box.depth, track.halfWidth * 0.04);
}

describe('décor hors piste', () => {
  const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8')) as Array<{
    circuit_id: string;
    file: string;
    length_km: number;
  }>;
  const elevation = JSON.parse(readFileSync(path.join(directory, 'elevation.json'), 'utf8')) as {
    circuits: Record<string, { reverse: boolean; start: number; points: Array<[number, number]> }>;
  };

  it('refuse une boîte posée sur une ligne droite', () => {
    const track = trackFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="16" d="M0 0 H200"/></svg>')!;
    expect(boxOnPaint(track, 100, 0, 0, 12, 6)).toBe(true);
    expect(boxOnPaint(track, 100, 30, 0, 12, 6)).toBe(false);
  });

  it.each(manifest.map((race) => [race.circuit_id, race] as const))('%s : aucun bâtiment sur l’asphalte', (id, race) => {
    const profile = elevation.circuits[id];
    const drawn = trackFromSvg(readFileSync(path.join(directory, race.file), 'utf8'))!;
    const raced = orientTrack(drawn, profile);
    const heightAt = (s: number) => profileAt(profile.points, raced.length > 0 ? s / raced.length : 0);
    const track = fitRoad(raced, race.length_km, heightAt);
    for (const box of placed(track, id)) expect(offPaint(track, box)).toBe(true);
  });

  it('donne de l’eau à chaque circuit du calendrier qui en a, et une île à Montréal', () => {
    const scene = JSON.parse(readFileSync(path.join(directory, 'surroundings.json'), 'utf8')) as Record<
      string,
      { waters?: unknown[]; sheets?: unknown[]; fit_m?: number }
    >;
    for (const race of manifest) expect(typeof scene[race.circuit_id]?.fit_m).toBe('number');
    expect((scene.monaco.waters?.length ?? 0) + (scene.monaco.sheets?.length ?? 0)).toBeGreaterThan(10);
    expect(scene.montreal.sheets?.length ?? 0).toBeGreaterThan(20);
  });
});
