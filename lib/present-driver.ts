import { asNumber, REFERENCE_SEASON } from '@/lib/f1-reference';

type DecimalLike = { toNumber(): number } | number | null;

type SeasonRow = {
  year: number;
  position: number | null;
  points: DecimalLike;
  wins: number;
  podiums: number;
  poles: number;
  fastest_laps?: number;
  starts?: number;
  position_text?: string;
  team?: { id: string; name: string } | null;
};

type ConstructorCard = {
  id: string;
  name: string;
  full_name?: string;
  color?: string | null;
  total_championship_wins: number;
  total_race_wins: number;
  total_podiums: number;
  total_pole_positions: number;
  total_points?: DecimalLike;
};

export type DriverReference = {
  id: string;
  full_name?: string;
  abbreviation?: string;
  nationality_name: string;
  nationality_code: string;
  date_of_birth?: Date | null;
  total_championship_wins: number;
  total_race_wins: number;
  total_podiums: number;
  total_pole_positions: number;
  total_fastest_laps: number;
  total_race_starts: number;
  total_points: DecimalLike;
  best_championship_position?: number | null;
  season_stats?: SeasonRow[];
  current_constructor?: ConstructorCard | null;
};

export function presentConstructor(constructor: ConstructorCard | null | undefined) {
  if (!constructor) return null;
  return {
    id: constructor.id,
    name: constructor.name,
    full_name: constructor.full_name ?? constructor.name,
    color: constructor.color ?? null,
    total_championship_wins: constructor.total_championship_wins,
    total_race_wins: constructor.total_race_wins,
    total_podiums: constructor.total_podiums,
    total_pole_positions: constructor.total_pole_positions,
    total_points: asNumber(constructor.total_points ?? null),
  };
}

export function presentSeason(season: SeasonRow) {
  return {
    year: season.year,
    position: season.position,
    position_text: season.position_text ?? (season.position != null ? String(season.position) : '–'),
    points: asNumber(season.points) ?? 0,
    wins: season.wins,
    podiums: season.podiums,
    poles: season.poles,
    fastest_laps: season.fastest_laps ?? 0,
    starts: season.starts ?? 0,
    constructor: season.team ? { id: season.team.id, name: season.team.name } : null,
  };
}

export function presentF1Driver(driver: DriverReference | null | undefined) {
  if (!driver) return null;
  const season = driver.season_stats?.find((row) => row.year === REFERENCE_SEASON) ?? driver.season_stats?.[0] ?? null;
  return {
    id: driver.id,
    full_name: driver.full_name ?? null,
    abbreviation: driver.abbreviation ?? null,
    nationality_name: driver.nationality_name,
    nationality_code: driver.nationality_code,
    date_of_birth: driver.date_of_birth ? driver.date_of_birth.toISOString().slice(0, 10) : null,
    total_championship_wins: driver.total_championship_wins,
    total_race_wins: driver.total_race_wins,
    total_podiums: driver.total_podiums,
    total_pole_positions: driver.total_pole_positions,
    total_fastest_laps: driver.total_fastest_laps,
    total_race_starts: driver.total_race_starts,
    total_points: asNumber(driver.total_points) ?? 0,
    best_championship_position: driver.best_championship_position ?? null,
    season: season ? presentSeason(season) : null,
    current_constructor: presentConstructor(driver.current_constructor),
  };
}

export const f1DriverCardInclude = {
  season_stats: {
    where: { year: REFERENCE_SEASON },
    include: { team: { select: { id: true, name: true } } },
  },
  current_constructor: {
    select: {
      id: true,
      name: true,
      full_name: true,
      color: true,
      total_championship_wins: true,
      total_race_wins: true,
      total_podiums: true,
      total_pole_positions: true,
      total_points: true,
    },
  },
} as const;
