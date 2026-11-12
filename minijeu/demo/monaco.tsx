import { useMemo, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { TimeTrial } from '@/components/clm/time-trial';
import { Button } from '@/components/ui/button';
import { trackSigns } from '@/lib/circuit-places';
import { bankTrack } from '@/lib/circuit-banking';
import { fitRoad, formatLap, metersPerUnit } from '@/lib/clm';
import { parseRecord, type LapRecord } from '@/lib/clm-record';
import { profileAt, smoothElevation, type ElevationSample } from '@/lib/grade';
import { orientTrack, trackFromSvg } from '@/lib/track-path';
import svgRaw from '../../lib/circuits/2026/06-monaco.svg';
import elevationFile from '../../lib/circuits/2026/elevation.json';
import cornersFile from '../../lib/circuits/2026/corners.json';

const CIRCUIT_ID = 'monaco';
const LENGTH_KM = 3.337;
const RECORD_KEY = `clm-record:v5:${CIRCUIT_ID}`;
const CAMERA_KEY = 'clm-camera';

type Screen = 'menu' | 'race' | 'times' | 'options';
type Camera = 'chase' | 'cockpit';

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

const elevation = (elevationFile as ElevationFile).circuits.monaco;
const corners = (cornersFile as CornersFile).circuits.monaco.corners;

function readCamera(): Camera {
  try {
    return localStorage.getItem(CAMERA_KEY) === 'cockpit' ? 'cockpit' : 'chase';
  } catch {
    return 'chase';
  }
}

function readRecord(): LapRecord | null {
  try {
    return parseRecord(localStorage.getItem(RECORD_KEY));
  } catch {
    return null;
  }
}

export function Demo() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [camera, setCamera] = useState<Camera>(readCamera);
  const [record, setRecord] = useState<LapRecord | null>(readRecord);

  const track = useMemo(() => {
    const drawn = trackFromSvg(svgRaw);
    if (!drawn || !elevation) return null;
    const raced = orientTrack(drawn, elevation);
    const heightAt = (s: number) => profileAt(elevation.points, raced.length > 0 ? s / raced.length : 0);
    return bankTrack(fitRoad(raced, LENGTH_KM, heightAt), CIRCUIT_ID, corners);
  }, []);

  const samples = useMemo<ElevationSample[] | undefined>(() => {
    if (!track || !elevation) return undefined;
    const raw = elevation.points.map(([fraction, z]) => ({ s: fraction * track.length, z }));
    return smoothElevation(raw, track.length, metersPerUnit(track, LENGTH_KM), track.closed);
  }, [track]);

  const signs = useMemo(() => (elevation ? trackSigns(CIRCUIT_ID, corners) : []), []);

  const openTimes = () => {
    setRecord(readRecord());
    setScreen('times');
  };

  const chooseCamera = (next: Camera) => {
    setCamera(next);
    try {
      localStorage.setItem(CAMERA_KEY, next);
    } catch { /* stockage privé */ }
  };

  const clearRecord = () => {
    try {
      localStorage.removeItem(RECORD_KEY);
    } catch { /* stockage privé */ }
    setRecord(null);
  };

  if (!track) {
    return <Shell><p className="text-center text-lg">Ce tracé ne peut pas être parcouru.</p></Shell>;
  }

  if (screen === 'race') {
    return (
      <Shell>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-ember">Démo · Contre-la-montre</p>
            <h1 className="text-2xl font-bold">Circuit de Monaco</h1>
          </div>
          <Button type="button" variant="outline" onClick={() => setScreen('menu')}>Menu</Button>
        </div>
        <TimeTrial
          key={camera}
          track={track}
          lengthKm={LENGTH_KM}
          circuitId={CIRCUIT_ID}
          elevation={samples}
          signs={signs}
        />
      </Shell>
    );
  }

  if (screen === 'times') {
    return (
      <Shell>
        <ScreenTitle title="Temps enregistrés" onBack={() => setScreen('menu')} />
        <Times record={record} onClear={clearRecord} />
      </Shell>
    );
  }

  if (screen === 'options') {
    return (
      <Shell>
        <ScreenTitle title="Options" onBack={() => setScreen('menu')} />
        <fieldset className="space-y-3">
          <legend className="mb-3 text-sm text-muted-foreground">Vue</legend>
          <Choice pressed={camera === 'chase'} onClick={() => chooseCamera('chase')}>Poursuite</Choice>
          <Choice pressed={camera === 'cockpit'} onClick={() => chooseCamera('cockpit')}>Cockpit</Choice>
        </fieldset>
        <p className="mt-6 text-sm text-muted-foreground">
          Haut, W ou Z pour accélérer. Flèches ou A et D pour tourner. Espace pour freiner. C change la vue pendant le tour.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.18em] text-ember">Démo · Ligue Fantasy F1</p>
      <h1 className="mt-2 text-4xl font-bold">Circuit de Monaco</h1>
      <p className="mt-2 text-sm text-muted-foreground">3,337 km · 19 virages · sens horaire</p>
      <div className="mt-8 flex flex-col gap-3">
        <Button type="button" onClick={() => setScreen('race')}>Lancer le circuit</Button>
        <Button type="button" variant="outline" onClick={openTimes}>Temps enregistrés</Button>
        <Button type="button" variant="outline" onClick={() => setScreen('options')}>Options</Button>
      </div>
      <p className="mt-8 text-center text-[11px] text-white/40">
        Tracé F1DB, CC BY 4.0 · Altitudes Copernicus DEM via Open-Meteo, CC BY 4.0
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8">
      {children}
    </main>
  );
}

function ScreenTitle({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <h1 className="text-3xl font-bold">{title}</h1>
      <Button type="button" variant="outline" onClick={onBack}>Menu</Button>
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

function Times({ record, onClear }: { record: LapRecord | null; onClear: () => void }) {
  if (!record) {
    return <p className="text-muted-foreground">Aucun tour enregistré. Le premier passage devient le record.</p>;
  }
  const sectors = record.sectors;
  const splits = sectors
    ? [sectors[0], sectors[1] - sectors[0], sectors[2] - sectors[1]]
    : null;
  return (
    <div className="rounded-3xl border border-white/15 bg-white/5 p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-white/55">Meilleur tour</p>
      <p className="mt-1 font-mono text-5xl tabular-nums">{formatLap(record.time)}</p>
      {splits && (
        <ul className="mt-4 space-y-1 font-mono text-sm tabular-nums text-white/80">
          {splits.map((split, index) => (
            <li key={index}>Secteur {index + 1} · {formatLap(split)}</li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" className="mt-6" onClick={onClear}>Effacer le record</Button>
    </div>
  );
}

const root = document.getElementById('demo');
if (root) createRoot(root).render(<Demo />);
