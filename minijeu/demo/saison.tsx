import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Borne } from '@/components/clm/arcade/habillage';
import { TimeTrial } from '@/components/clm/time-trial';
import { formatLap } from '@/lib/clm';
import type { LapRecord } from '@/lib/clm-record';
import {
  Credits, Options, ScreenTitle, SEASON, Shell, describeCircuit, eraseRecord, formatKm, panneauRecord, prepare, readCamera, readRecord,
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

function meilleurRecord(records: Array<LapRecord | null>): LapRecord | null {
  let best: LapRecord | null = null;
  for (const record of records) {
    if (record && (best == null || record.time < best.time)) best = record;
  }
  return best;
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
    setCamera(readCamera());
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
    const meilleur = meilleurRecord(SEASON.map((entry) => records[entry.circuit_id] ?? null));
    return (
      <Shell>
        <Borne
          surtitre="Meilleurs"
          mot="Temps"
          stickers={meilleur ? ['record'] : []}
          hiScore={meilleur ? formatLap(meilleur.time) : '—'}
          panneau={panneauRecord(meilleur)}
        >
          <ul className="clm-arcade__liste-boutons">
            {SEASON.map((entry) => {
              const record = records[entry.circuit_id];
              const splits = record ? sectorSplits(record) : null;
              return (
                <li key={entry.circuit_id} className="clm-arcade__ligne-record">
                  <div>
                    <p>
                      <span className="clm-arcade__legend">R{entry.round}</span>
                      <span>{entry.full_name}</span>
                    </p>
                    <p className="clm-arcade__chiffre">{record ? formatLap(record.time) : '—'}</p>
                    {splits && <p className="clm-arcade__chiffre">{splits.join(' · ')}</p>}
                  </div>
                  {record && (
                    <button type="button" onClick={() => clearRecord(entry.circuit_id)}>Effacer</button>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={toMenu}>Circuits</button>
        </Borne>
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

  const meilleur = meilleurRecord(SEASON.map((entry) => readRecord(entry.circuit_id)));

  return (
    <Shell>
      <Borne
        rays
        objet
        press
        surtitre="Saison"
        mot="Chrono"
        detail={`${SEASON.length} circuits`}
        stickers={['record', 'nouveau', 'depart', 'saison']}
        hiScore={meilleur ? formatLap(meilleur.time) : '0:00.000'}
        panneau={panneauRecord(meilleur)}
      >
        <div className="clm-arcade__grille-circuits clm-arcade__liste-boutons">
          {SEASON.map((entry) => (
            <button key={entry.circuit_id} type="button" className="clm-arcade__circuit" onClick={() => openRace(entry.circuit_id)}>
              <small>R{entry.round} · {formatDate(entry.date)}</small>
              {entry.full_name}
              <small>
                {formatKm(entry.length_km)} · {describeCircuit(entry)}
              </small>
            </button>
          ))}
        </div>
        <div className="clm-arcade__liste-boutons">
          <button type="button" onClick={openTimes}>Temps enregistrés</button>
          <button type="button" onClick={() => setScreen('options')}>Options</button>
        </div>
        <Credits plural />
      </Borne>
    </Shell>
  );
}

function Race({ circuit, camera, onMenu }: { circuit: Circuit; camera: Camera; onMenu: () => void }) {
  const prepared = useMemo(() => prepare(circuit, TRACKS[circuit.circuit_id]), [circuit]);

  if (!prepared) {
    return (
      <section className="clm-arcade" aria-label="Borne contre-la-montre">
        <ScreenTitle title={circuit.full_name} back="Circuits" onBack={onMenu} />
        <p className="clm-arcade__aide">Ce tracé ne peut pas être parcouru.</p>
      </section>
    );
  }

  return (
    <TimeTrial
      key={circuit.circuit_id}
      track={prepared.track}
      lengthKm={circuit.length_km}
      circuitId={circuit.circuit_id}
      elevation={prepared.samples}
      signs={prepared.signs}
      camera={camera}
      circuitName={circuit.full_name}
      onLeave={onMenu}
      leaveLabel="Circuits"
    />
  );
}

const root = document.getElementById('demo');
if (root) createRoot(root).render(<Demo />);
