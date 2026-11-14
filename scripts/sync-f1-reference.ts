/**
 * Importe le référentiel F1 (circuits, tracés, pilotes, écuries, historiques)
 * depuis la publication F1DB indiquée dans lib/f1-reference.ts.
 *
 * Usage : npm run db:sync-reference
 */
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  CONSTRUCTOR_COLORS,
  F1_DATA_SOURCE,
  linkFantasyDriver,
  matchCircuitId,
  normalizeTrackSvg,
  type CircuitName,
} from '../lib/f1-reference';

const execFileAsync = promisify(execFile);

function loadEnvFile() {
  const files = ['.env', '.env.local'];
  for (const [index, name] of files.entries()) {
    const envPath = path.join(process.cwd(), name);
    let text: string;
    try {
      text = readFileSync(envPath, 'utf8');
    } catch {
      continue;
    }
    const override = index > 0;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (override || !process.env[key]) process.env[key] = value;
    }
  }
}

type Country = { id: string; name: string; alpha2Code: string };
type CircuitRow = {
  id: string;
  name: string;
  fullName: string;
  previousNames: string[] | null;
  type: string;
  direction: string;
  placeName: string;
  countryId: string;
  latitude: number;
  longitude: number;
  length: number;
  turns: number;
  totalRacesHeld: number;
};
type LayoutRow = { id: string; circuitId: string; effective: boolean; length: number; turns: number };
type Person = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  fullName: string;
  abbreviation: string;
  permanentNumber: string | null;
  dateOfBirth: string | null;
  nationalityCountryId: string;
  totalChampionshipWins: number;
  totalRaceEntries: number;
  totalRaceStarts: number;
  totalRaceWins: number;
  totalRaceLaps: number;
  totalPodiums: number;
  totalPoints: number;
  totalPolePositions: number;
  totalFastestLaps: number;
  totalSprintRaceStarts: number;
  totalSprintRaceWins: number;
  totalDriverOfTheDay: number;
  totalGrandSlams: number;
  bestChampionshipPosition: number | null;
  bestRaceResult: number | null;
  bestStartingGridPosition: number | null;
};
type ConstructorRow = {
  id: string;
  name: string;
  fullName: string;
  countryId: string;
  totalChampionshipWins: number;
  totalRaceEntries: number;
  totalRaceStarts: number;
  totalRaceWins: number;
  totalPodiums: number;
  totalPoints: number;
  totalPolePositions: number;
  totalFastestLaps: number;
  bestChampionshipPosition: number | null;
  bestRaceResult: number | null;
};
type DriverSeason = {
  year: number;
  driverId: string;
  positionNumber: number | null;
  positionText: string;
  totalPoints: number;
  totalRaceWins: number;
  totalPodiums: number;
  totalPolePositions: number;
  totalFastestLaps: number;
  totalRaceStarts: number;
  totalRaceEntries: number;
  totalRaceLaps: number;
  totalSprintRaceStarts: number;
  totalSprintRaceWins: number;
  totalDriverOfTheDay: number;
  bestRaceResult: number | null;
  bestStartingGridPosition: number | null;
};
type ConstructorSeason = {
  year: number;
  constructorId: string;
  positionNumber: number | null;
  positionText: string;
  totalPoints: number;
  totalRaceWins: number;
  totalPodiums: number;
  totalPodiumRaces: number;
  totalPolePositions: number;
  totalFastestLaps: number;
  totalRaceStarts: number;
  totalRaceEntries: number;
  total1And2Finishes: number;
  totalSprintRaceStarts: number;
  totalSprintRaceWins: number;
  bestRaceResult: number | null;
  bestStartingGridPosition: number | null;
};
type Entrant = {
  year: number;
  constructorId: string;
  driverId: string;
  rounds: number[] | null;
  testDriver: boolean;
};
type RaceRow = {
  id: number;
  year: number;
  round: number;
  date: string;
  officialName: string;
  grandPrixId: string;
  circuitId: string;
  circuitLayoutId: string | null;
  direction: string | null;
  courseLength: number | null;
  turns: number | null;
  laps: number | null;
  distance: number | null;
};
type Classified = {
  raceId: number;
  positionNumber: number | null;
  positionDisplayOrder: number;
  driverId: string;
  constructorId?: string;
  time?: string | null;
};

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function countryOf(countries: Map<string, Country>, id: string) {
  const country = countries.get(id);
  if (!country) throw new Error(`Pays inconnu : ${id}`);
  return country;
}

