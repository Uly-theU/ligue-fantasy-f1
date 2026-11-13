export type EcranArcade =
  | 'menu'
  | 'circuits'
  | 'options'
  | 'hud'
  | 'resultats'
  | 'records'
  | 'classement';

export type CircuitArcade = {
  id: string;
  nom: string;
  genre: string;
  longueur: string;
};

export type LigneTemps = {
  rang: number | null;
  joueur: string;
  temps: string | null;
  secteurs: string | null;
  ecart: string | null;
  courant?: boolean;
};

export const CIRCUITS: CircuitArcade[] = [
  { id: 'monaco', nom: 'Monaco', genre: 'Ville', longueur: '3,337 km' },
  { id: 'monza', nom: 'Monza', genre: 'Rapide', longueur: '5,793 km' },
  { id: 'spa', nom: 'Spa-Francorchamps', genre: 'Rapide', longueur: '7,004 km' },
  { id: 'suzuka', nom: 'Suzuka', genre: 'Mixte', longueur: '5,807 km' },
  { id: 'silverstone', nom: 'Silverstone', genre: 'Rapide', longueur: '5,891 km' },
  { id: 'villeneuve', nom: 'Gilles-Villeneuve', genre: 'Mixte', longueur: '4,361 km' },
];

export const TEMPS_CHRONO = '1:12.438';
export const VITESSE_KMH = '287';
export const ECART_COURSE = '+0.842';
export const PENALITE = '+5.0 s';

export const SECTEURS_COURSE = [
  { id: 's1', label: 'S1', temps: '22.551' },
  { id: 's2', label: 'S2', temps: '25.102' },
  { id: 's3', label: 'S3', temps: '24.785' },
] as const;

export const CLASSEMENT: LigneTemps[] = [
  {
    rang: 1,
    joueur: 'Nina R.',
    temps: '1:11.204',
    secteurs: '22.104 · 24.880 · 24.220',
    ecart: '—',
  },
  {
    rang: 2,
    joueur: 'Camille D.',
    temps: '1:12.438',
    secteurs: '22.551 · 25.102 · 24.785',
    ecart: '+1.234',
    courant: true,
  },
  {
    rang: 3,
    joueur: 'Léo M.',
    temps: '1:13.016',
    secteurs: '22.880 · 25.440 · 24.696',
    ecart: '+1.812',
  },
  { rang: null, joueur: 'Sara K.', temps: null, secteurs: null, ecart: null },
  { rang: null, joueur: 'Inès P.', temps: null, secteurs: null, ecart: null },
];

export const RECORDS: LigneTemps[] = [
  { rang: 1, joueur: 'Nina R.', temps: '1:11.204', secteurs: 'Monza', ecart: '—' },
  {
    rang: 2,
    joueur: 'Camille D.',
    temps: '1:12.438',
    secteurs: 'Monza',
    ecart: '+1.234',
    courant: true,
  },
  { rang: 3, joueur: 'Léo M.', temps: '1:14.902', secteurs: 'Monaco', ecart: '+3.698' },
];

/** Les membres sans temps restent sous ceux qui ont un chrono. */
export function lignesClassees(lignes: LigneTemps[]): LigneTemps[] {
  return [...lignes].sort((a, b) => {
    const aVide = a.temps == null;
    const bVide = b.temps == null;
    if (aVide !== bVide) return aVide ? 1 : -1;
    return (a.rang ?? 0) - (b.rang ?? 0);
  });
}
