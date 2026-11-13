/** Ce que les deux pages de démo ont en commun : données de la saison, préparation d'un tracé, écrans et réglages. */

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { trackSigns } from '@/lib/circuit-places';
import { bankTrack } from '@/lib/circuit-banking';
import { fitRoad, formatLap, metersPerUnit } from '@/lib/clm';
import { parseRecord, type LapRecord } from '@/lib/clm-record';
import { profileAt, smoothElevation, type ElevationSample } from '@/lib/grade';
import { orientTrack, trackFromSvg } from '@/lib/track-path';
import manifestFile from '../../lib/circuits/2026/manifest.json';
import elevationFile from '../../lib/circuits/2026/elevation.json';
import cornersFile from '../../lib/circuits/2026/corners.json';

const CAMERA_KEY = 'clm-camera';

export type Screen = 'menu' | 'race' | 'times' | 'options';
export type Camera = 'chase' | 'cockpit';

export type Circuit = {
  round: number;
  date: string;
  circuit_id: string;
  full_name: string;
  length_km: number;
  turns: number;
  direction: 'CLOCKWISE' | 'ANTI_CLOCKWISE';
};

type ElevationFile = {
  circuits: Record<string, {
    reverse: boolean;
    start: number;
    range_m: number;
    points: Array<[number, number]>;
  }>;
};

type CornersFile = {
  circuits: Record<string, { corners: Array<{ number: number; at: number }> }>;
};

export const SEASON = manifestFile as Circuit[];
// Le JSON importé type les points en number[][] : la paire [fraction, altitude] est garantie par le script qui l'écrit.
const ELEVATION = elevationFile as unknown as ElevationFile;
const CORNERS = cornersFile as CornersFile;

const DIRECTION: Record<Circuit['direction'], string> = {
  CLOCKWISE: 'sens horaire',
  ANTI_CLOCKWISE: 'sens anti-horaire',
};

export function formatKm(km: number): string {
  return `${km.toFixed(3).replace('.', ',')} km`;
}

export function describeCircuit(circuit: Circuit): string {
  return `${circuit.turns} virages · ${DIRECTION[circuit.direction]}`;
}

export function readCamera(): Camera {
  try {
    return localStorage.getItem(CAMERA_KEY) === 'cockpit' ? 'cockpit' : 'chase';
  } catch {
    return 'chase';
  }
}

export function saveCamera(camera: Camera) {
  try {
    localStorage.setItem(CAMERA_KEY, camera);
  } catch { /* stockage privé */ }
}

function recordKey(circuitId: string): string {
  return `clm-record:v5:${circuitId}`;
}

export function readRecord(circuitId: string): LapRecord | null {
  try {
    return parseRecord(localStorage.getItem(recordKey(circuitId)));
  } catch {
    return null;
  }
}

export function eraseRecord(circuitId: string) {
  try {
    localStorage.removeItem(recordKey(circuitId));
  } catch { /* stockage privé */ }
}

/** Tracé prêt à rouler : orienté, mis à l'échelle, relevé, avec son relief et ses panneaux. Rien si le dessin ou le relief manque. */
export function prepare(circuit: Circuit, svg: string | undefined) {
  const elevation = ELEVATION.circuits[circuit.circuit_id];
  const corners = CORNERS.circuits[circuit.circuit_id]?.corners ?? [];
  const drawn = svg ? trackFromSvg(svg) : null;
  if (!drawn || !elevation) return null;
  const raced = orientTrack(drawn, elevation);
  const heightAt = (s: number) => profileAt(elevation.points, raced.length > 0 ? s / raced.length : 0);
  const track = bankTrack(fitRoad(raced, circuit.length_km, heightAt), circuit.circuit_id, corners);
  const raw = elevation.points.map(([fraction, z]) => ({ s: fraction * track.length, z }));
  const samples: ElevationSample[] = smoothElevation(raw, track.length, metersPerUnit(track, circuit.length_km), track.closed);
  return { track, samples, signs: trackSigns(circuit.circuit_id, corners) };
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      {children}
    </main>
  );
}

export function ScreenTitle({ title, back, onBack }: { title: string; back: string; onBack: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <h1 className="text-3xl font-bold">{title}</h1>
      <Button type="button" variant="outline" onClick={onBack}>{back}</Button>
    </div>
  );
}

function Choice({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button type="button" variant={pressed ? 'default' : 'outline'} aria-pressed={pressed} className="w-full" onClick={onClick}>
      {children}
    </Button>
  );
}

export function Options({ camera, onCamera, back, onBack }: { camera: Camera; onCamera: (next: Camera) => void; back: string; onBack: () => void }) {
  return (
    <>
      <ScreenTitle title="Options" back={back} onBack={onBack} />
      <fieldset className="space-y-3">
        <legend className="mb-3 text-sm text-muted-foreground">Vue</legend>
        <Choice pressed={camera === 'chase'} onClick={() => onCamera('chase')}>Poursuite</Choice>
        <Choice pressed={camera === 'cockpit'} onClick={() => onCamera('cockpit')}>Cockpit</Choice>
      </fieldset>
      <p className="mt-6 text-sm text-muted-foreground">
        Haut, W ou Z pour accélérer. Flèches ou A et D pour tourner. Espace pour freiner. C change la vue pendant le tour.
      </p>
    </>
  );
}

/** Les trois temps de secteur d'un record, ou rien s'il a été enregistré sans eux. */
export function sectorSplits(record: LapRecord): string[] | null {
  const sectors = record.sectors;
  if (!sectors) return null;
  return [sectors[0], sectors[1] - sectors[0], sectors[2] - sectors[1]].map(formatLap);
}

export function Credits({ plural }: { plural: boolean }) {
  return (
    <p className="mt-8 text-center text-[11px] text-white/40">
      {plural ? 'Tracés' : 'Tracé'} F1DB, CC BY 4.0 · Altitudes Copernicus DEM via Open-Meteo, CC BY 4.0
    </p>
  );
}