async function readJson<T>(dir: string, file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(dir, file), 'utf8')) as T;
}

async function ensureExtracted(): Promise<string> {
  const dir = path.join(tmpdir(), `f1db-${F1_DATA_SOURCE.version}`);
  await mkdir(dir, { recursive: true });
  const zipPath = path.join(dir, 'f1db.zip');
  try {
    await access(zipPath);
    console.log(`Archive ${F1_DATA_SOURCE.version} déjà téléchargée.`);
  } catch {
    console.log(`Téléchargement de ${F1_DATA_SOURCE.name} ${F1_DATA_SOURCE.version}…`);
    const response = await fetch(F1_DATA_SOURCE.releaseUrl);
    if (!response.ok) throw new Error(`Téléchargement F1DB impossible (${response.status}).`);
    await writeFile(zipPath, Buffer.from(await response.arrayBuffer()));
  }

  try {
    await access(path.join(dir, 'f1db-circuits.json'));
  } catch {
    await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', dir]);
  }
  return dir;
}

function firstPlace(rows: Classified[]): Map<number, Classified> {
  const winners = new Map<number, Classified>();
  for (const row of rows) {
    if (row.positionNumber !== 1) continue;
    const current = winners.get(row.raceId);
    if (!current || row.positionDisplayOrder < current.positionDisplayOrder) {
      winners.set(row.raceId, row);
    }
  }
  return winners;
}

async function eachLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => run()));
}

