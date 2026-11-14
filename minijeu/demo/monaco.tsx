import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TimeTrial } from '@/components/clm/time-trial';
import { Button } from '@/components/ui/button';
import { formatLap } from '@/lib/clm';
import type { LapRecord } from '@/lib/clm-record';
import svgRaw from '../../lib/circuits/2026/06-monaco.svg';
import {
  Credits, Options, ScreenTitle, SEASON, Shell, describeCircuit, eraseRecord, formatKm, prepare, readCamera, readRecord,
  saveCamera, sectorSplits, type Camera, type Screen,
} from './shared';

const CIRCUIT = SEASON.find((entry) => entry.circuit_id === 'monaco');

export function Demo() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [camera, setCamera] = useState<Camera>(readCamera);
  const [record, setRecord] = useState<LapRecord | null>(null);
  const prepared = useMemo(() => (CIRCUIT ? prepare(CIRCUIT, svgRaw) : null), []);
  const toMenu = () => setScreen('menu');

  if (!CIRCUIT || !prepared) {
    return <Shell><p className="text-center text-lg">Ce tracé ne peut pas être parcouru.</p></Shell>;
  }
  const circuit = CIRCUIT;

  if (screen === 'race') {
    return (
      <Shell>
        <TimeTrial
          track={prepared.track}
          lengthKm={circuit.length_km}
          circuitId={circuit.circuit_id}
          elevation={prepared.samples}
          signs={prepared.signs}
          camera={camera}
          circuitName={circuit.full_name}
          onLeave={toMenu}
          leaveLabel="Menu"
        />
      </Shell>
    );
  }

  if (screen === 'times') {
    return (
      <Shell>
        <ScreenTitle title="Temps enregistrés" back="Menu" onBack={toMenu} />
        <Times
          record={record}
          onClear={() => {
            eraseRecord(circuit.circuit_id);
            setRecord(null);
          }}
        />
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
          back="Menu"
          onBack={toMenu}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <p className="text-xs uppercase tracking-[0.18em] text-ember">Démo · Ligue Fantasy F1</p>
      <h1 className="mt-2 text-4xl font-bold">{circuit.full_name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{formatKm(circuit.length_km)} · {describeCircuit(circuit)}</p>
      <div className="mt-8 flex flex-col gap-3">
        <Button type="button" onClick={() => { setCamera(readCamera()); setScreen('race'); }}>Lancer le circuit</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setRecord(readRecord(circuit.circuit_id));
            setScreen('times');
          }}
        >
          Temps enregistrés
        </Button>
        <Button type="button" variant="outline" onClick={() => setScreen('options')}>Options</Button>
      </div>
      <Credits plural={false} />
    </Shell>
  );
}

function Times({ record, onClear }: { record: LapRecord | null; onClear: () => void }) {
  if (!record) {
    return <p className="text-muted-foreground">Aucun tour enregistré. Le premier passage devient le record.</p>;
  }
  const splits = sectorSplits(record);
  return (
    <div className="rounded-3xl border border-white/15 bg-white/5 p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-white/55">Meilleur tour</p>
      <p className="mt-1 font-mono text-5xl tabular-nums">{formatLap(record.time)}</p>
      {splits && (
        <ul className="mt-4 space-y-1 font-mono text-sm tabular-nums text-white/80">
          {splits.map((split, index) => (
            <li key={index}>Secteur {index + 1} · {split}</li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" className="mt-6" onClick={onClear}>Effacer le record</Button>
    </div>
  );
}

const root = document.getElementById('demo');
if (root) createRoot(root).render(<Demo />);
