import { useId } from 'react';
import { placesForCircuit } from '@/lib/circuit-places';
import { Habillage, type LignePanneau } from './habillage';

export type ChoixCircuit = {
  circuit_id: string;
  round: number;
  full_name: string;
  place_name: string | null;
  range_m: number | null;
};

export type EssaiAffiche = {
  name: string;
  roundNumber: number;
  nextRace: boolean;
  fullName: string | null;
  placeName: string | null;
  when: string;
  lengthLabel: string | null;
  turnsLabel: string | null;
  directionLabel: string | null;
  elevationLabel: string | null;
  circuitId: string | null;
  source: string;
};

const PROCHAIN = '';

export function EnteteClm({
  choice,
  circuits,
  onPick,
  essai = null,
  message = null,
  onRetry,
  attente = false,
}: {
  choice: string;
  circuits: ChoixCircuit[];
  onPick: (value: string) => void;
  essai?: EssaiAffiche | null;
  message?: string | null;
  onRetry?: () => void;
  attente?: boolean;
}) {
  const legendId = useId();
  const selectId = useId();
  const surtitre = essai
    ? `Contre-la-montre · Round ${essai.roundNumber}${essai.nextRace ? ' · Prochain Grand Prix' : ''}`
    : 'Contre-la-montre';
  const mot = essai?.name ?? (attente ? 'Chargement' : 'Vide');
  const detail = essai
    ? [essai.fullName, essai.placeName, essai.when].filter(Boolean).join(' · ')
    : message ?? undefined;
  const panneau = essai ? lignesFaits(essai) : undefined;
  const places = essai ? placesForCircuit(essai.circuitId) : [];

  return (
    <section
      className="clm-arcade clm-arcade__page"
      role="region"
      aria-label="Borne contre-la-montre"
      aria-busy={attente || undefined}
    >
      <Habillage
        rays={Boolean(essai)}
        objet={Boolean(essai)}
        surtitre={surtitre}
        mot={mot}
        detail={detail || undefined}
        stickers={essai ? (essai.nextRace ? ['saison', 'depart'] : ['saison']) : []}
        panneau={panneau}
      >
        {circuits.length > 0 ? (
          <label className="clm-arcade__liste" htmlFor={selectId}>
            <span className="clm-arcade__legend" id={legendId}>Circuit</span>
            <select
              id={selectId}
              className="clm-arcade__select"
              aria-labelledby={legendId}
              value={choice}
              onChange={(event) => onPick(event.target.value)}
            >
              <option value={PROCHAIN}>Prochain Grand Prix</option>
              {circuits.map((circuit) => (
                <option key={circuit.circuit_id} value={circuit.circuit_id}>
                  {libelleCircuit(circuit)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {attente ? <div className="clm-arcade__attente" /> : null}
        {onRetry ? (
          <button type="button" className="clm-arcade__bouton--principal" onClick={onRetry}>
            Réessayer
          </button>
        ) : null}
        {places.length > 0 ? (
          <section aria-label="Lieux du circuit">
            <h3>Lieux</h3>
            <ul className="clm-arcade__lore">
              {places.map((place) => (
                <li key={place.name}>
                  <span className="clm-arcade__legend">{place.name}</span>
                  {place.note}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {essai?.source ? <p className="clm-arcade__aide">{essai.source}</p> : null}
      </Habillage>
    </section>
  );
}

function libelleCircuit(circuit: ChoixCircuit): string {
  const denivele = circuit.range_m != null ? ` · ${Math.round(circuit.range_m)} m de dénivelé` : '';
  return `R${circuit.round} · ${circuit.full_name}${denivele}`;
}

function lignesFaits(essai: EssaiAffiche): LignePanneau[] | undefined {
  const lignes: LignePanneau[] = [];
  if (essai.lengthLabel) lignes.push({ pastille: 'cyan', label: 'Longueur', valeur: essai.lengthLabel });
  if (essai.turnsLabel) lignes.push({ pastille: 'jaune', label: 'Virages', valeur: essai.turnsLabel });
  if (essai.directionLabel) lignes.push({ pastille: 'vert', label: 'Sens', valeur: essai.directionLabel });
  if (essai.elevationLabel) lignes.push({ pastille: 'rouge', label: 'Dénivelé', valeur: essai.elevationLabel });
  return lignes.length > 0 ? lignes : undefined;
}
