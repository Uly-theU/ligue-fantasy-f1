import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fitRoad, metersPerUnit, ROAD_HALF_M } from '@/lib/clm';
import { orientTrack, trackFromSvg } from '@/lib/track-path';

const directory = path.join(process.cwd(), 'lib/circuits/2026');

describe('circuits 2026', () => {
  const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8')) as Array<{
    round: number;
    circuit_id: string;
    direction: string;
    file: string;
    layout_id: string;
    length_km: number;
  }>;

  it('couvre les 23 Grands Prix F1DB 2026', () => {
    expect(manifest).toHaveLength(23);
    expect(manifest.map((race) => race.round)).toEqual(Array.from({ length: 23 }, (_, index) => index + 1));
    const files = readdirSync(directory).filter((name) => name.endsWith('.svg'));
    expect(files).toHaveLength(23);
  });

  it.each(manifest.map((race) => [race.file, race] as const))('%s forme un circuit fermé', (file, race) => {
    const svg = readFileSync(path.join(directory, file), 'utf8');
    expect(svg).toContain(race.layout_id);
    expect(svg).toContain('CC BY 4.0');
    const track = trackFromSvg(svg);
    expect(track).not.toBeNull();
    expect(track!.closed).toBe(true);
    expect(track!.length).toBeGreaterThan(400);
    expect(track!.halfWidth).toBeGreaterThan(4);
    expect(race.length_km).toBeGreaterThan(3);
  });

  describe('altitudes', () => {
    const elevation = JSON.parse(readFileSync(path.join(directory, 'elevation.json'), 'utf8')) as {
      circuits: Record<string, {
        fit: number;
        range_m: number;
        elevation_source: string;
        reverse: boolean;
        start: number;
        points: Array<[number, number]>;
      }>;
    };
    const ids = manifest;

    it('donne un profil pour chaque circuit du calendrier', () => {
      expect(Object.keys(elevation.circuits).sort()).toEqual(ids.map((race) => race.circuit_id).sort());
    });

    it.each(ids.map((race) => [race.circuit_id, race] as const))('%s : profil aligné et pentes plausibles', (id, race) => {
      const profile = elevation.circuits[id];
      expect(profile.fit).toBeLessThan(0.01);
      expect(profile.points.length).toBeGreaterThan(50);
      expect(Math.min(...profile.points.map(([, z]) => z))).toBeCloseTo(0, 0);
      let previous = -1;
      for (const [fraction] of profile.points) {
        expect(fraction).toBeGreaterThanOrEqual(0);
        expect(fraction).toBeLessThan(1);
        expect(fraction).toBeGreaterThan(previous);
        previous = fraction;
      }
      const meters = race.length_km * 1000;
      for (let i = 0; i < profile.points.length; i += 1) {
        const [f1, z1] = profile.points[i];
        const [f2, z2] = profile.points[(i + 1) % profile.points.length];
        const run = ((f2 - f1 + 1) % 1 || 1) * meters;
        expect(Math.abs(z2 - z1) / run).toBeLessThan(0.25);
      }
    });

    it.each(ids.map((race) => [race.circuit_id, race] as const))('%s : part de la ligne, dans le sens officiel, à l’échelle', (id, race) => {
      const profile = elevation.circuits[id];
      const drawn = trackFromSvg(readFileSync(path.join(directory, race.file), 'utf8'))!;
      const track = fitRoad(orientTrack(drawn, profile), race.length_km);
      const mpu = metersPerUnit(track, race.length_km);
      let area = 0;
      for (let i = 0; i < track.points.length; i += 1) {
        const a = track.points[i];
        const b = track.points[(i + 1) % track.points.length];
        area += a.x * b.y - b.x * a.y;
      }
      expect(area > 0).toBe(race.direction === 'CLOCKWISE');
      const heading = track.points[0].angle;
      const corner = track.points.find((point) => Math.abs(Math.atan2(Math.sin(point.angle - heading), Math.cos(point.angle - heading))) > Math.PI / 2);
      expect(corner!.s * mpu).toBeGreaterThan(100);
      expect(track.halfWidth * mpu).toBeLessThanOrEqual(ROAD_HALF_M + 1e-6);
      expect(track.halfWidth * mpu).toBeGreaterThan(ROAD_HALF_M * 0.9);
      expect(track.length).toBeCloseTo(drawn.length, 0);
    });

    it('reproduit les grands dénivelés connus', () => {
      expect(elevation.circuits['spa-francorchamps'].range_m).toBeGreaterThan(80);
      expect(elevation.circuits.spielberg.range_m).toBeGreaterThan(50);
      expect(elevation.circuits.silverstone.range_m).toBeLessThan(20);
      expect(elevation.circuits.zandvoort.range_m).toBeLessThan(15);
    });
  });
});
