/** Photos libres (Wikimedia Commons). Crédit visible sur l'accueil. */

const CIRCUITS: Record<string, string> = {
  MC: '/photos/circuits/monaco.jpg',
  JP: '/photos/circuits/suzuka.jpg',
  IT: '/photos/circuits/monza.jpg',
  BE: '/photos/circuits/spa.jpg',
  MX: '/photos/circuits/mexico.jpg',
  GB: '/photos/circuits/silverstone.jpg',
  US: '/photos/circuits/mclaren.jpg',
};

const FALLBACKS = [
  '/photos/circuits/monaco.jpg',
  '/photos/circuits/silverstone.jpg',
  '/photos/circuits/mclaren.jpg',
  '/photos/circuits/champions.jpg',
  '/photos/circuits/spa.jpg',
  '/photos/circuits/monza.jpg',
  '/photos/circuits/suzuka.jpg',
  '/photos/circuits/mexico.jpg',
];

const DRIVERS: Record<string, string> = {
  VER: '/photos/drivers/ver.jpg',
  NOR: '/photos/drivers/nor.jpg',
  PIA: '/photos/drivers/pia.jpg',
};

export function circuitPhoto(country: string | null | undefined, round = 1): string {
  if (country && CIRCUITS[country]) return CIRCUITS[country];
  const index = Math.abs(round - 1) % FALLBACKS.length;
  return FALLBACKS[index];
}

export function driverPhoto(shortName: string | null | undefined): string | null {
  if (!shortName) return null;
  return DRIVERS[shortName.toUpperCase()] ?? null;
}
