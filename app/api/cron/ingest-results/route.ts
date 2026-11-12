import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ISO_TO_COUNTRY_NAME } from '@/lib/country-map';
import { bearerMatches } from '@/lib/cron-auth';
import { mapOfficialResult, type OpenF1SessionResult } from '@/lib/openf1-results';
import { syncGameweekStatuses } from '@/lib/sync-gameweeks';

const OPENF1_BASE = 'https://api.openf1.org/v1';

interface OpenF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  country_name: string;
  circuit_short_name: string;
  year: number;
}

interface OpenF1Driver {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  team_name: string;
}

interface OpenF1StartingGrid {
  driver_number: number;
  position: number;
}

interface OpenF1Lap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  is_pit_out_lap: boolean;
}

/** Fetch JSON depuis OpenF1 avec gestion d'erreur. Retourne [] si échec. */
async function openf1Fetch<T>(path: string): Promise<T[]> {
  try {
    const res = await fetch(`${OPENF1_BASE}${path}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** Convertit un code ISO pays en nom OpenF1. */
function countryNameForOpenF1(isoCode: string | null): string {
  if (!isoCode) return '';
  return ISO_TO_COUNTRY_NAME[isoCode] ?? isoCode;
}

/**
 * Trouve la session la plus proche de la date de course parmi les résultats OpenF1.
 * Gère les pays avec plusieurs GP (Italie x2, USA x3).
 */
function findClosestSession(sessions: OpenF1Session[], raceDate: Date): OpenF1Session | null {
  if (sessions.length === 0) return null;
  if (sessions.length === 1) return sessions[0];

  return sessions.reduce((closest, session) => {
    const diffCurrent = Math.abs(new Date(session.date_start).getTime() - raceDate.getTime());
    const diffClosest = Math.abs(new Date(closest.date_start).getTime() - raceDate.getTime());
    return diffCurrent < diffClosest ? session : closest;
  });
}

/**
 * Trouve le pilote ayant le meilleur tour (lap_duration le plus bas).
 * Ignore les pit out laps et les laps sans durée.
 */
function findFastestLapDriver(laps: OpenF1Lap[]): number | null {
  let bestTime = Infinity;
  let bestDriver: number | null = null;

  for (const lap of laps) {
    if (lap.is_pit_out_lap || lap.lap_duration === null || lap.lap_duration <= 0) continue;
    if (lap.lap_duration < bestTime) {
      bestTime = lap.lap_duration;
      bestDriver = lap.driver_number;
    }
  }

  return bestDriver;
}

/**
 * Logique d'ingestion d'un GP unique.
 * Retourne un résumé ou null si rien à ingérer.
 */
async function ingestGameweek(gameweekId: string) {
  const gameweek = await prisma.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gameweek) return null;

  const countryName = encodeURIComponent(countryNameForOpenF1(gameweek.country));

  // 1. Trouver les sessions Race et Qualifying sur OpenF1
  const [raceSessions, qualifSessions] = await Promise.all([
    openf1Fetch<OpenF1Session>(`/sessions?year=${gameweek.season}&session_type=Race&country_name=${countryName}`),
    openf1Fetch<OpenF1Session>(`/sessions?year=${gameweek.season}&session_type=Qualifying&country_name=${countryName}`),
  ]);

  if (raceSessions.length === 0) return null;

  // Désambiguer si plusieurs GP dans le même pays (IT x2, US x3)
  const raceSession = findClosestSession(raceSessions, gameweek.race_date)!;
  const qualifSession = findClosestSession(qualifSessions, gameweek.race_date);

  // 2. Récupérer en parallèle les données
  const [raceResults, openf1Drivers, startingGrid, qualifResults, laps] = await Promise.all([
    openf1Fetch<OpenF1SessionResult>(`/session_result?session_key=${raceSession.session_key}`),
    openf1Fetch<OpenF1Driver>(`/drivers?session_key=${raceSession.session_key}`),
    openf1Fetch<OpenF1StartingGrid>(`/starting_grid?session_key=${raceSession.session_key}`),
    qualifSession
      ? openf1Fetch<OpenF1SessionResult>(`/session_result?session_key=${qualifSession.session_key}`)
      : Promise.resolve([] as OpenF1SessionResult[]),
    openf1Fetch<OpenF1Lap>(`/laps?session_key=${raceSession.session_key}`),
  ]);

  if (raceResults.length === 0) return null;

  const gridPositions = new Map<number, number>();
  for (const g of startingGrid) {
    gridPositions.set(g.driver_number, g.position);
  }

  const finalQualifPositions = new Map<number, number>();
  for (const pos of qualifResults) {
    if (pos.position !== null) finalQualifPositions.set(pos.driver_number, pos.position);
  }

  const fastestLapDriver = findFastestLapDriver(laps);

  // Mapping driver_number → acronym
  const driverNumberToAcronym = new Map<number, string>();
  for (const d of openf1Drivers) {
    driverNumberToAcronym.set(d.driver_number, d.name_acronym);
  }

  // 3. Mapper sur nos real_entities
  const ourDrivers = await prisma.realEntity.findMany({
    where: { sport: 'f1', active: true },
  });
  const shortNameToEntity = new Map(ourDrivers.map((d) => [d.short_name, d]));

  let ingested = 0;

  for (const raceResult of raceResults) {
    const driverNumber = raceResult.driver_number;
    const acronym = driverNumberToAcronym.get(driverNumber);
    if (!acronym) continue;

    const entity = shortNameToEntity.get(acronym);
    if (!entity) continue;

    const qualifPos = finalQualifPositions.get(driverNumber) ?? null;
    const gridPos = gridPositions.get(driverNumber) ?? null;
    const results = mapOfficialResult({
      race: raceResult,
      qualifyingPosition: qualifPos,
      gridPosition: gridPos,
      fastestLap: fastestLapDriver === driverNumber,
    });

    await prisma.performance.upsert({
      where: {
        gameweek_id_real_entity_id: {
          gameweek_id: gameweekId,
          real_entity_id: entity.id,
        },
      },
      update: { results: results as object },
      create: { gameweek_id: gameweekId, real_entity_id: entity.id, results: results as object },
    });

    ingested++;
  }

  // Marquer le GP comme completed
  await prisma.gameweek.update({
    where: { id: gameweekId },
    data: { status: 'completed' },
  });

  return {
    gameweek_id: gameweekId,
    name: gameweek.name,
    openf1_session_key: raceSession.session_key,
    qualif_session_key: qualifSession?.session_key ?? null,
    drivers_ingested: ingested,
    total_drivers_found: raceResults.length,
  };
}

// ─── Handlers ─────────────────────────────────────────

/**
 * GET /api/cron/ingest-results
 *
 * Handler pour les crons Vercel (GET).
 * Auto-détecte les GP à ingérer : course passée, pas encore de performances.
 */
export async function GET(req: NextRequest) {
  if (!bearerMatches(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    await syncGameweekStatuses(2026);

    // 2. Trouver les GP qui ont besoin d'ingestion :
    //    course passée + status completed + pas de performances enregistrées
    const now = new Date();
    const candidates = await prisma.gameweek.findMany({
      where: {
        season: 2026,
        race_date: { lte: now },
        status: { notIn: ['cancelled', 'upcoming'] },
      },
      include: { _count: { select: { performances: true } } },
      orderBy: { round_number: 'asc' },
    });

    const toIngest = candidates.filter((gw) => gw._count.performances === 0);

    if (toIngest.length === 0) {
      return NextResponse.json({ message: 'Aucun GP à ingérer', candidates_checked: candidates.length });
    }

    const results = [];
    for (const gw of toIngest) {
      const result = await ingestGameweek(gw.id);
      if (result) results.push(result);
    }

    return NextResponse.json({
      message: `Ingestion terminée`,
      gameweeks_ingested: results.length,
      details: results,
    });
  } catch (error) {
    console.error('GET /api/cron/ingest-results:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/cron/ingest-results
 *
 * Handler pour appels manuels avec un gameweek_id spécifique.
 * Body: { gameweek_id: string }
 */
export async function POST(req: NextRequest) {
  if (!bearerMatches(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { gameweek_id } = body;

    if (!gameweek_id) {
      return NextResponse.json({ message: 'gameweek_id requis' }, { status: 400 });
    }

    const result = await ingestGameweek(gameweek_id);
    if (!result) {
      return NextResponse.json({ message: 'GP introuvable ou aucune session Race sur OpenF1' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Ingestion terminée', ...result });
  } catch (error) {
    console.error('POST /api/cron/ingest-results:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