async function main() {
  loadEnvFile();
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL est absent. Renseigne-le dans .env avant de lancer la synchro.');
  }

  const { prisma } = await import('../lib/prisma');
  const dir = await ensureExtracted();

  const countries = new Map(
    (await readJson<Country[]>(dir, 'f1db-countries.json')).map((country) => [country.id, country]),
  );
  const circuits = await readJson<CircuitRow[]>(dir, 'f1db-circuits.json');
  const layouts = await readJson<LayoutRow[]>(dir, 'f1db-circuits-layouts.json');
  const drivers = await readJson<Person[]>(dir, 'f1db-drivers.json');
  const constructors = await readJson<ConstructorRow[]>(dir, 'f1db-constructors.json');
  const driverSeasons = await readJson<DriverSeason[]>(dir, 'f1db-seasons-drivers.json');
  const constructorSeasons = await readJson<ConstructorSeason[]>(dir, 'f1db-seasons-constructors.json');
  const entrants = await readJson<Entrant[]>(dir, 'f1db-seasons-entrants-drivers.json');
  const races = await readJson<RaceRow[]>(dir, 'f1db-races.json');

  console.log('Lecture des résultats, qualifications et meilleurs tours…');
  const winners = firstPlace(await readJson<Classified[]>(dir, 'f1db-races-race-results.json'));
  const poles = firstPlace(await readJson<Classified[]>(dir, 'f1db-races-qualifying-results.json'));
  const fastest = firstPlace(await readJson<Classified[]>(dir, 'f1db-races-fastest-laps.json'));

  const constructorIds = new Set(constructors.map((constructor) => constructor.id));
  const driverIds = new Set(drivers.map((driver) => driver.id));
  const layoutIds = new Set(layouts.map((layout) => layout.id));
  const circuitIds = new Set(circuits.map((circuit) => circuit.id));

  const teamByDriverYear = new Map<string, { constructorId: string; maxRound: number; count: number }>();
  const currentTeam = new Map<string, { year: number; constructorId: string; maxRound: number }>();
  for (const entrant of entrants) {
    if (entrant.testDriver || !constructorIds.has(entrant.constructorId)) continue;
    const rounds = entrant.rounds ?? [];
    const maxRound = rounds.length ? Math.max(...rounds) : 0;
    const key = `${entrant.year}:${entrant.driverId}`;
    const previous = teamByDriverYear.get(key);
    if (!previous || maxRound > previous.maxRound || (maxRound === previous.maxRound && rounds.length > previous.count)) {
      teamByDriverYear.set(key, { constructorId: entrant.constructorId, maxRound, count: rounds.length });
    }
    if (rounds.length === 0) continue;
    const current = currentTeam.get(entrant.driverId);
    if (!current || entrant.year > current.year || (entrant.year === current.year && maxRound > current.maxRound)) {
      currentTeam.set(entrant.driverId, { year: entrant.year, constructorId: entrant.constructorId, maxRound });
    }
  }

  const activeConstructorIds = new Set(
    constructorSeasons.filter((season) => season.year === 2026 && season.totalRaceStarts > 0).map((season) => season.constructorId),
  );

  console.log(`Écuries (${constructors.length})…`);
  for (let offset = 0; offset < constructors.length; offset += 40) {
    const chunk = constructors.slice(offset, offset + 40);
    await prisma.$transaction(chunk.map((constructor) => {
      const country = countryOf(countries, constructor.countryId);
      const data = {
        name: clip(constructor.name, 120),
        full_name: clip(constructor.fullName, 200),
        country_id: constructor.countryId,
        country_name: clip(country.name, 80),
        country_code: country.alpha2Code,
        color: CONSTRUCTOR_COLORS[constructor.id] ?? null,
        active: activeConstructorIds.has(constructor.id),
        total_championship_wins: constructor.totalChampionshipWins,
        total_race_entries: constructor.totalRaceEntries,
        total_race_starts: constructor.totalRaceStarts,
        total_race_wins: constructor.totalRaceWins,
        total_podiums: constructor.totalPodiums,
        total_points: constructor.totalPoints,
        total_pole_positions: constructor.totalPolePositions,
        total_fastest_laps: constructor.totalFastestLaps,
        best_championship_position: constructor.bestChampionshipPosition,
        best_race_result: constructor.bestRaceResult,
      };
      return prisma.f1Constructor.upsert({ where: { id: constructor.id }, update: data, create: { id: constructor.id, ...data } });
    }));
  }

  console.log(`Pilotes (${drivers.length})…`);
  for (let offset = 0; offset < drivers.length; offset += 40) {
    const chunk = drivers.slice(offset, offset + 40);
    await prisma.$transaction(chunk.map((driver) => {
      const country = countryOf(countries, driver.nationalityCountryId);
      const data = {
        first_name: clip(driver.firstName, 80),
        last_name: clip(driver.lastName, 120),
        full_name: clip(driver.fullName, 200),
        display_name: clip(driver.name, 120),
        abbreviation: driver.abbreviation,
        permanent_number: driver.permanentNumber && /^\d{1,2}$/.test(driver.permanentNumber) ? driver.permanentNumber : null,
        nationality_id: driver.nationalityCountryId,
        nationality_name: clip(country.name, 80),
        nationality_code: country.alpha2Code,
        date_of_birth: driver.dateOfBirth ? new Date(`${driver.dateOfBirth}T00:00:00.000Z`) : null,
        total_championship_wins: driver.totalChampionshipWins,
        total_race_entries: driver.totalRaceEntries,
        total_race_starts: driver.totalRaceStarts,
        total_race_wins: driver.totalRaceWins,
        total_race_laps: driver.totalRaceLaps,
        total_podiums: driver.totalPodiums,
        total_points: driver.totalPoints,
        total_pole_positions: driver.totalPolePositions,
        total_fastest_laps: driver.totalFastestLaps,
        total_sprint_starts: driver.totalSprintRaceStarts,
        total_sprint_wins: driver.totalSprintRaceWins,
        total_driver_of_the_day: driver.totalDriverOfTheDay,
        total_grand_slams: driver.totalGrandSlams,
        best_championship_position: driver.bestChampionshipPosition,
        best_race_result: driver.bestRaceResult,
        best_grid: driver.bestStartingGridPosition,
        current_constructor_id: currentTeam.get(driver.id)?.constructorId ?? null,
      };
      return prisma.f1Driver.upsert({ where: { id: driver.id }, update: data, create: { id: driver.id, ...data } });
    }));
  }

  console.log(`Circuits (${circuits.length}) et tracés (${layouts.length})…`);
  for (const circuit of circuits) {
    const country = countryOf(countries, circuit.countryId);
    const data = {
      name: clip(circuit.name, 120),
      full_name: clip(circuit.fullName, 200),
      previous_names: circuit.previousNames ?? [],
      circuit_type: circuit.type,
      direction: circuit.direction,
      place_name: clip(circuit.placeName, 120),
      country_id: circuit.countryId,
      country_name: clip(country.name, 80),
      country_code: country.alpha2Code,
      latitude: circuit.latitude,
      longitude: circuit.longitude,
      length_km: circuit.length,
      turns: circuit.turns,
      total_races: circuit.totalRacesHeld,
    };
    await prisma.circuit.upsert({ where: { id: circuit.id }, update: data, create: { id: circuit.id, ...data } });
  }

  for (let offset = 0; offset < layouts.length; offset += 40) {
    const chunk = layouts.slice(offset, offset + 40);
    await prisma.$transaction(chunk.map((layout) => {
      const data = {
        circuit_id: layout.circuitId,
        effective: layout.effective,
        length_km: layout.length,
        turns: layout.turns,
      };
      return prisma.circuitLayout.upsert({ where: { id: layout.id }, update: data, create: { id: layout.id, ...data } });
    }));
  }

  const known = (id: string | null | undefined, ids: Set<string>) => (id && ids.has(id) ? id : null);
  const raceRows = races.flatMap((race) => {
    if (!circuitIds.has(race.circuitId) || !race.date) return [];
    const winner = winners.get(race.id);
    const pole = poles.get(race.id);
    const lap = fastest.get(race.id);
    return [{
      id: race.id,
      year: race.year,
      round: race.round,
      official_name: clip(race.officialName || `${race.grandPrixId} ${race.year}`, 240),
      grand_prix_id: race.grandPrixId,
      date: new Date(`${race.date}T00:00:00.000Z`),
      circuit_id: race.circuitId,
      circuit_layout_id: known(race.circuitLayoutId, layoutIds),
      laps: race.laps,
      distance_km: race.distance,
      course_length_km: race.courseLength,
      turns: race.turns,
      direction: race.direction,
      winner_driver_id: known(winner?.driverId, driverIds),
      winner_constructor_id: known(winner?.constructorId, constructorIds),
      pole_driver_id: known(pole?.driverId, driverIds),
      fastest_lap_driver_id: known(lap?.driverId, driverIds),
      fastest_lap_time: lap?.time ? clip(lap.time, 16) : null,
    }];
  });

  const driverSeasonRows = driverSeasons.flatMap((season) => {
    if (!driverIds.has(season.driverId)) return [];
    const team = teamByDriverYear.get(`${season.year}:${season.driverId}`);
    return [{
      driver_id: season.driverId,
      year: season.year,
      constructor_id: known(team?.constructorId, constructorIds),
      position: season.positionNumber,
      position_text: clip(season.positionText || '–', 8),
      points: season.totalPoints,
      wins: season.totalRaceWins,
      podiums: season.totalPodiums,
      poles: season.totalPolePositions,
      fastest_laps: season.totalFastestLaps,
      starts: season.totalRaceStarts,
      entries: season.totalRaceEntries,
      race_laps: season.totalRaceLaps,
      sprint_starts: season.totalSprintRaceStarts,
      sprint_wins: season.totalSprintRaceWins,
      driver_of_the_day: season.totalDriverOfTheDay,
      best_race_result: season.bestRaceResult,
      best_grid: season.bestStartingGridPosition,
    }];
  });

  const constructorSeasonRows = constructorSeasons.flatMap((season) => {
    if (!constructorIds.has(season.constructorId)) return [];
    return [{
      constructor_id: season.constructorId,
      year: season.year,
      position: season.positionNumber,
      position_text: clip(season.positionText || '–', 8),
      points: season.totalPoints,
      wins: season.totalRaceWins,
      podiums: season.totalPodiums,
      podium_races: season.totalPodiumRaces,
      poles: season.totalPolePositions,
      fastest_laps: season.totalFastestLaps,
      starts: season.totalRaceStarts,
      entries: season.totalRaceEntries,
      one_twos: season.total1And2Finishes,
      sprint_starts: season.totalSprintRaceStarts,
      sprint_wins: season.totalSprintRaceWins,
      best_race_result: season.bestRaceResult,
      best_grid: season.bestStartingGridPosition,
    }];
  });

  console.log(`Historique : ${raceRows.length} GP, ${driverSeasonRows.length} saisons pilotes, ${constructorSeasonRows.length} saisons écuries…`);
  await prisma.$transaction(async (tx) => {
    await tx.raceRecord.deleteMany();
    await tx.driverSeasonStat.deleteMany();
    await tx.constructorSeasonStat.deleteMany();
    for (let offset = 0; offset < constructorSeasonRows.length; offset += 500) {
      await tx.constructorSeasonStat.createMany({ data: constructorSeasonRows.slice(offset, offset + 500) });
    }
    for (let offset = 0; offset < driverSeasonRows.length; offset += 500) {
      await tx.driverSeasonStat.createMany({ data: driverSeasonRows.slice(offset, offset + 500) });
    }
    for (let offset = 0; offset < raceRows.length; offset += 400) {
      await tx.raceRecord.createMany({ data: raceRows.slice(offset, offset + 400) });
    }
  }, { timeout: 180_000 });

  const recentDriverIds = new Set(driverSeasons.filter((season) => season.year >= 2020).map((season) => season.driverId));
  const entities = await prisma.realEntity.findMany({ where: { sport: 'f1' }, select: { id: true, name: true, short_name: true } });
  let linked = 0;
  const identities = drivers.map((driver) => ({
    id: driver.id,
    full_name: driver.fullName,
    abbreviation: driver.abbreviation,
    total_race_starts: driver.totalRaceStarts,
  }));
  for (const entity of entities) {
    const choice = linkFantasyDriver(entity, identities, recentDriverIds);
    if (!choice) {
      console.warn(`Pilote fantasy non relié : ${entity.name} (${entity.short_name})`);
      continue;
    }
    await prisma.realEntity.update({ where: { id: entity.id }, data: { driver_id: choice } });
    linked += 1;
  }
  console.log(`${linked}/${entities.length} pilotes fantasy reliés au référentiel.`);

  const catalog: CircuitName[] = circuits.map((circuit) => ({
    id: circuit.id,
    full_name: circuit.fullName,
    name: circuit.name,
    previous_names: circuit.previousNames ?? [],
  }));
  const effectiveLayout = new Map(layouts.filter((layout) => layout.effective).map((layout) => [layout.circuitId, layout.id]));
  const gameweeks = await prisma.gameweek.findMany({ select: { id: true, season: true, name: true, circuit: true } });
  let linkedCircuits = 0;
  for (const gameweek of gameweeks) {
    const circuitId = matchCircuitId(gameweek.circuit, catalog);
    if (!circuitId) {
      console.warn(`GP non relié à un circuit : ${gameweek.name} (${gameweek.circuit})`);
      continue;
    }
    const raced = races.find((race) => race.year === gameweek.season && race.circuitId === circuitId);
    await prisma.gameweek.update({
      where: { id: gameweek.id },
      data: {
        circuit_id: circuitId,
        circuit_layout_id: raced?.circuitLayoutId ?? effectiveLayout.get(circuitId) ?? null,
      },
    });
    linkedCircuits += 1;
  }
  console.log(`${linkedCircuits}/${gameweeks.length} Grands Prix reliés à un circuit.`);

  console.log('Téléchargement des tracés SVG…');
  let stored = 0;
  let missing = 0;
  await eachLimit(layouts, 8, async (layout) => {
    const response = await fetch(`${F1_DATA_SOURCE.svgBaseUrl}/${layout.id}.svg`);
    if (!response.ok) {
      missing += 1;
      return;
    }
    const svg = normalizeTrackSvg(await response.text());
    if (!svg) {
      missing += 1;
      return;
    }
    await prisma.circuitLayout.update({ where: { id: layout.id }, data: { svg } });
    stored += 1;
    if (stored % 40 === 0) console.log(`  ${stored} tracés enregistrés`);
  });
  console.log(`Tracés : ${stored} enregistrés, ${missing} introuvables.`);

  await prisma.$disconnect();
  console.log('Référentiel F1 à jour.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
