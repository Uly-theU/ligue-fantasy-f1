import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClmArcade } from '@/components/clm/arcade/ClmArcade';
import { Borne } from '@/components/clm/arcade/habillage';
import { TimeTrial } from '@/components/clm/time-trial';
import { formatLap } from '@/lib/clm';
import type { LapRecord } from '@/lib/clm-record';
import svgRaw from '../../lib/circuits/2026/06-monaco.svg';
import {
  Credits, Options, SEASON, Shell, describeCircuit, eraseRecord, formatKm, panneauRecord, prepare, readCamera, readRecord,
  saveCamera, sectorSplits, type Camera, type Screen,
} from './shared';

const CIRCUIT = SEASON.find((entry) => entry.circuit_id === 'monaco');

export function Demo() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [camera, setCamera] = useState<Camera>(readCamera);
  const [record, setRecord] = useState<LapRecord | null>(null);
  const [scripted] = useState(() => new URLSearchParams(window.location.search).get('ecran') === 'arrivee');
  const prepared = useMemo(() => (CIRCUIT ? prepare(CIRCUIT, svgRaw) : null), []);
  const toMenu = () => setScreen('menu');

  if (scripted) {
    return (
      <Shell>
        <ClmArcade ecranInitial="resultats" />
      </Shell>
    );
  }

  if (!CIRCUIT || !prepared) {
    return (
      <Shell>
        <Borne surtitre="Circuit" mot="Vide" hiScore="—">
          <p className="clm-arcade__aide">Ce tracé ne peut pas être parcouru.</p>
        </Borne>
      </Shell>
    );
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
        <Borne
          surtitre="Meilleurs"
          mot="Temps"
          stickers={record ? ['record'] : []}
          hiScore={record ? formatLap(record.time) : '—'}
          panneau={panneauRecord(record)}
        >
          <Times
            record={record}
            onClear={() => {
              eraseRecord(circuit.circuit_id);
              setRecord(null);
            }}
          />
          <button type="button" onClick={toMenu}>Menu</button>
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
          back="Menu"
          onBack={toMenu}
        />
      </Shell>
    );
  }

  const affiche = record ?? readRecord(circuit.circuit_id);

  return (
    <Shell>
      <Borne
        rays
        objet
        press
        surtitre="Ligue"
        mot="Chrono"
        detail={circuit.full_name}
        stickers={['record', 'nouveau', 'depart', 'saison']}
        hiScore={affiche ? formatLap(affiche.time) : '0:00.000'}
        panneau={panneauRecord(affiche)}
      >
        <p className="clm-arcade__aide">{formatKm(circuit.length_km)} · {describeCircuit(circuit)}</p>
        <div className="clm-arcade__liste-boutons">
          <button type="button" className="clm-arcade__bouton--principal" onClick={() => { setCamera(readCamera()); setScreen('race'); }}>
            Lancer le circuit
          </button>
          <button
            type="button"
            onClick={() => {
              setRecord(readRecord(circuit.circuit_id));
              setScreen('times');
            }}
          >
            Temps enregistrés
          </button>
          <button type="button" onClick={() => setScreen('options')}>Options</button>
        </div>
        <Credits plural={false} />
      </Borne>
    </Shell>
  );
}

function Times({ record, onClear }: { record: LapRecord | null; onClear: () => void }) {
  if (!record) {
    return <p className="clm-arcade__aide">Aucun tour enregistré. Le premier passage devient le record.</p>;
  }
  const splits = sectorSplits(record);
  return (
    <div className="clm-arcade__ligne-record">
      <div>
        <p className="clm-arcade__legend">Meilleur tour</p>
        <p className="clm-arcade__temps clm-arcade__chiffre">{formatLap(record.time)}</p>
        {splits && (
          <ul className="clm-arcade__aide">
            {splits.map((split, index) => (
              <li key={index}>Secteur {index + 1} · {split}</li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" onClick={onClear}>Effacer le record</button>
    </div>
  );
}

const root = document.getElementById('demo');
if (root) createRoot(root).render(<Demo />);
