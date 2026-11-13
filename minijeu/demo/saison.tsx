import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TimeTrial } from '@/components/clm/time-trial';
import { Button } from '@/components/ui/button';
import { formatLap } from '@/lib/clm';
import type { LapRecord } from '@/lib/clm-record';
import {
  Credits, Options, ScreenTitle, SEASON, Shell, describeCircuit, eraseRecord, formatKm, prepare, readCamera, readRecord,
  saveCamera, sectorSplits, type Camera, type Circuit, type Screen,
} from './shared';
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

const CIRCUIT_PARAM = 'circuit';

function readChoice(): string | null {
  const raw = new URLSearchParams(window.location.search).get(CIRCUIT_PARAM);
  return raw && SEASON.some((circuit) => circuit.circuit_id === raw) ? raw : null;
}

/** L'adresse suit le circuit ouvert : la recharger ou la partager rouvre la même course. */
function writeChoice(id: string | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set(CIRCUIT_PARAM, id);
  else url.searchParams.delete(CIRCUIT_PARAM);
  window.history.replaceState(null, '', url);
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
  const [circuitId, setCircuitId] = useState<string | null>(readChoice);
  const [screen, setScreen] = useState<Screen>(() => (circuitId ? 'race' : 'menu'));
  const [camera, setCamera] = useState<Camera>(readCamera);
  const [records, setRecords] = useState<Record<string, LapRecord | null>>({});

  const circuit = SEASON.find((entry) => entry.circuit_id === circuitId) ?? null;

  const toMenu = () => {
    writeChoice(null);
    setScreen('menu');
  };

  const openRace = (id: string) => {
    setCircuitId(id);
    writeChoice(id);
    setScreen('race');
  };

  const openTimes = () => {
    const next: Record<string, LapRecord | null> = {};
    for (const entry of SEASON) next[entry.circuit_id] = readRecord(entry.circuit_id);
    setRecords(next);
    setScreen('times');
  };

  const clearRecord = (id: string) => {
    eraseRecord(id);
    setRecords((current) => ({ ...current, [id]: null }));
  };

  if (screen === 'race' && circuit) {
    return (
      <Shell>
        <Race circuit={circuit} camera={camera} onMenu={toMenu} />
      </Shell>
    );
  }

  if (screen === 'times') {
    return (
      <Shell>
        <ScreenTitle title="Temps enregistrés" back="Circuits" onBack={toMenu} />
        <ul className="space-y-2">
          {SEASON.map((entry) => {
            const record = records[entry.circuit_id];
            const splits = record ? sectorSplits(record) : null;
            return (
              <li key={entry.circuit_id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">R{entry.round} · {entry.full_name}</p>
                  <p className="font-mono text-lg tabular-nums">{record ? formatLap(record.time) : '—'}</p>
                  {splits && <p className="font-mono text-xs tabular-nums text-white/60">{splits.join(' · ')}</p>}
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
        <Options
          camera={camera}
          onCamera={(next) => {
            setCamera(next);
            saveCamera(next);
          }}
          back="Circuits"
          onBack={toMenu}
        />
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
                <span className="mt-1 block">{describeCircuit(entry)}</span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" onClick={openTimes}>Temps enregistrés</Button>
        <Button type="button" variant="outline" onClick={() => setScreen('options')}>Options</Button>
      </div>
      <Credits plural />
    </Shell>
  );
}

function Race({ circuit, camera, onMenu }: { circuit: Circuit; camera: Camera; onMenu: () => void }) {
  const prepared = useMemo(() => prepare(circuit, TRACKS[circuit.circuit_id]), [circuit]);

  if (!prepared) {
    return (
      <>
        <ScreenTitle title={circuit.full_name} back="Circuits" onBack={onMenu} />
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

const root = document.getElementById('demo');
if (root) createRoot(root).render(<Demo />);
