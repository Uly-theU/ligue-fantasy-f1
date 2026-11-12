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
import manifestFile from '../../lib/circuits/2026/manifest.json';
import elevationFile from '../../lib/circuits/2026/elevation.json';
import cornersFile from '../../lib/circuits/2026/corners.json';
import melbourne from '../../lib/circuits/2026/01-melbourne.svg';
import shanghai from '../../lib/circuits/2026/02-shanghai.svg';
import suzuka from '../../lib/circuits/2026/03-suzuka.svg';
import miami from '../../lib/circuits/2026/04-miami.svg';
import montreal from '../../lib/circuits/2026/05-montreal.svg';
import monaco from '../../lib/circuits/2026/06-monaco.svg';
import catalunya from '../../lib/circuits/2026/07-catalunya.svg';
import spielberg from '../../lib/circuits/2026/08-spielberg.svg';
import silverstone from '../../lib/circuits/2026/09-silverstone.svg';
import spa from '../../lib/circuits/2026/10-spa-francorchamps.svg';
import hungaroring from '../../lib/circuits/2026/11-hungaroring.svg';
import zandvoort from '../../lib/circuits/2026/12-zandvoort.svg';
import monza from '../../lib/circuits/2026/13-monza.svg';
import madring from '../../lib/circuits/2026/14-madring.svg';
import baku from '../../lib/circuits/2026/15-baku.svg';
import sepang from '../../lib/circuits/2026/16-sepang.svg';
import marinaBay from '../../lib/circuits/2026/17-marina-bay.svg';
import austin from '../../lib/circuits/2026/18-austin.svg';
import mexicoCity from '../../lib/circuits/2026/19-mexico-city.svg';
import interlagos from '../../lib/circuits/2026/20-interlagos.svg';
import lasVegas from '../../lib/circuits/2026/21-las-vegas.svg';
import lusail from '../../lib/circuits/2026/22-lusail.svg';
import yasMarina from '../../lib/circuits/2026/23-yas-marina.svg';

const CAMERA_KEY = 'clm-camera';

const TRACKS: Record<string, string> = {
  melbourne,
  shanghai,
  suzuka,
  miami,
  montreal,
  monaco,
  catalunya,
  spielberg,
  silverstone,
  'spa-francorchamps': spa,
  hungaroring,
  zandvoort,
  monza,
  madring,
  baku,
  sepang,
  'marina-bay': marinaBay,
  austin,
  'mexico-city': mexicoCity,
  interlagos,
  'las-vegas': lasVegas,
  lusail,
  'yas-marina': yasMarina,
};

type Screen = 'menu' | 'race' | 'times' | 'options';
type Camera = 'chase' | 'cockpit';

