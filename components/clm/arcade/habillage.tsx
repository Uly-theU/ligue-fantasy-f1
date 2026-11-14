import type { ReactNode } from 'react';
import './arcade.css';

export type Pastille = 'jaune' | 'cyan' | 'rouge' | 'vert';

export type LignePanneau = {
  pastille: Pastille;
  label: string;
  valeur: string;
};

export type Autocollant = 'record' | 'nouveau' | 'depart' | 'saison';

/** Les trois lignes du panneau dense : secteur, somme, record. */
export function lignesPanneau(secteur: string, somme: string, record: string): LignePanneau[] {
  return [
    { pastille: 'cyan', label: 'Secteur', valeur: secteur },
    { pastille: 'jaune', label: 'Somme', valeur: somme },
    { pastille: 'rouge', label: 'Record', valeur: record },
  ];
}

/** Premier morceau qui ressemble à un temps. Un nom de circuit ne devient pas un secteur. */
export function secteurAffiche(valeur: string | null | undefined): string {
  const premier = valeur?.split('·')[0]?.trim() ?? '';
  return /^\d/.test(premier) ? premier : '—';
}

type HabillageProps = {
  rays?: boolean;
  surtitre: string;
  mot: string;
  niveau?: 1 | 2;
  stickers?: Autocollant[];
  hiScore?: string;
  credit?: string;
  panneau?: LignePanneau[];
  press?: boolean;
  objet?: boolean;
  detail?: string;
  children?: ReactNode;
};

export function Borne(props: HabillageProps) {
  return (
    <section className="clm-arcade" role="region" aria-label="Borne contre-la-montre">
      <Habillage {...props} />
    </section>
  );
}

export function Habillage({
  rays = false,
  surtitre,
  mot,
  niveau = 1,
  stickers = [],
  hiScore = '—',
  credit = '1',
  panneau,
  press = false,
  objet = false,
  detail,
  children,
}: HabillageProps) {
  const Titre = niveau === 1 ? 'h1' : 'h2';
  return (
    <>
      <div className={rays ? 'clm-arcade__deluxe clm-arcade__deluxe--rayons' : 'clm-arcade__deluxe'}>
        <div className="clm-arcade__fond" aria-hidden="true">
          {objet ? <Voiture /> : null}
          {rays ? <Horizon /> : null}
        </div>
        <div className="clm-arcade__avant">
          <div className="clm-arcade__coins">
            <p className="clm-arcade__hiscore">
              <span className="clm-arcade__pixel">HI-SCORE</span>
              <strong className="clm-arcade__chiffre">{hiScore}</strong>
            </p>
            <p className="clm-arcade__credit">
              <span className="clm-arcade__pixel">CRÉDIT</span>
              <strong className="clm-arcade__chiffre">{credit}</strong>
            </p>
          </div>
          <div className="clm-arcade__identite">
            <p className="clm-arcade__surtitre">{surtitre}</p>
            <Titre className="clm-arcade__mot">{mot}</Titre>
            {detail ? <p className="clm-arcade__sous-titre">{detail}</p> : null}
            <Autocollants kinds={stickers} />
          </div>
          {panneau ? <PanneauTemps lignes={panneau} /> : null}
          {press ? <p className="clm-arcade__press">Press Start</p> : null}
        </div>
      </div>
      {children ? <div className="clm-arcade__contenu">{children}</div> : null}
    </>
  );
}

export function PanneauTemps({ lignes }: { lignes: LignePanneau[] }) {
  return (
    <ul className="clm-arcade__panneau">
      {lignes.map((ligne) => (
        <li key={ligne.label}>
          <span className={`clm-arcade__pastille clm-arcade__pastille--${ligne.pastille}`} aria-hidden="true" />
          <span>{ligne.label}</span>
          <span className="clm-arcade__chiffre">{ligne.valeur}</span>
        </li>
      ))}
    </ul>
  );
}

function Autocollants({ kinds }: { kinds: Autocollant[] }) {
  if (kinds.length === 0) return null;
  return (
    <div className="clm-arcade__autocollants">
      {kinds.includes('record') ? <span className="clm-arcade__eclat">Record</span> : null}
      {kinds.includes('nouveau') ? <span className="clm-arcade__ruban">Nouveau</span> : null}
      {kinds.includes('saison') ? <span className="clm-arcade__badge-rond">2026</span> : null}
      {kinds.includes('depart') ? <span className="clm-arcade__flamme">Départ</span> : null}
    </div>
  );
}

function Voiture() {
  return (
    <svg className="clm-arcade__objet" viewBox="0 0 168 64" aria-hidden="true">
      <rect x="28" y="26" width="96" height="18" fill="#f4efe2" />
      <rect x="48" y="12" width="52" height="16" fill="#3de1ff" />
      <rect x="124" y="30" width="22" height="8" fill="#ff2a2a" />
      <rect x="12" y="32" width="18" height="6" fill="#ffe14a" />
      <rect x="34" y="40" width="20" height="20" fill="#05060a" stroke="#f4efe2" strokeWidth="3" />
      <rect x="108" y="40" width="20" height="20" fill="#05060a" stroke="#f4efe2" strokeWidth="3" />
      <rect x="40" y="46" width="8" height="8" fill="#ffe14a" />
      <rect x="114" y="46" width="8" height="8" fill="#ffe14a" />
    </svg>
  );
}

function Horizon() {
  return (
    <div className="clm-arcade__horizon">
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
