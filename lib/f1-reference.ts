/** Référentiel F1 importé depuis F1DB. https://github.com/f1db/f1db — CC BY 4.0. */
export const F1_DATA_SOURCE = {
  name: 'F1DB',
  version: 'v2026.17.0',
  url: 'https://github.com/f1db/f1db',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  releaseUrl: 'https://github.com/f1db/f1db/releases/download/v2026.17.0/f1db-json-splitted.zip',
  svgBaseUrl: 'https://raw.githubusercontent.com/f1db/f1db/v2026.17.0/src/assets/circuits/white-outline',
} as const;

export const REFERENCE_SEASON = 2026;

export const CIRCUIT_TYPE_LABEL: Record<string, string> = {
  STREET: 'Circuit urbain',
  RACE: 'Circuit permanent',
  ROAD: 'Circuit routier',
};

export const DIRECTION_LABEL: Record<string, string> = {
  CLOCKWISE: 'Sens horaire',
  ANTI_CLOCKWISE: 'Sens anti-horaire',
};

const COUNTRY_FR: Record<string, string> = {
  Argentina: 'Argentine',
  Australia: 'Australie',
  Austria: 'Autriche',
  Azerbaijan: 'Azerbaïdjan',
  Bahrain: 'Bahreïn',
  Belgium: 'Belgique',
  Brazil: 'Brésil',
  Canada: 'Canada',
  China: 'Chine',
  France: 'France',
  Germany: 'Allemagne',
  Hungary: 'Hongrie',
  India: 'Inde',
  Italy: 'Italie',
  Japan: 'Japon',
  Malaysia: 'Malaisie',
  Mexico: 'Mexique',
  Monaco: 'Monaco',
  Morocco: 'Maroc',
  Netherlands: 'Pays-Bas',
  Portugal: 'Portugal',
  Qatar: 'Qatar',
  Russia: 'Russie',
  'Saudi Arabia': 'Arabie saoudite',
  Singapore: 'Singapour',
  'South Africa': 'Afrique du Sud',
  'South Korea': 'Corée du Sud',
  Spain: 'Espagne',
  Sweden: 'Suède',
  Switzerland: 'Suisse',
  Turkey: 'Turquie',
  'United Arab Emirates': 'Émirats arabes unis',
  'United Kingdom': 'Royaume-Uni',
  'United States of America': 'États-Unis',
};

export function countryLabel(name: string): string {
  return COUNTRY_FR[name] ?? name;
}

/** Noms du calendrier fantasy qui ne reprennent pas le nom officiel F1DB. */
const CIRCUIT_ALIASES: Record<string, string> = {
  'melbourne grand prix circuit': 'melbourne',
  'suzuka international racing course': 'suzuka',
  'las vegas strip circuit': 'las-vegas',
};

export type CircuitName = {
  id: string;
  full_name: string;
  name: string;
  previous_names: string[];
};

export function normalizeCircuitKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function namesOf(circuit: CircuitName): string[] {
  return [circuit.full_name, circuit.name, ...circuit.previous_names].map(normalizeCircuitKey);
}

export type DriverIdentity = {
  id: string;
  full_name: string;
  abbreviation: string;
  total_race_starts: number;
};

function tokens(name: string): string[] {
  return normalizeCircuitKey(name).split(' ').filter((token) => token.length > 1);
}

function tokenMatches(need: string, have: Set<string>): boolean {
  if (have.has(need)) return true;
  if (need.length < 4) return false;
  for (const token of have) {
    if (token.startsWith(need) || need.startsWith(token)) return true;
  }
  return false;
}

function nameCovers(entityName: string, fullName: string): boolean {
  const need = tokens(entityName);
  const have = new Set(tokens(fullName));
  return need.length >= 2 && need.every((token) => tokenMatches(token, have));
}

/** Relie un pilote fantasy (nom OpenF1) à l'identifiant du référentiel. */
export function linkFantasyDriver(
  entity: { name: string; short_name: string | null },
  drivers: DriverIdentity[],
  recentIds: ReadonlySet<string>,
): string | null {
  const abbreviation = entity.short_name?.toUpperCase() ?? '';
  const named = drivers.filter((driver) => nameCovers(entity.name, driver.full_name));
  const namedWithCode = abbreviation
    ? named.filter((driver) => driver.abbreviation === abbreviation)
    : named;
  let pool = namedWithCode.length > 0 ? namedWithCode : named;
  const recent = pool.filter((driver) => recentIds.has(driver.id));
  if (recent.length > 0) pool = recent;
  if (pool.length === 0 && abbreviation) {
    const recentCode = drivers.filter(
      (driver) => driver.abbreviation === abbreviation && recentIds.has(driver.id),
    );
    if (recentCode.length === 1) return recentCode[0].id;
  }
  return pool.slice().sort((a, b) => b.total_race_starts - a.total_race_starts)[0]?.id ?? null;
}

export function matchCircuitId(label: string | null | undefined, circuits: CircuitName[]): string | null {
  if (!label?.trim()) return null;
  const key = normalizeCircuitKey(label);
  const alias = CIRCUIT_ALIASES[key];
  if (alias && circuits.some((circuit) => circuit.id === alias)) return alias;

  const exact = circuits.find((circuit) => namesOf(circuit).includes(key));
  if (exact) return exact.id;

  if (key.length < 8) return null;
  const hits = circuits.filter((circuit) =>
    namesOf(circuit).some((name) => name.length >= 8 && (name.includes(key) || key.includes(name))),
  );
  return hits.length === 1 ? hits[0].id : null;
}

export function normalizeTrackSvg(raw: string): string | null {
  const svg = raw.trim();
  if (!svg.startsWith('<svg') || /<script/i.test(svg)) return null;
  return svg
    .replace(/stroke:\s*#(?:fff|ffffff)\b/gi, 'stroke: currentColor')
    .replace(/stroke="#(?:fff|ffffff)"/gi, 'stroke="currentColor"');
}

type DecimalLike = { toNumber(): number } | number | null | undefined;

export function asNumber(value: DecimalLike): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

function plural(count: number, one: string, many: string): string {
  const label = count === 1 ? one : many;
  return `${count.toLocaleString('fr-FR')} ${label}`;
}

export function formatCareer(stats: {
  total_championship_wins: number;
  total_race_wins: number;
  total_podiums: number;
  total_pole_positions: number;
}): string {
  const parts: string[] = [];
  if (stats.total_championship_wins > 0) {
    parts.push(plural(stats.total_championship_wins, 'titre', 'titres'));
  }
  parts.push(plural(stats.total_race_wins, 'victoire', 'victoires'));
  parts.push(plural(stats.total_podiums, 'podium', 'podiums'));
  parts.push(plural(stats.total_pole_positions, 'pôle', 'pôles'));
  return parts.join(' · ');
}

export function formatKm(value: number): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} km`;
}

export function formatPoints(value: number): string {
  return value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
}

/** Couleurs approximatives des livrées 2026, pour l'affichage seulement. */
export const CONSTRUCTOR_COLORS: Record<string, string> = {
  mclaren: '#FF8000',
  ferrari: '#E8002D',
  'red-bull': '#3671C6',
  mercedes: '#27F4D2',
  'aston-martin': '#229971',
  alpine: '#FF87BC',
  williams: '#64C4FF',
  'racing-bulls': '#6692FF',
  haas: '#B6BABD',
  audi: '#F50537',
  cadillac: '#C0C0C0',
};