type Circuit = {
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

const SEASON = manifestFile as Circuit[];
const ELEVATION = elevationFile as ElevationFile;
const CORNERS = cornersFile as CornersFile;

const DIRECTION: Record<Circuit['direction'], string> = {
  CLOCKWISE: 'Sens horaire',
  ANTI_CLOCKWISE: 'Sens anti-horaire',
};

function recordKey(circuitId: string): string {
  return `clm-record:v5:${circuitId}`;
}

function readCamera(): Camera {
  try {
    return localStorage.getItem(CAMERA_KEY) === 'cockpit' ? 'cockpit' : 'chase';
  } catch {
    return 'chase';
  }
}

function readRecord(circuitId: string): LapRecord | null {
  try {
    return parseRecord(localStorage.getItem(recordKey(circuitId)));
  } catch {
    return null;
  }
}

function readChoice(): string | null {
  const raw = new URLSearchParams(window.location.search).get('circuit');
  return raw && SEASON.some((circuit) => circuit.circuit_id === raw) ? raw : null;
}

function formatKm(km: number): string {
  return `${km.toFixed(3).replace('.', ',')} km`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T12:00:00Z`));
}

export function Demo() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [camera, setCamera] = useState<Camera>(readCamera);
  const [circuitId, setCircuitId] = useState<string | null>(readChoice);
  const [records, setRecords] = useState<Record<string, LapRecord | null>>({});

  const circuit = SEASON.find((entry) => entry.circuit_id === circuitId) ?? null;

  const chooseCamera = (next: Camera) => {
    setCamera(next);
    try {
      localStorage.setItem(CAMERA_KEY, next);
    } catch { /* stockage privé */ }
  };

  const openRace = (id: string) => {
    setCircuitId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('circuit', id);
    window.history.replaceState(null, '', url);
    setScreen('race');
  };

  const openTimes = () => {
    const next: Record<string, LapRecord | null> = {};
    for (const entry of SEASON) next[entry.circuit_id] = readRecord(entry.circuit_id);
    setRecords(next);
    setScreen('times');
  };

  const clearRecord = (id: string) => {
    try {
      localStorage.removeItem(recordKey(id));
    } catch { /* stockage privé */ }
    setRecords((current) => ({ ...current, [id]: null }));
  };

  if (screen === 'race' && circuit) {
    return (
      <Shell>
        <Race circuit={circuit} camera={camera} onMenu={() => setScreen('menu')} />
      </Shell>
    );
  }

  if (screen === 'times') {
    return (
      <Shell>
        <ScreenTitle title="Temps enregistrés" onBack={() => setScreen('menu')} />
        <ul className="space-y-2">
          {SEASON.map((entry) => {
            const record = records[entry.circuit_id];
            return (
              <li key={entry.circuit_id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">R{entry.round} · {entry.full_name}</p>
                  <p className="font-mono text-lg tabular-nums">{record ? formatLap(record.time) : '—'}</p>
                </div>
                {record && (
                  <Button type="button" variant="outline" size="sm" onClick={() => clearRecord(entry.circuit_id)}>Effacer</Button>
                )}
              </li>
            );
          })}
        </ul>
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
      <h1 className="mt-2 text-4xl font-bold">Saison 2026</h1>
      <p className="mt-2 text-sm text-muted-foreground">{SEASON.length} circuits · contre-la-montre</p>
      <ul className="mt-8 space-y-2">
        {SEASON.map((entry) => (
          <li key={entry.circuit_id}>
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-between gap-4 whitespace-normal rounded-2xl px-4 py-3 text-left"
              onClick={() => openRace(entry.circuit_id)}
            >
              <span>
                <span className="block text-xs uppercase tracking-[0.16em] text-white/55">R{entry.round} · {formatDate(entry.date)}</span>
                <span className="mt-1 block text-base font-semibold">{entry.full_name}</span>
              </span>
              <span className="shrink-0 text-right text-xs text-white/70">
                {formatKm(entry.length_km)}
                <span className="mt-1 block">{entry.turns} virages · {DIRECTION[entry.direction]}</span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" onClick={openTimes}>Temps enregistrés</Button>
        <Button type="button" variant="outline" onClick={() => setScreen('options')}>Options</Button>
      </div>
      <p className="mt-8 text-center text-[11px] text-white/40">
        Tracés F1DB, CC BY 4.0 · Altitudes Copernicus DEM via Open-Meteo, CC BY 4.0
      </p>
    </Shell>
  );
}

function Race({ circuit, camera, onMenu }: { circuit: Circuit; camera: Camera; onMenu: () => void }) {
  const prepared = useMemo(() => prepare(circuit), [circuit]);

  if (!prepared) {
    return (
      <>
        <ScreenTitle title={circuit.full_name} onBack={onMenu} />
        <p className="text-center text-lg">Ce tracé ne peut pas être parcouru.</p>
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-ember">Démo · R{circuit.round} · Contre-la-montre</p>
          <h1 className="text-2xl font-bold">{circuit.full_name}</h1>
        </div>
        <Button type="button" variant="outline" onClick={onMenu}>Circuits</Button>
      </div>
      <TimeTrial
        key={`${circuit.circuit_id}:${camera}`}
        track={prepared.track}
        lengthKm={circuit.length_km}
        circuitId={circuit.circuit_id}
        elevation={prepared.samples}
        signs={prepared.signs}
      />
    </>
  );
}

function prepare(circuit: Circuit) {
  const svg = TRACKS[circuit.circuit_id];
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
      <Button type="button" variant="outline" onClick={onBack}>Circuits</Button>
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

const root = document.getElementById('demo');
if (root) createRoot(root).render(<Demo />);
